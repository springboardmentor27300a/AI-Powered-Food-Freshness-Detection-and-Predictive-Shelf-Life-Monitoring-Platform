"""
StorageReading — Milestone 3 environmental monitoring. Can be logged
against a specific batch or a general storage_location (batch_id nullable).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AirCirculation(str, enum.Enum):
    POOR = "poor"
    MODERATE = "moderate"
    GOOD = "good"


class LightExposure(str, enum.Enum):
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class StorageReading(Base):
    __tablename__ = "storage_readings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True, index=True)
    storage_location = Column(String(120), nullable=False, index=True)

    temperature_c = Column(Float, nullable=False)
    humidity_pct = Column(Float, nullable=False)
    air_circulation = Column(Enum(AirCirculation), nullable=True)
    light_exposure = Column(Enum(LightExposure), nullable=True)

    is_compliant = Column(Boolean, nullable=False, default=True)
    compliance_notes = Column(Text, nullable=True)

    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    batch = relationship("Batch")
    recorder = relationship("User")
