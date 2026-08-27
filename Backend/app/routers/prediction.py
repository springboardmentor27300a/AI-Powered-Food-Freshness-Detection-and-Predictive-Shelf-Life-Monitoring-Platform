from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/prediction", tags=["Shelf-Life Prediction & Environmental Analysis"])

class ShelfLifeRequest(BaseModel):
    category: str = Field("Fruits", example="Fruits")
    harvest_date: Optional[str] = Field("2026-08-20", example="2026-08-20")
    storage_temp_celsius: float = Field(3.5, example=3.5)
    storage_humidity_percent: float = Field(87.0, example=87.0)
    visual_score: int = Field(90, ge=0, le=100, example=90)

class ShelfLifeResponse(BaseModel):
    remaining_days: int
    optimal_temp_celsius: float
    optimal_humidity_percent: float
    decay_rate_multiplier: float
    weighted_freshness_score: int
    freshness_status: str
    risk_level: str
    predicted_expiry_date: str
    recommendation: str

@router.post("/shelf-life", response_model=ShelfLifeResponse)
async def predict_shelf_life(req: ShelfLifeRequest):
    """
    Computes remaining shelf life based on temperature, humidity, harvest age, and visual freshness score.
    Enforces PRD Weighted Scoring Matrix:
    - Visual Condition Analysis: 40%
    - Storage Conditions: 25%
    - Shelf-Life Prediction: 20%
    - Product Age: 15%
    """
    # Standard optimal parameters per category
    optimal_specs = {
        "Fruits": {"temp": 3.0, "humidity": 88.0, "base_days": 25},
        "Vegetables": {"temp": 4.0, "humidity": 90.0, "base_days": 18},
        "Dairy Products": {"temp": 2.0, "humidity": 75.0, "base_days": 14},
        "Meat & Poultry": {"temp": 1.0, "humidity": 70.0, "base_days": 7},
        "Seafood": {"temp": 0.5, "humidity": 70.0, "base_days": 5},
        "Bakery Products": {"temp": 18.0, "humidity": 60.0, "base_days": 6},
    }
    
    spec = optimal_specs.get(req.category, {"temp": 4.0, "humidity": 85.0, "base_days": 14})
    
    # Calculate age in days
    try:
        h_date = datetime.strptime(req.harvest_date, "%Y-%m-%d")
        age_days = (datetime.utcnow() - h_date).days
        if age_days < 0: age_days = 0
    except Exception:
        age_days = 5

    # Storage condition impact score (0-100)
    temp_diff = abs(req.storage_temp_celsius - spec["temp"])
    humidity_diff = abs(req.storage_humidity_percent - spec["humidity"])
    
    storage_score = max(0, 100 - int(temp_diff * 12 + humidity_diff * 1.5))
    
    # Decay rate multiplier based on temperature elevation
    if req.storage_temp_celsius > spec["temp"]:
        decay_multiplier = round(1.0 + (req.storage_temp_celsius - spec["temp"]) * 0.22, 2)
    else:
        decay_multiplier = 1.0

    # Age score (0-100)
    max_lifespan = spec["base_days"]
    age_score = max(0, 100 - int((age_days / max_lifespan) * 100))

    # Remaining days prediction
    raw_remaining = (max_lifespan - age_days) / decay_multiplier
    visual_factor = req.visual_score / 100.0
    remaining_days = max(0, int(raw_remaining * visual_factor))

    # Shelf life prediction score component
    shelf_life_score = min(100, int((remaining_days / max_lifespan) * 100))

    # PRD Weighted Final Health Score
    # Visual 40%, Storage 25%, Shelf-Life 20%, Age 15%
    weighted_score = int(
        (req.visual_score * 0.40) +
        (storage_score * 0.25) +
        (shelf_life_score * 0.20) +
        (age_score * 0.15)
    )

    if weighted_score >= 88:
        status_str = "Fresh"
        risk = "Low"
        rec = "Optimal freshness. Maintain current cold room storage parameters."
    elif weighted_score >= 70:
        status_str = "Good"
        risk = "Low"
        rec = "Good condition. Monitor temperature stability to avoid decay acceleration."
    elif weighted_score >= 50:
        status_str = "Acceptable"
        risk = "Medium"
        rec = "Acceptable freshness. Prioritize for retail distribution (FEFO rotation)."
    elif weighted_score >= 30:
        status_str = "Near Spoilage"
        risk = "High"
        rec = "Near spoilage! Apply dynamic price discount or channel to quick processing."
    else:
        status_str = "Spoiled"
        risk = "Critical"
        rec = "Item spoiled! Quarantine and discard to prevent contamination."

    exp_date = (datetime.utcnow() + timedelta(days=remaining_days)).strftime("%Y-%m-%d")

    return ShelfLifeResponse(
        remaining_days=remaining_days,
        optimal_temp_celsius=spec["temp"],
        optimal_humidity_percent=spec["humidity"],
        decay_rate_multiplier=decay_multiplier,
        weighted_freshness_score=weighted_score,
        freshness_status=status_str,
        risk_level=risk,
        predicted_expiry_date=exp_date,
        recommendation=rec
    )
