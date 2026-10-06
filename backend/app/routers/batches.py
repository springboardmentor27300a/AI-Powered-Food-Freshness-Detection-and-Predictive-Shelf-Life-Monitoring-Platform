"""
/api/batches — batch CRUD.

Permissions:
  - View: any authenticated user
  - Create: retail_manager, warehouse_operator, administrator
  - Update: retail_manager, warehouse_operator, quality_inspector, administrator
            (field-level restrictions enforced in batch_service.update_batch)
  - Delete: administrator only
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.user import User, UserRole
from app.schemas.batch import BatchCreate, BatchListResponse, BatchOut, BatchUpdate
from app.services import batch_service

router = APIRouter(prefix="/api/batches", tags=["batches"])

CREATE_ROLES = (UserRole.RETAIL_MANAGER, UserRole.WAREHOUSE_OPERATOR, UserRole.ADMINISTRATOR)
UPDATE_ROLES = (
    UserRole.RETAIL_MANAGER,
    UserRole.WAREHOUSE_OPERATOR,
    UserRole.QUALITY_INSPECTOR,
    UserRole.ADMINISTRATOR,
)


@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    data: BatchCreate,
    current_user: User = Depends(require_role(*CREATE_ROLES)),
    db: Session = Depends(get_db),
):
    return batch_service.create_batch(db, data, created_by=current_user.id)


@router.get("", response_model=BatchListResponse)
def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    food_item_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = batch_service.list_batches(db, page, page_size, status_filter, food_item_id)
    return BatchListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch = batch_service.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return batch


@router.put("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: uuid.UUID,
    data: BatchUpdate,
    current_user: User = Depends(require_role(*UPDATE_ROLES)),
    db: Session = Depends(get_db),
):
    batch = batch_service.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return batch_service.update_batch(db, batch, data, current_user)


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
):
    batch = batch_service.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    batch_service.delete_batch(db, batch)
