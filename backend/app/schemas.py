from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: str = "consumer"

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    class Config:
        from_attributes = True

class FoodItemIn(BaseModel):
    name: str = Field(min_length=2)
    category: str
    unit: str = "kg"
    min_temp: float = 2
    max_temp: float = 8
    min_humidity: float = 40
    max_humidity: float = 75

class FoodItemOut(FoodItemIn):
    id: int
    class Config:
        from_attributes = True

class BatchIn(BaseModel):
    food_item_id: int
    batch_code: str
    quantity: float = Field(gt=0)
    received_date: date
    expiry_date: date
    temperature: float = 5
    humidity: float = 60
    packaging: str = "Standard"
    storage_area: str = "Main Storage"
    status: str = "Active"

class BatchOut(BatchIn):
    id: int
    created_at: datetime
    food_name: str = ""
    category: str = ""
    class Config:
        from_attributes = True

class AssessmentOut(BaseModel):
    id: int
    batch_id: int | None
    user_id: int
    image_name: str
    category: str
    score: float
    spoilage_probability: float
    visual_score: float
    storage_score: float
    shelf_score: float
    age_score: float
    remaining_days: int
    confidence: float
    indicators: str
    recommendation: str
    created_at: datetime
    class Config:
        from_attributes = True
