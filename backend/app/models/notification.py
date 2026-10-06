from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # User who should receive the notification
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Notification information
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # info / success / warning / critical
    severity = Column(String(20), nullable=False, default="info")

    # freshness / shelf_life / spoilage / storage / inventory / platform
    notification_type = Column(String(50), nullable=False, index=True)

    # Optional related FoodCare record
    # Examples: batch, food_item, storage_reading, freshness_report
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)

    # Optional frontend navigation URL
    action_url = Column(String(500), nullable=True)

    # Read/unread status
    is_read = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    read_at = Column(DateTime(timezone=True), nullable=True)