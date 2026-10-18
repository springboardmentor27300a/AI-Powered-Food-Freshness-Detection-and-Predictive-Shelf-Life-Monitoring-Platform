from datetime import datetime, date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator
from backend.app.models.inventory_model import FoodCategory, StorageType, FreshnessStatus


class InventoryCreateRequest(BaseModel):
    food_name: str = Field(..., min_length=1, max_length=100, description="Name of the food item")
    category: str = Field(..., description="Food Category")
    quantity: float = Field(..., gt=0, description="Quantity (must be greater than 0)")
    unit: str = Field(default="kg", min_length=1, max_length=20, description="Unit of measurement (e.g., kg, g, items)")
    purchase_date: str = Field(..., description="Date of purchase (YYYY-MM-DD)")
    expiry_date: str = Field(..., description="Date of expiry (YYYY-MM-DD)")
    storage_type: str = Field(default=StorageType.REFRIGERATED.value, description="Storage Type")
    storage_temperature: Optional[float] = Field(None, description="Storage temperature in Celsius")
    storage_humidity: Optional[float] = Field(None, description="Storage humidity percentage (0-100)")
    location: Optional[str] = Field("Main Storage", max_length=100, description="Physical location or shelf")
    batch_number: Optional[str] = Field(None, max_length=50, description="Batch / Lot identifier")
    image_url: Optional[str] = Field(None, description="Image URL or uploaded file reference")

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


class InventoryUpdateRequest(BaseModel):
    food_name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = None
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    purchase_date: Optional[str] = None
    expiry_date: Optional[str] = None
    storage_type: Optional[str] = None
    storage_temperature: Optional[float] = None
    storage_humidity: Optional[float] = None
    location: Optional[str] = None
    batch_number: Optional[str] = None
    image_url: Optional[str] = None

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


class InventoryResponse(BaseModel):
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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DashboardStatsResponse(BaseModel):
    total_food_items: int
    total_quantity: float
    items_expiring_soon: int
    freshness_analysis_pending: int
    spoiled_items: int
    storage_alerts: int
    category_distribution: Dict[str, int]
    storage_distribution: Dict[str, int]
