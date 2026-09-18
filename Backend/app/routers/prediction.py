from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import math

from app.db.mongodb import get_database
from app.models.schemas import (
    DecayCurvePoint,
    ShelfLifeSimulationRequest,
    ShelfLifeSimulationResponse,
)

router = APIRouter(prefix="/prediction", tags=["Shelf-Life Prediction & Environmental Analysis"])

# --- CATEGORY BIO-KINETIC REFERENCE STANDARDS ---
CATEGORY_SPECS = {
    "Fruits": {
        "temp": 3.0,
        "humidity": 88.0,
        "base_days": 25,
        "q10": 2.2,
        "optimal_pkg": "Modified Atmosphere (MAP)",
        "ethylene_class": "High Emitter / High Sensitivity"
    },
    "Vegetables": {
        "temp": 4.0,
        "humidity": 90.0,
        "base_days": 18,
        "q10": 2.3,
        "optimal_pkg": "Perforated Polyethylene",
        "ethylene_class": "Moderate Emitter / High Sensitivity"
    },
    "Dairy Products": {
        "temp": 2.0,
        "humidity": 75.0,
        "base_days": 14,
        "q10": 2.5,
        "optimal_pkg": "Vacuum Sealed",
        "ethylene_class": "Neutral"
    },
    "Meat & Poultry": {
        "temp": 1.0,
        "humidity": 70.0,
        "base_days": 7,
        "q10": 2.6,
        "optimal_pkg": "Vacuum Sealed",
        "ethylene_class": "Neutral"
    },
    "Seafood": {
        "temp": 0.5,
        "humidity": 70.0,
        "base_days": 5,
        "q10": 2.8,
        "optimal_pkg": "Modified Atmosphere (MAP)",
        "ethylene_class": "Neutral"
    },
    "Bakery Products": {
        "temp": 18.0,
        "humidity": 60.0,
        "base_days": 6,
        "q10": 1.8,
        "optimal_pkg": "Modified Atmosphere (MAP)",
        "ethylene_class": "Neutral"
    },
    "Packaged Foods": {
        "temp": 4.0,
        "humidity": 75.0,
        "base_days": 21,
        "q10": 2.0,
        "optimal_pkg": "Modified Atmosphere (MAP)",
        "ethylene_class": "Neutral"
    },
    "Beverages": {
        "temp": 3.5,
        "humidity": 70.0,
        "base_days": 30,
        "q10": 2.1,
        "optimal_pkg": "Vacuum Sealed",
        "ethylene_class": "Neutral"
    }
}

PACKAGING_FACTORS = {
    "Modified Atmosphere (MAP)": 0.55,
    "Vacuum Sealed": 0.65,
    "Perforated Polyethylene": 0.90,
    "Open Container / Ambient": 1.35
}

AIRFLOW_FACTORS = {
    "Optimal (Active)": 0.92,
    "Moderate": 1.00,
    "Stagnant": 1.25
}

def solve_bio_kinetic_model(
    category: str,
    harvest_date_str: Optional[str],
    storage_temp: float,
    storage_humidity: float,
    packaging: str,
    airflow: str,
    visual_score: int
) -> Dict[str, Any]:
    spec = CATEGORY_SPECS.get(category, {
        "temp": 4.0,
        "humidity": 85.0,
        "base_days": 16,
        "q10": 2.2,
        "optimal_pkg": "Modified Atmosphere (MAP)",
        "ethylene_class": "Moderate"
    })

    # 1. Product Age in Days
    try:
        if harvest_date_str:
            h_date = datetime.strptime(harvest_date_str[:10], "%Y-%m-%d")
            age_days = (datetime.utcnow() - h_date).days
            if age_days < 0:
                age_days = 0
        else:
            age_days = 3
    except Exception:
        age_days = 3

    # 2. Arrhenius / Q10 Temperature Multiplier
    # Rate increases exponentially as temperature exceeds optimal
    temp_delta = storage_temp - spec["temp"]
    q10 = spec["q10"]
    if temp_delta > 0:
        temp_multiplier = round(math.pow(q10, temp_delta / 10.0), 2)
    elif temp_delta < -3.0:
        # Chilling injury risk for tropical fruits/vegetables
        temp_multiplier = round(1.0 + abs(temp_delta + 3.0) * 0.15, 2)
    else:
        temp_multiplier = 1.0

    # 3. Humidity Impact Multiplier
    hum_diff = storage_humidity - spec["humidity"]
    if hum_diff < -10:
        # Moisture loss / transpirational shriveling
        hum_multiplier = round(1.0 + abs(hum_diff) * 0.018, 2)
    elif hum_diff > 8:
        # High condensation / mold sporulation risk
        hum_multiplier = round(1.0 + abs(hum_diff) * 0.022, 2)
    else:
        hum_multiplier = 1.0

    # 4. Packaging & Airflow Barrier Multipliers
    pkg_mult = PACKAGING_FACTORS.get(packaging, 1.0)
    air_mult = AIRFLOW_FACTORS.get(airflow, 1.0)

    total_decay_multiplier = round(temp_multiplier * hum_multiplier * pkg_mult * air_mult, 2)
    if total_decay_multiplier < 0.4:
        total_decay_multiplier = 0.4

    # 5. Base Lifespan and Remaining Calculation
    max_lifespan = spec["base_days"]
    effective_remaining_potential = max(0.0, float(max_lifespan - age_days))
    
    # Visual quality scaling
    visual_ratio = max(0.1, visual_score / 100.0)
    calculated_days = (effective_remaining_potential / total_decay_multiplier) * visual_ratio
    remaining_days = max(0, int(round(calculated_days)))
    remaining_hours = int(round(calculated_days * 24.0))

    # Optimal counterfactual comparison (optimal storage + optimal packaging)
    opt_pkg_mult = PACKAGING_FACTORS.get(spec["optimal_pkg"], 0.6)
    opt_decay = 1.0 * 1.0 * opt_pkg_mult * 0.92
    optimal_days = max(0, int(round((effective_remaining_potential / opt_decay) * visual_ratio)))
    extension_gain = max(0, optimal_days - remaining_days)

    # 6. Storage Condition Score (0-100)
    temp_penalty = abs(storage_temp - spec["temp"]) * 11.0
    hum_penalty = abs(storage_humidity - spec["humidity"]) * 1.6
    storage_score = max(0, int(100 - (temp_penalty + hum_penalty)))

    # 7. Age Score (0-100)
    age_score = max(0, int(100 - ((age_days / float(max_lifespan)) * 100)))

    # 8. Shelf Life Score (0-100)
    shelf_life_score = min(100, int((remaining_days / float(max_lifespan)) * 100))

    # 9. PRD Weighted Composite Score
    # Visual 40%, Storage 25%, Shelf-Life 20%, Age 15%
    weighted_score = int(
        (visual_score * 0.40) +
        (storage_score * 0.25) +
        (shelf_life_score * 0.20) +
        (age_score * 0.15)
    )
    weighted_score = max(5, min(100, weighted_score))

    # 10. Status & Risk Classification
    if weighted_score >= 88:
        status_str = "Fresh"
        risk = "Low"
        rec = "Optimal freshness. Maintain current cold room parameters to preserve cell turgidity."
    elif weighted_score >= 70:
        status_str = "Good"
        risk = "Low"
        rec = "Good condition. Keep cold-chain sealed and prevent ambient temperature fluctuations."
    elif weighted_score >= 50:
        status_str = "Acceptable"
        risk = "Medium"
        rec = "Acceptable freshness. Prioritize for immediate retail distribution (FEFO rotation)."
    elif weighted_score >= 30:
        status_str = "Near Spoilage"
        risk = "High"
        rec = "Near spoilage! Apply dynamic price discount or route to culinary processing."
    else:
        status_str = "Spoiled"
        risk = "Critical"
        rec = "Spoilage detected! Quarantine immediately to prevent ethylene cross-contamination."

    # 11. 30-Day Day-by-Day Decay Trajectory Curve
    decay_curve: List[DecayCurvePoint] = []
    current_k = total_decay_multiplier
    optimal_k = opt_decay

    max_points = min(30, max_lifespan + 7)
    for d in range(0, max_points + 1):
        # Current condition drop
        loss_current = (d * current_k * 4.2)
        score_curr = max(0, int(weighted_score - loss_current))
        
        # Optimal condition drop
        loss_opt = (d * optimal_k * 4.2)
        score_opt = max(0, int(weighted_score - loss_opt))

        if score_curr >= 88:
            pt_status = "Fresh"
        elif score_curr >= 70:
            pt_status = "Good"
        elif score_curr >= 50:
            pt_status = "Acceptable"
        elif score_curr >= 30:
            pt_status = "Near Spoilage"
        else:
            pt_status = "Spoiled"

        decay_curve.append(DecayCurvePoint(
            day=d,
            predicted_score=score_curr,
            optimal_score=score_opt,
            status=pt_status
        ))

    # 12. Key Factors Diagnosis
    key_factors = []
    if storage_temp > spec["temp"] + 2.0:
        key_factors.append(f"Temperature elevated (+{round(storage_temp - spec['temp'], 1)}°C above optimal {spec['temp']}°C), accelerating cellular respiration by {int((temp_multiplier-1)*100)}%.")
    elif storage_temp < spec["temp"] - 3.0:
        key_factors.append("Temperature below chilling threshold; potential risk of physiological cold injury.")
    else:
        key_factors.append("Cold storage temperature is within strict optimal preservation band.")

    if storage_humidity < spec["humidity"] - 8.0:
        key_factors.append(f"Low relative humidity ({storage_humidity}%) causing transpirational moisture loss and wilting.")
    elif storage_humidity > spec["humidity"] + 6.0:
        key_factors.append("Elevated humidity (>94%) promotes condensation and surface mold sporulation.")
    else:
        key_factors.append("Relative humidity is well-balanced for epidermal skin integrity.")

    if packaging != spec["optimal_pkg"]:
        key_factors.append(f"Current packaging '{packaging}' permits higher gas exchange. Upgrading to '{spec['optimal_pkg']}' extends shelf life by ~{extension_gain} days.")
    else:
        key_factors.append(f"Packaging '{packaging}' provides optimal barrier against atmospheric oxidation.")

    pred_exp_date = (datetime.utcnow() + timedelta(days=remaining_days)).strftime("%Y-%m-%d")

    return {
        "remaining_days": remaining_days,
        "remaining_hours": remaining_hours,
        "decay_rate_multiplier": total_decay_multiplier,
        "optimal_temp_celsius": spec["temp"],
        "optimal_humidity_percent": spec["humidity"],
        "optimal_packaging": spec["optimal_pkg"],
        "weighted_freshness_score": weighted_score,
        "freshness_status": status_str,
        "risk_level": risk,
        "predicted_expiry_date": pred_exp_date,
        "extension_gain_days": extension_gain,
        "day_by_day_curve": decay_curve,
        "key_factors": key_factors,
        "recommendation": rec
    }

