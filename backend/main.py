import csv

import io

import logging

import os

# Keep TensorFlow/BLAS thread usage low on small cloud instances. These must be
# set before TensorFlow is imported (TensorFlow is imported lazily below).
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "1")
os.environ.setdefault("TF_NUM_INTEROP_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import sys

from datetime import datetime, date

from pathlib import Path

from threading import Lock

import gc

from typing import Optional, List, Dict, Any, Tuple

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status, Response

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import FileResponse

from fastapi.staticfiles import StaticFiles

import numpy as np

from PIL import Image

from pydantic import BaseModel

from sqlalchemy.orm import Session

from auth import hash_password, verify_password

from database import Base, engine, get_db

import models

from analysis_engine import (

    analyze_color,

    analyze_texture,

    detect_surface_indicators,

    compute_five_tier_grade,

    evaluate_storage_condition,

    estimate_shelf_life,

    calculate_quality_score,

    compute_inventory_insights,

    CATEGORY_BASELINES

)

from export_engine import generate_excel_report, generate_pdf_report

# =========================================================

# LOGGING SETUP

# =========================================================

logging.basicConfig(

    level=logging.INFO,

    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"

)

logger = logging.getLogger("freshsense")

# =========================================================

# PATHS

# =========================================================

BASE_DIR = Path(__file__).resolve().parent

FRONTEND_DIR = BASE_DIR.parent / "frontend"

MODEL_PATH = BASE_DIR / "freshness_model.keras"

DATASET_DIR = BASE_DIR / "dataset"

# =========================================================

# DATABASE INITIALIZATION

# =========================================================

Base.metadata.create_all(bind=engine)

# =========================================================

# LOAD AI MODEL

# =========================================================

model = None
model_lock = Lock()

logger.info("FreshSense AI model will be loaded on first analysis request.")

# =========================================================

# FASTAPI APP SETUP

# =========================================================

app = FastAPI(

    title="FreshSense AI Platform API",

    description="AI Food Freshness Monitoring & Quality Analytics Platform",

    version="2.0.0"

)

# CORS configuration

origins = [

    "http://127.0.0.1:5500",

    "http://localhost:5500",

    "http://127.0.0.1:8001",

    "http://localhost:8001",

    "http://127.0.0.1:8000",

    "http://localhost:8000",

    "http://127.0.0.1:3000",

    "http://localhost:3000",

    "*"

]

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

# Mount static frontend directory if it exists

if FRONTEND_DIR.exists():

    app.mount(

        "/static",

        StaticFiles(directory=FRONTEND_DIR),

        name="static"

    )

# =========================================================

# PYDANTIC SCHEMAS

# =========================================================

class RegisterRequest(BaseModel):

    name: str

    email: str

    password: str

    role: str = "Consumer"

class LoginRequest(BaseModel):

    email: str

    password: str

class StorageAnalysisRequest(BaseModel):

    category: str = "Fruits"

    temperature: Optional[float] = None

    humidity: Optional[float] = None

    air_circulation: Optional[str] = "Good"

    light_exposure: Optional[str] = "Low"

    packaging_type: Optional[str] = "Standard"

    storage_duration_days: Optional[int] = 0

class ShelfLifeRequest(BaseModel):

    category: str = "Fruits"

    freshness_score: float = 85.0

    temperature: Optional[float] = None

    humidity: Optional[float] = None

    storage_duration_days: Optional[int] = 0

    expiry_date: Optional[str] = None

class InventoryCreateRequest(BaseModel):

    user_id: int

    food_name: str

    category: str = "Fruits"

    quantity: float = 1.0

    unit: str = "items"

    batch_info: Optional[str] = None

    purchase_date: Optional[str] = None

    storage_duration_days: Optional[int] = 0

    expiry_date: str

    freshness_status: Optional[str] = "Fresh"

    storage_temperature: Optional[float] = None

    humidity: Optional[float] = None

    packaging_type: Optional[str] = "Standard"

    storage_location: Optional[str] = "Refrigerator"

    air_circulation: Optional[str] = "Good"

    light_exposure: Optional[str] = "Low"

    consumption_priority: Optional[str] = "Normal"

class InventoryUpdateRequest(BaseModel):

    food_name: Optional[str] = None

    category: Optional[str] = None

    quantity: Optional[float] = None

    unit: Optional[str] = None

    batch_info: Optional[str] = None

    purchase_date: Optional[str] = None

    storage_duration_days: Optional[int] = None

    expiry_date: Optional[str] = None

    freshness_status: Optional[str] = None

    storage_temperature: Optional[float] = None

    humidity: Optional[float] = None

    packaging_type: Optional[str] = None

    storage_location: Optional[str] = None

    air_circulation: Optional[str] = None

    light_exposure: Optional[str] = None

    consumption_priority: Optional[str] = None

class UserStatusUpdateRequest(BaseModel):

    is_active: bool

    role: Optional[str] = None

# HOME & HEALTH ENDPOINTS

# =========================================================

@app.get("/")

def home():

    return {

        "message": "FreshSense AI Platform API is running",

        "model_loaded": model is not None,

        "version": "2.0.0",

        "docs_url": "/docs"

    }

@app.get("/health")

def health():

    return {

        "status": "ok",

        "model_loaded": model is not None,

        "database": "connected"

    }

# =========================================================

# USER REGISTRATION & AUTHENTICATION

# =========================================================

@app.post("/register")

def register_user(

    user_data: RegisterRequest,

    db: Session = Depends(get_db)

):

    clean_name = user_data.name.strip()

    clean_email = user_data.email.strip().lower()

    if not clean_name:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Name cannot be empty."

        )

    if not clean_email or "@" not in clean_email:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="A valid email address is required."

        )

    if len(user_data.password) < 6:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Password must contain at least 6 characters."

        )

    existing_user = (

        db.query(models.User)

        .filter(models.User.email == clean_email)

        .first()

    )

    if existing_user:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Email already registered."

        )

    hashed_pwd = hash_password(user_data.password)

    # Support the requested roles

    allowed_roles = [

        "Consumer",

        "Retail Manager",

        "Warehouse Operator",

        "Food Quality Inspector",

        "Administrator",

        "user",

        "admin"

    ]

    user_role = user_data.role if user_data.role in allowed_roles else "Consumer"

    new_user = models.User(

        name=clean_name,

        email=clean_email,

        password=hashed_pwd,

        role=user_role

    )

    try:

        db.add(new_user)

        db.commit()

        db.refresh(new_user)

        logger.info(f"User registered successfully: {clean_email} (ID: {new_user.id}, Role: {new_user.role})")

    except Exception as e:

        db.rollback()

        logger.error(f"REGISTER ERROR for {clean_email}: {e}")

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail="User registration failed."

        )

    return {

        "success": True,

        "message": "Registration successful.",

        "user_id": new_user.id,

        "name": new_user.name,

        "email": new_user.email,

        "role": new_user.role,

        "is_active": True

    }

