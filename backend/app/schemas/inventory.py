"""
Pydantic schemas used for food inventory request validation
and response serialization.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FoodInventoryCreate(BaseModel):
    food_name: str = Field(..., min_length=1, max_length=150)
    category: str = Field(..., min_length=1, max_length=100)
    batch_number: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(..., gt=0)
    purchase_date: date
    expiry_date: date
    storage_location: str | None = Field(default=None, max_length=150)

    @field_validator("food_name", "category", "batch_number")
    @classmethod
    def validate_required_strings(cls, v: str) -> str:
        v = v.strip()

        if not v:
            raise ValueError("This field cannot be blank")

        return v

    @field_validator("storage_location")
    @classmethod
    def validate_storage_location(cls, v: str | None) -> str | None:
        if v is None:
            return None

        v = v.strip()

        return v if v else None

    @field_validator("expiry_date")
    @classmethod
    def validate_expiry_date(cls, v: date, info):
        purchase_date = info.data.get("purchase_date")

        if purchase_date and v < purchase_date:
            raise ValueError(
                "Expiry date must be on or after purchase date"
            )

        return v


class FoodInventoryUpdate(BaseModel):
    food_name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    batch_number: str | None = Field(default=None, min_length=1, max_length=100)
    quantity: int | None = Field(default=None, gt=0)
    purchase_date: date | None = None
    expiry_date: date | None = None
    storage_location: str | None = Field(default=None, max_length=150)

    @field_validator("food_name", "category", "batch_number")
    @classmethod
    def validate_optional_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None

        v = v.strip()

        if not v:
            raise ValueError("This field cannot be blank")

        return v

    @field_validator("storage_location")
    @classmethod
    def validate_storage_location(cls, v: str | None) -> str | None:
        if v is None:
            return None

        v = v.strip()

        return v if v else None


class FoodInventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    food_name: str
    category: str
    batch_number: str
    quantity: int
    purchase_date: date
    expiry_date: date
    storage_location: str | None
    created_at: datetime