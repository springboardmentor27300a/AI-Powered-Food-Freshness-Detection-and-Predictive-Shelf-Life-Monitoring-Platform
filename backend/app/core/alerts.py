"""
Alert / notification engine (Milestone 3).

In-app only, computed on request (not persisted) from real, current
data - no email/SMS/push, no fabricated events.
"""
from dataclasses import dataclass
from typing import List, Optional

from app.models.freshness_assessment import FreshnessCategory
from app.models.storage_condition import ComplianceStatus


@dataclass
class Alert:
    type: str  # freshness / shelf_life / spoilage / storage / inventory
    severity: str  # info / warning / critical
    message: str


def generate_alerts_for_item(
    food_name: str,
    freshness_category: Optional[FreshnessCategory],
    remaining_shelf_life_days: Optional[int],
    storage_status: Optional[ComplianceStatus],
) -> List[Alert]:
    alerts: List[Alert] = []

    if freshness_category == FreshnessCategory.NEAR_SPOILAGE:
        alerts.append(Alert("freshness", "warning", f"{food_name}: nearing spoilage."))
    if freshness_category == FreshnessCategory.SPOILED:
        alerts.append(Alert("spoilage", "critical", f"{food_name}: spoilage detected."))

    if remaining_shelf_life_days is not None:
        if remaining_shelf_life_days <= 0:
            alerts.append(Alert("inventory", "critical", f"{food_name}: past its estimated shelf life."))
        elif remaining_shelf_life_days <= 3:
            alerts.append(Alert(
                "shelf_life", "warning",
                f"{food_name}: only {remaining_shelf_life_days} day(s) of estimated shelf life remain.",
            ))

    if storage_status == ComplianceStatus.CRITICAL:
        alerts.append(Alert("storage", "critical", f"{food_name}: storage conditions are critical."))
    elif storage_status == ComplianceStatus.WARNING:
        alerts.append(Alert("storage", "warning", f"{food_name}: storage conditions need attention."))

    return alerts
