"""
Recommendation Engine (Milestone 3).

Combines shelf-life predictions and storage-condition validation into
actionable recommendations:
  - consumption recommendations    (use-soon / use-first / discard)
  - storage recommendations        (environment fixes)
  - inventory rotation suggestions (FIFO/FEFO)
  - waste reduction recommendations
  - quality improvement suggestions
"""
from ml.shelf_life import predict_shelf_life
from ml.storage_conditions import validate_storage_conditions

LOW_QUANTITY = 10

_PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def _consumption_recommendation(shelf_life: dict) -> dict:
    """What to do with the item based on its predicted remaining life."""
    days = shelf_life["effective_remaining_days"]
    risk = shelf_life["risk_level"]

    if shelf_life.get("ml_status") == "Rotten":
        return {
            "type": "consumption",
            "priority": "critical",
            "title": "Do not consume - remove from inventory",
            "message": "AI inspection classified this item as Rotten. Discard immediately and log the loss for waste analytics.",
        }
    if days <= 1:
        return {
            "type": "consumption",
            "priority": "critical",
            "title": "Consume or discard today",
            "message": f"Less than a day of predicted shelf life remains ({days} d). Use now or discard.",
        }
    if days <= 3:
        return {
            "type": "consumption",
            "priority": "high",
            "title": "Use within 3 days",
            "message": f"Predicted {days} days of shelf life remaining. Plan meals and rotations around this batch first.",
        }
    if days <= 7 or risk in ("High", "Medium"):
        return {
            "type": "consumption",
            "priority": "medium",
            "title": "Use soon",
            "message": f"About {days} days of shelf life remain. Monitor and re-scan if storage conditions change.",
        }
    return {
        "type": "consumption",
        "priority": "low",
        "title": "No immediate action needed",
        "message": f"Predicted {days} days of shelf life remaining under current conditions.",
    }


def _waste_reduction_recommendation(shelf_life: dict, quantity) -> dict:
    """How to avoid throwing the batch away."""
    days = shelf_life["effective_remaining_days"]
    qty = quantity if isinstance(quantity, (int, float)) and quantity > 0 else None

    if shelf_life.get("ml_status") == "Rotten":
        return {
            "type": "waste_reduction",
            "priority": "medium",
            "title": "Log the loss",
            "message": "Record this batch as spoiled in waste analytics so root causes (storage, over-ordering) can be tracked.",
        }
    if days <= 3 and qty and qty > LOW_QUANTITY:
        return {
            "type": "waste_reduction",
            "priority": "high",
            "title": "Discount or donate this batch",
            "message": f"{int(qty)} units expire in about {days} days. Run a markdown promotion or donate to a food bank today.",
        }
    if days <= 3:
        return {
            "type": "waste_reduction",
            "priority": "medium",
            "title": "Prioritize this batch",
            "message": f"Small batch ({qty if qty else 'unknown'} units) with ~{days} days left. Move it to a pick-first location.",
        }
    if days <= 7:
        return {
            "type": "waste_reduction",
            "priority": "medium",
            "title": "Plan a markdown window",
            "message": f"Schedule a discount or bundle promotion within the next {max(1, int(days) - 1)} days to sell through before expiry.",
        }
    return {
        "type": "waste_reduction",
        "priority": "low",
        "title": "Stock levels healthy",
        "message": "Batch has ample remaining shelf life. Keep monitoring at regular intervals.",
    }


def _rotation_recommendation(shelf_life: dict, storage_duration_days) -> dict:
    """FIFO/FEFO rotation guidance."""
    days = shelf_life["effective_remaining_days"]
    if days <= 3:
        return {
            "type": "rotation",
            "priority": "high",
            "title": "Move to front (FEFO)",
            "message": "This batch should be the next one picked/sold - first expired, first out.",
        }
    if storage_duration_days is not None and storage_duration_days >= 7:
        return {
            "type": "rotation",
            "priority": "medium",
            "title": "Rotate stock",
            "message": f"This batch has been stored for {storage_duration_days} days. Move newer stock behind it (FIFO).",
        }
    return {
        "type": "rotation",
        "priority": "low",
        "title": "Rotation normal",
        "message": "Keep current FIFO ordering; no urgent rotation needed.",
    }


def _quality_improvement_recommendation(payload: dict, shelf_life: dict) -> dict:
    """How to raise the freshness factor of the prediction."""
    tips = []
    quality_score = payload.get("quality_score")
    packaging = shelf_life.get("packaging_type", "")

    if quality_score is not None and quality_score < 70:
        tips.append("Run a fresh quality inspection; sub-70 quality scores shorten predicted shelf life by 30%+.")
    if packaging in ("Open", "None", "Ventilated") and shelf_life["category"] in (
        "Meat & Poultry", "Seafood", "Dairy Products",
    ):
        tips.append("Switch to vacuum-sealed or modified-atmosphere packaging to extend shelf life by 30-40%.")
    if shelf_life.get("temperature_factor", 1.0) < 0.9:
        tips.append("Lower storage temperature toward the category optimum; every 10 C warmer roughly doubles spoilage rate.")
    if shelf_life.get("humidity_penalty", 0.0) > 0.2:
        tips.append("Correct humidity drift; moisture loss or condensation is accelerating aging.")

    if not tips:
        return None
    return {
        "type": "quality_improvement",
        "priority": "medium" if len(tips) > 1 else "low",
        "title": "Extend shelf life",
        "message": " ".join(tips),
    }


def generate_recommendations(payload: dict) -> dict:
    """
    Build the full recommendation set for a food item.

    Expected payload keys: category (required), name, quantity, batch_number,
    quality_score, ml_status, temperature_c, humidity_pct, packaging_type,
    air_circulation, light_exposure, stored_at, expiry_date.
    """
    shelf_life = predict_shelf_life(payload)
    storage = validate_storage_conditions(
        payload.get("category", "Packaged Foods"),
        payload.get("temperature_c"),
        payload.get("humidity_pct"),
        payload.get("air_circulation"),
        payload.get("light_exposure"),
    )

    recommendations = [
        _consumption_recommendation(shelf_life),
        _waste_reduction_recommendation(shelf_life, payload.get("quantity")),
        _rotation_recommendation(shelf_life, shelf_life.get("storage_duration_days")),
    ]

    quality_tip = _quality_improvement_recommendation(payload, shelf_life)
    if quality_tip:
        recommendations.append(quality_tip)

    recommendations.extend(storage["recommendations"])
    recommendations.sort(key=lambda r: _PRIORITY_RANK.get(r.get("priority", "info"), 4))

    return {
        "item": {
            "name": payload.get("name"),
            "category": payload.get("category"),
            "quantity": payload.get("quantity"),
            "batch_number": payload.get("batch_number"),
        },
        "shelf_life": shelf_life,
        "storage_assessment": storage,
        "recommendations": recommendations,
    }


def build_recommendations(payload: dict) -> dict:
    """Backward-compatible alias for generate_recommendations."""
    return generate_recommendations(payload)
