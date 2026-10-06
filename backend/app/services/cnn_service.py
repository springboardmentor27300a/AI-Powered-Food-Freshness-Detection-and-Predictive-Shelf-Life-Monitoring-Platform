"""
Runs the trained CNN (via ml/inference/freshness_predictor.py) on a
FoodImage and persists a CNNPrediction row. Always writes a row — even on
failure — so the frontend has something to render (with status explaining
why there's no prediction).
"""
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.analysis import CNNPrediction, CNNPredictionStatus
from app.models.food_image import FoodImage
from app.services.image_service import get_image_path

# ml/ lives at backend/ml, i.e. one level up from app/
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ml.inference.freshness_predictor import predictor  # noqa: E402

_STATUS_MAP = {
    "success": CNNPredictionStatus.SUCCESS,
    "model_unavailable": CNNPredictionStatus.MODEL_UNAVAILABLE,
    "inference_error": CNNPredictionStatus.INFERENCE_ERROR,
}


def model_status() -> dict:
    return predictor.status()


def run_cnn_prediction(db: Session, food_image: FoodImage) -> CNNPrediction:
    image_path = get_image_path(food_image)
    result = predictor.predict(image_path)

    prediction = CNNPrediction(
        image_id=food_image.id,
        status=_STATUS_MAP.get(result.status, CNNPredictionStatus.MODEL_LOADING_ERROR),
        model_version=result.model_version,
        predicted_class=result.predicted_class,
        confidence=result.confidence,
        class_probabilities=result.class_probabilities,
        error_message=result.error_message,
        inference_time_ms=result.inference_time_ms,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction
