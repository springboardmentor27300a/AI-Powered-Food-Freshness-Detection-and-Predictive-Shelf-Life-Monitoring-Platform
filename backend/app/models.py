"""
SQLAlchemy ORM models.

users            - registered platform users (with role + hashed password).
food_batches     - every registered food batch, owned by a user.
image_analyses   - records of food image analyses with freshness scores.
freshness_reports - generated freshness assessment reports.
"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import freshness


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    food_batches: Mapped[list["FoodBatch"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    image_analyses: Mapped[list["ImageAnalysis"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    freshness_reports: Mapped[list["FreshnessReport"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    shelf_life_predictions: Mapped[list["ShelfLifePrediction"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    storage_readings: Mapped[list["StorageReading"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class FoodBatch(Base):
    __tablename__ = "food_batches"
    __table_args__ = (
        UniqueConstraint("batch_id", name="uq_food_batches_batch_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner: Mapped["User"] = relationship(back_populates="food_batches")

    food_name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False, index=True)

    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    available_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)

    received_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    storage_location: Mapped[str] = mapped_column(String(150), nullable=False)
    packaging_type: Mapped[str] = mapped_column(String(80), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Milestone 3 - live storage-condition fields (optional; readings history
    # is stored in the storage_readings table).
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    air_circulation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    light_exposure: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    image_analyses: Mapped[list["ImageAnalysis"]] = relationship(back_populates="batch")
    freshness_reports: Mapped[list["FreshnessReport"]] = relationship(back_populates="batch")
    shelf_life_predictions: Mapped[list["ShelfLifePrediction"]] = relationship(
        back_populates="batch", passive_deletes=True
    )
    storage_readings: Mapped[list["StorageReading"]] = relationship(
        back_populates="batch", passive_deletes=True
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="batch")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="batch")

    @property
    def days_to_expiry(self) -> int:
        return freshness.days_to_expiry(self.expiry_date)

    @property
    def freshness_status(self) -> str:
        return freshness.freshness_status(self.expiry_date)

    @property
    def expiry_priority_status(self) -> str:
        """Granular dynamic expiry label (EXPIRED / EXPIRING TODAY / ... / SAFE)."""
        return freshness.expiry_priority(self.expiry_date)

    @property
    def priority_level(self) -> str:
        """Combined inventory priority badge: CRITICAL / HIGH / MEDIUM / LOW."""
        return freshness.expiry_priority_level(self.expiry_date)


class ImageAnalysis(Base):
    __tablename__ = "image_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="image_analyses")

    batch_id_ref: Mapped[str | None] = mapped_column(String(40), ForeignKey("food_batches.batch_id", ondelete="SET NULL"), nullable=True, index=True)
    batch: Mapped["FoodBatch | None"] = relationship(back_populates="image_analyses")

    food_name: Mapped[str] = mapped_column(String(150), nullable=False)
    food_category: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # Classification result
    classification: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Individual quality scores
    color_score: Mapped[float] = mapped_column(Float, nullable=False)
    texture_score: Mapped[float] = mapped_column(Float, nullable=False)
    mold_risk: Mapped[float] = mapped_column(Float, nullable=False)
    bruise_risk: Mapped[float] = mapped_column(Float, nullable=False)
    damage_risk: Mapped[float] = mapped_column(Float, nullable=False)
    image_quality_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Spoilage detection
    spoilage_detected: Mapped[bool] = mapped_column(nullable=False, default=False)
    spoilage_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, default="low")

    # Recommendation
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_shelf_life_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Full analysis details as JSON text
    analysis_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FreshnessReport(Base):
    __tablename__ = "freshness_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="freshness_reports")

    batch_id_ref: Mapped[str | None] = mapped_column(String(40), ForeignKey("food_batches.batch_id", ondelete="SET NULL"), nullable=True, index=True)
    batch: Mapped["FoodBatch | None"] = relationship(back_populates="freshness_reports")

    food_name: Mapped[str] = mapped_column(String(150), nullable=False)
    food_category: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # Classification summary
    classification: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Spoilage summary
    spoilage_detected: Mapped[bool] = mapped_column(nullable=False, default=False)
    spoilage_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, default="low")

    # Recommendation
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_shelf_life_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Full report data as JSON text
    report_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Inventory context
    days_to_expiry: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inventory_freshness_status: Mapped[str | None] = mapped_column(String(30), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ---------------------------------------------------------------------------
# Milestone 3 - shelf-life prediction history, storage readings, recommendations,
# alerts and inventory insights.
# ---------------------------------------------------------------------------
class ShelfLifePrediction(Base):
    """One prediction snapshot per batch per day (real persisted history)."""

    __tablename__ = "shelf_life_predictions"
    __table_args__ = (
        UniqueConstraint("batch_id_ref", "predicted_on", name="uq_prediction_batch_day"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id_ref: Mapped[str] = mapped_column(
        String(40), ForeignKey("food_batches.batch_id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch: Mapped["FoodBatch"] = relationship(back_populates="shelf_life_predictions")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="shelf_life_predictions")

    food_name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)

    freshness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_remaining_days: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    calendar_remaining_days: Mapped[int] = mapped_column(Integer, nullable=False)
    shelf_life_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    storage_condition_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    spoilage_risk: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    factors: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list

    predicted_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StorageReading(Base):
    """A recorded storage-condition reading for one batch (history)."""

    __tablename__ = "storage_readings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id_ref: Mapped[str] = mapped_column(
        String(40), ForeignKey("food_batches.batch_id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch: Mapped["FoodBatch"] = relationship(back_populates="storage_readings")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="storage_readings")

    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    air_circulation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    light_exposure: Mapped[str | None] = mapped_column(String(20), nullable=True)
    compliance_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Recommendation(Base):
    """Persisted recommendation produced by the recommendation engine."""

    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id_ref: Mapped[str | None] = mapped_column(
        String(40), ForeignKey("food_batches.batch_id", ondelete="CASCADE"), nullable=True, index=True
    )
    batch: Mapped["FoodBatch | None"] = relationship(back_populates="recommendations")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="recommendations")

    category: Mapped[str] = mapped_column(String(40), nullable=False)  # storage/consumption/rotation/waste_reduction/quality_improvement
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="rule_engine")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Alert(Base):
    """In-app notification/alert record."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id_ref: Mapped[str | None] = mapped_column(
        String(40), ForeignKey("food_batches.batch_id", ondelete="CASCADE"), nullable=True, index=True
    )
    batch: Mapped["FoodBatch | None"] = relationship(back_populates="alerts")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="alerts")

    alert_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
