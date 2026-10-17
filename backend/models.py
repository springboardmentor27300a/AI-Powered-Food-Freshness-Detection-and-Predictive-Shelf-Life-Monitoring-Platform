from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from datetime import datetime

from database import Base


# =========================================================
# USER TABLE
# =========================================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(255),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(50),
        default="user",
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

# =========================================================
# INVENTORY TABLE
# =========================================================

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    food_name = Column(String(255), nullable=False)
    category = Column(String(100), default="Fruits", nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), default="items", nullable=False)
    batch_info = Column(String(100), nullable=True)
    purchase_date = Column(String(50), nullable=True)
    storage_duration_days = Column(Integer, default=0, nullable=True)
    expiry_date = Column(String(50), nullable=False)
    freshness_status = Column(String(50), default="Fresh", nullable=True)
    storage_temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    packaging_type = Column(String(100), default="Standard", nullable=True)
    storage_location = Column(String(100), default="Refrigerator", nullable=True)
    air_circulation = Column(String(50), default="Good", nullable=True)
    light_exposure = Column(String(50), default="Low", nullable=True)
    consumption_priority = Column(String(50), default="Normal", nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# =========================================================
# PREDICTION HISTORY TABLE
# =========================================================

class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    image_name = Column(String(255), nullable=False)
    result = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    freshness_score = Column(Float, nullable=True)
    grade = Column(String(50), nullable=True)
    color_condition = Column(String(50), nullable=True)
    texture_condition = Column(String(50), nullable=True)
    overall_quality_score = Column(Float, nullable=True)
    estimated_shelf_life_days = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)