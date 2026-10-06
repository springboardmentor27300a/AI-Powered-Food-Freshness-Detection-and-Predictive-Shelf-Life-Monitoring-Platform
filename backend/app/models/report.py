"""
FreshnessReport — Milestone 2's central deliverable. One report is created
per completed analysis workflow (image -> CNN -> visual -> scoring ->
shelf-life). It stores the computed freshness score/category plus
snapshots of the storage conditions and recommendations at analysis time,
so a downloaded PDF always reflects exactly what was true when it was
generated (not live-recomputed values that could drift later).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class FreshnessCategory(str, enum.Enum):
    FRESH = "fresh"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    NEAR_SPOILAGE = "near_spoilage"
    SPOILED = "spoiled"


class ReportStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class FreshnessReport(Base):
    __tablename__ = "freshness_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_number = Column(String(30), unique=True, nullable=False, index=True)

    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)
    image_id = Column(UUID(as_uuid=True), ForeignKey("food_images.id"), nullable=True)
    cnn_prediction_id = Column(UUID(as_uuid=True), ForeignKey("cnn_predictions.id"), nullable=True)
    visual_analysis_id = Column(UUID(as_uuid=True), ForeignKey("visual_analysis_results.id"), nullable=True)
    shelf_life_prediction_id = Column(UUID(as_uuid=True), ForeignKey("shelf_life_predictions.id"), nullable=True)

    # --- Weighted freshness score (see app/services/scoring_service.py) ---
    visual_component_score = Column(Float, nullable=False)   # 40%
    storage_component_score = Column(Float, nullable=False)  # 25%
    shelf_life_component_score = Column(Float, nullable=False)  # 20%
    product_age_component_score = Column(Float, nullable=False)  # 15%
    freshness_score = Column(Float, nullable=False)  # 0-100 weighted total
    freshness_category = Column(Enum(FreshnessCategory), nullable=False, index=True)
    spoilage_probability_pct = Column(Float, nullable=False)

    storage_conditions_snapshot = Column(JSON, nullable=True)
    recommendations_snapshot = Column(JSON, nullable=True)

    inspector_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ReportStatus), nullable=False, default=ReportStatus.FINALIZED)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    batch = relationship("Batch")
    image = relationship("FoodImage")
    cnn_prediction = relationship("CNNPrediction")
    visual_analysis = relationship("VisualAnalysisResult")
    shelf_life_prediction = relationship("ShelfLifePrediction")
    inspector = relationship("User")
