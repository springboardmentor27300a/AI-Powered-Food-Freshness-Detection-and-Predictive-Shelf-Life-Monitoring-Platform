from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


# ============================================================
# FOOD CREATE
# ============================================================

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

    # ========================================================
    # MILESTONE 3 - SHELF LIFE & STORAGE INPUTS
    # ========================================================

    # Storage temperature in Celsius
    storage_temperature: float | None = None

    # Relative humidity percentage
    storage_humidity: float | None = None

    # Packaging type
    # Examples: Open, Plastic, Vacuum, Sealed, Box, Other
    packaging_type: str | None = None

    # Number of days the food has already been stored
    storage_duration: float | None = None

    # Air circulation condition
    # Examples: Good, Moderate, Poor
    air_circulation: str | None = None

    # Light exposure condition
    # Examples: Low, Moderate, High
    light_exposure: str | None = None


# ============================================================
# FOOD RESPONSE
# ============================================================

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

    # ========================================================
    # MILESTONE 3 - SHELF LIFE & STORAGE INPUTS
    # ========================================================

    storage_temperature: float | None

    storage_humidity: float | None

    packaging_type: str | None

    storage_duration: float | None

    air_circulation: str | None

    light_exposure: str | None

    # ========================================================
    # SHELF LIFE OUTPUTS
    # ========================================================

    remaining_shelf_life: float | None

    shelf_life_confidence: float | None

    shelf_life_risk: str | None

    # ========================================================
    # STORAGE INTELLIGENCE
    # ========================================================

    storage_compliance_score: float | None

    # ========================================================
    # OVERALL QUALITY SCORE
    # ========================================================

    overall_health_score: float | None

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )