from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal
import models
import schemas
import auth
import numpy as np
from PIL import Image
import io
import tensorflow as tf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMG_SIZE = (160, 160)
freshness_model = tf.keras.models.load_model("freshness_model.keras")
CLASS_NAMES = ["fresh", "spoiled"]


def get_quality_score_and_category(spoiled_probability: float):
    quality_score = round((1 - spoiled_probability) * 100, 2)

    if spoiled_probability < 0.10:
        category = "Fresh"
    elif spoiled_probability < 0.30:
        category = "Good"
    elif spoiled_probability < 0.50:
        category = "Acceptable"
    elif spoiled_probability < 0.75:
        category = "Near Spoilage"
    else:
        category = "Spoiled"

    return quality_score, category


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "Food freshness API is alive"}


@app.get("/food/{food_name}")
def get_food(food_name: str):
    return {"food": food_name, "status": "checking freshness..."}


@app.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        name=user.name,
        email=user.email,
        hashed_password=auth.hash_password(user.password),
        role=user.role or "consumer",
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()

    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = auth.create_access_token(data={"sub": db_user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "name": db_user.name,
            "email": db_user.email,
            "role": db_user.role,
        },
    }


@app.get("/me", response_model=schemas.UserOut)
def get_me(
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    return current_user


@app.post("/food", response_model=schemas.FoodItemOut)
def add_food(
    food: schemas.FoodItemCreate,
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    new_food = models.FoodItem(
        name=food.name,
        category=food.category,
        quantity=food.quantity,
        expiry_date=food.expiry_date,
        batch_number=food.batch_number,
        storage_temp=food.storage_temp,
        owner_id=current_user.id,
    )

    db.add(new_food)
    db.commit()
    db.refresh(new_food)

    return new_food


@app.get("/food", response_model=list[schemas.FoodItemOut])
def list_food(
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    return db.query(models.FoodItem).filter(models.FoodItem.owner_id == current_user.id).all()


@app.put("/food/{food_id}", response_model=schemas.FoodItemOut)
def update_food(
    food_id: int,
    food: schemas.FoodItemCreate,
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    food_item = db.query(models.FoodItem).filter(
        models.FoodItem.id == food_id,
        models.FoodItem.owner_id == current_user.id,
    ).first()

    if not food_item:
        raise HTTPException(status_code=404, detail="Food item not found")

    food_item.name = food.name
    food_item.category = food.category
    food_item.quantity = food.quantity
    food_item.expiry_date = food.expiry_date
    food_item.batch_number = food.batch_number
    food_item.storage_temp = food.storage_temp

    db.commit()
    db.refresh(food_item)

    return food_item


@app.delete("/food/{food_id}")
def delete_food(
    food_id: int,
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    food_item = db.query(models.FoodItem).filter(
        models.FoodItem.id == food_id,
        models.FoodItem.owner_id == current_user.id,
    ).first()

    if not food_item:
        raise HTTPException(status_code=404, detail="Food item not found")

    db.query(models.FreshnessAnalysis).filter(
        models.FreshnessAnalysis.food_item_id == food_id
    ).delete()

    db.delete(food_item)
    db.commit()

    return {"message": "Food item deleted successfully"}


import cv_engine

@app.post("/analyze-freshness", response_model=schemas.FreshnessAnalysisOut)
async def analyze_freshness(
    food_item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    food_item = db.query(models.FoodItem).filter(
        models.FoodItem.id == food_item_id,
        models.FoodItem.owner_id == current_user.id,
    ).first()

    if not food_item:
        raise HTTPException(status_code=404, detail="Food item not found")

    image_bytes = await file.read()
    raw_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # 1. Run OpenCV Sub-feature extractors
    color_score, browning_pct = cv_engine.analyze_color_degradation(raw_image)
    mold_score, bruising_score, mold_pct, bruising_pct = cv_engine.analyze_mold_and_bruising(raw_image)

    # 2. Run MobileNetV2 CNN inference
    resized_image = raw_image.resize(IMG_SIZE)
    img_array = np.array(resized_image)
    img_array = tf.keras.applications.mobilenet_v2.preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)

    prediction = freshness_model.predict(img_array)[0][0]

    if prediction < 0.5:
        label = CLASS_NAMES[0]
        confidence = 1.0 - prediction
    else:
        label = CLASS_NAMES[1]
        confidence = prediction

    # 3. Section 4.7 Weighted Model Calculation
    weighted_res = cv_engine.calculate_section_47_weighted_score(
        cnn_spoiled_prob=float(prediction),
        color_score=color_score,
        mold_score=mold_score,
        bruising_score=bruising_score,
        category=food_item.category,
        storage_temp=food_item.storage_temp,
        expiry_date_str=food_item.expiry_date,
    )

    analysis = models.FreshnessAnalysis(
        food_item_id=food_item.id,
        owner_id=current_user.id,
        label=label,
        confidence=float(confidence),
        quality_score=weighted_res["final_score"],
        category=weighted_res["category_rating"],
        color_score=color_score,
        mold_score=mold_score,
        bruising_score=bruising_score,
        visual_score=weighted_res["visual_score"],
        storage_score=weighted_res["storage_score"],
        shelflife_days=weighted_res["shelflife_days"],
        age_score=weighted_res["age_score"],
    )

    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return analysis


@app.get("/food/{food_id}/trend", response_model=list[schemas.FreshnessAnalysisOut])
def get_food_freshness_trend(
    food_id: int,
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    return db.query(models.FreshnessAnalysis).filter(
        models.FreshnessAnalysis.food_item_id == food_id,
        models.FreshnessAnalysis.owner_id == current_user.id,
    ).order_by(models.FreshnessAnalysis.created_at.asc()).all()


@app.get("/freshness-reports", response_model=list[schemas.FreshnessAnalysisOut])
def get_freshness_reports(
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    return db.query(models.FreshnessAnalysis).filter(
        models.FreshnessAnalysis.owner_id == current_user.id
    ).order_by(models.FreshnessAnalysis.created_at.desc()).all()


@app.get("/freshness-summary", response_model=schemas.FreshnessSummaryOut)
def get_freshness_summary(
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    total_items = db.query(models.FoodItem).filter(models.FoodItem.owner_id == current_user.id).count()
    analyses = db.query(models.FreshnessAnalysis).filter(models.FreshnessAnalysis.owner_id == current_user.id).all()

    total_analyzed = len(analyses)
    avg_quality = round(sum(a.quality_score for a in analyses) / total_analyzed, 2) if total_analyzed > 0 else 0.0
    fresh_count = sum(1 for a in analyses if a.label == "fresh")
    spoiled_count = sum(1 for a in analyses if a.label == "spoiled")

    return {
        "total_items": total_items,
        "total_analyzed": total_analyzed,
        "avg_quality_score": avg_quality,
        "fresh_count": fresh_count,
        "spoiled_count": spoiled_count,
    }

import recommendation_engine

@app.get("/food/{food_id}/recommendations")
def get_recommendations(
    food_id: int,
    db: Session = Depends(get_db),
    current_user_email: str = Depends(auth.get_current_user_email),
):
    current_user = db.query(models.User).filter(models.User.email == current_user_email).first()

    food_item = db.query(models.FoodItem).filter(
        models.FoodItem.id == food_id,
        models.FoodItem.owner_id == current_user.id,
    ).first()

    if not food_item:
        raise HTTPException(status_code=404, detail="Food item not found")

    analysis = db.query(models.FreshnessAnalysis).filter(
        models.FreshnessAnalysis.food_item_id == food_id,
        models.FreshnessAnalysis.owner_id == current_user.id,
    ).order_by(models.FreshnessAnalysis.created_at.desc()).first()

    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this food item")

    recs = recommendation_engine.generate_recommendations(analysis, food_item)
    return recs