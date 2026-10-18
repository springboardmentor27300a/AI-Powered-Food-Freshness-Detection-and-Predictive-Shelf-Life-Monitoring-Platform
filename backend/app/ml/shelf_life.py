"""Transparent M3 shelf-life baseline.

This module is intentionally rule-based. It is separate from the M2 image
classifier and can be replaced by a trained regression model later.
"""

from datetime import date, timedelta
from typing import Any, Dict, List


FOOD_PROFILES = {
    "apple": {"base_days": 14, "temperature": 4.0, "humidity": 85.0},
    "banana": {"base_days": 7, "temperature": 15.0, "humidity": 85.0},
    "orange": {"base_days": 14, "temperature": 5.0, "humidity": 85.0},
    "fruit": {"base_days": 10, "temperature": 5.0, "humidity": 85.0},
    "vegetable": {"base_days": 7, "temperature": 4.0, "humidity": 90.0},
    "dairy": {"base_days": 7, "temperature": 4.0, "humidity": 65.0},
    "meat": {"base_days": 5, "temperature": 2.0, "humidity": 70.0},
    "seafood": {"base_days": 3, "temperature": 1.0, "humidity": 70.0},
    "bakery": {"base_days": 5, "temperature": 21.0, "humidity": 55.0},
    "generic": {"base_days": 7, "temperature": 5.0, "humidity": 65.0},
}

PACKAGING_FACTORS = {
    "sealed": 1.08,
    "vacuum_sealed": 1.15,
    "modified_atmosphere": 1.18,
    "airtight": 1.08,
    "perforated": 1.02,
    "paper": 0.96,
    "open": 0.88,
}

# ---------------------------------------------------------------------------
# Category → Profile Key Aliases (maps frontend inventory category labels and
# common food names to the correct FOOD_PROFILES key)
# ---------------------------------------------------------------------------
_CATEGORY_ALIASES: Dict[str, str] = {
    "fruits": "fruit",
    "fruit": "fruit",
    "vegetables": "vegetable",
    "vegetable": "vegetable",
    "dairy products": "dairy",
    "dairy": "dairy",
    "meat & poultry": "meat",
    "meat": "meat",
    "poultry": "meat",
    "seafood": "seafood",
    "bakery products": "bakery",
    "bakery": "bakery",
    "bread": "bakery",
    "packaged foods": "generic",
    "beverages": "generic",
}


def normalize_food_type(raw: str) -> str:
    """Map a user-supplied food name or inventory category to a FOOD_PROFILES key.

    Resolution order:
    1. Direct match          e.g. ``"apple"`` → ``"apple"``
    2. Substring scan        e.g. ``"Organic Gala Apples"`` → ``"apple"``
    3. Category alias table  e.g. ``"Dairy Products"`` → ``"dairy"``
    4. Fallback              → ``"generic"``
    """
    value = (raw or "generic").lower().strip()

    # 1. Direct profile-key match
    if value in FOOD_PROFILES:
        return value

    # 2. Scan for a profile key embedded in the input string
    for key in FOOD_PROFILES:
        if key != "generic" and key in value:
            return key

    # 3. Category alias lookup
    for alias, profile_key in _CATEGORY_ALIASES.items():
        if alias in value:
            return profile_key

    return "generic"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _profile(food_type: str) -> Dict[str, float]:
    value = (food_type or "generic").lower().strip()
    for key, profile in FOOD_PROFILES.items():
        if key in value:
            return profile
    return FOOD_PROFILES["generic"]


def _score_temperature(value: float, target: float) -> float:
    deviation = abs(value - target)
    return max(0.0, 100.0 - deviation * 14.0)


def _score_humidity(value: float, target: float) -> float:
    deviation = abs(value - target)
    return max(0.0, 100.0 - deviation * 2.5)


def _condition_score(payload: Dict[str, Any], profile: Dict[str, float]) -> int:
    temperature_score = _score_temperature(payload["temperature_c"], profile["temperature"])
    humidity_score = _score_humidity(payload["humidity_pct"], profile["humidity"])
    airflow_score = {"good": 100.0, "moderate": 75.0, "poor": 40.0}[payload["air_circulation"]]
    light_score = {"low": 100.0, "moderate": 75.0, "high": 40.0}[payload["light_exposure"]]
    return round(
        temperature_score * 0.45
        + humidity_score * 0.30
        + airflow_score * 0.15
        + light_score * 0.10
    )