# --- LEGACY COMPATIBLE SCHEMAS ---
class ShelfLifeRequest(BaseModel):
    category: str = Field("Fruits", example="Fruits")
    harvest_date: Optional[str] = Field("2026-08-20", example="2026-08-20")
    storage_temp_celsius: float = Field(3.5, example=3.5)
    storage_humidity_percent: float = Field(87.0, example=87.0)
    visual_score: int = Field(90, ge=0, le=100, example=90)
    packaging_type: Optional[str] = "Modified Atmosphere (MAP)"
    air_circulation: Optional[str] = "Optimal (Active)"

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
    Standard PRD shelf-life prediction endpoint. Computes remaining shelf life,
    decay rate, weighted score, and expiry date.
    """
    res = solve_bio_kinetic_model(
        category=req.category,
        harvest_date_str=req.harvest_date,
        storage_temp=req.storage_temp_celsius,
        storage_humidity=req.storage_humidity_percent,
        packaging=req.packaging_type or "Modified Atmosphere (MAP)",
        airflow=req.air_circulation or "Optimal (Active)",
        visual_score=req.visual_score
    )

    return ShelfLifeResponse(
        remaining_days=res["remaining_days"],
        optimal_temp_celsius=res["optimal_temp_celsius"],
        optimal_humidity_percent=res["optimal_humidity_percent"],
        decay_rate_multiplier=res["decay_rate_multiplier"],
        weighted_freshness_score=res["weighted_freshness_score"],
        freshness_status=res["freshness_status"],
        risk_level=res["risk_level"],
        predicted_expiry_date=res["predicted_expiry_date"],
        recommendation=res["recommendation"]
    )

@router.post("/simulate-conditions", response_model=ShelfLifeSimulationResponse)
async def simulate_storage_conditions(req: ShelfLifeSimulationRequest):
    """
    Advanced Bio-Kinetic Arrhenius & Q10 Shelf-Life Simulation.
    Returns 30-day projected decay trajectory, dual curve comparison (Current vs Optimal),
    and actionable shelf-life extension gain analysis.
    """
    res = solve_bio_kinetic_model(
        category=req.category,
        harvest_date_str=req.harvest_date,
        storage_temp=req.storage_temp_celsius,
        storage_humidity=req.storage_humidity_percent,
        packaging=req.packaging_type,
        airflow=req.air_circulation,
        visual_score=req.visual_score
    )
    return ShelfLifeSimulationResponse(**res)

@router.get("/batch/{batch_id}", response_model=ShelfLifeSimulationResponse)
async def predict_batch_shelf_life(batch_id: str):
    """
    Fetches real-time produce batch data from MongoDB and calculates its active bio-kinetic
    remaining shelf life, decay multiplier, and projected expiry trajectory.
    """
    db = get_database()
    batch = await db.food_batches.find_one({"batch_id": batch_id})
    if not batch:
        batch = await db.food_batches.find_one({"_id": batch_id})

    if not batch:
        # Fallback default simulation for testing
        res = solve_bio_kinetic_model(
            category="Fruits",
            harvest_date_str="2026-08-20",
            storage_temp=3.5,
            storage_humidity=88.0,
            packaging="Modified Atmosphere (MAP)",
            airflow="Optimal (Active)",
            visual_score=92
        )
        return ShelfLifeSimulationResponse(**res)

    res = solve_bio_kinetic_model(
        category=batch.get("category", "Fruits"),
        harvest_date_str=batch.get("harvest_date", "2026-08-20"),
        storage_temp=batch.get("storage_temp_celsius", 3.5),
        storage_humidity=batch.get("storage_humidity_percent", 88.0),
        packaging="Modified Atmosphere (MAP)",
        airflow="Optimal (Active)",
        visual_score=batch.get("freshness_score", 90)
    )
    return ShelfLifeSimulationResponse(**res)

@router.get("/all-batches")
async def get_all_batches_shelf_life() -> List[Dict[str, Any]]:
    """
    Evaluates bio-kinetic shelf life predictions across all registered inventory batches
    for warehouse operations and retail procurement teams.
    """
    db = get_database()
    cursor = db.food_batches.find({})
    batches = await cursor.to_list(100)

    results = []
    for b in batches:
        model_out = solve_bio_kinetic_model(
            category=b.get("category", "Fruits"),
            harvest_date_str=b.get("harvest_date"),
            storage_temp=b.get("storage_temp_celsius", 3.5),
            storage_humidity=b.get("storage_humidity_percent", 88.0),
            packaging="Modified Atmosphere (MAP)",
            airflow="Optimal (Active)",
            visual_score=b.get("freshness_score", 85)
        )
        results.append({
            "batch_id": b.get("batch_id"),
            "product_name": b.get("product_name"),
            "category": b.get("category"),
            "warehouse_name": b.get("warehouse_name"),
            "quantity_kg": b.get("quantity_kg"),
            "remaining_days": model_out["remaining_days"],
            "remaining_hours": model_out["remaining_hours"],
            "decay_multiplier": model_out["decay_rate_multiplier"],
            "freshness_status": model_out["freshness_status"],
            "risk_level": model_out["risk_level"],
            "predicted_expiry_date": model_out["predicted_expiry_date"],
            "extension_gain_days": model_out["extension_gain_days"]
        })

    return results
