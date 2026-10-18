import io
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .analysis import router as analysis_router
from .database import Base, engine, get_db
from .m2_v2 import router as m2_v2_router
from .m3 import router as m3_router
from .notifications import router as notifications_router
from .report_routes import router as reports_router
from .models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition
from .schemas import (
    RegisterRequest, LoginRequest, UserResponse, TokenResponse,
    FoodCreate, FoodResponse, ExpiringSoonItem, ROLES,
    ProfileUpdateRequest, FoodUpdate,
)
from .auth import hash_password, verify_password, create_token, get_current_user, require_admin
from .ml.assessment import is_model_ready


_REAL_CLASSIFIER = None
_REAL_WEIGHTS = None


def _load_real_classifier():
    global _REAL_CLASSIFIER, _REAL_WEIGHTS
    if _REAL_CLASSIFIER is not None and _REAL_WEIGHTS is not None:
        return _REAL_CLASSIFIER, _REAL_WEIGHTS

    import torch
    from torchvision import models

    weights = models.MobileNet_V2_Weights.DEFAULT
    model = models.mobilenet_v2(weights=weights)
    model.eval()
    _REAL_CLASSIFIER = model
    _REAL_WEIGHTS = weights
    return model, weights


# A4: Replace deprecated @app.on_event("startup") with the modern lifespan pattern.
# Behaviour is identical: create all tables once on startup, continue in degraded
# mode if the database is unreachable.
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized successfully")
    except Exception as e:
        print(f"Warning: Could not initialize database: {e}")
        print("App will continue running in degraded mode.")
    yield
    # Nothing to clean up on shutdown at this time.


app = FastAPI(
    title="AI Food Freshness Monitoring Platform API",
    version="1.0.0",
    description="Milestone 1 API: authentication and food inventory workflow.",
    lifespan=lifespan,
)

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
origins = configured_origins or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://0.0.0.0:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

app.include_router(analysis_router)
app.include_router(m2_v2_router)
app.include_router(m3_router)
app.include_router(notifications_router)
app.include_router(reports_router)


def admin_platform_stats(db: Session) -> dict:
    """Return platform totals and seven-day activity using portable datetimes."""
    cutoff = datetime.utcnow() - timedelta(days=7)
    return {
        "total_users": db.scalar(select(func.count(User.id))) or 0,
        "total_inventory_items": db.scalar(select(func.count(FoodItem.id))) or 0,
        "total_analyses": db.scalar(select(func.count(FreshnessAnalysis.id))) or 0,
        "total_predictions": db.scalar(select(func.count(ShelfLifePrediction.id))) or 0,
        "total_storage_records": db.scalar(select(func.count(StorageCondition.id))) or 0,
        "recent_analyses_7d": db.scalar(select(func.count(FreshnessAnalysis.id)).where(FreshnessAnalysis.created_at >= cutoff)) or 0,
        "recent_predictions_7d": db.scalar(select(func.count(ShelfLifePrediction.id)).where(ShelfLifePrediction.created_at >= cutoff)) or 0,
    }


@app.get("/admin/users")
def admin_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    users = db.scalars(select(User).order_by(User.id)).all()
    return [
        {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}
        for user in users
    ]


@app.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    return admin_platform_stats(db)


@app.get("/dashboard/data")
def dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inventory = db.scalars(
        select(FoodItem).where(FoodItem.created_by == current_user.id)
        .order_by(FoodItem.created_at.desc())
    ).all()
    analyses = db.scalars(
        select(FreshnessAnalysis).where(FreshnessAnalysis.user_id == current_user.id)
        .order_by(FreshnessAnalysis.created_at.desc())
    ).all()
    predictions = db.scalars(
        select(ShelfLifePrediction).where(ShelfLifePrediction.user_id == current_user.id)
        .order_by(ShelfLifePrediction.created_at.desc())
    ).all()
    storage_conditions = db.scalars(
        select(StorageCondition).where(StorageCondition.user_id == current_user.id)
        .order_by(StorageCondition.observed_at.desc())
    ).all()

    data = {
        "role": current_user.role,
        "inventory": inventory,
        "analyses": analyses,
        "predictions": predictions,
        "storage_conditions": storage_conditions,
    }
    if current_user.role == "administrator":
        data["users"] = [
            {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}
            for user in db.scalars(select(User).order_by(User.id)).all()
        ]
        data["platform_stats"] = admin_platform_stats(db)
    elif current_user.role == "retail_manager":
        data["shelf_life_alerts"] = [p for p in predictions if p.remaining_shelf_life_days <= 3]
        data["waste_insights"] = {
            "expired_count": sum(item.expiry_date < date.today() for item in inventory),
            "inventory_count": len(inventory),
        }
    elif current_user.role == "warehouse_operator":
        data["environmental_analytics"] = {
            "storage_records_count": len(storage_conditions),
            "average_temperature_c": (
                sum(row.temperature_c for row in storage_conditions) / len(storage_conditions)
                if storage_conditions else None
            ),
        }
    return data

@app.get("/real/ml/health")
def real_ml_health():
    try:
        model, weights = _load_real_classifier()
        return {
            "status": "ok",
            "service": "food-freshness-api",
            "ml_available": True,
            "model_status": "real_public_model_loaded",
            "model_name": "MobileNetV2",
            "source": "torchvision public ImageNet weights",
            "labels_count": len(weights.meta["categories"]),
            "note": "This is a real public classifier, not a validated food-freshness model.",
        }
    except Exception:  # pragma: no cover - environment dependent
        return {
            "status": "error",
            "service": "food-freshness-api",
            "ml_available": False,
            "model_status": "load_failed",
        }


@app.post("/real/predict")
async def real_predict(file: UploadFile = File(...)):
    try:
        model, weights = _load_real_classifier()
        data = await file.read()
        image = Image.open(io.BytesIO(data)).convert("RGB")
        preprocess = weights.transforms()
        tensor = preprocess(image).unsqueeze(0)

        import torch

        with torch.no_grad():
            logits = model(tensor)
        probs = torch.softmax(logits[0], dim=0)
        top5_probs, top5_idx = torch.topk(probs, 5)

        labels = weights.meta["categories"]
        items = []
        for idx, prob in zip(top5_idx.tolist(), top5_probs.tolist()):
            items.append({
                "label": labels[idx],
                "confidence": round(float(prob), 6),
            })

        top_label = items[0]
        return {
            "status": "ok",
            "model_name": "MobileNetV2",
            "source": "torchvision public ImageNet weights",
            "classification": top_label["label"],
            "confidence": top_label["confidence"],
            "top_5": items,
            "note": "Real ML inference from a public model. This is not a validated freshness detector for food quality.",
        }
    except Exception as exc:
        # Keep implementation details out of the public response while retaining
        # the exception chain in server logs for diagnosis.
        print(f"Real prediction failed ({type(exc).__name__})")
        raise HTTPException(status_code=500, detail="Image prediction failed") from exc


@app.get("/health")
def health():
    ready = is_model_ready()
    return {
        "status": "ok",
        "service": "food-freshness-api",
        "ml_available": ready,
        "model_status": "ready" if ready else "not_trained",
    }


@app.get("/demo/health")
def demo_health():
    return {
        "status": "ok",
        "service": "food-freshness-api",
        "ml_available": False,
        "model_status": "demo_mock",
        "demo_mode": True,
        "message": "Demo mode only: no validated production freshness model is currently approved.",
        "sample_output": {
            "assessment_status": "demo_mock",
            "category": {
                "declared_category": "Fruits",
                "canonical_category": "Fruits",
                "capability_status": "demo_mock",
                "reason": "This is a mocked result for presentation only."
            },
            "freshness": {
                "status": "demo_mock",
                "classification": "Fresh",
                "confidence": 0.91,
                "quality_score": 90,
                "spoilage_probability": 0.09
            }
        },
    }


@app.post("/demo/predict")
def demo_predict():
    return {
        "assessment_status": "demo_mock",
        "image_format": "PNG",
        "image_width": 1024,
        "image_height": 768,
        "category": {
            "declared_category": "Fruits",
            "canonical_category": "Fruits",
            "declared_food_subtype": "apple",
            "capability_status": "demo_mock",
            "reason": "This response is mock-only for presentation and testing. No validated model is active.",
            "model_id": "demo-mock-model"
        },
        "freshness": {
            "status": "demo_mock",
            "reason": "Demo output only. No real ML prediction is being used.",
            "classification": "Fresh",
            "confidence": 0.91,
            "quality_score": 90,
            "spoilage_probability": 0.09,
            "class_probabilities": {
                "Fresh": 0.91,
                "Good": 0.06,
                "Acceptable": 0.02,
                "Near Spoilage": 0.01,
                "Spoiled": 0.00
            }
        },
        "defects": [],
        "visual_analysis": {
            "color": {
                "dominant_color_hex": "#7ACB7A",
                "discoloration_index": 0.08
            },
            "texture": {
                "texture_uniformity": 0.85,
                "surface_roughness": 0.15
            }
        },
        "limitations": [
            "This is mock data for presentation only.",
            "No validated production model is currently approved.",
            "This output does not establish food safety."
        ],
        "safety_notice": "Demo output only: use verified inspection and safety procedures for real decisions.",
    }


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    role = payload.role.lower()
    if role not in ROLES:
        raise HTTPException(400, "Invalid role")

    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_token(user),
        user=user,
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    return TokenResponse(
        access_token=create_token(user),
        user=user,
    )


