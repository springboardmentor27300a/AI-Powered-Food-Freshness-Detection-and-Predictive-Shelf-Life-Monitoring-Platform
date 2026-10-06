"""
/api/food — food item catalog CRUD.

Permissions:
  - View (list/detail): any authenticated user
  - Create/Update: retail_manager, warehouse_operator, administrator
  - Delete: administrator only
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.user import User, UserRole
from app.schemas.food_item import (
    FoodItemCreate,
    FoodItemListResponse,
    FoodItemOut,
    FoodItemUpdate,
)
from app.services import food_service

router = APIRouter(prefix="/api/food", tags=["food"])

WRITE_ROLES = (UserRole.RETAIL_MANAGER, UserRole.WAREHOUSE_OPERATOR, UserRole.ADMINISTRATOR)


@router.post("", response_model=FoodItemOut, status_code=status.HTTP_201_CREATED)
def create_food_item(
    data: FoodItemCreate,
    current_user: User = Depends(require_role(*WRITE_ROLES)),
    db: Session = Depends(get_db),
):
    return food_service.create_food_item(db, data, created_by=current_user.id)


@router.get("", response_model=FoodItemListResponse)
def list_food_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = food_service.list_food_items(db, page, page_size, category, search)
    return FoodItemListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{food_item_id}", response_model=FoodItemOut)
def get_food_item(
    food_item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = food_service.get_food_item(db, food_item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")
    return item


@router.put("/{food_item_id}", response_model=FoodItemOut)
def update_food_item(
    food_item_id: uuid.UUID,
    data: FoodItemUpdate,
    current_user: User = Depends(require_role(*WRITE_ROLES)),
    db: Session = Depends(get_db),
):
    item = food_service.get_food_item(db, food_item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")
    return food_service.update_food_item(db, item, data)


@router.delete("/{food_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food_item(
    food_item_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
):
    item = food_service.get_food_item(db, food_item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")
    food_service.delete_food_item(db, item)
