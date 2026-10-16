"""
Account-wide alerts endpoint (Milestone 3).

Aggregates alerts across every inventory item owned by the
authenticated user - used by dashboards. Computed fresh on each
request from real, current data (latest freshness assessment + latest
storage condition per item); nothing is persisted or fabricated.
"""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.alerts import generate_alerts_for_item
from app.core.deps import get_current_user
from app.core.access import inventory_scope, record_scope
from app.core.shelf_life import estimate_shelf_life
from app.database import get_db
from app.models.freshness_assessment import FreshnessAssessment
from app.models.inventory import FoodInventory
from app.models.storage_condition import StorageCondition
from app.models.user import User
from app.schemas.analysis import AlertResponse

router = APIRouter(tags=["Alerts"])


@router.get(
    "/api/alerts",
    response_model=List[AlertResponse],
    summary="Get all current alerts across the authenticated user's inventory",
)
def get_my_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.now(timezone.utc).date()

    items = db.query(FoodInventory).filter(inventory_scope(current_user)).all()

    all_alerts: List[AlertResponse] = []
    for item in items:
        latest_assessment = (
            db.query(FreshnessAssessment)
            .filter(
                FreshnessAssessment.inventory_item_id == item.id,
                record_scope(FreshnessAssessment.user_id, current_user),
            )
            .order_by(FreshnessAssessment.created_at.desc())
            .first()
        )
        latest_storage = (
            db.query(StorageCondition)
            .filter(
                StorageCondition.inventory_item_id == item.id,
                record_scope(StorageCondition.user_id, current_user),
            )
            .order_by(StorageCondition.recorded_at.desc())
            .first()
        )

        freshness_category = latest_assessment.freshness_category if latest_assessment else None
        storage_status = latest_storage.compliance_status if latest_storage else None

        shelf_life_result = estimate_shelf_life(
            food_name=item.food_name,
            category=item.category,
            storage_temperature_celsius=latest_storage.temperature_celsius if latest_storage else None,
            storage_location_text=item.storage_location,
            purchase_date=item.purchase_date,
            expiry_date=item.expiry_date,
            as_of=today,
            freshness_category=freshness_category,
            storage_status=storage_status,
        )

        raw_alerts = generate_alerts_for_item(
            food_name=item.food_name,
            freshness_category=freshness_category,
            remaining_shelf_life_days=shelf_life_result.remaining_shelf_life_days,
            storage_status=storage_status,
        )

        for a in raw_alerts:
            all_alerts.append(
                AlertResponse(
                    type=a.type, severity=a.severity, message=a.message,
                    inventory_item_id=item.id, food_name=item.food_name,
                )
            )

    return all_alerts