@app.post("/login")

def login_user(

    user_data: LoginRequest,

    db: Session = Depends(get_db)

):

    clean_email = user_data.email.strip().lower()

    user = (

        db.query(models.User)

        .filter(models.User.email == clean_email)

        .first()

    )

    if not user or not verify_password(user_data.password, user.password):

        logger.warning(f"Failed login attempt for email: {clean_email}")

        raise HTTPException(

            status_code=status.HTTP_401_UNAUTHORIZED,

            detail="Invalid email or password."

        )

    if getattr(user, "is_active", True) is False:

        logger.warning(f"Deactivated user attempted login: {clean_email} (ID: {user.id})")

        raise HTTPException(

            status_code=status.HTTP_403_FORBIDDEN,

            detail="Account is deactivated. Please contact an administrator."

        )

    logger.info(f"User login successful: {clean_email} (ID: {user.id}, Role: {user.role})")

    return {

        "success": True,

        "message": "Login successful.",

        "user_id": user.id,

        "name": user.name,

        "email": user.email,

        "role": user.role,

        "is_active": getattr(user, "is_active", True)

    }

# =========================================================

# CORE AI PREDICTION & IMAGE ANALYSIS ENGINE

# =========================================================

async def run_food_analysis(

    file: UploadFile,

    user_id: Optional[int],

    category: str,

    temperature: Optional[float],

    humidity: Optional[float],

    storage_duration_days: Optional[int],

    air_circulation: Optional[str],

    light_exposure: Optional[str],

    packaging_type: Optional[str],

    expiry_date: Optional[str],

    db: Session

):

    global model

    # Validate the upload before importing/loading TensorFlow to avoid wasting RAM.
    if not file or not file.filename:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="No image file received."

        )

    allowed_types = [

        "image/jpeg",

        "image/jpg",

        "image/png",

        "image/webp",

        "image/bmp"

    ]

    ext = Path(file.filename).suffix.lower()

    if file.content_type not in allowed_types and ext not in [

        ".jpg", ".jpeg", ".png", ".webp", ".bmp"

    ]:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Please upload a valid image file (JPG, JPEG, or PNG)."

        )

    # Only one request can load/use the model at a time. This prevents duplicate
    # TensorFlow model loads and reduces peak RAM on Render's 512 MB instance.
    with model_lock:

        if model is None:

            try:

                if not MODEL_PATH.exists():

                    raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

                import tensorflow as tf

                try:

                    tf.config.threading.set_intra_op_parallelism_threads(1)

                    tf.config.threading.set_inter_op_parallelism_threads(1)

                except RuntimeError:

                    # TensorFlow may already be initialized; environment limits remain in place.
                    pass

                model = tf.keras.models.load_model(MODEL_PATH, compile=False)

                logger.info("FreshSense AI model loaded on first analysis request")

            except Exception as e:

                logger.exception("Error loading freshness model")

                raise HTTPException(

                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

                    detail="Freshness model could not be loaded. Check the Render logs and model file."

                ) from e

    try:

        image_bytes = await file.read()

        if not image_bytes:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail="Uploaded image is empty."

            )

        # 1. Decode image and cap its dimensions to prevent huge uploads from
        # creating large temporary arrays on the small cloud instance.
        with Image.open(io.BytesIO(image_bytes)) as uploaded_image:

            raw_pil = uploaded_image.convert("RGB")

        raw_pil.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        original_np = np.asarray(raw_pil, dtype=np.uint8)

        # 2. MobileNetV2 requires 224x224 RGB. Keep the input batch small.
        resized_pil = raw_pil.resize((224, 224), Image.Resampling.BILINEAR)

        image_array = np.asarray(resized_pil, dtype=np.float32)[None, ...]

        # 3. Direct model call avoids some of predict()'s data-adapter overhead.
        # The model was trained with class_names=["fresh", "spoiled"], so the
        # sigmoid output is the spoiled-class probability (0=fresh, 1=spoiled).
        with model_lock:

            prediction = model(image_array, training=False)

            probability = float(np.asarray(prediction)[0][0])

        del image_array, prediction

        gc.collect()

        # Underlying model binary mapping

        if probability >= 0.5:

            result = "Spoiled"

            confidence = probability

        else:

            result = "Fresh"

            confidence = 1.0 - probability

        confidence_percent = round(

            confidence * 100,

            2

        )

        model_score = round(

            probability,

            4

        )

        # 4. Five-Tier Freshness Grading

        grading_result = compute_five_tier_grade(

            probability

        )

        freshness_score = grading_result["freshness_score"]

        grade = grading_result["grade"]

        consumption_rec = grading_result["consumption_recommendation"]

        storage_rec = grading_result["storage_recommendation"]

        # 5. Image-Based Color Analysis

        color_data = analyze_color(

            original_np

        )

        # 6. Image-Based Texture Analysis

        texture_data = analyze_texture(

            original_np

        )

        # 7. Surface Spoilage Indicators

        surface_data = detect_surface_indicators(

            original_np

        )

        # 8. Storage Condition Evaluation

        storage_eval = evaluate_storage_condition(

            category=category or "Fruits",

            temperature=temperature,

            humidity=humidity,

            air_circulation=air_circulation or "Good",

            light_exposure=light_exposure or "Low",

            packaging_type=packaging_type or "Standard",

            storage_duration_days=storage_duration_days or 0

        )

        # 9. Shelf-Life Estimation

        shelf_life_eval = estimate_shelf_life(

            category=category or "Fruits",

            freshness_score=freshness_score,

            temperature=temperature,

            humidity=humidity,

            storage_duration_days=storage_duration_days or 0,

            expiry_date_str=expiry_date

        )

        # 10. Weighted Food Quality Scoring

        quality_eval = calculate_quality_score(

            visual_freshness_score=freshness_score,

            storage_score=(

                storage_eval["storage_score"]

                if (

                    temperature is not None

                    or humidity is not None

                )

                else None

            ),

            shelf_life_score=(

                min(

                    100.0,

                    (

                        shelf_life_eval[

                            "estimated_remaining_days"

                        ] / 10.0

                    ) * 100.0

                )

                if shelf_life_eval[

                    "estimated_remaining_days"

                ] > 0

                else 0.0

            ),

            product_age_days=(

                storage_duration_days

                if (

                    storage_duration_days is not None

                    and storage_duration_days > 0

                )

                else None

            ),

            category=category or "Fruits"

        )

        # 11. Save record into PostgreSQL

        history = models.PredictionHistory(

            user_id=user_id,

            image_name=file.filename,

            result=result,

            confidence=confidence_percent,

            freshness_score=freshness_score,

            grade=grade,

            color_condition=color_data["color_condition"],

            texture_condition=texture_data["texture_condition"],

            overall_quality_score=quality_eval[

                "overall_health_score"

            ],

            estimated_shelf_life_days=shelf_life_eval[

                "estimated_remaining_days"

            ]

        )

        try:

            db.add(history)

            db.commit()

            db.refresh(history)

            logger.info(

                f"Prediction saved: id={history.id}, "

                f"img='{file.filename}', "

                f"result={result}, "

                f"grade={grade}, "

                f"user_id={user_id}"

            )

        except Exception as e:

            db.rollback()

            logger.error(

                f"HISTORY SAVE ERROR: {e}"

            )

        # 12. Combined response

        return {

            "success": True,

            "result": result,

            "prediction": result,

            "label": result,

            "grade": grade,

            "freshness_grade": grade,

            "confidence": confidence_percent,

            "confidence_percent": confidence_percent,

            "freshness_score": freshness_score,

            "quality_score": quality_eval[

                "overall_health_score"

            ],

            "overall_health_score": quality_eval[

                "overall_health_score"

            ],

            "model_score": model_score,

            "score": model_score,

            "recommendation": consumption_rec,

            "consumption_recommendation": consumption_rec,

            "storage_recommendation": storage_rec,

            "filename": file.filename,

            "image_name": file.filename,

            "category": category,

            "color_analysis": color_data,

            "texture_analysis": texture_data,

            "surface_indicators": surface_data,

            "storage_evaluation": storage_eval,

            "shelf_life_estimate": shelf_life_eval,

            "quality_scoring": quality_eval,

            "disclaimer": (

                "AI-assisted assessment and computer vision "

                "heuristics; not a food-safety laboratory certification."

            )

        }

    except HTTPException:

        raise

    except Exception as e:

        print("PREDICTION ERROR:", e)

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Prediction failed: {str(e)}"

        )

