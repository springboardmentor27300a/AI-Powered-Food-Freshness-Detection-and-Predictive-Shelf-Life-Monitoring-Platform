"""Persistence models for the additive, authenticated M2 v2 workflow."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class M2Analysis(Base):
    __tablename__ = "m2_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    declared_category: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(80), index=True)
    food_subtype: Mapped[str | None] = mapped_column(String(120), nullable=True)
    capability_status: Mapped[str] = mapped_column(String(32))
    assessment_status: Mapped[str] = mapped_column(String(32), index=True)
    reason: Mapped[str] = mapped_column(Text)
    model_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    classification: Mapped[str | None] = mapped_column(String(40), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spoilage_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_format: Mapped[str] = mapped_column(String(12))
    image_width: Mapped[int] = mapped_column(Integer)
    image_height: Mapped[int] = mapped_column(Integer)
    visual_analysis_json: Mapped[str] = mapped_column(Text)
    defects_json: Mapped[str] = mapped_column(Text)
    class_probabilities_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