def _risk_level(remaining_days: int, spoilage_probability: float, storage_score: int) -> str:
    if remaining_days <= 1 or spoilage_probability >= 0.70:
        return "critical"
    if remaining_days <= 3 or storage_score < 50 or spoilage_probability >= 0.45:
        return "high"
    if remaining_days <= 7 or storage_score < 75 or spoilage_probability >= 0.20:
        return "moderate"
    return "low"


def _recommendations(
    payload: Dict[str, Any],
    profile: Dict[str, float],
    storage_score: int,
    risk: str,
    remaining_days: int,
) -> List[Dict[str, str]]:
    """Generate context-aware storage and consumption recommendations.

    Args:
        payload:         The prediction input dict.
        profile:         Optimal storage profile for this food type.
        storage_score:   0–100 overall storage condition score.
        risk:            Risk level string (critical/high/moderate/low).
        remaining_days:  Actual estimated remaining shelf-life days.
    """
    recommendations: List[Dict[str, str]] = []
    temperature = payload["temperature_c"]
    humidity = payload["humidity_pct"]

    # --- Storage condition recommendations ---
    if abs(temperature - profile["temperature"]) > 3:
        direction = "lower" if temperature > profile["temperature"] else "raise"
        recommendations.append({
            "priority": "high",
            "action": f"{direction.capitalize()} storage temperature toward {profile['temperature']:.0f}°C",
            "reason": "The current temperature is outside the typical range for this food type and accelerates quality loss.",
        })
    if abs(humidity - profile["humidity"]) > 10:
        recommendations.append({
            "priority": "medium",
            "action": f"Adjust relative humidity toward {profile['humidity']:.0f}%",
            "reason": "Humidity outside the target range increases dehydration, condensation, or microbial growth risk.",
        })
    if payload["air_circulation"] == "poor":
        recommendations.append({
            "priority": "medium",
            "action": "Improve air circulation around the stored item",
            "reason": "Poor circulation creates uneven temperature and moisture pockets.",
        })
    if payload["light_exposure"] == "high":
        recommendations.append({
            "priority": "medium",
            "action": "Move the item away from direct light",
            "reason": "High light exposure can speed colour, nutrient, and freshness degradation.",
        })
    if payload["packaging_type"] in {"open", "paper"}:
        recommendations.append({
            "priority": "low",
            "action": "Use sealed or breathable food-appropriate packaging",
            "reason": "The current packaging provides limited protection from moisture exchange and contamination.",
        })

    # --- Risk-based urgent alert (spoilage signal, not solely time-based) ---
    # Only added when risk is elevated by spoilage probability or storage score,
    # and the consumption recommendation below is not already high-priority.
    if risk in {"high", "critical"} and remaining_days > 3:
        recommendations.append({
            "priority": "high",
            "action": "Prioritize inspection or consumption",
            "reason": "Combined spoilage probability and storage condition signals indicate elevated spoilage risk despite the estimated remaining time.",
        })

    # --- Specific consumption recommendation (always included) ---
    # Uses the actual remaining_shelf_life_days — not a fixed number.
    if remaining_days <= 0:
        recommendations.append({
            "priority": "high",
            "action": "Consume or discard immediately",
            "reason": "Estimated shelf life has been exhausted under current storage conditions.",
        })
    elif remaining_days == 1:
        recommendations.append({
            "priority": "high",
            "action": "Consume within 1 day",
            "reason": "Only 1 day of estimated shelf life remains under current conditions.",
        })
    elif remaining_days <= 3:
        recommendations.append({
            "priority": "high",
            "action": f"Consume within {remaining_days} days",
            "reason": f"Only {remaining_days} days of estimated shelf life remain under current conditions.",
        })
    else:
        recommendations.append({
            "priority": "low",
            "action": f"Consume within {remaining_days} days",
            "reason": (
                f"An estimated {remaining_days} days of shelf life remain. "
                f"Continue monitoring storage conditions."
            ),
        })

    # --- Waste reduction recommendations ---
    # Prioritize items nearing expiry to reduce waste
    if remaining_days <= 3 and risk in {"high", "critical"}:
        recommendations.append({
            "priority": "high",
            "action": "Prioritize consumption to reduce waste",
            "reason": "Item has elevated spoilage risk and limited remaining shelf life.",
        })
    elif remaining_days <= 3:
        recommendations.append({
            "priority": "medium",
            "action": "Plan consumption soon to avoid expiry",
            "reason": "Item is approaching expiry; prioritize use in upcoming meals.",
        })
    elif remaining_days <= 7:
        recommendations.append({
            "priority": "low",
            "action": "Monitor for spoilage signs",
            "reason": "Keep track of item condition to prevent unexpected waste.",
        })

    # --- Quality improvement recommendations ---
    # Review storage conditions for quality gains using available data
    if payload["air_circulation"] == "poor":
        recommendations.append({
            "priority": "medium",
            "action": "Improve air circulation for better quality retention",
            "reason": "Better airflow maintains more consistent temperature and moisture levels.",
        })
    if payload["light_exposure"] == "high":
        recommendations.append({
            "priority": "medium",
            "action": "Reduce light exposure to preserve quality",
            "reason": "Limiting direct light helps maintain colour, nutrients, and freshness.",
        })
    if storage_score < 70:
        recommendations.append({
            "priority": "medium",
            "action": "Review and improve storage conditions",
            "reason": "Current storage condition score is below optimal; improvements can extend shelf life.",
        })

    return recommendations


