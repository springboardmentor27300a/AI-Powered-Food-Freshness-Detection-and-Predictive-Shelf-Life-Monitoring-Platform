import shutil
import uuid
from pathlib import Path
from datetime import datetime, timezone, date, timedelta
from typing import Dict, Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from pydantic import BaseModel, Field

from backend.app.database import (
    get_inventory_collection,
    get_freshness_records_collection,
    get_storage_conditions_collection,
)
from backend.app.models.inventory_model import inventory_helper
from backend.app.ml.cv_analyzer import image_analyzer
from backend.app.ml.shelf_life_model import shelf_life_predictor
from backend.app.ml.recommendation_engine import recommendation_engine, FoodRecommendationEngine
from backend.app.ml.freshness_score_engine import freshness_scoring_engine
from backend.app.models.user_model import UserRole
from backend.app.utils.dependencies import get_current_user, get_current_user_optional
from backend.app.config import settings

router = APIRouter(tags=["AI Freshness, Spoilage & Shelf-Life Inference"])


class FreshnessAnalysisRequest(BaseModel):
    inventory_id: str = Field(..., description="Target inventory item ID")
    image_url: Optional[str] = Field(None, description="Image URL or relative path")


class SpoilageDetectionRequest(BaseModel):
    inventory_id: str = Field(..., description="Target inventory item ID")
    gas_sensor_ppm: Optional[float] = Field(None, description="Ethylene / VOC gas sensor ppm reading")


class ShelfLifePredictionRequest(BaseModel):
    inventory_id: str = Field(..., description="Target inventory item ID")
    current_temp: Optional[float] = Field(None, description="Ambient temperature override in Celsius")
    current_humidity: Optional[float] = Field(None, description="Ambient relative humidity override")
    packaging_type: Optional[str] = Field("Standard Pack", description="Packaging type barrier factor")


class ShelfLifeSimulationRequest(BaseModel):
    category: str = Field("Fruits", description="Food category")
    food_name: Optional[str] = Field("Food Item", description="Food item name")
    storage_temperature: float = Field(4.0, description="Ambient storage temperature in Celsius")
    storage_humidity: float = Field(85.0, description="Relative humidity percentage")
    current_freshness_score: float = Field(90.0, ge=0.0, le=100.0, description="Current visual or composite freshness score")
    packaging_type: Optional[str] = Field("Standard Pack", description="Packaging type barrier factor")


class StorageConditionLogRequest(BaseModel):
    inventory_id: str = Field(..., description="Target inventory item ID")
    temperature: float = Field(..., description="Current temperature in Celsius")
    humidity: float = Field(..., description="Current relative humidity percentage")
    storage_location: Optional[str] = Field("Main Storage", description="Storage bay / chamber tag")
    air_circulation: Optional[str] = Field("Standard", description="Air circulation environment (Low, Standard, High)")
    light_exposure: Optional[str] = Field("Dark", description="Light exposure environment (Dark, Diffused, Direct Sunlight)")
    storage_duration_hours: Optional[float] = Field(None, description="Elapsed hours in current storage environment")


