import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.analysis import CNNPredictionStatus
from app.schemas.image import FoodImageOut


class CNNPredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image_id: uuid.UUID
    status: CNNPredictionStatus
    model_version: Optional[str] = None
    predicted_class: Optional[str] = None
    confidence: Optional[float] = None
    class_probabilities: Optional[dict] = None
    error_message: Optional[str] = None
    inference_time_ms: Optional[float] = None
    created_at: datetime


class VisualAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image_id: uuid.UUID
    color_score: float
    texture_score: float
    dark_spot_score: float
    bruising_score: float
    damage_score: float
    overall_visual_score: float
    dark_spot_area_pct: Optional[float] = None
    summary: str
    explanation: str
    created_at: datetime


class AnalyzeImageResponse(BaseModel):
    """Full response returned right after POST /api/images/{id}/analyze."""
    image: FoodImageOut
    cnn_prediction: CNNPredictionOut
    visual_analysis: VisualAnalysisOut
