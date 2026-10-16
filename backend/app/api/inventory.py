"""
Food inventory API endpoints.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import inventory_scope
from app.core.deps import get_current_user
from app.database import get_db
from app.models.inventory import FoodInventory
from app.models.user import User
from app.schemas.inventory import (
    FoodInventoryCreate,
    FoodInventoryResponse,
    FoodInventoryUpdate,
)

router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
)


@router.post(
    "",
    response_model=FoodInventoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inventory(
    data: FoodInventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = FoodInventory(
        user_id=current_user.id,
        **data.model_dump(),
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.get(
    "",
    response_model=list[FoodInventoryResponse],
)
def get_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = db.execute(
        select(FoodInventory)
        .where(inventory_scope(current_user))
        .order_by(FoodInventory.expiry_date)
    )

    return result.scalars().all()


@router.get(
    "/{inventory_id}",
    response_model=FoodInventoryResponse,
)
def get_inventory_item(
    inventory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.scalar(
        select(FoodInventory).where(
            FoodInventory.id == inventory_id,
            inventory_scope(current_user),
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )

    return item


@router.patch(
    "/{inventory_id}",
    response_model=FoodInventoryResponse,
)
def update_inventory(
    inventory_id: uuid.UUID,
    data: FoodInventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.scalar(
        select(FoodInventory).where(
            FoodInventory.id == inventory_id,
            FoodInventory.user_id == current_user.id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    purchase_date = update_data.get(
        "purchase_date",
        item.purchase_date,
    )
    expiry_date = update_data.get(
        "expiry_date",
        item.expiry_date,
    )

    if expiry_date < purchase_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Expiry date must be on or after purchase date",
        )

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete(
    "/{inventory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_inventory(
    inventory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.scalar(
        select(FoodInventory).where(
            FoodInventory.id == inventory_id,
            FoodInventory.user_id == current_user.id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )

    db.delete(item)
    db.commit()

    return None