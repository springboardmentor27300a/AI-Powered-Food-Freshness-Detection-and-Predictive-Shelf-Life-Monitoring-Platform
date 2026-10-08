from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class FreshnessAssessment(Base):
    __tablename__ = "freshness_assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("food_batches.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    image_name: Mapped[str] = mapped_column(String(255), default="")
    category: Mapped[str] = mapped_column(String(40))
    score: Mapped[float] = mapped_column(Float)
    spoilage_probability: Mapped[float] = mapped_column(Float)
    visual_score: Mapped[float] = mapped_column(Float)
    storage_score: Mapped[float] = mapped_column(Float)
    shelf_score: Mapped[float] = mapped_column(Float)
    age_score: Mapped[float] = mapped_column(Float)
    remaining_days: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float)
    indicators: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
