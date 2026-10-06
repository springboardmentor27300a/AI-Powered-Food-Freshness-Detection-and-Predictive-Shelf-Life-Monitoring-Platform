import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.batch import BatchStatus, BatchUnit


class BatchBase(BaseModel):
    food_item_id: uuid.UUID
    quantity: float = Field(ge=0)
    unit: BatchUnit
    manufacturing_date: Optional[date] = None
    received_date: Optional[date] = None
    expiry_date: date
    storage_location: Optional[str] = None
    is_available: bool = True


class BatchCreate(BatchBase):
    batch_code: Optional[str] = None  # auto-generated if not supplied


class BatchUpdate(BaseModel):
    """
    All fields optional. Field-level write permission (e.g. only a Quality
    Inspector may set inspection_notes) is enforced in the router/service,
    not here — the schema just describes what CAN be sent.
    """
    quantity: Optional[float] = Field(default=None, ge=0)
    unit: Optional[BatchUnit] = None
    manufacturing_date: Optional[date] = None
    received_date: Optional[date] = None
    expiry_date: Optional[date] = None
    storage_location: Optional[str] = None
    is_available: Optional[bool] = None
    inspection_notes: Optional[str] = None


class BatchOut(BatchBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_code: str
    status: BatchStatus
    inspection_notes: Optional[str] = None
    inspected_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BatchListResponse(BaseModel):
    items: list[BatchOut]
    total: int
    page: int
    page_size: int


class InventorySummary(BaseModel):
    total_food_items: int
    total_batches: int
    total_available_quantity: float
    low_stock_count: int
    near_expiry_count: int
    expired_count: int
    category_summary: dict[str, int]