@app.post("/predict")

async def predict_food(

    file: UploadFile = File(...),

    user_id: Optional[int] = Form(None),

    category: Optional[str] = Form("Fruits"),

    temperature: Optional[float] = Form(None),

    humidity: Optional[float] = Form(None),

    storage_duration_days: Optional[int] = Form(None),

    air_circulation: Optional[str] = Form(None),

    light_exposure: Optional[str] = Form(None),

    packaging_type: Optional[str] = Form(None),

    expiry_date: Optional[str] = Form(None),

    db: Session = Depends(get_db)

):

    return await run_food_analysis(

        file=file,

        user_id=user_id,

        category=category,

        temperature=temperature,

        humidity=humidity,

        storage_duration_days=storage_duration_days,

        air_circulation=air_circulation,

        light_exposure=light_exposure,

        packaging_type=packaging_type,

        expiry_date=expiry_date,

        db=db

    )

@app.post("/analyze-image")

async def analyze_image_endpoint(

    file: UploadFile = File(...),

    user_id: Optional[int] = Form(None),

    category: Optional[str] = Form("Fruits"),

    temperature: Optional[float] = Form(None),

    humidity: Optional[float] = Form(None),

    storage_duration_days: Optional[int] = Form(None),

    air_circulation: Optional[str] = Form(None),

    light_exposure: Optional[str] = Form(None),

    packaging_type: Optional[str] = Form(None),

    expiry_date: Optional[str] = Form(None),

    db: Session = Depends(get_db)

):

    return await run_food_analysis(

        file=file,

        user_id=user_id,

        category=category,

        temperature=temperature,

        humidity=humidity,

        storage_duration_days=storage_duration_days,

        air_circulation=air_circulation,

        light_exposure=light_exposure,

        packaging_type=packaging_type,

        expiry_date=expiry_date,

        db=db

    )

# =========================================================

# STANDALONE STORAGE CONDITION MONITORING

# =========================================================

@app.post("/storage-analysis")

def analyze_storage_endpoint(req: StorageAnalysisRequest):

    return evaluate_storage_condition(

        category=req.category,

        temperature=req.temperature,

        humidity=req.humidity,

        air_circulation=req.air_circulation,

        light_exposure=req.light_exposure,

        packaging_type=req.packaging_type,

        storage_duration_days=req.storage_duration_days

    )

# =========================================================

# STANDALONE SHELF-LIFE PREDICTION

# =========================================================

@app.post("/shelf-life")

def shelf_life_endpoint(req: ShelfLifeRequest):

    return estimate_shelf_life(

        category=req.category,

        freshness_score=req.freshness_score,

        temperature=req.temperature,

        humidity=req.humidity,

        storage_duration_days=req.storage_duration_days,

        expiry_date_str=req.expiry_date

    )

# =========================================================

# COMBINED RECOMMENDATIONS ENDPOINT

# =========================================================

@app.get("/recommendations")

def get_recommendations_endpoint(

    category: str = Query("Fruits"),

    freshness_score: float = Query(85.0),

    temperature: Optional[float] = Query(None),

    humidity: Optional[float] = Query(None)

):

    # Grade

    if freshness_score >= 85.0:

        grade = "Fresh"

        consumption = "Safe condition based on analysis. Normal consumption recommended."

    elif freshness_score >= 70.0:

        grade = "Good"

        consumption = "Food is in good condition. Consume normally."

    elif freshness_score >= 50.0:

        grade = "Acceptable"

        consumption = "Quality is acceptable. Consider consuming soon."

    elif freshness_score >= 25.0:

        grade = "Near Spoilage"

        consumption = "Food is approaching spoilage. Consume soon after careful inspection."

    else:

        grade = "Spoiled"

        consumption = "Food appears spoiled. Do not consume."

    storage_res = evaluate_storage_condition(

        category=category,

        temperature=temperature,

        humidity=humidity

    )

    return {

        "category": category,

        "grade": grade,

        "freshness_score": freshness_score,

        "consumption_recommendation": consumption,

        "storage_condition": storage_res["condition"],

        "storage_recommendations": storage_res["recommendations"],

        "disclaimer": "AI-assisted assessment; not a food-safety laboratory certification."

    }

# =========================================================

# FOOD INVENTORY MANAGEMENT (POSTGRESQL CRUD)

# =========================================================

# =========================================================
# ROLE-BASED ACCESS CONTROL HELPERS
# =========================================================

STAFF_ROLES = {
    "warehouse operator",
    "retail manager",
    "food quality inspector",
    "administrator",
    "admin"
}


def is_staff_role(role: Optional[str]) -> bool:
    if not role:
        return False
    return role.strip().lower() in STAFF_ROLES


def resolve_access_scope(
    db: Session,
    user_id: Optional[int] = None,
    x_user_id: Optional[str] = None,
    x_user_role: Optional[str] = None
) -> Tuple[str, Optional[int]]:
    """
    Resolves data access scope:
      - 'shared': staff or organizational shared data
      - 'private': consumer personal records for the resolved user ID
    Enforces that Consumers cannot access other users' private records via URL parameter manipulation.
    """
    caller_user = None
    if x_user_id:
        try:
            caller_user = db.query(models.User).filter(models.User.id == int(x_user_id)).first()
        except (ValueError, TypeError):
            pass

    target_user = None
    if user_id is not None:
        target_user = db.query(models.User).filter(models.User.id == user_id).first()

    # If caller header is provided and caller is a Consumer:
    # Strictly forbid accessing another user's private records
    if caller_user and not is_staff_role(caller_user.role):
        if user_id is not None and user_id != caller_user.id:
            logger.warning(f"Unauthorized cross-user access blocked: caller {caller_user.id} -> target {user_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access another user's private records."
            )
        return ("private", caller_user.id)

    # If target_user exists:
    if target_user:
        if is_staff_role(target_user.role):
            return ("shared", target_user.id)
        else:
            return ("private", target_user.id)

    # If caller header indicates staff role:
    if (caller_user and is_staff_role(caller_user.role)) or (x_user_role and is_staff_role(x_user_role)):
        return ("shared", caller_user.id if caller_user else None)

    # Fallback when user_id is given but user not in DB:
    if user_id is not None:
        return ("private", user_id)

    # Default for shared queries
    return ("shared", None)


@app.get("/inventory")
def get_inventory(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    query = db.query(models.Inventory)
    if scope == "private" and resolved_id is not None:
        query = query.filter(models.Inventory.user_id == resolved_id)

    items = query.order_by(models.Inventory.id.desc()).all()

    today = date.today()

    result = []

    for item in items:

        days_left = None

        is_expired = False

        is_urgent = False

        if item.expiry_date:

            try:

                exp = datetime.strptime(item.expiry_date, "%Y-%m-%d").date()

                days_left = (exp - today).days

                if days_left < 0:

                    is_expired = True

                elif days_left <= 3:

                    is_urgent = True

            except Exception:

                pass

        result.append({

            "id": item.id,

            "user_id": item.user_id,

            "food_name": item.food_name,

            "category": item.category or "Fruits",

            "quantity": item.quantity if item.quantity is not None else 1.0,

            "unit": item.unit or "items",

            "batch_info": item.batch_info,

            "purchase_date": item.purchase_date,

            "storage_duration_days": item.storage_duration_days or 0,

            "expiry_date": item.expiry_date,

            "freshness_status": item.freshness_status or "Fresh",

            "storage_temperature": item.storage_temperature,

            "humidity": item.humidity,

            "packaging_type": item.packaging_type or "Standard",

            "storage_location": item.storage_location or "Refrigerator",

            "air_circulation": item.air_circulation or "Good",

            "light_exposure": item.light_exposure or "Low",

            "consumption_priority": "Consume First" if (is_urgent or is_expired or (item.freshness_status and "near" in item.freshness_status.lower())) else (item.consumption_priority or "Normal"),

            "days_left": days_left,

            "is_expired": is_expired,

            "is_urgent": is_urgent,

            "created_at": item.created_at.isoformat() if item.created_at else None

        })

    return result

@app.post("/inventory")

def add_inventory(

    item_data: InventoryCreateRequest,

    db: Session = Depends(get_db)

):

    if not item_data.food_name.strip():

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Food name is required."

        )

    if not item_data.expiry_date.strip():

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Expiry date is required."

        )

    new_item = models.Inventory(

        user_id=item_data.user_id,

        food_name=item_data.food_name.strip(),

        category=item_data.category or "Fruits",

        quantity=item_data.quantity,

        unit=item_data.unit or "items",

        batch_info=item_data.batch_info,

        purchase_date=item_data.purchase_date,

        storage_duration_days=item_data.storage_duration_days or 0,

        expiry_date=item_data.expiry_date.strip(),

        freshness_status=item_data.freshness_status or "Fresh",

        storage_temperature=item_data.storage_temperature,

        humidity=item_data.humidity,

        packaging_type=item_data.packaging_type or "Standard",

        storage_location=item_data.storage_location or "Refrigerator",

        air_circulation=item_data.air_circulation or "Good",

        light_exposure=item_data.light_exposure or "Low",

        consumption_priority=item_data.consumption_priority or "Normal"

    )

    try:

        db.add(new_item)

        db.commit()

        db.refresh(new_item)

    except Exception as e:

        db.rollback()

        print("INVENTORY SAVE ERROR:", e)

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail="Failed to save inventory item."

        )

    return {

        "success": True,

        "message": f"Added {new_item.food_name} to inventory.",

        "id": new_item.id,

        "item": {

            "id": new_item.id,

            "food_name": new_item.food_name,

            "category": new_item.category,

            "quantity": new_item.quantity,

            "unit": new_item.unit,

            "expiry_date": new_item.expiry_date

        }

    }

