"""
Notification/alert generation (Milestone 3).

Generates in-app alerts from real product state:
  - shelf-life warnings (expiring in 0/1/3/7 days),
  - spoilage notifications (high/critical risk, spoilage indicators),
  - storage condition alerts (temperature/humidity outside recommended range),
  - freshness alerts (overall score status),
  - inventory alerts (waste risk),
  - platform notifications.

Alerts are persisted (Alert model) and served to the owning user / staff roles.
No external email/push notifications are sent.
"""
from dataclasses import dataclass

from app.services.scoring_service import FreshnessScore
from app.services.shelf_life_service import ShelfLifePrediction
from app.services.storage_service import StorageAnalysis


@dataclass
class GeneratedAlert:
    alert_type: str    # shelf_life | spoilage | storage | freshness | inventory | platform
    severity: str      # info | warning | critical
    message: str
    batch_id: str


class AlertService:
    """Pure generator of alerts; persistence happens in the router."""

    def generate_for_batch(
        self,
        batch,
        prediction: ShelfLifePrediction,
        storage: StorageAnalysis | None,
        score: FreshnessScore | None,
    ) -> list[GeneratedAlert]:
        alerts: list[GeneratedAlert] = []
        days = prediction.estimated_remaining_days
        label = prediction.expected_expiry_date.strftime("%d %b %Y")

        # --- Shelf-life warnings -------------------------------------------------
        if prediction.expired:
            alerts.append(GeneratedAlert(
                "shelf_life", "critical",
                f"{batch.food_name} ({batch.batch_id}) has passed its predicted expiry date.", batch.batch_id))
        elif days == 0:
            alerts.append(GeneratedAlert(
                "shelf_life", "critical",
                f"{batch.food_name} ({batch.batch_id}) expires today.", batch.batch_id))
        elif days == 1:
            alerts.append(GeneratedAlert(
                "shelf_life", "warning",
                f"{batch.food_name} ({batch.batch_id}) expires in 1 day.", batch.batch_id))
        elif days <= 3:
            alerts.append(GeneratedAlert(
                "shelf_life", "warning",
                f"{batch.food_name} ({batch.batch_id}) expires in {days} days "
                f"({label}).", batch.batch_id))
        elif days <= 7:
            alerts.append(GeneratedAlert(
                "shelf_life", "info",
                f"{batch.food_name} ({batch.batch_id}) expires in {days} days "
                f"({label}).", batch.batch_id))

        # --- Spoilage notifications ---------------------------------------------
        if prediction.spoilage_risk == "Critical":
            alerts.append(GeneratedAlert(
                "spoilage", "critical",
                f"Critical spoilage risk detected for {batch.food_name} ({batch.batch_id}).", batch.batch_id))
        elif prediction.spoilage_risk == "High":
            alerts.append(GeneratedAlert(
                "spoilage", "warning",
                f"High spoilage risk detected for {batch.food_name} ({batch.batch_id}).", batch.batch_id))

        # --- Storage condition alerts -------------------------------------------
        if storage is not None:
            for param, pretty in (
                ("temperature", "storage temperature"),
                ("humidity", "storage humidity"),
            ):
                status = getattr(storage, param)
                if status.status == "critical":
                    alerts.append(GeneratedAlert(
                        "storage", "warning",
                        f"{batch.food_name} ({batch.batch_id}) {pretty} is outside the "
                        "recommended range.", batch.batch_id))
                elif status.status == "warning":
                    alerts.append(GeneratedAlert(
                        "storage", "info",
                        f"{batch.food_name} ({batch.batch_id}) {pretty} is close to the "
                        "recommended range boundary.", batch.batch_id))
            if storage.duration.status == "critical":
                alerts.append(GeneratedAlert(
                    "storage", "warning",
                    f"{batch.food_name} ({batch.batch_id}) exceeds the recommended storage "
                    f"duration of {storage.rule.max_storage_days} days.", batch.batch_id))

        # --- Freshness alerts ----------------------------------------------------
        if score is not None and score.freshness_status in ("Needs Attention", "Spoiled"):
            alerts.append(GeneratedAlert(
                "freshness", "warning",
                f"{batch.food_name} ({batch.batch_id}) overall freshness status is "
                f"'{score.freshness_status}' (score {score.overall_score:g}/100).", batch.batch_id))

        # --- Inventory alerts (waste risk) ----------------------------------------
        if prediction.spoilage_risk in ("High", "Critical") or days <= 1:
            alerts.append(GeneratedAlert(
                "inventory", "warning",
                f"{batch.available_quantity:g} {batch.unit} of {batch.food_name} "
                f"({batch.batch_id}) requires priority consumption.", batch.batch_id))

        return alerts