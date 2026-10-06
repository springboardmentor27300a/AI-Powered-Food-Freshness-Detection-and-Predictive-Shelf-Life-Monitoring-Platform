"""
app/services/shelf_life_service.py

Milestone 3 shelf-life estimation — Option B from the spec: a documented,
transparent rule-based model (no invented "trained regression accuracy"
claims, since no labeled shelf-life dataset is used here). Full write-up
in docs/SHELF_LIFE_MODEL.md.

Method, in plain terms:
  1. Start from a published-style baseline shelf life (days, under
     reference refrigerated conditions) for the food's category.
  2. Adjust for actual storage temperature using a Q10-style factor: for
     each 10C above the reference temperature, spoilage rate roughly
     doubles (a standard food-science approximation), so remaining life
     roughly halves; the reverse applies for colder-than-reference storage.
  3. Adjust for humidity relative to the category's ideal range.
  4. Adjust down if the visual analysis / CNN indicate existing quality
     loss (a produce item photographed already showing degradation has
     less remaining life than its "textbook" baseline would suggest).
  5. Subtract elapsed product age (days since registration/purchase).
  6. Confidence is reduced whenever an input had to be defaulted rather
     than pulled from a real reading.

This is an estimate, not a laboratory shelf-life measurement.
"""
import math
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy.orm import Session

REFERENCE_TEMP_C = 4.0     # standard refrigeration reference point
REFERENCE_HUMIDITY_PCT = 90.0

# Documented baseline shelf life (days) at reference conditions, by category.
# Sources: general USDA/FSA cold-storage guidance ranges, used here as
# reasonable defaults for a decision-support tool, not as certified data.
CATEGORY_BASELINE_DAYS = {
    "fruits": 10,
    "vegetables": 12,
    "dairy_products": 10,
    "meat_poultry": 4,
    "seafood": 2,
    "bakery_products": 5,
    "packaged_foods": 30,
    "beverages": 21,
}

CATEGORY_IDEAL_HUMIDITY = {
    "fruits": (85, 95),
    "vegetables": (90, 98),
    "dairy_products": (80, 90),
    "meat_poultry": (80, 90),
    "seafood": (85, 95),
    "bakery_products": (40, 60),
    "packaged_foods": (30, 60),
    "beverages": (30, 70),
}


@dataclass
class ShelfLifeResult:
    estimated_days_remaining: float
    estimated_expiry_date: date
    confidence_pct: float
    risk_level: str
    factors: dict = field(default_factory=dict)
    explanation: str = ""


def _temp_factor(actual_temp_c: float) -> float:
    # Q10 ~2 approximation: 2 ** ((reference - actual) / 10)
    return 2 ** ((REFERENCE_TEMP_C - actual_temp_c) / 10)


def _humidity_factor(category: str, actual_humidity_pct: float) -> float:
    lo, hi = CATEGORY_IDEAL_HUMIDITY.get(category, (60, 90))
    if lo <= actual_humidity_pct <= hi:
        return 1.0
    deviation = min(abs(actual_humidity_pct - lo), abs(actual_humidity_pct - hi))
    # Each 10 points outside the ideal band costs ~8% of remaining life.
    return max(0.5, 1.0 - (deviation / 10) * 0.08)


def _visual_factor(overall_visual_score: float | None) -> float:
    if overall_visual_score is None:
        return 1.0
    # 100 (no visible degradation) -> 1.0x ; 0 (severe) -> ~0.2x
    return max(0.2, overall_visual_score / 100)


