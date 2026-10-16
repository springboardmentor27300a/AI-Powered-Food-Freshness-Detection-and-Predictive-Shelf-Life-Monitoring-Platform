from datetime import date, datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(ORMModel):
    id: int
    name: str
    email: EmailStr
    role: str


class FoodItemCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None


class FoodItemResponse(ORMModel):
    id: int
    name: str
    category: str
    description: Optional[str] = None


class FoodBatchCreate(BaseModel):
    food_item_id: int
    batch_number: str
    quantity: float = Field(ge=0)
    unit: str
    storage_temperature: Optional[float] = None
    humidity: Optional[float] = None
    packaging_type: Optional[str] = None
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None
    storage_unit_id: Optional[int] = None


class FoodBatchResponse(ORMModel):
    id: int
    food_item_id: int
    batch_number: str
    quantity: float
    unit: str
    storage_temperature: Optional[float] = None
    humidity: Optional[float] = None
    packaging_type: Optional[str] = None
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None
    storage_unit_id: Optional[int] = None


class AnalysisReportResponse(ORMModel):
    id: int
    user_id: int
    food_batch_id: Optional[int] = None
    filename: str
    freshness_classification: Optional[str] = None
    freshness_confidence: Optional[float] = None
    freshness_score: Optional[float] = None
    color_level: Optional[str] = None
    color_score: Optional[float] = None
    texture_level: Optional[str] = None
    texture_score: Optional[float] = None
    mold_level: Optional[str] = None
    mold_score: Optional[float] = None
    bruising_level: Optional[str] = None
    bruising_score: Optional[float] = None
    physical_damage_level: Optional[str] = None
    physical_damage_score: Optional[float] = None
    condition: Optional[str] = None
    recommendation: Optional[str] = None
    created_at: Optional[datetime] = None


class StorageUnitCreate(BaseModel):
    name: str
    storage_type: str
    location: str
    min_temperature: float
    max_temperature: float
    target_temperature: float
    current_temperature: Optional[float] = None
    capacity: Optional[float] = None
    capacity_unit: Optional[str] = None


class StorageUnitResponse(ORMModel):
    id: int
    name: str
    storage_type: str
    location: str
    min_temperature: float
    max_temperature: float
    target_temperature: float
    current_temperature: Optional[float] = None
    capacity: Optional[float] = None
    capacity_unit: Optional[str] = None
    is_active: bool


class TemperatureReadingCreate(BaseModel):
    temperature: float
    source: Literal["manual", "sensor"] = "manual"


class TemperatureReadingResponse(ORMModel):
    id: int
    storage_unit_id: int
    temperature: float
    source: str
    recorded_by: Optional[int] = None
    recorded_at: Optional[datetime] = None


class StorageRequirementCreate(BaseModel):
    category: str
    storage_type: str
    min_temperature: float
    max_temperature: float
    target_temperature: float
    is_verified: bool = False
    guidance_source: Optional[str] = None


class WasteRecordCreate(BaseModel):
    food_batch_id: Optional[int] = None
    quantity: float = Field(gt=0)
    unit: str
    waste_type: Literal[
        "expired", "spoiled", "damaged", "temperature_issue", "other"
    ]
    reason: str
    recorded_date: date


class WasteRecordResponse(ORMModel):
    id: int
    food_batch_id: Optional[int] = None
    quantity: float
    unit: str
    waste_type: str
    reason: str
    recorded_date: date
    responsible_user_id: Optional[int] = None


class NotificationResponse(ORMModel):
    id: int
    title: str
    message: str
    severity: str
    notification_type: str
    food_batch_id: Optional[int] = None
    storage_unit_id: Optional[int] = None
    user_id: Optional[int] = None
    target_role: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None