# ---------------------------------------------------------------------------
# Public prediction function
# ---------------------------------------------------------------------------

def predict_shelf_life(payload: Dict[str, Any]) -> Dict[str, Any]:
    profile = _profile(payload["food_type"])
    storage_score = _condition_score(payload, profile)
    visual_score = int(payload["visual_quality_score"])
    spoilage_probability = float(payload["spoilage_probability"])
    freshness_factor = 0.35 + (visual_score / 100.0) * 0.65
    storage_factor = 0.55 + storage_score / 220.0
    packaging_factor = PACKAGING_FACTORS.get(payload["packaging_type"], 1.0)
    gross_days = profile["base_days"] * freshness_factor * storage_factor * packaging_factor
    remaining_days = max(0, round(gross_days - payload["storage_duration_days"]))
    predicted_expiry = date.today() + timedelta(days=remaining_days)
    shelf_life_score = max(0, min(100, round((remaining_days / profile["base_days"]) * 100)))
    age_score = max(0, min(100, round(100 - (payload["product_age_days"] / max(profile["base_days"] * 2, 1)) * 100)))
    risk = _risk_level(remaining_days, spoilage_probability, storage_score)
    confidence = round(min(0.92, 0.55 + (0.10 if payload["analysis_id"] else 0.0) + (0.05 if visual_score else 0.0)), 2)
    recommendations = _recommendations(payload, profile, storage_score, risk, remaining_days)
    overall_score = round(
        visual_score * 0.40
        + storage_score * 0.25
        + shelf_life_score * 0.20
        + age_score * 0.15
    )
    storage_compliance = "compliant" if storage_score >= 70 else "needs_attention"
    return {
        "model_type": "rule_based_baseline",
        "food_type": payload["food_type"],
        "remaining_shelf_life_days": remaining_days,
        "predicted_expiry_date": predicted_expiry,
        "confidence": confidence,
        "risk_level": risk,
        "official_freshness_score": overall_score,
        "storage_compliance": storage_compliance,
        "score_components": {
            "visual_condition_score": visual_score,
            "storage_condition_score": storage_score,
            "shelf_life_score": shelf_life_score,
            "product_age_score": age_score,
        },
        "storage_impact": {
            "temperature_score": round(_score_temperature(payload["temperature_c"], profile["temperature"])),
            "humidity_score": round(_score_humidity(payload["humidity_pct"], profile["humidity"])),
            "condition_score": storage_score,
        },
        "recommendations": recommendations,
    }
