from sqlalchemy import (
    Column, Integer, String, Text, Date, Numeric, TIMESTAMP,
    ForeignKey, Boolean, DateTime, UniqueConstraint
)
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())


class FoodBatch(Base):
    __tablename__ = "food_batches"

    id = Column(Integer, primary_key=True, index=True)
    food_item_id = Column(
        Integer, ForeignKey("food_items.id", ondelete="CASCADE"),
        nullable=False
    )
    batch_number = Column(String(100), unique=True, nullable=False, index=True)
    quantity = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(20), nullable=False)
    storage_temperature = Column(Numeric(5, 2))
    humidity = Column(Numeric(5, 2))
    packaging_type = Column(String(100))
    purchase_date = Column(Date)
    expiry_date = Column(Date)
    storage_unit_id = Column(
        Integer, ForeignKey("storage_units.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    created_at = Column(TIMESTAMP, server_default=func.now())


class AnalysisReport(Base):
    __tablename__ = "analysis_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    food_batch_id = Column(
        Integer, ForeignKey("food_batches.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    filename = Column(String(255), nullable=False)
    freshness_classification = Column(String(50))
    freshness_confidence = Column(Numeric(6, 2))
    freshness_score = Column(Numeric(6, 2))
    color_level = Column(String(50))
    color_score = Column(Numeric(6, 2))
    texture_level = Column(String(50))
    texture_score = Column(Numeric(6, 2))
    mold_level = Column(String(50))
    mold_score = Column(Numeric(6, 2))
    bruising_level = Column(String(50))
    bruising_score = Column(Numeric(6, 2))
    physical_damage_level = Column(String(50))
    physical_damage_score = Column(Numeric(6, 2))
    condition = Column(String(100))
    recommendation = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())


class StorageUnit(Base):
    __tablename__ = "storage_units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    storage_type = Column(String(50), nullable=False)
    location = Column(String(255), nullable=False)
    min_temperature = Column(Numeric(5, 2), nullable=False)
    max_temperature = Column(Numeric(5, 2), nullable=False)
    target_temperature = Column(Numeric(5, 2), nullable=False)
    current_temperature = Column(Numeric(5, 2))
    capacity = Column(Numeric(12, 2))
    capacity_unit = Column(String(20))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class TemperatureReading(Base):
    __tablename__ = "temperature_readings"

    id = Column(Integer, primary_key=True, index=True)
    storage_unit_id = Column(
        Integer, ForeignKey("storage_units.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    temperature = Column(Numeric(5, 2), nullable=False)
    source = Column(String(30), nullable=False, default="manual")
    recorded_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    recorded_at = Column(
        TIMESTAMP, nullable=False, server_default=func.now()
    )


class StorageRequirement(Base):
    __tablename__ = "storage_requirements"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)
    storage_type = Column(String(50), nullable=False)
    min_temperature = Column(Numeric(5, 2), nullable=False)
    max_temperature = Column(Numeric(5, 2), nullable=False)
    target_temperature = Column(Numeric(5, 2), nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    guidance_source = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "category", "storage_type",
            name="uq_storage_requirement_category_type"
        ),
    )


class WasteRecord(Base):
    __tablename__ = "waste_records"

    id = Column(Integer, primary_key=True, index=True)
    food_batch_id = Column(
        Integer, ForeignKey("food_batches.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    quantity = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(20), nullable=False)
    waste_type = Column(String(30), nullable=False)
    reason = Column(Text, nullable=False)
    recorded_date = Column(Date, nullable=False, index=True)
    responsible_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at = Column(TIMESTAMP, server_default=func.now())


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    alert_type = Column(String(50), nullable=False)
    days_before_expiry = Column(Integer)
    duration_minutes = Column(Integer)
    category = Column(String(50))
    storage_type = Column(String(50))
    severity = Column(String(20), nullable=False, default="Warning")
    is_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    notification_type = Column(String(50), nullable=False)
    food_batch_id = Column(
        Integer, ForeignKey("food_batches.id", ondelete="SET NULL"),
        nullable=True
    )
    storage_unit_id = Column(
        Integer, ForeignKey("storage_units.id", ondelete="SET NULL"),
        nullable=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True
    )
    target_role = Column(String(50), nullable=True, index=True)
    event_key = Column(String(255), nullable=False, unique=True)
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        server_default=func.now(), index=True
    )