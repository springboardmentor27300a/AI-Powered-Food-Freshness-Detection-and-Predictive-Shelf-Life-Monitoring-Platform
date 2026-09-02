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

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )