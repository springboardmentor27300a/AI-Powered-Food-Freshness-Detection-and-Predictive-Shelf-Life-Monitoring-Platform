"""
ShelfLifePrediction — Milestone 3. See docs/SHELF_LIFE_MODEL.md for the
full method. method=RULE_BASED uses a documented, transparent estimation
formula (no invented "AI accuracy" claims); method=ML_MODEL is used only
once/if a regression model has actually been trained on real data.
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ShelfLifeMethod(str, enum.Enum):
    RULE_BASED = "rule_based"
    ML_MODEL = "ml_model"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class ShelfLifePrediction(Base):
    __tablename__ = "shelf_life_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)

    method = Column(Enum(ShelfLifeMethod), nullable=False, default=ShelfLifeMethod.RULE_BASED)
    model_version = Column(String(50), nullable=True)

    estimated_days_remaining = Column(Float, nullable=False)
    estimated_expiry_date = Column(Date, nullable=False)
    confidence_pct = Column(Float, nullable=False)   # transparency: how certain the estimate is, 0-100
    risk_level = Column(Enum(RiskLevel), nullable=False)

    factors = Column(JSON, nullable=False)  # {"storage_temp_c": 4, "product_age_days": 2, ...}
    explanation = Column(Text, nullable=False)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    batch = relationship("Batch")
