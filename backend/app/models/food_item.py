"""
Food item model — the "catalog" entry for a product (not a physical batch).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class FoodCategory(str, enum.Enum):
    FRUITS = "fruits"
    VEGETABLES = "vegetables"
    DAIRY_PRODUCTS = "dairy_products"
    MEAT_POULTRY = "meat_poultry"
    SEAFOOD = "seafood"
    BAKERY_PRODUCTS = "bakery_products"
    PACKAGED_FOODS = "packaged_foods"
    BEVERAGES = "beverages"


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(FoodCategory), nullable=False, index=True)
    description = Column(Text, nullable=True)
    storage_location = Column(String(120), nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    batches = relationship("Batch", back_populates="food_item", cascade="all, delete-orphan")
    creator = relationship("User")
