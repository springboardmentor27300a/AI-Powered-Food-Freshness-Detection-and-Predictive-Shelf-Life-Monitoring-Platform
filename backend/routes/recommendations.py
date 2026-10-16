from fastapi import APIRouter, Form
from services.recommendation_engine import generate_recommendations

router = APIRouter(
    prefix="/recommendations",
    tags=["Recommendation Engine"]
)


@router.post("/generate")
def generate_food_recommendations(
    food_type: str = Form(...),
    remaining_days: int = Form(...),
    spoilage_probability: float = Form(...),
    temperature_status: str = Form(...),
    humidity_status: str = Form(...),
    air_status: str = Form(...),
    light_status: str = Form(...),
    recommended_temperature: str = Form(...),
    recommended_humidity: str = Form(...),
    predicted_expiry_date: str = Form(...)
):
    return generate_recommendations(
        food_type=food_type,
        remaining_days=remaining_days,
        spoilage_probability=spoilage_probability,
        temperature_status=temperature_status,
        humidity_status=humidity_status,
        air_status=air_status,
        light_status=light_status,
        recommended_temperature=recommended_temperature,
        recommended_humidity=recommended_humidity,
        predicted_expiry_date=predicted_expiry_date
    )