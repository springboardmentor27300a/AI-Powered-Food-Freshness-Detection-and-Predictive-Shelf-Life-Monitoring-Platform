from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True
class FoodItemCreate(BaseModel):
    name: str
    category: str
    quantity: int = 1
    expiry_date: str | None = None

class FoodItemOut(BaseModel):
    id: int
    name: str
    category: str
    quantity: int
    expiry_date: str | None
    owner_id: int

    class Config:
        from_attributes = True
class UserLogin(BaseModel):
    email: str
    password: str
from datetime import datetime

class FreshnessAnalysisOut(BaseModel):
    id: int
    food_item_id: int
    label: str
    confidence: float
    quality_score: float
    category: str
    created_at: datetime

    class Config:
        from_attributes = True