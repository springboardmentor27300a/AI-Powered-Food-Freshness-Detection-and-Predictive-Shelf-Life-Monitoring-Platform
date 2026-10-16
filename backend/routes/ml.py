from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt as jose_jwt
import numpy as np
import io
import os
import logging
import uuid

try:
    import tensorflow as tf
except ImportError:
    tf = None

from ml.shelf_life import predict_shelf_life
from ml.recommendations import generate_recommendations
from ml.alert_helpers import generate_alerts
from database import (
    analysis_collection, prediction_collection, recommendation_collection,
    report_collection, food_item_collection, batch_collection, user_collection,
)
from dependencies import (get_current_user, require_roles, serialize_doc, to_object_id,
                          SECRET_KEY, ALGORITHM, bearer_scheme, user_collection)

logger = logging.getLogger("ml_inference")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)
if not logger.handlers:
    logger.addHandler(ch)

router = APIRouter()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "freshness_model.keras")
UPLOAD_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "uploads", "scans"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Ensure this is exactly the order of train_ds.class_names
CLASSES = [
    "FreshApple", "FreshBanana", "FreshBellpepper", "FreshCarrot",
    "FreshCucumber", "FreshMango", "FreshOrange", "FreshPotato",
    "FreshStrawberry", "FreshTomato", "RottenApple", "RottenBanana",
    "RottenBellpepper", "RottenCarrot", "RottenCucumber", "RottenMango",
    "RottenOrange", "RottenPotato", "RottenStrawberry", "RottenTomato"
]

# Map food types recognized by the model to platform inventory categories
FOOD_TYPE_CATEGORY = {
    "Apple": "Fruits", "Banana": "Fruits", "Mango": "Fruits",
    "Orange": "Fruits", "Strawberry": "Fruits",
    "Bellpepper": "Vegetables", "Carrot": "Vegetables",
    "Cucumber": "Vegetables", "Potato": "Vegetables", "Tomato": "Vegetables",
}

model = None
if tf is not None:
    if os.path.exists(MODEL_PATH):
        logger.info(f"Loading model exactly once from: {MODEL_PATH}")
        model = tf.keras.models.load_model(MODEL_PATH)
        logger.info("Model loaded successfully.")
    else:
        logger.warning(f"Warning: Model not found at {MODEL_PATH}")


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    try:
        # Keep pixel values at 0-255 because preprocess_input is built into the model
        img = tf.keras.utils.load_img(io.BytesIO(image_bytes), target_size=(224, 224), color_mode='rgb')
        img_array = tf.keras.utils.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        raise ValueError(f"Image preprocessing failed: {str(e)}")


@router.get("/scans")
async def list_scans(limit: int = 50, user: dict = Depends(get_current_user)):
    """Persisted scan history. Staff see all scans; consumers see scans of their own items."""
    query: dict = {}
    if user["role"] == "Consumer":
        query["$or"] = [{"scanned_by": str(user["_id"])}, {"owner_id": str(user["_id"])}]
    scans = []
    cursor = analysis_collection.find(query).sort("scanned_at", -1).limit(min(limit, 200))
    async for document in cursor:
        scans.append(serialize_doc(document))
    return scans


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str, user: dict = Depends(get_current_user)):
    doc = await analysis_collection.find_one({"_id": to_object_id(scan_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")
    if user["role"] == "Consumer" and str(doc.get("scanned_by")) != str(user["_id"]) \
            and str(doc.get("owner_id")) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Not your scan")
    return serialize_doc(doc)


@router.get("/scans/image/{filename}")
async def scan_image(filename: str,
                     credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
                     token: str = Query(None)):
    """Serve a persisted scan image to authenticated users.

    Auth is accepted via the Authorization header OR a signed ?token= query
    parameter (the latter lets <img> tags work while keeping the endpoint
    private). Filenames are random UUIDs (unguessable).
    """
    jwt_token = credentials.credentials if credentials is not None else token
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jose_jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username or await user_collection.find_one({"username": username}) is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    safe = Path(filename).name
    path = UPLOAD_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.post("/predict")
async def predict_freshness(
    file: UploadFile = File(...),
    item_id: str = Form(None),
    temperature_c: float = Form(None),
    humidity_pct: float = Form(None),
    packaging_type: str = Form(None),
    user: dict = Depends(require_roles("Consumer", "Retail Manager", "Warehouse Operator",
                                       "Food Quality Inspector")),
):
    """
    Full AI inspection pipeline, linked to a real inventory item and fully persisted:
    1. CNN freshness classification + OpenCV heuristics (Milestone 2, unchanged)
    2. Combined quality scoring (Milestone 2)
    3. Shelf-life estimation (Milestone 3, parametric - duration-subtracted)
    4. Recommendations + alerts + persistent report
    """
    if tf is None:
        raise HTTPException(status_code=500, detail="TensorFlow is not installed on the server.")
    if model is None:
        raise HTTPException(status_code=500, detail="Model file could not be found or loaded.")

    contents = await file.read()

    item = None
    batch = None
    if item_id:
        item = await food_item_collection.find_one({"_id": to_object_id(item_id)})
        if not item:
            raise HTTPException(status_code=404, detail="Linked inventory item not found")
        if user["role"] == "Consumer" and item.get("created_by") != str(user["_id"]):
            raise HTTPException(status_code=403, detail="Not your inventory item")
        if item.get("status") and item["status"] != "Active":
            raise HTTPException(status_code=409, detail=f"Item is {item['status']}; scans are only for active inventory")
        batch = await batch_collection.find_one(
            {"item_id": item["_id"], "batch_number": item.get("batch_number")})

    try:
        img_array = preprocess_image(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    predictions = model.predict(img_array)[0]
    top_5_indices = np.argsort(predictions)[-5:][::-1]
    logger.info("=== Top 5 Predictions ===")
    for i in top_5_indices:
        logger.info(f"Class: {CLASSES[i]} | Probability: {predictions[i]:.4f}")
    logger.info("=========================")

    predicted_class_index = int(np.argmax(predictions))
    confidence = float(predictions[predicted_class_index])
    predicted_class_name = CLASSES[predicted_class_index]

    if predicted_class_name.startswith("Fresh"):
        status = "Fresh"
        food_type = predicted_class_name.replace("Fresh", "")
        freshness_score = confidence * 100
    elif predicted_class_name.startswith("Rotten"):
        status = "Rotten"
        food_type = predicted_class_name.replace("Rotten", "")
        freshness_score = (1.0 - confidence) * 100
    else:
        status = "Unknown"
        food_type = "Unknown"
        freshness_score = 0.0

    freshness_score = round(max(0.0, min(100.0, freshness_score)))

    image_analysis = None
    quality_assessment = None
    try:
        from ml.image_analysis import analyze_image
        from ml.quality_scoring import calculate_quality_score

        image_analysis = analyze_image(contents)
        quality_assessment = calculate_quality_score(
            ml_status=status,
            ml_confidence=confidence,
            ml_freshness_score=float(freshness_score),
            cv_analysis=image_analysis,
        )
    except Exception as cv_error:
        logger.warning(f"CV analysis/quality scoring failed: {cv_error}")

    quality_score = (
        quality_assessment["quality_score"] if quality_assessment else float(freshness_score)
    )

    category = (item.get("category") if item else None) or FOOD_TYPE_CATEGORY.get(food_type, "Packaged Foods")
    scan_payload = {
        "item_id": str(item["_id"]) if item else None,
        "batch_id": str(batch["_id"]) if batch else None,
        "name": (item.get("name") if item else None) or food_type,
        "category": category,
        "quantity": (item.get("active_quantity") if item.get("active_quantity") is not None else item.get("quantity")) if item else None,
        "batch_number": item.get("batch_number") if item else None,
        "quality_score": quality_score,
        "ml_status": status,
        "temperature_c": temperature_c if temperature_c is not None else (item.get("temperature_c") if item else None),
        "humidity_pct": humidity_pct if humidity_pct is not None else (item.get("humidity_pct") if item else None),
        "packaging_type": packaging_type or (item.get("packaging_type") if item else None),
        "stored_at": (item.get("stored_at") or item.get("created_at")) if item else None,
        "expiry_date": item.get("expiry_date") if item else None,
        "storage_zone": item.get("storage_zone") if item else None,
    }

    now = datetime.now(timezone.utc)

    image_filename = f"{uuid.uuid4().hex}.jpg"
    image_path = UPLOAD_DIR / image_filename
    try:
        with open(image_path, "wb") as f:
            f.write(contents)
    except Exception as persist_error:
        logger.warning(f"Failed to persist scan image: {persist_error}")
        image_filename = None

    analysis_doc = {
        "item_id": str(item["_id"]) if item else None,
        "batch_id": str(batch["_id"]) if batch else None,
        "owner_id": str(item["created_by"]) if item else str(user["_id"]),
        "image_filename": image_filename,
        "image_url": f"/api/ml/scans/image/{image_filename}" if image_filename else None,
        "food_type": food_type,
        "class_name": predicted_class_name,
        "ml_status": status,
        "confidence": round(confidence, 4),
        "freshness_score": freshness_score,
        "quality_score": quality_score,
        "quality_category": quality_assessment.get("quality_category") if quality_assessment else None,
        "image_analysis": image_analysis,
        "quality_assessment": quality_assessment,
        "category": category,
        "scanned_by": str(user["_id"]),
        "scanned_by_username": user["username"],
        "scanned_at": now,
    }
    analysis_result = await analysis_collection.insert_one(analysis_doc)
    analysis_id = str(analysis_result.inserted_id)

    shelf_life = None
    recommendations = None
    try:
        shelf_life = predict_shelf_life(scan_payload)
        prediction_doc = {
            "item_id": scan_payload["item_id"],
            "batch_id": scan_payload["batch_id"],
            "analysis_id": analysis_id,
            "requested_by": str(user["_id"]),
            "requested_by_username": user["username"],
            "inputs": {k: scan_payload.get(k) for k in (
                "category", "quality_score", "ml_status", "temperature_c",
                "humidity_pct", "packaging_type", "stored_at", "expiry_date")},
            "result": shelf_life,
            "predicted_at": now,
        }
        prediction_insert = await prediction_collection.insert_one(prediction_doc)
        shelf_life["prediction_id"] = str(prediction_insert.inserted_id)

        recommendations = generate_recommendations(scan_payload)
        await recommendation_collection.insert_one({
            "item_id": scan_payload["item_id"],
            "batch_id": scan_payload["batch_id"],
            "analysis_id": analysis_id,
            "generated_by": str(user["_id"]),
            "generated_at": now,
            "result": {
                "risk_level": shelf_life["risk_level"],
                "effective_remaining_days": shelf_life["effective_remaining_days"],
                "recommendations": recommendations["recommendations"],
            },
        })
    except Exception as m3_error:
        logger.warning(f"Shelf-life/recommendation generation failed: {m3_error}")

    report_id = None
    try:
        report_doc = {
            "created_by": str(user["_id"]),
            "created_by_username": user["username"],
            "created_at": now,
            "analysis_id": analysis_id,
            "prediction_id": shelf_life.get("prediction_id") if shelf_life else None,
            "item_id": scan_payload["item_id"],
            "batch_id": scan_payload["batch_id"],
            "item": {
                "name": scan_payload.get("name"),
                "category": category,
                "batch_number": scan_payload.get("batch_number"),
                "quantity": scan_payload.get("quantity"),
                "storage_zone": scan_payload.get("storage_zone"),
            },
            "analysis": serialize_doc(analysis_doc | {"_id": analysis_id}),
            "prediction": shelf_life,
            "recommendations": recommendations["recommendations"] if recommendations else None,
            "storage_assessment": recommendations.get("storage_assessment") if recommendations else None,
        }
        report_insert = await report_collection.insert_one(report_doc)
        report_id = str(report_insert.inserted_id)
        # link the report back onto the scan so View Report can load it from the DB
        await analysis_collection.update_one(
            {"_id": analysis_result.inserted_id}, {"$set": {"report_id": report_id}})
    except Exception as report_error:
        logger.warning(f"Failed to persist report: {report_error}")

    try:
        owner_role = None
        if item:
            from bson import ObjectId
            owner = await user_collection.find_one({"_id": ObjectId(item["created_by"])}) if item.get("created_by") else None
            owner_role = owner.get("role") if owner else None
        await generate_alerts(scan_payload, shelf_life,
                              recommendations.get("storage_assessment") if recommendations else None, user,
                              item_owner_role=owner_role)
    except Exception as alert_error:
        logger.warning(f"Alert generation failed: {alert_error}")

    if item:
        try:
            await food_item_collection.update_one(
                {"_id": item["_id"]},
                {"$set": {
                    "ml_status": status,
                    "quality_score": quality_score,
                    "quality_category": quality_assessment.get("quality_category") if quality_assessment else None,
                    "last_scan_id": analysis_id,
                    "last_scan_at": now,
                    "updated_at": now,
                }},
            )
        except Exception as update_error:
            logger.warning(f"Failed to refresh item with scan results: {update_error}")

    return {
        "analysis_id": analysis_id,
        "report_id": report_id,
        "item_id": scan_payload["item_id"],
        "batch_id": scan_payload["batch_id"],
        "class_name": predicted_class_name,
        "food_type": food_type,
        "status": status,
        "confidence": round(confidence, 4),
        "freshness_score": freshness_score,
        "image_url": f"/api/ml/scans/image/{image_filename}" if image_filename else None,
        "image_analysis": image_analysis,
        "quality_assessment": quality_assessment,
        "category": category,
        "shelf_life": shelf_life,
        "recommendations": recommendations["recommendations"] if recommendations else None,
        "storage_assessment": recommendations.get("storage_assessment") if recommendations else None,
    }
