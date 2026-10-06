"""
Recommendation — generated from real stored data (freshness assessment,
shelf-life prediction, storage readings) by app/services/recommendation_service.py.
Never hand-authored per-item; always traceable to the inputs that produced it.
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class RecommendationType(str, enum.Enum):
    STORAGE = "storage"
    CONSUMPTION = "consumption"
    ROTATION = "rotation"
    WASTE_REDUCTION = "waste_reduction"
    QUALITY_IMPROVEMENT = "quality_improvement"


class RecommendationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)

    type = Column(Enum(RecommendationType), nullable=False, index=True)
    priority = Column(Enum(RecommendationPriority), nullable=False, default=RecommendationPriority.MEDIUM)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    based_on = Column(Text, nullable=False)  # human-readable trace of the inputs used

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    batch = relationship("Batch")
