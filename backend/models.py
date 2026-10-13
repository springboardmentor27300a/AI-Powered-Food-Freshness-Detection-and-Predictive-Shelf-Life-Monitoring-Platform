from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from enum import Enum
from datetime import datetime


class RoleEnum(str, Enum):
    CONSUMER = "Consumer"
    RETAIL_MANAGER = "Retail Manager"
    INSPECTOR = "Food Quality Inspector"
    WAREHOUSE_OPERATOR = "Warehouse Operator"
    ADMIN = "Administrator"


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    email: EmailStr
    password: str = Field(min_length=6)
    role: RoleEnum


class UserInDB(BaseModel):
    username: str
    email: str
    hashed_password: str
    role: str
    is_active: bool = True


class UserPublic(BaseModel):
    username: str
    email: str
    role: str
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str


class FoodCategoryEnum(str, Enum):
    FRUITS = "Fruits"
    VEGETABLES = "Vegetables"
    DAIRY = "Dairy Products"
    MEAT = "Meat & Poultry"
    SEAFOOD = "Seafood"
    BAKERY = "Bakery Products"
    PACKAGED = "Packaged Foods"
    BEVERAGES = "Beverages"


class PackagingTypeEnum(str, Enum):
    VACUUM_SEALED = "Vacuum Sealed"
    MODIFIED_ATMOSPHERE = "Modified Atmosphere"
    SEALED_CONTAINER = "Sealed Container"
    VENTILATED = "Ventilated"
    OPEN = "Open"
    NONE = "None"


class AirCirculationEnum(str, Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"


class LightExposureEnum(str, Enum):
    DARK = "Dark"
    DIM = "Dim"
    BRIGHT = "Bright"


class FoodItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: FoodCategoryEnum
    quantity: int = Field(ge=0)
    batch_number: str = Field(min_length=1, max_length=50)
    expiry_date: Optional[datetime] = None
    is_available: bool = True
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = Field(None, ge=0, le=100)
    packaging_type: Optional[str] = None
    storage_zone: Optional[str] = None
    stored_at: Optional[datetime] = None
    notes: Optional[str] = None


class ItemLifecycle(str, Enum):
    ACTIVE = "Active"
    SOLD_OUT = "Sold Out"
    CONSUMED = "Consumed"
    DISPOSED = "Disposed"
    EXPIRED = "Expired"
    ARCHIVED = "Archived"


class SaleRequest(BaseModel):
    quantity_sold: int = Field(gt=0)
    sale_date: Optional[datetime] = None
    notes: Optional[str] = None


class DisposeRequest(BaseModel):
    quantity_disposed: int = Field(gt=0)
    reason: str = Field(min_length=1)  # "damaged", "expired", "spoiled", other free text
    disposal_date: Optional[datetime] = None
    notes: Optional[str] = None


class AdjustQuantityRequest(BaseModel):
    new_quantity: int = Field(ge=0)
    reason: str = Field(min_length=1)
    notes: Optional[str] = None


class ArchiveRequest(BaseModel):
    reason: Optional[str] = None


class FoodItemInDB(FoodItemCreate):
    id: str = Field(..., alias="_id")
    created_by: str
    created_by_username: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # lifecycle (added 2026-09-29; legacy docs get defaults at read time)
    status: str = ItemLifecycle.ACTIVE.value
    active_quantity: int = 0
    sold_quantity: int = 0
    disposed_quantity: int = 0
    sold_at: Optional[datetime] = None
    sold_by: Optional[str] = None
    disposed_at: Optional[datetime] = None
    disposed_by: Optional[str] = None
    archived_at: Optional[datetime] = None
    archived_by: Optional[str] = None

    class Config:
        populate_by_name = True


class BatchCreate(BaseModel):
    item_id: str
    batch_number: str
    quantity: int = Field(ge=0)
    expiry_date: Optional[datetime] = None
    storage_zone: Optional[str] = None
    stored_at: Optional[datetime] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    packaging_type: Optional[str] = None


class BatchInDB(BatchCreate):
    id: str = Field(..., alias="_id")
    created_by: str
    created_at: datetime


class ShelfLifeRequest(BaseModel):
    """Payload for the shelf-life prediction endpoint."""
    name: Optional[str] = None
    category: FoodCategoryEnum
    quantity: Optional[int] = None
    batch_number: Optional[str] = None
    quality_score: Optional[float] = Field(None, ge=0, le=100)
    ml_status: Optional[str] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = Field(None, ge=0, le=100)
    packaging_type: Optional[PackagingTypeEnum] = None
    air_circulation: Optional[AirCirculationEnum] = None
    light_exposure: Optional[LightExposureEnum] = None
    stored_at: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class StorageReadingCreate(BaseModel):
    """A periodic storage-environment reading, optionally linked to an item/batch."""
    item_id: Optional[str] = None
    batch_id: Optional[str] = None
    zone: str = Field(min_length=1)
    category: FoodCategoryEnum
    temperature_c: float
    humidity_pct: float = Field(..., ge=0, le=100)
    air_circulation: Optional[AirCirculationEnum] = None
    light_exposure: Optional[LightExposureEnum] = None
    recorded_at: Optional[datetime] = None
    notes: Optional[str] = None


class StorageReadingInDB(StorageReadingCreate):
    id: str = Field(..., alias="_id")
    recorded_by: str
    recorded_by_username: Optional[str] = None
    source: str = "manual"
    compliance_status: Optional[str] = None
    storage_score: Optional[float] = None
    violations: List[str] = []

    class Config:
        populate_by_name = True


class BatchShelfLifeRequest(BaseModel):
    """Predict shelf life for multiple items."""
    items: List[ShelfLifeRequest]


class AlertCreate(BaseModel):
    type: str
    severity: str
    message: str
    item_id: Optional[str] = None
    batch_id: Optional[str] = None
    zone: Optional[str] = None


class AlertOut(AlertCreate):
    id: str = Field(..., alias="_id")
    recipient_id: Optional[str] = None
    recipient_role: str
    created_at: datetime
    is_read: bool = False


class AlertUpdate(BaseModel):
    is_read: bool = True
