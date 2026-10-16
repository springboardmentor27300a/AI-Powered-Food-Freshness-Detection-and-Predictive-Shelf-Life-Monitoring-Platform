"""
Storage Condition Monitoring endpoints (Milestone 3).

Same ownership pattern as app/api/inventory.py and app/api/freshness.py:
every lookup is scoped to the authenticated user via FoodInventory.user_id,
and a missing/foreign item returns 404.

There is no physical sensor integration - conditions are entered
manually via POST. The schema/architecture (a timestamped history
table) allows a future sensor integration to insert rows the same way.
"""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.access import inventory_scope, record_scope
from app.core.storage_scoring import evaluate_storage_conditions
from app.database import get_db
from app.models.inventory import FoodInventory
from app.models.storage_condition import StorageCondition
from app.models.user import User
from app.schemas.storage_condition import StorageConditionCreate, StorageConditionResponse

router = APIRouter(tags=["Storage Conditions"])


def _get_owned_inventory_item_or_404(
    db: Session, inventory_id: uuid.UUID, current_user: User
) -> FoodInventory:
    item = (
        db.query(FoodInventory)
        .filter(FoodInventory.id == inventory_id, inventory_scope(current_user))
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")
    return item


@router.post(
    "/api/inventory/{inventory_id}/storage-conditions",
    response_model=StorageConditionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually record a storage condition reading for an inventory item",
)
def record_storage_condition(
    inventory_id: uuid.UUID,
    payload: StorageConditionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _get_owned_inventory_item_or_404(db, inventory_id, current_user)

    evaluation = evaluate_storage_conditions(
        category=item.category,
        temperature_celsius=payload.temperature_celsius,
        humidity_percent=payload.humidity_percent,
    )

    condition = StorageCondition(
        inventory_item_id=item.id,
        user_id=current_user.id,
        temperature_celsius=payload.temperature_celsius,
        humidity_percent=payload.humidity_percent,
        air_circulation=payload.air_circulation,
        light_exposure=payload.light_exposure,
        packaging_type=payload.packaging_type,
        compliance_status=evaluation.compliance_status,
        compliance_notes=evaluation.compliance_notes,
    )
    db.add(condition)
    db.commit()
    db.refresh(condition)

    return condition


@router.get(
    "/api/inventory/{inventory_id}/storage-conditions",
    response_model=List[StorageConditionResponse],
    summary="Get storage condition history for an inventory item",
)
def get_storage_condition_history(
    inventory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_inventory_item_or_404(db, inventory_id, current_user)

    return (
        db.query(StorageCondition)
        .filter(
            StorageCondition.inventory_item_id == inventory_id,
            record_scope(StorageCondition.user_id, current_user),
        )
        .order_by(StorageCondition.recorded_at.desc())
        .all()
    )
