from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.prediction import predict_freshness


router = APIRouter(
    prefix="/prediction",
    tags=["Freshness Prediction"],
)


# ============================================================
# REQUEST SCHEMA
# ============================================================

class PredictionRequest(BaseModel):

    # Existing fields
    food_name: str
    image_path: str

    # ========================================================
    # SHELF-LIFE / STORAGE INPUTS
    # ========================================================

    category: str | None = None

    storage_temperature: float | None = None

    storage_humidity: float | None = None

    packaging_type: str | None = None

    storage_duration: float | None = None

    air_circulation: str | None = None

    light_exposure: str | None = None

    manufacturing_date: date | None = None

    expiry_date: date | None = None


# ============================================================
# HEALTH CHECK
# ============================================================

@router.get("/health")
def prediction_health():

    return {
        "status": "Prediction module is working"
    }


# ============================================================
# FOOD FRESHNESS + SHELF-LIFE PREDICTION
# ============================================================

@router.post("/")
def predict_food_freshness(
    request: PredictionRequest,
):

    try:

        result = predict_freshness(

            # Existing prediction inputs
            food_name=request.food_name,

            image_path=request.image_path,

            # Shelf-life / storage inputs
            category=request.category,

            storage_temperature=(
                request.storage_temperature
            ),

            storage_humidity=(
                request.storage_humidity
            ),

            packaging_type=(
                request.packaging_type
            ),

            storage_duration=(
                request.storage_duration
            ),

            air_circulation=(
                request.air_circulation
            ),

            light_exposure=(
                request.light_exposure
            ),

            manufacturing_date=(
                request.manufacturing_date
            ),

            expiry_date=(
                request.expiry_date
            ),

        )

        return result

    except FileNotFoundError as e:

        raise HTTPException(
            status_code=404,
            detail=str(e),
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}",
        )