@app.get("/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.put("/auth/me", response_model=UserResponse)
def update_me(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload is None:
        return current_user

    if payload.new_password is not None and payload.current_password is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="current_password is required when setting a new password",
        )

    if payload.new_password is not None:
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )
        current_user.password_hash = hash_password(payload.new_password)

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/inventory", response_model=FoodResponse, status_code=status.HTTP_201_CREATED)
def create_food(
    payload: FoodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = FoodItem(**payload.model_dump(), created_by=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/inventory", response_model=list[FoodResponse])
def list_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list(
        db.scalars(
            select(FoodItem)
            .where(FoodItem.created_by == current_user.id)
            .order_by(FoodItem.created_at.desc())
        )
    )


@app.put("/inventory/{food_id}", response_model=FoodResponse)
def update_food(
    food_id: int,
    payload: FoodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.scalar(
        select(FoodItem).where(
            FoodItem.id == food_id,
            FoodItem.created_by == current_user.id,
        )
    )
    if not item:
        raise HTTPException(404, "Food item not found")

    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.category is not None:
        item.category = payload.category.strip()
    if payload.batch_number is not None:
        item.batch_number = payload.batch_number.strip()
    if payload.quantity is not None:
        item.quantity = max(0, int(payload.quantity))
    if payload.expiry_date is not None:
        item.expiry_date = payload.expiry_date

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ============================================================
# B1 — Expiring-soon inventory endpoint
# ============================================================
# Registered before DELETE /inventory/{food_id} so FastAPI matches
# the fixed path segment "expiring-soon" before the int path parameter.

@app.get("/inventory/expiring-soon", response_model=list[ExpiringSoonItem])
def expiring_soon(
    days: int = Query(default=7, ge=1, le=365, description="Look-ahead window in days (1–365, default 7)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return inventory items whose expiry_date falls on or before today + `days`.

    Expired items (expiry_date < today) are always included — they are the most urgent.
    Results are ordered by expiry_date ascending (soonest / most overdue first).

    For each item the response includes the most recent M3 shelf-life prediction
    (risk_level, official_freshness_score, remaining_shelf_life_days) when one exists,
    and null for those fields when no prediction has been made yet.
    """
    today = date.today()
    cutoff = today + timedelta(days=days)

    items = list(db.scalars(
        select(FoodItem)
        .where(
            FoodItem.created_by == current_user.id,
            FoodItem.expiry_date <= cutoff,
        )
        .order_by(FoodItem.expiry_date.asc())
    ))

    if not items:
        return []

    # Fetch the most recent ShelfLifePrediction per food_item_id in one query.
    item_ids = [i.id for i in items]
    predictions_raw = list(db.scalars(
        select(ShelfLifePrediction)
        .where(
            ShelfLifePrediction.user_id == current_user.id,
            ShelfLifePrediction.food_item_id.in_(item_ids),
        )
        .order_by(ShelfLifePrediction.created_at.desc())
    ))
    # Keep only the newest prediction per item (results are already newest-first).
    latest_prediction: dict[int, ShelfLifePrediction] = {}
    for pred in predictions_raw:
        if pred.food_item_id not in latest_prediction:
            latest_prediction[pred.food_item_id] = pred

    result = []
    for item in items:
        days_until = (item.expiry_date - today).days
        pred = latest_prediction.get(item.id)
        result.append(ExpiringSoonItem(
            id=item.id,
            name=item.name,
            category=item.category,
            batch_number=item.batch_number,
            quantity=item.quantity,
            expiry_date=item.expiry_date,
            days_until_expiry=days_until,
            is_expired=days_until < 0,
            risk_level=pred.risk_level if pred else None,
            official_freshness_score=pred.official_freshness_score if pred else None,
            remaining_shelf_life_days=pred.remaining_shelf_life_days if pred else None,
        ))
    return result


@app.delete("/inventory/{food_id}")
def delete_food(
    food_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.scalar(
        select(FoodItem).where(
            FoodItem.id == food_id,
            FoodItem.created_by == current_user.id,
        )
    )
    if not item:
        raise HTTPException(404, "Food item not found")

    db.delete(item)
    db.commit()
    return {"message": "Food item deleted"}
