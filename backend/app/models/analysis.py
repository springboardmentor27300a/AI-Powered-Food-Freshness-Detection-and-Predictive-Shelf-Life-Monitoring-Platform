"""
Milestone 2 analysis models.

CNNPrediction  — the output of the trained CNN model (or a clear
                  "unavailable" record if the model isn't trained/loaded).
VisualAnalysisResult — OpenCV/NumPy-derived visual indicators. These are
                  explicitly NOT a CNN prediction and are stored/labeled
                  separately so the two are never confused in the UI or API.
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CNNPredictionStatus(str, enum.Enum):
    SUCCESS = "success"
    MODEL_UNAVAILABLE = "model_unavailable"
    MODEL_LOADING_ERROR = "model_loading_error"
    INFERENCE_ERROR = "inference_error"


class CNNPrediction(Base):
    """
    Result of running the trained CNN (see backend/ml/) on a FoodImage.

    IMPORTANT: status must be checked before trusting predicted_class /
    confidence. If status != SUCCESS, predicted_class/confidence are NULL —
    the API and frontend must show "model unavailable", never a fabricated
    result.
    """
    __tablename__ = "cnn_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(UUID(as_uuid=True), ForeignKey("food_images.id"), nullable=False, unique=True, index=True)

    status = Column(Enum(CNNPredictionStatus), nullable=False)
    model_version = Column(String(50), nullable=True)  # e.g. "mobilenetv2-freshness-v1"

    predicted_class = Column(String(50), nullable=True)   # e.g. "fresh" / "rotten"
    confidence = Column(Float, nullable=True)              # 0.0-1.0, real softmax output only
    class_probabilities = Column(JSON, nullable=True)      # {"fresh": 0.87, "rotten": 0.13}

    error_message = Column(Text, nullable=True)
    inference_time_ms = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    image = relationship("FoodImage", back_populates="cnn_prediction")


class VisualAnalysisResult(Base):
    """
    Rule-based / OpenCV visual indicators. Distinct from CNNPrediction.
    Scores are 0-100, higher = more favorable (less degraded) unless noted.
    """
    __tablename__ = "visual_analysis_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(UUID(as_uuid=True), ForeignKey("food_images.id"), nullable=False, unique=True, index=True)

    color_score = Column(Float, nullable=False)         # hue/saturation degradation vs. expected fresh range
    texture_score = Column(Float, nullable=False)        # local variance / edge-density based smoothness change
    dark_spot_score = Column(Float, nullable=False)      # 100 = no dark/mold-like regions detected
    bruising_score = Column(Float, nullable=False)       # 100 = no bruise-like discoloration detected
    damage_score = Column(Float, nullable=False)         # 100 = no physical damage contours detected
    overall_visual_score = Column(Float, nullable=False) # weighted combination of the above

    dark_spot_area_pct = Column(Float, nullable=True)
    summary = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    image = relationship("FoodImage", back_populates="visual_analysis")
