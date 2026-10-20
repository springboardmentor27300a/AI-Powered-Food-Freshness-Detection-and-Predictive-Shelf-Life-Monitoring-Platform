from datetime import datetime, date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator
from backend.app.models.inventory_model import FoodCategory, StorageType, FreshnessStatus, normalize_food_category


class InventoryCreateRequest(BaseModel):
    food_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the food item")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Alternative food name")
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

    @model_validator(mode="before")
    @classmethod
    def populate_food_name(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("food_name") and data.get("name"):
                data["food_name"] = data["name"]
            elif not data.get("name") and data.get("food_name"):
                data["name"] = data["food_name"]
        return data

    @field_validator("food_name")
    @classmethod
    def validate_food_name(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            raise ValueError("Food name cannot be empty")
        return v.strip()

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        cats = FoodCategory.list()
        if v in cats:
            return v
        norm = normalize_food_category(v, use_official_spec=False)
        if norm in cats:
            return norm
        norm_spec = normalize_food_category(v, use_official_spec=True)
        if norm_spec in cats:
            return norm_spec
        raise ValueError(f"Invalid category '{v}'. Allowed: {', '.join(cats)}")

    @field_validator("storage_type")
    @classmethod
    def validate_storage_type(cls, v: str) -> str:
        types = StorageType.list()
        for t in types:
            if v.strip().lower() == t.lower():
                return t
        c = v.strip().lower().replace("_", " ")
        if "refrig" in c or "fridge" in c:
            return StorageType.REFRIGERATED.value
        if "freez" in c:
            return StorageType.FROZEN.value
        if "room" in c or "ambient" in c:
            return StorageType.ROOM_TEMPERATURE.value
        if "pantry" in c:
            return StorageType.PANTRY.value
        if "dry" in c:
            return StorageType.DRY_STORAGE.value
        if "cold" in c:
            return StorageType.COLD_STORAGE.value
        if "atmosphere" in c or "ca" in c:
            return StorageType.CONTROLLED_ATMOSPHERE.value
        raise ValueError(f"Invalid storage type '{v}'. Allowed: {', '.join(types)}")

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
    name: Optional[str] = Field(None, min_length=1, max_length=100)
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

    @model_validator(mode="before")
    @classmethod
    def populate_food_name(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("food_name") and data.get("name"):
                data["food_name"] = data["name"]
            elif not data.get("name") and data.get("food_name"):
                data["name"] = data["food_name"]
        return data

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cats = FoodCategory.list()
        if v in cats:
            return v
        norm = normalize_food_category(v, use_official_spec=False)
        if norm in cats:
            return norm
        norm_spec = normalize_food_category(v, use_official_spec=True)
        if norm_spec in cats:
            return norm_spec
        raise ValueError(f"Invalid category '{v}'.")

    @field_validator("storage_type")
    @classmethod
    def validate_storage_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        types = StorageType.list()
        for t in types:
            if v.strip().lower() == t.lower():
                return t
        c = v.strip().lower().replace("_", " ")
        if "refrig" in c or "fridge" in c:
            return StorageType.REFRIGERATED.value
        if "freez" in c:
            return StorageType.FROZEN.value
        if "room" in c or "ambient" in c:
            return StorageType.ROOM_TEMPERATURE.value
        if "pantry" in c:
            return StorageType.PANTRY.value
        if "dry" in c:
            return StorageType.DRY_STORAGE.value
        if "cold" in c:
            return StorageType.COLD_STORAGE.value
        if "atmosphere" in c or "ca" in c:
            return StorageType.CONTROLLED_ATMOSPHERE.value
        raise ValueError(f"Invalid storage type '{v}'.")

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
    name: Optional[str] = None
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
