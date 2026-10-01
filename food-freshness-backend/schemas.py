from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "consumer"

class UserUpdate(BaseModel):
    name: str | None = None
    password: str | None = None

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True

class FoodItemCreate(BaseModel):
    name: str
    category: str
    quantity: int = 1
    expiry_date: str | None = None
    batch_number: str | None = None
    storage_temp: float | None = None
    humidity: float | None = None
    packaging_type: str | None = "Loose"

class FoodItemOut(BaseModel):
    id: int
    name: str
    category: str
    quantity: int
    expiry_date: str | None
    batch_number: str | None
    storage_temp: float | None
    humidity: float | None
    packaging_type: str | None
    owner_id: int

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str

class FreshnessAnalysisOut(BaseModel):
    id: int
    food_item_id: int
    label: str
    confidence: float
    quality_score: float
    category: str
    color_score: float | None = 100.0
    mold_score: float | None = 100.0
    bruising_score: float | None = 100.0
    visual_score: float | None = 100.0
    storage_score: float | None = 90.0
    shelflife_days: float | None = 7.0
    age_score: float | None = 80.0
    risk_level: str | None = 'Low Risk'
    created_at: datetime

    class Config:
        from_attributes = True

class FreshnessSummaryOut(BaseModel):
    total_items: int
    total_analyzed: int
    avg_quality_score: float
    fresh_count: int
    spoiled_count: int

class StorageLogCreate(BaseModel):
    temperature: float | None = None
    humidity: float | None = None
    air_circulation: str | None = None
    light_exposure: str | None = None

class StorageLogOut(BaseModel):
    id: int
    food_item_id: int
    temperature: float | None
    humidity: float | None
    air_circulation: str | None
    light_exposure: str | None
    recorded_at: datetime
    class Config:
        from_attributes = True
