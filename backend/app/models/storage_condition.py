"""
SQLAlchemy model for the `storage_conditions` table.

This is a NEW, additive table for Milestone 3 (Storage Condition
Monitoring). It does not modify `users`, `food_inventory`, or
`freshness_assessments` in any way - it only references
`food_inventory.id` via a foreign key.

There is currently no physical IoT sensor integration. Each row here
represents ONE manually-entered storage-condition reading for one
inventory item at a point in time. Storing a history (rather than a
single row per item) is intentional: it lets environmental trends be
shown later, and it means a future sensor integration could simply
insert new rows here without any schema change.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ComplianceStatus(str, enum.Enum):
    SUITABLE = "suitable"
    WARNING = "warning"
    CRITICAL = "critical"


class StorageCondition(Base):
    __tablename__ = "storage_conditions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("food_inventory.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Denormalized owner reference for fast, direct ownership checks -
    # same style as freshness_assessments.user_id (plain UUID column,
    # no FK constraint), for consistency with the rest of this project.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    temperature_celsius: Mapped[float] = mapped_column(Float, nullable=False)
    humidity_percent: Mapped[float] = mapped_column(Float, nullable=False)

    # Optional finer-grained environmental parameters.
    air_circulation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    light_exposure: Mapped[str | None] = mapped_column(String(50), nullable=True)
    packaging_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Computed at write time by app/core/storage_scoring.py and stored
    # so history/trend queries don't need to re-run the rule engine
    # against thresholds that might change later.
    compliance_status: Mapped[ComplianceStatus] = mapped_column(
        Enum(
            ComplianceStatus,
            name="storage_compliance_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    compliance_notes: Mapped[str] = mapped_column(String(500), nullable=False)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_storage_conditions_item_recorded", "inventory_item_id", "recorded_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<StorageCondition item={self.inventory_item_id} "
            f"status={self.compliance_status}>"
        )
