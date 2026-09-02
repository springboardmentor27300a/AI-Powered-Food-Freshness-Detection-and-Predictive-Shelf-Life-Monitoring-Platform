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

    food_name: str

    image_path: str


# ============================================================
# HEALTH CHECK
# ============================================================

@router.get("/health")
def prediction_health():

    return {
        "status": "Prediction module is working"
    }


# ============================================================
# FOOD FRESHNESS PREDICTION
# ============================================================

@router.post("/")
def predict_food_freshness(
    request: PredictionRequest,
):

    try:

        result = predict_freshness(

            food_name=request.food_name,

            image_path=request.image_path,

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