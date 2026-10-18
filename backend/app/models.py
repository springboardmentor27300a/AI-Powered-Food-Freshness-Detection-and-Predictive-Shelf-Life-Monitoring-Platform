from datetime import date, datetime
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class FoodItem(Base):
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))
    batch_number: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[int] = mapped_column(Integer)
    expiry_date: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


# ============================================================
# M2 — Freshness Analysis History
# ============================================================

class FreshnessAnalysis(Base):
    """Stores a record of every freshness analysis run by an authenticated user."""
    __tablename__ = "freshness_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Optional human-readable item name (detected or user-supplied)
    item_name: Mapped[str] = mapped_column(String(120), nullable=True)
    # Core prediction results
    classification: Mapped[str] = mapped_column(String(40))          # e.g. "Fresh"
    confidence: Mapped[float] = mapped_column(Float)                  # 0.0–1.0
    quality_score: Mapped[int] = mapped_column(Integer)               # 0–100
    spoilage_probability: Mapped[float] = mapped_column(Float)        # 0.0–1.0
    # Raw model class
    predicted_class: Mapped[str] = mapped_column(String(80), nullable=True)
    # Visual metrics (JSON string for portability)
    color_metrics: Mapped[str] = mapped_column(Text, nullable=True)   # JSON
    texture_metrics: Mapped[str] = mapped_column(Text, nullable=True) # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )


class StorageCondition(Base):
    __tablename__ = "storage_conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    food_item_id: Mapped[int] = mapped_column(ForeignKey("food_items.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("freshness_analyses.id", ondelete="SET NULL"), nullable=True, index=True)
    temperature_c: Mapped[float] = mapped_column(Float)
    humidity_pct: Mapped[float] = mapped_column(Float)
    air_circulation: Mapped[str] = mapped_column(String(20))
    light_exposure: Mapped[str] = mapped_column(String(20))
    packaging_type: Mapped[str] = mapped_column(String(40))
    storage_duration_days: Mapped[int] = mapped_column(Integer, default=0)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ShelfLifePrediction(Base):
    __tablename__ = "shelf_life_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    food_item_id: Mapped[int] = mapped_column(ForeignKey("food_items.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("freshness_analyses.id", ondelete="SET NULL"), nullable=True, index=True)
    storage_condition_id: Mapped[int] = mapped_column(ForeignKey("storage_conditions.id", ondelete="SET NULL"), nullable=True)
    food_type: Mapped[str] = mapped_column(String(80))
    remaining_shelf_life_days: Mapped[int] = mapped_column(Integer)
    predicted_expiry_date: Mapped[date] = mapped_column(Date)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(20))
    official_freshness_score: Mapped[int] = mapped_column(Integer)
    visual_condition_score: Mapped[int] = mapped_column(Integer)
    storage_condition_score: Mapped[int] = mapped_column(Integer)
    shelf_life_score: Mapped[int] = mapped_column(Integer)
    product_age_score: Mapped[int] = mapped_column(Integer)
    input_snapshot: Mapped[str] = mapped_column(Text)
    recommendations: Mapped[str] = mapped_column(Text)
    model_type: Mapped[str] = mapped_column(String(40), default="rule_based_baseline")
    storage_compliance: Mapped[str] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


# ============================================================
# M4 — Notification & Alert System
# ============================================================

class Notification(Base):
    """Stores in-application notifications for users."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    notification_type: Mapped[str] = mapped_column(String(40), index=True)
    severity: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    related_item_id: Mapped[int] = mapped_column(
        ForeignKey("food_items.id", ondelete="SET NULL"), nullable=True
    )
    related_prediction_id: Mapped[int] = mapped_column(
        ForeignKey("shelf_life_predictions.id", ondelete="SET NULL"), nullable=True
    )
    related_analysis_id: Mapped[int] = mapped_column(
        ForeignKey("freshness_analyses.id", ondelete="SET NULL"), nullable=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, index=True
    )
 