def estimate_shelf_life(
    category: str,
    product_age_days: float,
    storage_temp_c: float | None,
    humidity_pct: float | None,
    overall_visual_score: float | None,
    reference_date: date | None = None,
) -> ShelfLifeResult:
    reference_date = reference_date or date.today()
    category_key = category.lower().strip()
    baseline = CATEGORY_BASELINE_DAYS.get(category_key, 7)

    confidence = 90.0
    used_temp = storage_temp_c
    if used_temp is None:
        used_temp = REFERENCE_TEMP_C
        confidence -= 20

    used_humidity = humidity_pct
    if used_humidity is None:
        used_humidity = REFERENCE_HUMIDITY_PCT
        confidence -= 10

    if overall_visual_score is None:
        confidence -= 10

    t_factor = _temp_factor(used_temp)
    h_factor = _humidity_factor(category_key, used_humidity)
    v_factor = _visual_factor(overall_visual_score)

    adjusted_baseline = baseline * t_factor * h_factor * v_factor
    remaining = max(0.0, adjusted_baseline - product_age_days)
    confidence = max(30.0, min(95.0, confidence))

    baseline_ratio = remaining / baseline if baseline > 0 else 0
    if remaining <= 0:
        risk = "critical"
    elif baseline_ratio < 0.15:
        risk = "high"
    elif baseline_ratio < 0.4:
        risk = "moderate"
    else:
        risk = "low"

    expiry = reference_date + timedelta(days=math.floor(remaining))

    factors = {
        "category": category_key,
        "category_baseline_days_at_reference_conditions": baseline,
        "reference_temperature_c": REFERENCE_TEMP_C,
        "reference_humidity_pct": REFERENCE_HUMIDITY_PCT,
        "storage_temperature_c": storage_temp_c,
        "storage_temperature_used_c": used_temp,
        "humidity_pct": humidity_pct,
        "humidity_used_pct": used_humidity,
        "product_age_days": product_age_days,
        "overall_visual_score": overall_visual_score,
        "temperature_factor": round(t_factor, 3),
        "humidity_factor": round(h_factor, 3),
        "visual_factor": round(v_factor, 3),
        "adjusted_baseline_days": round(adjusted_baseline, 2),
    }

    explanation = (
        f"Baseline for '{category_key}' at {REFERENCE_TEMP_C}C/{REFERENCE_HUMIDITY_PCT}% humidity is "
        f"{baseline} days. Adjusted for actual storage temperature ({used_temp}C, factor "
        f"{round(t_factor, 2)}x), humidity ({used_humidity}%, factor {round(h_factor, 2)}x), and visual "
        f"condition (factor {round(v_factor, 2)}x) gives an adjusted baseline of "
        f"{round(adjusted_baseline, 1)} days. Subtracting {product_age_days} days of product age since "
        f"registration leaves an estimated {round(remaining, 1)} days remaining. "
        f"This is a rule-based estimate (see docs/SHELF_LIFE_MODEL.md), not a lab measurement."
    )

    return ShelfLifeResult(
        estimated_days_remaining=round(remaining, 1),
        estimated_expiry_date=expiry,
        confidence_pct=round(confidence, 1),
        risk_level=risk,
        factors=factors,
        explanation=explanation,
    )


def generate_and_save(db: Session, batch, overall_visual_score: float | None,
                       created_by: uuid.UUID | None = None):
    """
    Orchestrator used by routers/reports: pulls the batch's category, its
    latest storage reading (if any), and product age, runs the estimate,
    and persists a ShelfLifePrediction row.
    """
    from app.models.shelf_life import RiskLevel, ShelfLifeMethod, ShelfLifePrediction
    from app.services import storage_service

    category = batch.food_item.category.value
    age_source = batch.received_date or batch.manufacturing_date or batch.created_at.date()
    product_age_days = (date.today() - age_source).days

    latest_reading = storage_service.latest_reading_for_batch(db, batch.id)
    storage_temp = latest_reading.temperature_c if latest_reading else None
    storage_humidity = latest_reading.humidity_pct if latest_reading else None

    result = estimate_shelf_life(
        category=category,
        product_age_days=product_age_days,
        storage_temp_c=storage_temp,
        humidity_pct=storage_humidity,
        overall_visual_score=overall_visual_score,
    )

    row = ShelfLifePrediction(
        batch_id=batch.id,
        method=ShelfLifeMethod.RULE_BASED,
        model_version="rule-based-v1",
        estimated_days_remaining=result.estimated_days_remaining,
        estimated_expiry_date=result.estimated_expiry_date,
        confidence_pct=result.confidence_pct,
        risk_level=RiskLevel(result.risk_level),
        factors=result.factors,
        explanation=result.explanation,
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
