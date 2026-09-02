from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class FoodCreate(BaseModel):
    food_name: str

    # Food category
    # Example: Fruits, Vegetables, Dairy, Meat, Other
    category: str = "Other"

    freshness_status: str = "Pending"

    freshness_score: float | None = None

    image_path: str | None = None

    manufacturing_date: date | None = None

    expiry_date: date | None = None

    storage_condition: str | None = None


class FoodResponse(BaseModel):
    id: int

    user_id: int

    food_name: str

    # Return category to frontend
    category: str

    freshness_status: str

    freshness_score: float | None

    image_path: str | None

    manufacturing_date: date | None

    expiry_date: date | None

    storage_condition: str | None

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )