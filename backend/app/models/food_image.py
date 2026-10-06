"""
FoodImage — a single uploaded photo of a batch, used as input to both the
CNN prediction and the OpenCV visual analysis.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class FoodImage(Base):
    __tablename__ = "food_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True)

    # Path is relative to app.core.config.settings.UPLOAD_DIR — never a raw
    # client-supplied path. The stored filename is a generated UUID, not the
    # original filename, to avoid path traversal / collision issues.
    stored_filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    batch = relationship("Batch")
    uploader = relationship("User")
    cnn_prediction = relationship(
        "CNNPrediction", back_populates="image", uselist=False, cascade="all, delete-orphan"
    )
    visual_analysis = relationship(
        "VisualAnalysisResult", back_populates="image", uselist=False, cascade="all, delete-orphan"
    )
