from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator
from backend.app.models.inventory_model import FoodCategory, StorageType, FreshnessStatus


class StockUpdateRequest(BaseModel):
    quantity: float = Field(..., ge=0, description="New stock quantity or amount to adjust (must be >= 0)")
    adjustment_type: Optional[str] = Field("set", description="Type of adjustment: 'set', 'add', or 'deduct'")
    reason: Optional[str] = Field("Authorized retailer inventory count", max_length=200, description="Reason for stock modification")

    @field_validator("adjustment_type")
    @classmethod
    def validate_adj_type(cls, v: Optional[str]) -> str:
        allowed = ["set", "add", "deduct"]
        val = (v or "set").lower()
        if val not in allowed:
            raise ValueError(f"Invalid adjustment_type '{v}'. Allowed: {', '.join(allowed)}")
        return val


class ArchiveRequest(BaseModel):
    is_archived: bool = Field(True, description="Archive or unarchive item")
    reason: Optional[str] = Field("Item archived by retailer", max_length=200, description="Reason for archive action")


class RetailerProductCreateRequest(BaseModel):
    food_name: str = Field(..., min_length=1, max_length=100, description="Name of the food product")
    category: str = Field(..., description="Food Category")
    quantity: float = Field(..., gt=0, description="Stock quantity (must be > 0)")
    unit: str = Field(default="kg", min_length=1, max_length=20, description="Unit of measurement (e.g., kg, g, packs, items)")
    purchase_date: str = Field(..., description="Procurement or harvest date (YYYY-MM-DD)")
    expiry_date: str = Field(..., description="Recorded product expiration date (YYYY-MM-DD)")
    storage_type: str = Field(default=StorageType.REFRIGERATED.value, description="Storage Method")
    storage_temperature: Optional[float] = Field(None, description="Current / designated temperature in Celsius")
    storage_humidity: Optional[float] = Field(None, description="Current / designated relative humidity percentage (0-100)")
    location: Optional[str] = Field("Main Retail Display", max_length=100, description="Store aisle, shelf, or cold display zone")
    batch_number: Optional[str] = Field(None, max_length=50, description="Lot / batch identifier")
    image_url: Optional[str] = Field(None, description="Image URL or uploaded file reference")
    low_stock_threshold: Optional[float] = Field(5.0, ge=0, description="Quantity threshold for low stock alert")

    @field_validator("food_name")
    @classmethod
    def validate_food_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Food name cannot be empty")
        return trimmed

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        cats = FoodCategory.list()
        if v not in cats:
            raise ValueError(f"Invalid category '{v}'. Allowed: {', '.join(cats)}")
        return v

    @field_validator("storage_type")
    @classmethod
    def validate_storage_type(cls, v: str) -> str:
        types = StorageType.list()
        if v not in types:
            raise ValueError(f"Invalid storage type '{v}'. Allowed: {', '.join(types)}")
        return v

    @field_validator("storage_humidity")
    @classmethod
    def validate_humidity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Humidity must be between 0 and 100%")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        try:
            p_date = datetime.strptime(self.purchase_date, "%Y-%m-%d").date()
            e_date = datetime.strptime(self.expiry_date, "%Y-%m-%d").date()
            if e_date < p_date:
                raise ValueError("Expiry date cannot be earlier than purchase date")
        except ValueError as e:
            if "does not match format" in str(e):
                raise ValueError("Dates must be in YYYY-MM-DD format")
            raise e
        return self


class RetailerProductUpdateRequest(BaseModel):
    food_name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = None
    quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    purchase_date: Optional[str] = None
    expiry_date: Optional[str] = None
    storage_type: Optional[str] = None
    storage_temperature: Optional[float] = None
    storage_humidity: Optional[float] = None
    location: Optional[str] = None
    batch_number: Optional[str] = None
    image_url: Optional[str] = None
    low_stock_threshold: Optional[float] = Field(None, ge=0)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in FoodCategory.list():
            raise ValueError(f"Invalid category '{v}'.")
        return v

    @field_validator("storage_type")
    @classmethod
    def validate_storage_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in StorageType.list():
            raise ValueError(f"Invalid storage type '{v}'.")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.purchase_date and self.expiry_date:
            try:
                p_date = datetime.strptime(self.purchase_date, "%Y-%m-%d").date()
                e_date = datetime.strptime(self.expiry_date, "%Y-%m-%d").date()
                if e_date < p_date:
                    raise ValueError("Expiry date cannot be earlier than purchase date")
            except ValueError as e:
                if "does not match format" in str(e):
                    raise ValueError("Dates must be in YYYY-MM-DD format")
                raise e
        return self


class AlertAcknowledgeRequest(BaseModel):
    note: Optional[str] = Field("Reviewed by store manager", max_length=200, description="Review notes")


class RetailerAlertResponse(BaseModel):
    id: str
    type: str
    product_name: str
    inventory_id: str
    batch_number: Optional[str] = None
    severity: str  # Critical, Warning, Info
    timestamp: datetime
    reason: str
    status: str    # Active, Acknowledged
    action: str


class RetailerItemResponse(BaseModel):
    id: str
    user_id: str
    food_name: str
    category: str
    quantity: float
    unit: str
    purchase_date: str
    expiry_date: str
    storage_type: str
    storage_temperature: Optional[float] = None
    storage_humidity: Optional[float] = None
    location: Optional[str] = None
    batch_number: Optional[str] = None
    image_url: Optional[str] = None
    freshness_status: str
    freshness_score: Optional[float] = None
    shelf_life_days: Optional[float] = None
    is_archived: bool = False
    low_stock_threshold: float = 5.0
    days_to_expiry: Optional[int] = None
    expiry_category: str = "Safe"  # Expired, Approaching Expiry, Safe
    is_low_stock: bool = False
    stock_history: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RetailerNotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    severity: str
    inventory_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime
