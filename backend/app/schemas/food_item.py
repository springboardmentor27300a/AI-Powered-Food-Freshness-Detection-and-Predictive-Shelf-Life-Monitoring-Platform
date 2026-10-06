import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.food_item import FoodCategory


class FoodItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: FoodCategory
    description: Optional[str] = None
    storage_location: Optional[str] = None
    is_available: bool = True


class FoodItemCreate(FoodItemBase):
    pass


class FoodItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[FoodCategory] = None
    description: Optional[str] = None
    storage_location: Optional[str] = None
    is_available: Optional[bool] = None


class FoodItemOut(FoodItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class FoodItemListResponse(BaseModel):
    items: list[FoodItemOut]
    total: int
    page: int
    page_size: int
