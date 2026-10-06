"""
Batch model — a physical, trackable lot of a food item with its own
quantity, dates, and expiry-derived status.
"""
import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class BatchStatus(str, enum.Enum):
    AVAILABLE = "available"
    LOW_STOCK = "low_stock"
    NEAR_EXPIRY = "near_expiry"
    EXPIRED = "expired"
    OUT_OF_STOCK = "out_of_stock"


class BatchUnit(str, enum.Enum):
    KG = "kg"
    G = "g"
    L = "l"
    ML = "ml"
    PIECES = "pieces"
    PACKS = "packs"
    BOXES = "boxes"


LOW_STOCK_THRESHOLD = 10
NEAR_EXPIRY_DAYS = 3


class Batch(Base):
    __tablename__ = "batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_code = Column(String(50), unique=True, index=True, nullable=False)

    food_item_id = Column(UUID(as_uuid=True), ForeignKey("food_items.id"), nullable=False, index=True)

    quantity = Column(Float, nullable=False, default=0)
    unit = Column(Enum(BatchUnit), nullable=False, default=BatchUnit.PIECES)

    manufacturing_date = Column(Date, nullable=True)
    received_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=False, index=True)

    storage_location = Column(String(120), nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)

    # Status is computed (see services/batch_service.py) but persisted for
    # fast filtering/dashboard queries. It is recalculated on every write
    # and on every read of a stale record.
    status = Column(Enum(BatchStatus), nullable=False, default=BatchStatus.AVAILABLE, index=True)

    inspection_notes = Column(Text, nullable=True)
    inspected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    inspected_at = Column(DateTime(timezone=True), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    food_item = relationship("FoodItem", back_populates="batches")
    creator = relationship("User", foreign_keys=[created_by])
    inspector = relationship("User", foreign_keys=[inspected_by])

    def compute_status(self) -> "BatchStatus":
        """Derive the correct status from expiry_date and quantity.
        Called by the service layer before persisting or returning a batch.
        """
        today = date.today()
        if self.expiry_date < today:
            return BatchStatus.EXPIRED
        if self.quantity <= 0:
            return BatchStatus.OUT_OF_STOCK
        if (self.expiry_date - today).days <= NEAR_EXPIRY_DAYS:
            return BatchStatus.NEAR_EXPIRY
        if self.quantity <= LOW_STOCK_THRESHOLD:
            return BatchStatus.LOW_STOCK
        return BatchStatus.AVAILABLE