@router.post(
    "/freshness/analyze",
    summary="Execute AI Computer Vision Freshness Classification on a Food Sample"
)
async def analyze_freshness(
    data: FreshnessAnalysisRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes live Computer Vision analysis on the target food inventory item.
    Calculates visual quality score (0-100%), discrete classification label,
    spoilage probability, detects mold/bruising/damage, updates MongoDB inventory,
    and inserts a record in freshness_records.
    """
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()

    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    # Locate inventory item
    try:
        oid = ObjectId(data.inventory_id)
        item = inv_col.find_one({"_id": oid})
    except Exception:
        item = inv_col.find_one({"_id": data.inventory_id})

    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item '{data.inventory_id}' not found.")

    # Image source resolution
    img_ref = data.image_url or item.get("image_url")
    image_file_path = None
    if img_ref:
        s = img_ref.strip()
        if s.startswith(("http://", "https://")):
            try:
                import httpx
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FoodFreshnessScanner/1.0"}
                with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
                    resp = client.get(s)
                    if resp.status_code == 200 and len(resp.content) > 0:
                        content_type = resp.headers.get("content-type", "").lower()
                        ext = ".jpg"
                        if "png" in content_type or ".png" in s.lower(): ext = ".png"
                        elif "webp" in content_type or ".webp" in s.lower(): ext = ".webp"
                        filename = f"food_{uuid.uuid4().hex[:12]}{ext}"
                        save_path = settings.UPLOAD_DIR / filename
                        with open(save_path, "wb") as f:
                            f.write(resp.content)
                        image_file_path = str(save_path)
                        img_ref = f"/uploads/{filename}"
                    else:
                        image_file_path = s
            except Exception:
                image_file_path = s
        elif s.startswith("data:image/"):
            try:
                import base64
                header, b64_str = s.split(",", 1)
                ext = ".png" if "png" in header else ".webp" if "webp" in header else ".jpg"
                filename = f"food_{uuid.uuid4().hex[:12]}{ext}"
                save_path = settings.UPLOAD_DIR / filename
                with open(save_path, "wb") as f:
                    f.write(base64.b64decode(b64_str))
                image_file_path = str(save_path)
                img_ref = f"/uploads/{filename}"
            except Exception:
                image_file_path = s
        else:
            clean_ref = img_ref.lstrip("/").replace("uploads/", "")
            candidate_path = settings.UPLOAD_DIR / clean_ref
            if candidate_path.exists():
                image_file_path = str(candidate_path)

    # Execute Computer Vision Model
    cv_result = image_analyzer.analyze_image(
        image_input=image_file_path if image_file_path else (img_ref if img_ref else b""),
        category=item.get("category", "Fruits")
    )

    # Execute Arrhenius Shelf Life Kinetics
    shelf_res = shelf_life_predictor.predict_shelf_life(
        category=item.get("category", "Fruits"),
        purchase_date_val=item.get("purchase_date"),
        expiry_date_val=item.get("expiry_date"),
        storage_temperature=item.get("storage_temperature"),
        storage_humidity=item.get("storage_humidity"),
        current_freshness_score=cv_result.get("visual_score", 75.0),
    )

    # Execute Authoritative 4-Pillar Weighted Freshness Scoring Model
    weighted_res = freshness_scoring_engine.calculate_weighted_freshness(
        visual_score=cv_result.get("visual_score", 75.0),
        category=item.get("category", "Fruits"),
        purchase_date_val=item.get("purchase_date"),
        expiry_date_val=item.get("expiry_date"),
        storage_temperature=item.get("storage_temperature"),
        storage_humidity=item.get("storage_humidity"),
        air_circulation=item.get("air_circulation", "Standard"),
        light_exposure=item.get("light_exposure", "Dark"),
        predicted_remaining_days=shelf_res.get("predicted_remaining_days"),
        mold_detected=cv_result.get("mold_detected", False),
    )

    final_score = weighted_res["composite_freshness_score"]
    final_label = weighted_res["freshness_category"]
    overall_health = weighted_res["overall_food_health_score"]
    confidence = weighted_res["confidence_score"]
    spoilage_prob = weighted_res["spoilage_probability"]

    now = datetime.now(timezone.utc)

    # Atomically update inventory item
    inv_col.update_one(
        {"_id": item["_id"]},
        {"$set": {
            "freshness_status": cv_result["freshness_label"],
            "freshness_score": cv_result["visual_score"],
            "composite_freshness_score": final_score,
            "freshness_category": final_label,
            "overall_food_health_score": overall_health,
            "image_url": img_ref,
            "updated_at": now,
        }}
    )

    # Insert historical freshness record
    fresh_record = {
        "user_id": item.get("user_id") or current_user.get("_id"),
        "inventory_id": item["_id"],
        "food_name": item.get("food_name", "Food Item"),
        "category": item.get("category", "General"),
        "image_url": img_ref,
        "freshness_score": final_score,
        "composite_freshness_score": final_score,
        "freshness_label": final_label,
        "freshness_category": final_label,
        "confidence": confidence,
        "overall_food_health_score": overall_health,
        "sub_scores": weighted_res["sub_scores"],
        "spoilage_probability": spoilage_prob,
        "estimated_shelf_life_days": shelf_res.get("predicted_remaining_shelf_life_days", 7.0),
        "detected_defects": cv_result["detected_defects"],
        "mold_detected": cv_result["mold_detected"],
        "bruising_detected": cv_result["bruising_detected"],
        "color_score": cv_result["color_score"],
        "texture_score": cv_result["texture_score"],
        "model_version": cv_result["model_version"],
        "analysis_date": now,
    }
    fresh_col.insert_one(fresh_record)

    return {
        "success": True,
        "inventory_id": str(item["_id"]),
        "food_name": item.get("food_name"),
        "freshness_score": final_score,
        "composite_freshness_score": final_score,
        "freshness_status": final_label,
        "freshness_category": final_label,
        "overall_food_health_score": overall_health,
        "sub_scores": weighted_res["sub_scores"],
        "confidence": confidence,
        "confidence_score": confidence,
        "spoilage_probability": spoilage_prob,
        "is_safe_for_consumption": weighted_res["is_safe_for_consumption"],
        "estimated_shelf_life_days": shelf_res.get("predicted_remaining_shelf_life_days", 7.0),
        "analysis": cv_result,
        "updated_inventory": {
            "freshness_status": cv_result["freshness_label"],
            "freshness_score": cv_result["visual_score"],
            "composite_freshness_score": final_score,
            "freshness_category": final_label,
            "image_url": img_ref,
        }
    }


@router.post(
    "/freshness/quick-scan",
    summary="Instant AI Food Freshness & Shelf-Life Scan via Device Upload or Image Address"
)
async def quick_scan_food(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    category: str = Form("Fruits"),
    food_name: Optional[str] = Form("Food Item"),
    storage_temperature: Optional[float] = Form(None),
    storage_humidity: Optional[float] = Form(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Executes live Computer Vision analysis and Arrhenius shelf-life prediction
    on a food image provided from either the device (file upload) or
    an image address / URL.
    """
    image_reference = image_url
    image_file_path = None

    if file and file.filename:
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format '{file_ext}'. Allowed: .jpg, .jpeg, .png, .webp."
            )
        filename = f"scan_{uuid.uuid4().hex[:12]}{file_ext}"
        save_path = settings.UPLOAD_DIR / filename
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_reference = f"/uploads/{filename}"
        image_file_path = str(save_path)
    elif image_url:
        s = image_url.strip()
        if s.startswith(("http://", "https://")):
            try:
                import httpx
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FoodFreshnessScanner/1.0"}
                with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
                    resp = client.get(s)
                    if resp.status_code == 200 and len(resp.content) > 0:
                        content_type = resp.headers.get("content-type", "").lower()
                        ext = ".jpg"
                        if "png" in content_type or ".png" in s.lower(): ext = ".png"
                        elif "webp" in content_type or ".webp" in s.lower(): ext = ".webp"
                        filename = f"scan_{uuid.uuid4().hex[:12]}{ext}"
                        save_path = settings.UPLOAD_DIR / filename
                        with open(save_path, "wb") as f:
                            f.write(resp.content)
                        image_reference = f"/uploads/{filename}"
                        image_file_path = str(save_path)
                    else:
                        image_file_path = s
            except Exception:
                image_file_path = s
        elif s.startswith("data:image/"):
            try:
                import base64
                header, b64_str = s.split(",", 1)
                ext = ".png" if "png" in header else ".webp" if "webp" in header else ".jpg"
                filename = f"scan_{uuid.uuid4().hex[:12]}{ext}"
                save_path = settings.UPLOAD_DIR / filename
                with open(save_path, "wb") as f:
                    f.write(base64.b64decode(b64_str))
                image_reference = f"/uploads/{filename}"
                image_file_path = str(save_path)
            except Exception:
                image_file_path = s
        else:
            clean_ref = image_url.lstrip("/").replace("uploads/", "")
            cand = settings.UPLOAD_DIR / clean_ref
            if cand.exists():
                image_file_path = str(cand)

    # 1. Computer Vision Diagnostic
    cv_result = image_analyzer.analyze_image(
        image_input=image_file_path if image_file_path else (image_url if image_url else b""),
        category=category
    )

    visual_score = float(cv_result.get("visual_score", 75.0))
    freshness_label = cv_result.get("freshness_label", "Fresh")

    # 2. Arrhenius Shelf Life Kinetics
    today = date.today()
    default_expiry = today + timedelta(days=14)
    shelf_res = shelf_life_predictor.predict_shelf_life(
        category=category,
        purchase_date_val=today,
        expiry_date_val=default_expiry,
        storage_temperature=storage_temperature,
        storage_humidity=storage_humidity,
        current_freshness_score=visual_score,
    )

    # 3. Authoritative 4-Pillar Weighted Freshness Scoring Engine
    weighted_res = freshness_scoring_engine.calculate_weighted_freshness(
        visual_score=visual_score,
        category=category,
        purchase_date_val=today,
        expiry_date_val=default_expiry,
        storage_temperature=storage_temperature,
        storage_humidity=storage_humidity,
        predicted_remaining_days=shelf_res.get("predicted_remaining_days"),
        mold_detected=cv_result.get("mold_detected", False),
    )

    final_score = weighted_res["composite_freshness_score"]
    final_label = weighted_res["freshness_category"]
    overall_health = weighted_res["overall_food_health_score"]
    confidence = weighted_res["confidence_score"]
    spoilage_prob = weighted_res["spoilage_probability"]

    risk_level = "Critical" if final_score < 40.0 or cv_result.get("mold_detected") else "High" if final_score < 55.0 else "Medium" if final_score < 70.0 else "Low"

    user_id = current_user.get("_id") if current_user else None
    inserted_id = None

    # Persist quick-scan diagnostic into freshness records collection
    fresh_col = get_freshness_records_collection()
    if fresh_col is not None:
        try:
            ins = fresh_col.insert_one({
                "user_id": user_id,
                "food_name": food_name or "Food Item",
                "category": category,
                "image_url": image_reference,
                "freshness_score": final_score,
                "composite_freshness_score": final_score,
                "freshness_label": final_label,
                "freshness_category": final_label,
                "confidence": confidence,
                "overall_food_health_score": overall_health,
                "sub_scores": weighted_res["sub_scores"],
                "spoilage_probability": spoilage_prob,
                "spoilage_risk_level": risk_level,
                "estimated_shelf_life_days": shelf_res.get("predicted_remaining_shelf_life_days", 7.0),
                "detected_defects": cv_result.get("detected_defects", []),
                "mold_detected": cv_result.get("mold_detected", False),
                "bruising_detected": cv_result.get("bruising_detected", False),
                "color_score": cv_result.get("color_score"),
                "texture_score": cv_result.get("texture_score"),
                "model_version": cv_result.get("model_version", "cv-arrhenius-v2.4"),
                "analysis_date": datetime.now(timezone.utc),
            })
            inserted_id = str(ins.inserted_id)
        except Exception:
            pass

    return {
        "success": True,
        "id": inserted_id,
        "user_id": str(user_id) if user_id else None,
        "food_name": food_name or "Food Item",
        "category": category,
        "image_reference": image_reference,
        "image_url": image_reference,
        "visual_score": visual_score,
        "freshness_score": final_score,
        "composite_freshness_score": final_score,
        "freshness_label": final_label,
        "freshness_category": final_label,
        "overall_food_health_score": overall_health,
        "sub_scores": weighted_res["sub_scores"],
        "confidence": confidence,
        "confidence_score": confidence,
        "spoilage_probability": spoilage_prob,
        "spoilage_risk_level": risk_level,
        "is_safe_for_consumption": weighted_res["is_safe_for_consumption"],
        "estimated_shelf_life_days": shelf_res.get("predicted_remaining_shelf_life_days", 7.0),
        "detected_defects": cv_result.get("detected_defects", []),
        "color_score": cv_result.get("color_score"),
        "texture_score": cv_result.get("texture_score"),
        "browning_index": cv_result.get("browning_index"),
        "roughness_index": cv_result.get("roughness_index"),
        "mold_detected": cv_result.get("mold_detected", False),
        "bruising_detected": cv_result.get("bruising_detected", False),
    }


