"""
Overall freshness scoring engine (Milestone 3).

Combines the four weighted pillars into one 0-100 overall food-health score:

    Overall = Visual Condition (40%) + Storage Conditions (25%)
            + Shelf-Life Prediction (20%) + Product Age (15%)

Each pillar is normalised to 0-100.  Missing optional data is handled safely
(e.g. no storage readings -> neutral score, no image analysis -> calendar proxy)
so a batch is never penalised twice for the same missing input.
"""
from dataclasses import dataclass
from datetime import date

from app.constants import DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN
from app.ml.config import SCORING_PILLARS
from app.services.storage_rules import get_storage_rule
from app.utils.freshness import get_freshness_status


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


@dataclass
class FreshnessScore:
    batch_id: str
    food_name: str
    category: str
    visual_condition_score: float
    storage_condition_score: float
    shelf_life_score: float
    product_age_score: float
    overall_score: float
    freshness_status: str
    weights: dict
    notes: list[str]


class FreshnessScoreService:
    """Computes the weighted overall freshness score for a batch."""

    def score(
        self,
        *,
        batch_id: str,
        food_name: str,
        category: str | None,
        received_date: date,
        expiry_date: date,
        visual_score: float | None = None,
        storage_compliance: float | None = None,
        shelf_life_score: float | None = None,
        today: date | None = None,
    ) -> FreshnessScore:
        reference = today or date.today()
        rule = get_storage_rule(category, food_name)

        # 1. Visual condition (0-100). Prefer a Milestone 2 analysis score; when
        #    unavailable, derive a calendar proxy from remaining shelf life.
        if visual_score is not None:
            visual = clamp(visual_score, 0, 100)
            visual_note = "Using latest image-analysis freshness score."
        else:
            remaining_days = (expiry_date - reference).days
            visual = clamp(100.0 * remaining_days / max(rule.shelf_life_days, 1), 0, 100)
            visual_note = "No recent image analysis - using calendar-based freshness proxy."

        # 2. Storage conditions (0-100). Neutral default when no data recorded.
        if storage_compliance is not None:
            storage = clamp(storage_compliance, 0, 100)
            storage_note = "Using recorded storage-condition compliance score."
        else:
            storage = float(DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN)
            storage_note = "No storage readings recorded - using neutral storage score."

        # 3. Shelf-life prediction (0-100).
        if shelf_life_score is not None:
            shelf = clamp(shelf_life_score, 0, 100)
            shelf_note = "Using shelf-life prediction score."
        else:
            remaining_days = max(0, (expiry_date - reference).days)
            shelf = clamp(100.0 * remaining_days / max(rule.shelf_life_days, 1), 0, 100)
            shelf_note = "No prediction available - using calendar-based shelf-life score."

        # 4. Product age (0-100): 100 when brand new, 0 at/after the expected max.
        age_days = max(0, (reference - received_date).days)
        age = clamp(100.0 * (1.0 - age_days / max(rule.max_storage_days, 1)), 0, 100)
        age_note = f"Product age is {age_days} day(s); expected maximum storage is {rule.max_storage_days} days."

        overall = (
            visual * SCORING_PILLARS["visual_condition"]
            + storage * SCORING_PILLARS["storage_conditions"]
            + shelf * SCORING_PILLARS["shelf_life_prediction"]
            + age * SCORING_PILLARS["product_age"]
        )
        overall = round(overall, 1)
        status = get_freshness_status(overall)

        return FreshnessScore(
            batch_id=batch_id,
            food_name=food_name,
            category=category or "Unknown",
            visual_condition_score=round(visual, 1),
            storage_condition_score=round(storage, 1),
            shelf_life_score=round(shelf, 1),
            product_age_score=round(age, 1),
            overall_score=overall,
            freshness_status=status,
            weights=dict(SCORING_PILLARS),
            notes=[visual_note, storage_note, shelf_note, age_note],
        )