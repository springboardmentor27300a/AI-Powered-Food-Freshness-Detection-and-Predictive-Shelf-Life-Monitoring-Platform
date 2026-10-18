import os
import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, status
from backend.app.schemas.inventory_schema import (
    InventoryCreateRequest,
    InventoryUpdateRequest,
    InventoryResponse,
)
from backend.app.services.inventory_service import InventoryService
from backend.app.utils.dependencies import get_current_user
from backend.app.config import settings

router = APIRouter(prefix="/inventory", tags=["Food Inventory"])


@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new food item to inventory"
)
async def create_food_item(
    data: InventoryCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add a food item to inventory.
    Initializes freshness_status to 'Not Analyzed'.
    """
    return InventoryService.create_inventory_item(data, current_user)


@router.get(
    "",
    response_model=List[InventoryResponse],
    summary="List food inventory with search, filters, and sorting"
)
async def list_food_items(
    search: Optional[str] = Query(None, description="Search by name, location, or batch"),
    category: Optional[str] = Query(None, description="Filter by food category"),
    expiry_status: Optional[str] = Query(None, description="Filter: expiring_soon, expired, fresh, all"),
    storage_type: Optional[str] = Query(None, description="Filter by storage type"),
    sort_by: str = Query("expiry_date", description="Field to sort by: expiry_date, purchase_date, food_name, quantity, created_at"),
    sort_order: str = Query("asc", description="Sort direction: asc or desc"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve inventory items scoped by role (consumers see personal, admin/managers see platform-wide).
    """
    return InventoryService.list_inventory(
        current_user=current_user,
        search=search,
        category=category,
        expiry_status=expiry_status,
        storage_type=storage_type,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/{item_id}",
    response_model=InventoryResponse,
    summary="Get single food item details"
)
async def get_food_item(
    item_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve full details for an individual inventory item.
    """
    return InventoryService.get_inventory_item(item_id, current_user)


@router.put(
    "/{item_id}",
    response_model=InventoryResponse,
    summary="Update food item details"
)
async def update_food_item(
    item_id: str,
    data: InventoryUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update editable properties of an inventory item.
    """
    return InventoryService.update_inventory_item(item_id, data, current_user)


@router.delete(
    "/{item_id}",
    summary="Delete a food item from inventory"
)
async def delete_food_item(
    item_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Permanently delete an item from inventory.
    """
    return InventoryService.delete_inventory_item(item_id, current_user)


@router.post(
    "/upload-image",
    summary="Upload a food item image"
)
async def upload_food_image(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload a food image. The image is saved in the server uploads folder,
    ready for future AI freshness classification.
    """
    allowed_content_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPEG, PNG, WEBP."
        )

    # Max 10MB
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 10MB."
        )

    file_ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    unique_filename = f"food_{uuid.uuid4().hex[:12]}{file_ext}"
    target_path = settings.UPLOAD_DIR / unique_filename

    with open(target_path, "wb") as f:
        f.write(contents)

    image_url = f"/uploads/{unique_filename}"
    return {
        "success": True,
        "filename": unique_filename,
        "image_url": image_url,
        "message": "Image uploaded successfully and ready for future AI inspection."
    }


@router.post(
    "/seed-dataset",
    summary="Seed inventory with standard food dataset items"
)
async def seed_dataset_inventory(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Explicitly populate standard dataset items (derived from platform datasets in datasets/)
    into the active user's inventory.
    """
    user_id = current_user.get("id")
    count = InventoryService.seed_dataset_items_for_user(user_id)
    return {
        "success": True,
        "message": f"Successfully loaded {count} dataset food items into your inventory.",
        "count": count
    }