@router.post(
    "/spoilage/detect",
    summary="Detect Spoilage Indicators and Microbial Risk"
)
async def detect_spoilage(
    data: SpoilageDetectionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Evaluates spoilage probability combining visual quality indicators and gas sensor readings.
    """
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(data.inventory_id)
        item = inv_col.find_one({"_id": oid})
    except Exception:
        item = inv_col.find_one({"_id": data.inventory_id})

    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item '{data.inventory_id}' not found.")

    score = float(item.get("freshness_score") or 85.0)
    gas_ppm = data.gas_sensor_ppm or 0.0

    # Spoilage calculation: baseline from score plus penalty for high VOC/ethylene (> 15 ppm)
    base_spoilage = max(0.0, min(1.0, (100.0 - score) / 100.0))
    gas_penalty = min(0.35, (gas_ppm / 100.0)) if gas_ppm > 15.0 else 0.0
    combined_risk = round(min(1.0, base_spoilage + gas_penalty), 2)

    risk_level = "Critical" if combined_risk >= 0.65 else "Moderate" if combined_risk >= 0.35 else "Low"

    return {
        "inventory_id": str(item["_id"]),
        "food_name": item.get("food_name"),
        "spoilage_probability": combined_risk,
        "spoilage_risk_level": risk_level,
        "gas_sensor_ppm": gas_ppm,
        "visual_score": score,
        "is_safe_for_consumption": combined_risk < 0.60
    }


@router.post(
    "/shelf-life/predict",
    summary="Predict Remaining Shelf Life using Arrhenius Kinetic Decay Modeling"
)
async def predict_shelf_life(
    data: ShelfLifePredictionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes Arrhenius temperature acceleration modeling to predict remaining days
    of safe shelf life and generates a 7-day forward risk trajectory.
    """
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(data.inventory_id)
        item = inv_col.find_one({"_id": oid})
    except Exception:
        item = inv_col.find_one({"_id": data.inventory_id})

    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item '{data.inventory_id}' not found.")

    temp = data.current_temp if data.current_temp is not None else item.get("storage_temperature")
    humidity = data.current_humidity if data.current_humidity is not None else item.get("storage_humidity")
    score = float(item.get("freshness_score") or 85.0)

    prediction = shelf_life_predictor.predict_shelf_life(
        category=item.get("category", "Fruits"),
        purchase_date_val=item.get("purchase_date", ""),
        expiry_date_val=item.get("expiry_date", ""),
        storage_temperature=temp,
        storage_humidity=humidity,
        packaging_type=data.packaging_type or "Standard Pack",
        current_freshness_score=score,
    )

    return {
        "inventory_id": str(item["_id"]),
        "food_name": item.get("food_name"),
        "prediction": prediction,
    }


@router.post(
    "/storage/conditions",
    summary="Ingest Environmental Sensor Reading for an Inventory Item"
)
async def log_storage_conditions(
    data: StorageConditionLogRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Logs time-series temperature and humidity conditions into the storage_conditions collection.
    """
    env_col = get_storage_conditions_collection()
    inv_col = get_inventory_collection()
    if env_col is None or inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(data.inventory_id)
        item = inv_col.find_one({"_id": oid})
    except Exception:
        item = inv_col.find_one({"_id": data.inventory_id})

    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item '{data.inventory_id}' not found.")

    now = datetime.now(timezone.utc)
    record = {
        "inventory_id": item["_id"],
        "temperature": data.temperature,
        "humidity": data.humidity,
        "air_circulation": data.air_circulation or "Standard",
        "light_exposure": data.light_exposure or "Dark",
        "storage_duration_hours": data.storage_duration_hours,
        "storage_location": data.storage_location or item.get("location", "Main Storage"),
        "recorded_at": now,
    }
    res = env_col.insert_one(record)

    # Also update latest readings in inventory
    inv_update: Dict[str, Any] = {
        "storage_temperature": data.temperature,
        "storage_humidity": data.humidity,
        "air_circulation": data.air_circulation or "Standard",
        "light_exposure": data.light_exposure or "Dark",
        "updated_at": now,
    }
    if data.storage_duration_hours is not None:
        inv_update["storage_duration_hours"] = data.storage_duration_hours

    inv_col.update_one(
        {"_id": item["_id"]},
        {"$set": inv_update}
    )

    return {
        "success": True,
        "condition_id": str(res.inserted_id),
        "inventory_id": str(item["_id"]),
        "temperature": data.temperature,
        "humidity": data.humidity,
        "air_circulation": data.air_circulation or "Standard",
        "light_exposure": data.light_exposure or "Dark",
        "storage_duration_hours": data.storage_duration_hours,
        "recorded_at": now.isoformat(),
    }


@router.get(
    "/storage/conditions",
    summary="Retrieve Historical Environmental Sensor Readings"
)
async def get_storage_conditions(
    inventory_id: Optional[str] = Query(None, description="Optional inventory ID filter"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves time-series temperature and humidity sensor observations.
    """
    env_col = get_storage_conditions_collection()
    if env_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if inventory_id:
        try:
            query["inventory_id"] = ObjectId(inventory_id)
        except Exception:
            query["inventory_id"] = inventory_id

    records = env_col.find(query).sort("recorded_at", -1).limit(50)

    result = []
    for r in records:
        result.append({
            "id": str(r["_id"]),
            "inventory_id": str(r["inventory_id"]),
            "temperature": r.get("temperature"),
            "humidity": r.get("humidity"),
            "air_circulation": r.get("air_circulation", "Standard"),
            "light_exposure": r.get("light_exposure", "Dark"),
            "storage_duration_hours": r.get("storage_duration_hours"),
            "storage_location": r.get("storage_location"),
            "recorded_at": r.get("recorded_at").isoformat() if r.get("recorded_at") else None,
        })

    return result


@router.get(
    "/recommendations/{inventory_id}",
    summary="Generate Prescriptive Storage, Consumption and FEFO Recommendations"
)
async def get_item_recommendations(
    inventory_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Synthesizes current inventory state, observed storage parameters, and Arrhenius predictions
    to produce actionable recommendations.
    """
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(inventory_id)
        item = inv_col.find_one({"_id": oid})
    except Exception:
        item = inv_col.find_one({"_id": inventory_id})

    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item '{inventory_id}' not found.")

    score = float(item.get("freshness_score") or 85.0)

    # Run quick shelf-life prediction to obtain remaining days
    prediction = shelf_life_predictor.predict_shelf_life(
        category=item.get("category", "Fruits"),
        purchase_date_val=item.get("purchase_date", ""),
        expiry_date_val=item.get("expiry_date", ""),
        storage_temperature=item.get("storage_temperature"),
        storage_humidity=item.get("storage_humidity"),
        current_freshness_score=score,
    )

    recs = recommendation_engine.generate_recommendations(
        category=item.get("category", "Fruits"),
        freshness_status=item.get("freshness_status", "Fresh"),
        freshness_score=score,
        days_remaining=prediction["predicted_remaining_days"],
        temperature=item.get("storage_temperature"),
        humidity=item.get("storage_humidity"),
        quantity=float(item.get("quantity", 1.0)),
        unit=item.get("unit", "kg"),
    )

    return {
        "inventory_id": str(item["_id"]),
        "food_name": item.get("food_name"),
        "predicted_remaining_days": prediction["predicted_remaining_days"],
        "recommendations": recs,
    }


@router.get(
    "/freshness/history",
    summary="Retrieve Recent AI Food Freshness Scans and Diagnostics"
)
async def get_freshness_history(
    limit: int = Query(20, ge=1, le=100),
    inventory_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves history of AI freshness scans, CV visual scores, and defect assessments.
    Scoped to the authenticated user for standard consumers.
    """
    fresh_col = get_freshness_records_collection()
    if fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if inventory_id:
        try:
            query["inventory_id"] = ObjectId(inventory_id)
        except Exception:
            query["inventory_id"] = inventory_id

    if category and category.lower() != "all":
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}

    if search and search.strip():
        query["food_name"] = {"$regex": search.strip(), "$options": "i"}

    # Role Scoping: Consumers and regular users can only access their own scans
    user_role = current_user.get("role")
    if user_role not in ["Admin", "Food Quality Inspector"]:
        u_id = current_user.get("_id")
        inv_col = get_inventory_collection()
        user_inv_ids = []
        if inv_col is not None and u_id:
            user_items = list(inv_col.find({"$or": [{"user_id": u_id}, {"user_id": str(u_id)}]}, {"_id": 1}))
            user_inv_ids = [it["_id"] for it in user_items]
            user_inv_ids += [str(it["_id"]) for it in user_items]

        user_conds = [
            {"user_id": u_id},
            {"user_id": str(u_id)}
        ]
        if user_inv_ids:
            user_conds.append({"inventory_id": {"$in": user_inv_ids}})

        if query:
            query = {"$and": [query, {"$or": user_conds}]}
        else:
            query["$or"] = user_conds

    records = list(fresh_col.find(query).sort("analysis_date", -1).limit(limit))

    result = []
    for r in records:
        analysis_date = r.get("analysis_date")
        if isinstance(analysis_date, datetime):
            date_str = analysis_date.isoformat()
        else:
            date_str = str(analysis_date) if analysis_date else None

        result.append({
            "id": str(r["_id"]),
            "inventory_id": str(r.get("inventory_id")) if r.get("inventory_id") else None,
            "user_id": str(r.get("user_id")) if r.get("user_id") else None,
            "food_name": r.get("food_name", "Food Item"),
            "category": r.get("category", "General"),
            "image_url": r.get("image_url"),
            "freshness_score": r.get("freshness_score"),
            "composite_freshness_score": r.get("composite_freshness_score") or r.get("freshness_score"),
            "freshness_label": r.get("freshness_label") or r.get("freshness_status") or "Fresh",
            "freshness_category": r.get("freshness_category") or r.get("freshness_label") or "Fresh",
            "confidence": r.get("confidence", 0.92),
            "confidence_score": r.get("confidence", 0.92),
            "overall_food_health_score": r.get("overall_food_health_score"),
            "sub_scores": r.get("sub_scores"),
            "spoilage_probability": r.get("spoilage_probability", 0.1),
            "spoilage_risk_level": r.get("spoilage_risk_level", "Low"),
            "estimated_shelf_life_days": r.get("estimated_shelf_life_days", 7.0),
            "detected_defects": r.get("detected_defects", []),
            "mold_detected": r.get("mold_detected", False),
            "bruising_detected": r.get("bruising_detected", False),
            "color_score": r.get("color_score"),
            "texture_score": r.get("texture_score"),
            "model_version": r.get("model_version", "cv-arrhenius-v2.4"),
            "analysis_date": date_str,
        })

    return result


@router.get(
    "/freshness/history/{record_id}",
    summary="Retrieve Detailed Single AI Scan Diagnostics"
)
async def get_freshness_record(
    record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns full diagnostics for a specific scan record with strict authorization verification.
    """
    fresh_col = get_freshness_records_collection()
    if fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(record_id)
        r = fresh_col.find_one({"_id": oid})
    except Exception:
        r = fresh_col.find_one({"_id": record_id})

    if not r:
        raise HTTPException(status_code=404, detail="Scan diagnostic record not found.")

    # Access control verification
    user_role = current_user.get("role")
    if user_role not in ["Admin", "Food Quality Inspector"]:
        u_id = str(current_user.get("_id"))
        rec_u_id = str(r.get("user_id")) if r.get("user_id") else None

        inv_owned = False
        if r.get("inventory_id"):
            inv_col = get_inventory_collection()
            if inv_col is not None:
                try:
                    inv_item = inv_col.find_one({"_id": ObjectId(r.get("inventory_id"))})
                except Exception:
                    inv_item = inv_col.find_one({"_id": r.get("inventory_id")})
                if inv_item and str(inv_item.get("user_id")) == u_id:
                    inv_owned = True

        if rec_u_id != u_id and not inv_owned:
            raise HTTPException(status_code=403, detail="Not authorized to inspect this scan record.")

    analysis_date = r.get("analysis_date")
    date_str = analysis_date.isoformat() if isinstance(analysis_date, datetime) else str(analysis_date) if analysis_date else None

    # Recommendations synthesis for this specific record
    recs = recommendation_engine.generate_recommendations(
        category=r.get("category", "Fruits"),
        freshness_status=r.get("freshness_label", "Fresh"),
        freshness_score=float(r.get("freshness_score") or 85.0),
        days_remaining=float(r.get("estimated_shelf_life_days") or 7.0),
    )

    return {
        "success": True,
        "id": str(r["_id"]),
        "inventory_id": str(r.get("inventory_id")) if r.get("inventory_id") else None,
        "user_id": str(r.get("user_id")) if r.get("user_id") else None,
        "food_name": r.get("food_name", "Food Item"),
        "category": r.get("category", "General"),
        "image_url": r.get("image_url"),
        "freshness_score": r.get("freshness_score"),
        "composite_freshness_score": r.get("composite_freshness_score") or r.get("freshness_score"),
        "freshness_label": r.get("freshness_label") or r.get("freshness_status") or "Fresh",
        "freshness_category": r.get("freshness_category") or r.get("freshness_label") or "Fresh",
        "confidence": r.get("confidence", 0.92),
        "confidence_score": r.get("confidence", 0.92),
        "overall_food_health_score": r.get("overall_food_health_score"),
        "sub_scores": r.get("sub_scores"),
        "spoilage_probability": r.get("spoilage_probability", 0.1),
        "spoilage_risk_level": r.get("spoilage_risk_level", "Low"),
        "estimated_shelf_life_days": r.get("estimated_shelf_life_days", 7.0),
        "detected_defects": r.get("detected_defects", []),
        "mold_detected": r.get("mold_detected", False),
        "bruising_detected": r.get("bruising_detected", False),
        "color_score": r.get("color_score"),
        "texture_score": r.get("texture_score"),
        "model_version": r.get("model_version", "cv-arrhenius-v2.4"),
        "analysis_date": date_str,
        "recommendations": recs,
    }


@router.get(
    "/freshness/storage-guidelines",
    summary="Retrieve Food Storage Guidelines and Permitted Climate Ranges"
)
async def get_storage_guidelines(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns food category specific storage recommendations, ideal temperature and humidity bounds,
    ethylene sensitivity, refrigeration guidelines, and shelf preservation advice.
    """
    category_data = {
        "Fruits": {
            "name": "Fruits",
            "icon": "fas fa-apple-alt",
            "storage_type": "Refrigerate / Cool Room",
            "temp_min": 1.0,
            "temp_max": 6.0,
            "temp_optimal": 4.0,
            "humidity_min": 85.0,
            "humidity_max": 95.0,
            "ethylene": "High producer (Apples, Bananas). Keep segregated from leafy greens.",
            "tips": "Store ethylene producers separately. Do not wash before storing to prevent fungal mold proliferation. Refrigerate ripe berries immediately.",
            "shelf_life_guidance": "Berries: 3-5 days; Apples/Citrus: 2-4 weeks when refrigerated."
        },
        "Vegetables": {
            "name": "Vegetables",
            "icon": "fas fa-carrot",
            "storage_type": "High Humidity Crisper",
            "temp_min": 1.0,
            "temp_max": 5.0,
            "temp_optimal": 3.0,
            "humidity_min": 85.0,
            "humidity_max": 95.0,
            "ethylene": "Highly sensitive (Leafy greens, Broccoli, Cucumbers).",
            "tips": "Maintain high humidity crisper drawer. Keep root vegetables (potatoes, onions) in cool, dark, dry ventilated spaces away from moisture.",
            "shelf_life_guidance": "Leafy greens: 5-7 days; Carrots/Roots: 3-4 weeks."
        },
        "Dairy": {
            "name": "Dairy Products",
            "icon": "fas fa-cheese",
            "storage_type": "Main Refrigerator Body (1-4°C)",
            "temp_min": 1.0,
            "temp_max": 4.0,
            "temp_optimal": 3.0,
            "humidity_min": 50.0,
            "humidity_max": 75.0,
            "ethylene": "Neutral. Susceptible to odor absorption.",
            "tips": "Never store milk in the refrigerator door where temperature fluctuates. Keep cheese in parchment paper to allow respiration while retaining moisture.",
            "shelf_life_guidance": "Milk: 5-7 days after opening; Hard Cheese: 3-6 weeks; Yogurt: 1-2 weeks."
        },
        "Meat": {
            "name": "Meat & Poultry",
            "icon": "fas fa-drumstick-bite",
            "storage_type": "Coldest Shelf / Meat Drawer (-2 to 2°C)",
            "temp_min": -2.0,
            "temp_max": 2.0,
            "temp_optimal": 0.0,
            "humidity_min": 60.0,
            "humidity_max": 75.0,
            "ethylene": "Neutral.",
            "tips": "Store raw meats on the bottom shelf in sealed containers to prevent cross-contamination from dripping juices. Freeze if not cooking within 48 hours.",
            "shelf_life_guidance": "Ground meat/poultry: 1-2 days; Steaks/roasts: 3-5 days; Freezer: 6-12 months."
        },
        "Fish": {
            "name": "Fish & Seafood",
            "icon": "fas fa-fish",
            "storage_type": "Slush Ice / Chiller (-1 to 2°C)",
            "temp_min": -1.0,
            "temp_max": 2.0,
            "temp_optimal": 0.0,
            "humidity_min": 70.0,
            "humidity_max": 85.0,
            "ethylene": "Neutral.",
            "tips": "Highly perishable. Store on shaved ice in a perforated pan inside refrigerator. Prepare within 24 to 36 hours of acquisition.",
            "shelf_life_guidance": "Fresh fish: 1-2 days; Shellfish: 1-2 days; Frozen: 3-6 months."
        },
        "Bakery": {
            "name": "Bakery & Breads",
            "icon": "fas fa-bread-slice",
            "storage_type": "Room Temperature / Bread Box (18-24°C)",
            "temp_min": 18.0,
            "temp_max": 24.0,
            "temp_optimal": 20.0,
            "humidity_min": 40.0,
            "humidity_max": 60.0,
            "ethylene": "Neutral.",
            "tips": "Never refrigerate bread as cold temperatures accelerate starch retrogradation (staling). Freeze sliced bread for extended preservation up to 3 months.",
            "shelf_life_guidance": "Fresh bread: 3-5 days room temp; Frozen slices: 3 months."
        },
        "Grains": {
            "name": "Grains & Cereals",
            "icon": "fas fa-wheat-awn",
            "storage_type": "Cool, Dry Pantry (15-22°C)",
            "temp_min": 15.0,
            "temp_max": 22.0,
            "temp_optimal": 18.0,
            "humidity_min": 35.0,
            "humidity_max": 55.0,
            "ethylene": "Neutral.",
            "tips": "Store in airtight glass or BPA-free food-grade plastic containers to prevent weevils and humidity absorption. Keep away from direct sunlight.",
            "shelf_life_guidance": "Dry pasta/rice: 1-2 years; Flour: 6-8 months."
        },
        "Packaged Food": {
            "name": "Packaged Food",
            "icon": "fas fa-box",
            "storage_type": "Ambient Pantry (15-24°C)",
            "temp_min": 15.0,
            "temp_max": 24.0,
            "temp_optimal": 20.0,
            "humidity_min": 30.0,
            "humidity_max": 65.0,
            "ethylene": "Neutral.",
            "tips": "Inspect seals and expiration codes. Once unsealed, refrigerate per manufacturer instructions and consume within specified timeframe.",
            "shelf_life_guidance": "Varies by product. Refer to 'Best By' / 'Use By' dates."
        }
    }
    return {
        "success": True,
        "guidelines": category_data,
        "thresholds": FoodRecommendationEngine.CATEGORY_THRESHOLDS
    }


@router.post(
    "/shelf-life/simulate",
    summary="Simulate Shelf Life and Arrhenius Decay Trajectory"
)
async def simulate_shelf_life(
    data: ShelfLifeSimulationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Simulates dynamic Arrhenius kinetic degradation, Q10 acceleration,
    and 7-day quality trajectory given climate and packaging parameters.
    """
    today = date.today()
    default_expiry = today + timedelta(days=14)

    prediction = shelf_life_predictor.predict_shelf_life(
        category=data.category,
        purchase_date_val=today,
        expiry_date_val=default_expiry,
        storage_temperature=data.storage_temperature,
        storage_humidity=data.storage_humidity,
        packaging_type=data.packaging_type or "Standard Pack",
        current_freshness_score=data.current_freshness_score,
        food_name=data.food_name,
    )

    resolved_cat = prediction.get("commodity", {}).get("category") if prediction.get("commodity") else data.category

    recs = recommendation_engine.generate_recommendations(
        category=resolved_cat or data.category,
        freshness_status="Fresh" if data.current_freshness_score >= 70.0 else "Moderately Fresh" if data.current_freshness_score >= 50.0 else "Spoiled",
        freshness_score=data.current_freshness_score,
        days_remaining=prediction["predicted_remaining_days"],
        temperature=data.storage_temperature,
        humidity=data.storage_humidity,
        packaging_type=data.packaging_type or "Standard Pack",
    )

    thresholds = FoodRecommendationEngine.CATEGORY_THRESHOLDS.get(resolved_cat, FoodRecommendationEngine.CATEGORY_THRESHOLDS.get("Other", {}))

    return {
        "success": True,
        "category": resolved_cat or data.category,
        "food_name": prediction.get("food_name") or data.food_name,
        "emoji": prediction.get("emoji") or "🥗",
        "commodity": prediction.get("commodity"),
        "optimal_temp": prediction.get("optimal_temp"),
        "optimal_rh": prediction.get("optimal_rh"),
        "storage_advice": prediction.get("storage_advice"),
        "storage_temperature": data.storage_temperature,
        "storage_humidity": data.storage_humidity,
        "packaging_type": data.packaging_type,
        "current_freshness_score": data.current_freshness_score,
        "predicted_remaining_days": prediction["predicted_remaining_days"],
        "adjusted_expiry_date": prediction.get("adjusted_expiry_date"),
        "daily_degradation_rate_pct": prediction["daily_degradation_rate_pct"],
        "temp_acceleration_factor": prediction["temp_acceleration_factor"],
        "packaging_protection_factor": prediction["packaging_protection_factor"],
        "confidence_score": prediction["confidence_score"],
        "storage_stress_level": prediction["storage_stress_level"],
        "forecast_7_days": prediction["forecast_7_days"],
        "thresholds": thresholds,
        "recommendations": recs,
    }


@router.get(
    "/shelf-life/commodities",
    summary="List Recognized Food Commodities & Standard Shelf-Life Kinetics"
)
async def get_shelf_life_commodities():
    """
    Returns catalogue of recognized food items with standard Arrhenius kinetics,
    reference temperatures, optimal humidity bounds, and typical shelf life.
    """
    items = []
    for key, c in shelf_life_predictor.COMMODITY_DATABASE.items():
        items.append({
            "key": key,
            "display_name": c["display_name"],
            "category": c["category"],
            "emoji": c["emoji"],
            "base_days": c["base_days"],
            "ref_temp": c["ref_temp"],
            "ref_rh": c["ref_rh"],
            "q10": c["q10"],
            "storage_advice": c["storage_advice"]
        })
    return {"success": True, "count": len(items), "commodities": items}