@app.put("/inventory/{item_id}")

def update_inventory(

    item_id: int,

    item_data: InventoryUpdateRequest,

    db: Session = Depends(get_db)

):

    item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()

    if not item:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail="Inventory item not found."

        )

    update_dict = item_data.dict(exclude_unset=True)

    for key, value in update_dict.items():

        if value is not None:

            setattr(item, key, value)

    try:

        db.commit()

        db.refresh(item)

    except Exception as e:

        db.rollback()

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail="Failed to update inventory item."

        )

    return {"success": True, "message": "Item updated successfully."}

@app.delete("/inventory/{item_id}")

def delete_inventory(

    item_id: int,

    db: Session = Depends(get_db)

):

    item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()

    if not item:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail="Inventory item not found."

        )

    try:

        db.delete(item)

        db.commit()

    except Exception as e:

        db.rollback()

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail="Failed to delete inventory item."

        )

    return {"success": True, "message": "Item removed from inventory."}

# =========================================================

# INVENTORY INSIGHTS & FEFO ROTATION

# =========================================================

@app.get("/inventory-insights")
def get_inventory_insights_endpoint(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    query = db.query(models.Inventory)
    if scope == "private" and resolved_id is not None:
        query = query.filter(models.Inventory.user_id == resolved_id)

    raw_items = query.all()

    item_dicts = []

    for it in raw_items:

        item_dicts.append({

            "id": it.id,

            "food_name": it.food_name,

            "category": it.category,

            "quantity": it.quantity,

            "unit": it.unit,

            "expiry_date": it.expiry_date,

            "freshness_status": it.freshness_status,

            "storage_location": it.storage_location

        })

    return compute_inventory_insights(item_dicts)

# =========================================================

# NOTIFICATION & ALERT SYSTEM

# =========================================================

@app.get("/alerts")
def get_alerts_endpoint(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    alerts = []
    today = date.today()

    # 1. Check prediction history for recent near-spoilage or spoiled predictions
    hist_query = db.query(models.PredictionHistory)
    if scope == "private" and resolved_id is not None:
        hist_query = hist_query.filter(models.PredictionHistory.user_id == resolved_id)

    recent_preds = hist_query.order_by(models.PredictionHistory.id.desc()).limit(10).all()
    for p in recent_preds:
        res = (p.result or "").lower()
        grd = (p.grade or "").lower()
        if res == "spoiled" or "spoil" in grd:
            alerts.append({
                "type": "CRITICAL",
                "badge": "ALERT",
                "title": f"Spoilage Detected: {p.image_name}",
                "message": f"Recent inspection classified {p.image_name} as Spoiled with {p.confidence}% confidence. Avoid consumption.",
                "created_at": p.created_at.isoformat() if p.created_at else None
            })
        elif "near" in grd or (p.freshness_score is not None and p.freshness_score < 50.0):
            alerts.append({
                "type": "WARNING",
                "badge": "WARNING",
                "title": f"Near Spoilage Warning: {p.image_name}",
                "message": f"{p.image_name} is nearing end of freshness (Quality score: {p.freshness_score}%). Consume immediately.",
                "created_at": p.created_at.isoformat() if p.created_at else None
            })

    # 2. Check inventory for expired or near-expiry items
    inv_query = db.query(models.Inventory)
    if scope == "private" and resolved_id is not None:
        inv_query = inv_query.filter(models.Inventory.user_id == resolved_id)

    inv_items = inv_query.all()

    for item in inv_items:

        if item.expiry_date:

            try:

                exp = datetime.strptime(item.expiry_date, "%Y-%m-%d").date()

                days = (exp - today).days

                if days < 0:

                    alerts.append({

                        "type": "CRITICAL",

                        "badge": "EXPIRED",

                        "title": f"Expired Stock: {item.food_name}",

                        "message": f"{item.food_name} expired on {item.expiry_date}. Inspect carefully before use or discard.",

                        "created_at": item.created_at.isoformat() if item.created_at else None

                    })

                elif days <= 3:

                    alerts.append({

                        "type": "WARNING",

                        "badge": "EXPIRING SOON",

                        "title": f"Shelf-Life Warning: {item.food_name}",

                        "message": f"{item.food_name} ({item.quantity} {item.unit}) will expire in {days} day(s). Prioritize for consumption (FEFO).",

                        "created_at": item.created_at.isoformat() if item.created_at else None

                    })

            except Exception:

                pass

        # Check storage condition deviations if temp is set

        if item.storage_temperature is not None:

            baseline = CATEGORY_BASELINES.get(item.category or "Fruits", CATEGORY_BASELINES["Fruits"])

            if item.storage_temperature > baseline["ideal_temp_max"] + 4.0:

                alerts.append({

                    "type": "STORAGE_WARNING",

                    "badge": "STORAGE TEMP",

                    "title": f"Suboptimal Storage: {item.food_name}",

                    "message": f"Storage temperature of {item.food_name} ({item.storage_temperature}°C) exceeds optimal max ({baseline['ideal_temp_max']}°C).",

                    "created_at": item.created_at.isoformat() if item.created_at else None

                })

    return alerts

# =========================================================

# REPORTS & EXPORT ENGINE

# =========================================================

@app.get("/reports")
def get_reports_endpoint(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    # Retrieve prediction history & inventory with RBAC
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    h_query = db.query(models.PredictionHistory)
    i_query = db.query(models.Inventory)

    if scope == "private" and resolved_id is not None:
        h_query = h_query.filter(models.PredictionHistory.user_id == resolved_id)
        i_query = i_query.filter(models.Inventory.user_id == resolved_id)

    predictions = h_query.all()
    inventory = i_query.all()

    total_analyses = len(predictions)

    fresh_count = sum(1 for p in predictions if (p.result or "").lower() == "fresh")

    spoiled_count = sum(1 for p in predictions if (p.result or "").lower() == "spoiled")

    avg_score = round(sum(p.freshness_score or 0.0 for p in predictions) / total_analyses, 2) if total_analyses > 0 else 0.0

    today = date.today()

    expired_inv = 0

    at_risk_inv = 0

    for it in inventory:

        if it.expiry_date:

            try:

                exp = datetime.strptime(it.expiry_date, "%Y-%m-%d").date()

                if (exp - today).days < 0:

                    expired_inv += 1

                elif (exp - today).days <= 3:

                    at_risk_inv += 1

            except Exception:

                pass

    return {

        "freshness_report": {

            "total_analyses": total_analyses,

            "fresh_samples": fresh_count,

            "spoiled_samples": spoiled_count,

            "average_freshness_score": avg_score,

            "compliance_rate": f"{round((fresh_count / total_analyses * 100), 1)}%" if total_analyses > 0 else "N/A"

        },

        "inventory_report": {

            "total_inventory_items": len(inventory),

            "expired_items": expired_inv,

            "near_expiry_items": at_risk_inv,

            "stable_items": max(0, len(inventory) - expired_inv - at_risk_inv)

        },

        "waste_reduction_report": {

            "prevented_waste_estimate": f"{fresh_count} safe consumptions recorded",

            "immediate_risk_items": at_risk_inv + expired_inv,

            "rotation_strategy": "FEFO (First-Expired, First-Out)"

        },

        "storage_condition_report": {

            "monitoring_status": "Active / Parameter Evaluation Enabled",

            "active_categories_tracked": len(set(it.category for it in inventory if it.category))

        }

    }

def _build_stats_summary(predictions: List[Any]) -> Dict[str, Any]:

    total = len(predictions)

    fresh_cnt = sum(1 for p in predictions if (getattr(p, "result", "") or "").lower() == "fresh")

    spoiled_cnt = sum(1 for p in predictions if (getattr(p, "result", "") or "").lower() == "spoiled")

    avg_score = round(sum(getattr(p, "freshness_score", 0.0) or 0.0 for p in predictions) / total, 1) if total > 0 else 0.0

    return {

        "total_analyses": total,

        "fresh_count": fresh_cnt,

        "spoiled_count": spoiled_cnt,

        "avg_freshness": avg_score,

        "fresh_pct": round((fresh_cnt / total) * 100, 1) if total > 0 else 0.0

    }

def _build_alerts_summary(inventory: List[Any]) -> List[Dict[str, Any]]:

    today = date.today()

    alerts = []

    for it in inventory:

        days_left = None

        if getattr(it, "expiry_date", None):

            try:

                exp = datetime.strptime(it.expiry_date, "%Y-%m-%d").date()

                days_left = (exp - today).days

            except Exception:

                pass

        status_lower = (getattr(it, "freshness_status", "") or "").lower()

        if days_left is not None and days_left < 0:

            alerts.append({

                "item_name": it.food_name,

                "alert_type": "EXPIRED",

                "days_left": days_left,

                "priority": "CRITICAL",

                "action_required": "Dispose safely / Prevent cross-contamination"

            })

        elif days_left is not None and days_left <= 2:

            alerts.append({

                "item_name": it.food_name,

                "alert_type": "NEAR EXPIRY",

                "days_left": days_left,

                "priority": "HIGH",

                "action_required": "Immediate consumption or markdown"

            })

        elif status_lower in ["near spoilage", "spoiled"]:

            alerts.append({

                "item_name": it.food_name,

                "alert_type": "QUALITY DEGRADATION",

                "days_left": days_left if days_left is not None else "N/A",

                "priority": "HIGH",

                "action_required": "Isolate from fresh inventory"

            })

    return alerts

@app.get("/reports/export")
def export_report_endpoint(
    user_id: Optional[int] = Query(None),
    report_type: str = Query("inventory"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    rtype = report_type.lower().strip()

    # Query records with RBAC
    i_query = db.query(models.Inventory)
    p_query = db.query(models.PredictionHistory)

    if scope == "private" and resolved_id is not None:
        i_query = i_query.filter(models.Inventory.user_id == resolved_id)
        p_query = p_query.filter(models.PredictionHistory.user_id == resolved_id)

    inventory_items = i_query.all()
    prediction_items = p_query.order_by(models.PredictionHistory.id.desc()).all()

    stats = _build_stats_summary(prediction_items)

    alerts = _build_alerts_summary(inventory_items)

    user_name = "Authorized Inspector"

    if user_id is not None:

        u = db.query(models.User).filter(models.User.id == user_id).first()

        if u and u.name:

            user_name = f"{u.name} ({u.role})"

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # 1. EXCEL EXPORT

    if rtype in ["excel", "xlsx"]:

        excel_bytes = generate_excel_report(inventory_items, prediction_items, stats)

        filename = f"freshsense_audit_report_{timestamp}.xlsx"

        logger.info(f"Generated Excel export ({len(excel_bytes)} bytes) for user_id={user_id}")

        return Response(

            content=excel_bytes,

            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

            headers={"Content-Disposition": f"attachment; filename={filename}"}

        )

    # 2. PDF AUDIT EXPORT

    elif rtype == "pdf":

        pdf_bytes = generate_pdf_report(inventory_items, prediction_items, stats, alerts, user_name)

        filename = f"freshsense_inspection_audit_{timestamp}.pdf"

        logger.info(f"Generated PDF export ({len(pdf_bytes)} bytes) for user_id={user_id}")

        return Response(

            content=pdf_bytes,

            media_type="application/pdf",

            headers={"Content-Disposition": f"attachment; filename={filename}"}

        )

    # 3. CSV EXPORT (INVENTORY)

    elif rtype == "inventory":

        output = io.StringIO()

        writer = csv.writer(output)

        writer.writerow([

            "ID", "Food Name", "Category", "Quantity", "Unit", "Batch Info",

            "Purchase Date", "Expiry Date", "Freshness Status", "Temperature (C)",

            "Humidity (%)", "Storage Location", "Consumption Priority", "Created At"

        ])

        for it in inventory_items:

            writer.writerow([

                it.id, it.food_name, it.category, it.quantity, it.unit, it.batch_info,

                it.purchase_date, it.expiry_date, it.freshness_status, it.storage_temperature,

                it.humidity, it.storage_location, it.consumption_priority, it.created_at

            ])

        filename = f"freshsense_inventory_{datetime.utcnow().strftime('%Y%m%d')}.csv"

        return Response(

            content=output.getvalue(),

            media_type="text/csv",

            headers={"Content-Disposition": f"attachment; filename={filename}"}

        )

    # 4. CSV EXPORT (PREDICTIONS)

    else:

        output = io.StringIO()

        writer = csv.writer(output)

        writer.writerow([

            "ID", "Image Name", "Result", "Grade", "Confidence (%)",

            "Freshness Score (%)", "Color Condition", "Texture Condition",

            "Overall Quality Score", "Shelf Life (Days)", "Created At"

        ])

        for p in prediction_items:

            writer.writerow([

                p.id, p.image_name, p.result, p.grade, p.confidence,

                p.freshness_score, p.color_condition, p.texture_condition,

                p.overall_quality_score, p.estimated_shelf_life_days, p.created_at

            ])

        filename = f"freshsense_analyses_{datetime.utcnow().strftime('%Y%m%d')}.csv"

        return Response(

            content=output.getvalue(),

            media_type="text/csv",

            headers={"Content-Disposition": f"attachment; filename={filename}"}

        )

@app.get("/reports/export-excel")
def export_excel_report_direct(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    return export_report_endpoint(user_id=user_id, report_type="excel", x_user_id=x_user_id, x_user_role=x_user_role, db=db)

@app.get("/reports/export-pdf")
def export_pdf_report_direct(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    return export_report_endpoint(user_id=user_id, report_type="pdf", x_user_id=x_user_id, x_user_role=x_user_role, db=db)

# =========================================================

# ADMIN & SYSTEM MONITORING ENDPOINTS

# =========================================================

@app.get("/admin/users")

def get_admin_users(

    search: Optional[str] = Query(None),

    role: Optional[str] = Query(None),

    db: Session = Depends(get_db)

):

    query = db.query(models.User)

    if search:

        s = f"%{search.strip().lower()}%"

        query = query.filter((models.User.name.ilike(s)) | (models.User.email.ilike(s)))

    if role and role != "All":

        query = query.filter(models.User.role == role)

    users = query.order_by(models.User.id.asc()).all()

    user_list = []

    for u in users:

        pred_cnt = db.query(models.PredictionHistory).filter(models.PredictionHistory.user_id == u.id).count()

        inv_cnt = db.query(models.Inventory).filter(models.Inventory.user_id == u.id).count()

        user_list.append({

            "id": u.id,

            "name": u.name,

            "email": u.email,

            "role": u.role,

            "is_active": getattr(u, "is_active", True) if getattr(u, "is_active", None) is not None else True,

            "created_at": u.created_at.isoformat() if u.created_at else None,

            "prediction_count": pred_cnt,

            "inventory_count": inv_cnt

        })

    return {"users": user_list, "total_count": len(user_list)}

@app.put("/admin/users/{user_id}/status")

def update_user_status(

    user_id: int,

    payload: UserStatusUpdateRequest,

    db: Session = Depends(get_db)

):

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail="User not found."

        )

    user.is_active = payload.is_active

    if payload.role:

        user.role = payload.role

    try:

        db.commit()

        db.refresh(user)

    except Exception as e:

        db.rollback()

        logger.error(f"Failed to update user {user_id} status: {e}")

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail="Failed to update user status."

        )

    logger.info(f"Admin updated user ID {user_id} ({user.email}) status: is_active={user.is_active}, role={user.role}")

    return {

        "success": True,

        "message": f"User '{user.name}' updated successfully.",

        "user": {

            "id": user.id,

            "name": user.name,

            "email": user.email,

            "role": user.role,

            "is_active": user.is_active

        }

    }

@app.get("/admin/analytics")

def get_admin_analytics(

    db: Session = Depends(get_db)

):

    total_users = db.query(models.User).count()

    active_users = db.query(models.User).filter(models.User.is_active == True).count()

    inactive_users = total_users - active_users

    all_users = db.query(models.User.role).all()

    roles_distribution = {}

    for (r,) in all_users:

        role_name = r or "Consumer"

        roles_distribution[role_name] = roles_distribution.get(role_name, 0) + 1

    total_preds = db.query(models.PredictionHistory).count()

    fresh_preds = db.query(models.PredictionHistory).filter(models.PredictionHistory.result.ilike("fresh")).count()

    spoiled_preds = db.query(models.PredictionHistory).filter(models.PredictionHistory.result.ilike("spoiled")).count()

    all_scores = [p.freshness_score for p in db.query(models.PredictionHistory.freshness_score).all() if p.freshness_score is not None]

    avg_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0

    total_inv = db.query(models.Inventory).count()

    inv_items = db.query(models.Inventory).all()

    today = date.today()

    expired_cnt = 0

    near_expiry_cnt = 0

    for it in inv_items:

        if it.expiry_date:

            try:

                exp = datetime.strptime(it.expiry_date, "%Y-%m-%d").date()

                if (exp - today).days < 0:

                    expired_cnt += 1

                elif (exp - today).days <= 3:

                    near_expiry_cnt += 1

            except Exception:

                pass

    return {

        "user_analytics": {

            "total_users": total_users,

            "active_users": active_users,

            "inactive_users": inactive_users,

            "roles_distribution": roles_distribution

        },

        "inspection_analytics": {

            "total_inspections": total_preds,

            "fresh_inspections": fresh_preds,

            "spoiled_inspections": spoiled_preds,

            "average_freshness_score": avg_score,

            "quality_compliance_pct": f"{round(fresh_preds / total_preds * 100, 1)}%" if total_preds > 0 else "N/A"

        },

        "inventory_analytics": {

            "total_items": total_inv,

            "expired_items": expired_cnt,

            "near_expiry_items": near_expiry_cnt,

            "stable_items": max(0, total_inv - expired_cnt - near_expiry_cnt)

        }

    }

@app.get("/admin/system-status")

def get_system_status():

    fresh_dir = DATASET_DIR / "fresh"

    spoiled_dir = DATASET_DIR / "spoiled"

    fresh_count = len([f for f in fresh_dir.iterdir() if f.is_file()]) if fresh_dir.exists() else 0

    spoiled_count = len([f for f in spoiled_dir.iterdir() if f.is_file()]) if spoiled_dir.exists() else 0

    return {

        "system_status": "Healthy / Operational",

        "api_version": "2.0.0 Enterprise",

        "server_time": datetime.utcnow().isoformat() + "Z",

        "model_status": {

            "loaded": model is not None,

            "architecture": "MobileNetV2 Transfer Learning",

            "weights_file": "freshness_model.keras",

            "input_resolution": "224x224x3",

            "task": "Binary Fresh/Spoiled + Computer Vision Feature Analysis"

        },

        "database_status": {

            "status": "Connected",

            "engine": "PostgreSQL",

            "pool_pre_ping": True

        },

        "dataset_status": {

            "fresh_images": fresh_count,

            "spoiled_images": spoiled_count,

            "total_images": fresh_count + spoiled_count

        },

        "features_available": [

            "AI Freshness Classification",

            "Color & Texture CV Analysis",

            "Surface Defect & Mold Detection",

            "FEFO Inventory Management",

            "Shelf-Life Forecasting",

            "Storage Condition Matrix",

            "Real-Time Quality Alerts",

            "PDF Export (ReportLab)",

            "Excel Export (OpenPyXL)",

            "CSV Export",

            "Role-Based Access Control",

            "User Management & Auditing"

        ]

    }

# =========================================================

# GET PREDICTION HISTORY (LEGACY COMPATIBLE)

# =========================================================

@app.get("/history")
def get_history(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    query = db.query(models.PredictionHistory)
    if scope == "private" and resolved_id is not None:
        query = query.filter(models.PredictionHistory.user_id == resolved_id)

    records = query.order_by(models.PredictionHistory.created_at.desc()).all()

    return [

        {

            "id": record.id,

            "user_id": record.user_id,

            "image_name": record.image_name,

            "result": record.result,

            "grade": record.grade or record.result,

            "confidence": record.confidence,

            "freshness_score": (

                round(record.freshness_score, 2)

                if record.freshness_score is not None

                else (record.confidence if (record.result or "").lower() == "fresh" else round(100.0 - record.confidence, 2))

            ),

            "color_condition": record.color_condition,

            "texture_condition": record.texture_condition,

            "overall_quality_score": record.overall_quality_score,

            "estimated_shelf_life_days": record.estimated_shelf_life_days,

            "created_at": record.created_at.isoformat() if record.created_at else None

        }

        for record in records

    ]

# =========================================================

# GET STATISTICS (LEGACY COMPATIBLE)

# =========================================================

@app.get("/statistics")
def get_statistics(
    user_id: Optional[int] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    scope, resolved_id = resolve_access_scope(db, user_id=user_id, x_user_id=x_user_id, x_user_role=x_user_role)
    query = db.query(models.PredictionHistory)
    if scope == "private" and resolved_id is not None:
        query = query.filter(models.PredictionHistory.user_id == resolved_id)

    records = query.all()

    total_analyses = len(records)

    fresh_count = 0

    spoiled_count = 0

    total_confidence = 0.0

    total_freshness_score = 0.0

    grade_distribution = {

        "Fresh": 0,

        "Good": 0,

        "Acceptable": 0,

        "Near Spoilage": 0,

        "Spoiled": 0

    }

    for record in records:

        res = (record.result or "").lower()

        if res == "fresh":

            fresh_count += 1

        elif res == "spoiled":

            spoiled_count += 1

        total_confidence += (record.confidence or 0.0)

        fscore = record.freshness_score

        if fscore is None:

            fscore = record.confidence if res == "fresh" else (100.0 - (record.confidence or 0.0))

        total_freshness_score += fscore

        g = record.grade

        if not g:

            if fscore >= 85.0:

                g = "Fresh"

            elif fscore >= 70.0:

                g = "Good"

            elif fscore >= 50.0:

                g = "Acceptable"

            elif fscore >= 25.0:

                g = "Near Spoilage"

            else:

                g = "Spoiled"

        if g in grade_distribution:

            grade_distribution[g] += 1

        else:

            matched = False

            for k in grade_distribution:

                if k.lower() == g.lower():

                    grade_distribution[k] += 1

                    matched = True

                    break

            if not matched:

                grade_distribution["Spoiled" if res == "spoiled" else "Fresh"] += 1

    if total_analyses > 0:

        avg_confidence = round(total_confidence / total_analyses, 2)

        avg_freshness = round(total_freshness_score / total_analyses, 2)

        fresh_pct = round((fresh_count / total_analyses) * 100, 2)

    else:

        avg_confidence = 0.0

        avg_freshness = 0.0

        fresh_pct = 0.0

    return {

        "total_analyses": total_analyses,

        "total_analyzes": total_analyses,

        "fresh": fresh_count,

        "spoiled": spoiled_count,

        "average_confidence": avg_confidence,

        "average_freshness_score": avg_freshness,

        "fresh_percentage": fresh_pct,

        "grade_distribution": grade_distribution

    }

# =========================================================

# GET DATASET INFORMATION

# =========================================================

@app.get("/dataset-info")

def get_dataset_info():

    fresh_dir = DATASET_DIR / "fresh"

    spoiled_dir = DATASET_DIR / "spoiled"

    fresh_count = 0

    spoiled_count = 0

    exists = False

    if fresh_dir.exists() and spoiled_dir.exists():

        exists = True

        try:

            fresh_count = len([f for f in fresh_dir.iterdir() if f.is_file()])

            spoiled_count = len([f for f in spoiled_dir.iterdir() if f.is_file()])

        except Exception as e:

            print("Error reading dataset counts:", e)

    return {

        "dataset_exists": exists,

        "fresh_images": fresh_count,

        "spoiled_images": spoiled_count,

        "total_images": fresh_count + spoiled_count

    }

# =========================================================

# RUN MAIN

# =========================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(

        "main:app",

        host="0.0.0.0",

        port=int(os.getenv("PORT", "8001")),

        reload=True

    )
