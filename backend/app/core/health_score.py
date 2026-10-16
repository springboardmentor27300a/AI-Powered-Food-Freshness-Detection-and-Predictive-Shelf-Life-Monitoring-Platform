"""
Overall Food Health Score (Milestone 3).

Weighted combination, exactly as specified:
    Visual Condition Analysis   40%  (the EXISTING Milestone 2 freshness_score, unchanged)
    Storage Conditions          25%
    Shelf-Life Prediction       20%
    Product Age                 15%

This is a transparent, hand-written formula - not a trained model.
The API layer returns every component score alongside the final
total so the calculation is never a black box to the user.
"""
from dataclasses import dataclass

VISUAL_WEIGHT = 0.40
STORAGE_WEIGHT = 0.25
SHELF_LIFE_WEIGHT = 0.20
PRODUCT_AGE_WEIGHT = 0.15


@dataclass
class HealthScoreBreakdown:
    visual_condition_score: float
    storage_condition_score: float
    shelf_life_score: float
    product_age_score: float
    overall_food_health_score: int


def calculate_overall_health_score(
    visual_condition_score: float,
    storage_condition_score: float,
    shelf_life_score: float,
    product_age_score: float,
) -> HealthScoreBreakdown:
    total = (
        VISUAL_WEIGHT * visual_condition_score
        + STORAGE_WEIGHT * storage_condition_score
        + SHELF_LIFE_WEIGHT * shelf_life_score
        + PRODUCT_AGE_WEIGHT * product_age_score
    )
    total = max(0.0, min(100.0, total))

    return HealthScoreBreakdown(
        visual_condition_score=round(visual_condition_score, 1),
        storage_condition_score=round(storage_condition_score, 1),
        shelf_life_score=round(shelf_life_score, 1),
        product_age_score=round(product_age_score, 1),
        overall_food_health_score=int(round(total)),
    )
