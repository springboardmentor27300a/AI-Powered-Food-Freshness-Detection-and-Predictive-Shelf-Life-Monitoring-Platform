"""
Recommendation engine (Milestone 3).

Purely rule-based (if/then), driven entirely by real stored values
(freshness category, spoilage probability, remaining shelf life,
storage compliance, product age, quantity). No randomness, no
fabricated data.
"""
from dataclasses import dataclass
from typing import List, Optional

from app.core.food_rules import METHOD_LABELS, StorageGuidance
from app.models.freshness_assessment import FreshnessCategory
from app.models.storage_condition import ComplianceStatus


@dataclass
class Recommendation:
    type: str  # storage / consumption / rotation / waste_reduction / quality_improvement
    message: str


def generate_recommendations(
    freshness_category: Optional[FreshnessCategory],
    spoilage_probability: Optional[float],
    remaining_shelf_life_days: int,
    risk_level: str,
    storage_status: Optional[ComplianceStatus],
    quantity: int,
    has_storage_data: bool,
    storage_guidance: Optional[StorageGuidance] = None,
    is_expired: bool = False,
) -> List[Recommendation]:
    recs: List[Recommendation] = []

    if is_expired:
        recs.append(Recommendation(
            "consumption",
            "The recorded expiry date has passed - do not rely on this item; check it carefully and discard it if in doubt.",
        ))
    elif freshness_category == FreshnessCategory.SPOILED:
        recs.append(Recommendation(
            "consumption",
            "Discard this item - visual spoilage indicators were detected in the latest analysis.",
        ))
    elif risk_level == "High":
        recs.append(Recommendation(
            "consumption",
            f"Consume soon - only {remaining_shelf_life_days} day(s) of estimated shelf life remain.",
        ))

    if storage_status == ComplianceStatus.CRITICAL:
        recs.append(Recommendation(
            "storage",
            "Move to appropriate storage immediately - current conditions are outside the safe range for this category.",
        ))
    elif storage_status == ComplianceStatus.WARNING:
        recs.append(Recommendation(
            "storage",
            "Improve storage conditions (temperature/humidity) to help extend remaining shelf life.",
        ))
    elif storage_guidance is not None and storage_guidance.recommended_method != "unknown":
        # Always give food-specific storage advice, with or without readings.
        g = storage_guidance
        text = f"Recommended storage for {g.rule_label}: {METHOD_LABELS[g.recommended_method].lower()}"
        if g.temperature_range_c:
            text += f" ({g.temperature_range_c[0]:.0f}-{g.temperature_range_c[1]:.0f}C)"
        text += f". {g.handling}"
        recs.append(Recommendation("storage", text))
    elif storage_guidance is not None:
        recs.append(Recommendation(
            "storage",
            "No food-specific storage rule exists for this item - follow the storage instructions on its label.",
        ))

    if remaining_shelf_life_days <= 3 and quantity > 1:
        recs.append(Recommendation(
            "rotation",
            f"Prioritize this batch - rotate it to the front of inventory ({quantity} units affected).",
        ))

    if freshness_category in (FreshnessCategory.NEAR_SPOILAGE, FreshnessCategory.SPOILED):
        recs.append(Recommendation(
            "waste_reduction",
            "Use this item first to reduce the chance of it going to waste.",
        ))

    if spoilage_probability is not None and spoilage_probability >= 0.5 and freshness_category != FreshnessCategory.SPOILED:
        recs.append(Recommendation(
            "waste_reduction",
            f"Spoilage probability is elevated ({round(spoilage_probability * 100)}%) - monitor closely and use soon.",
        ))

    if not has_storage_data:
        recs.append(Recommendation(
            "quality_improvement",
            "Log storage conditions for this item to improve the accuracy of future shelf-life estimates.",
        ))

    if freshness_category in (FreshnessCategory.FRESH, FreshnessCategory.GOOD) and risk_level == "Low" and (
        storage_status is None or storage_status == ComplianceStatus.SUITABLE
    ):
        recs.append(Recommendation(
            "quality_improvement",
            "Item is in good condition - no action needed right now.",
        ))

    return recs
