from sqlalchemy import Column, Date, DateTime, Float, ForeignKey
from sqlalchemy import Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class Food(Base):
    __tablename__ = "foods"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    food_name = Column(
        String(100),
        nullable=False,
    )

    # Food category
    # Example: Fruits, Vegetables, Dairy, Meat, Other
    category = Column(
        String(50),
        nullable=False,
        default="Other",
    )

    freshness_status = Column(
        String(50),
        nullable=False,
        default="Pending",
    )

    freshness_score = Column(
        Float,
        nullable=True,
    )

    image_path = Column(
        String(255),
        nullable=True,
    )

    manufacturing_date = Column(
        Date,
        nullable=True,
    )

    expiry_date = Column(
        Date,
        nullable=True,
    )

    storage_condition = Column(
        String(50),
        nullable=True,
    )

    # ========================================================
    # MILESTONE 3 - SHELF LIFE & STORAGE INTELLIGENCE
    # ========================================================

    # Storage temperature in Celsius
    storage_temperature = Column(
        Float,
        nullable=True,
    )

    # Relative humidity percentage
    storage_humidity = Column(
        Float,
        nullable=True,
    )

    # Packaging type
    # Examples: Open, Plastic, Vacuum, Sealed, Box, Other
    packaging_type = Column(
        String(50),
        nullable=True,
    )

    # Number of days the food has been stored
    storage_duration = Column(
        Float,
        nullable=True,
    )

    # Air circulation condition
    # Examples: Good, Moderate, Poor
    air_circulation = Column(
        String(50),
        nullable=True,
    )

    # Light exposure condition
    # Examples: Low, Moderate, High
    light_exposure = Column(
        String(50),
        nullable=True,
    )

    # ========================================================
    # SHELF-LIFE OUTPUTS
    # ========================================================

    # Estimated remaining shelf life in days
    remaining_shelf_life = Column(
        Float,
        nullable=True,
    )

    # Shelf-life prediction confidence
    shelf_life_confidence = Column(
        Float,
        nullable=True,
    )

    # Shelf-life risk level
    # Examples: Low, Moderate, High, Critical
    shelf_life_risk = Column(
        String(50),
        nullable=True,
    )

    # ========================================================
    # STORAGE INTELLIGENCE OUTPUTS
    # ========================================================

    # Storage compliance score
    storage_compliance_score = Column(
        Float,
        nullable=True,
    )

    # ========================================================
    # OVERALL FOOD HEALTH / QUALITY SCORE
    # ========================================================

    overall_health_score = Column(
        Float,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )