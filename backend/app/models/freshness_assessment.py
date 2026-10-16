"""
SQLAlchemy model for the `freshness_assessments` table.

This is a NEW, additive table for Milestone 2 (Food Image Analysis &
Freshness Assessment Engine). It does not modify `users` or
`food_inventory` in any way — it only references `food_inventory.id`
via a foreign key so each assessment is tied to one inventory item.

Each row stores the result of ONE heuristic computer-vision analysis
of ONE uploaded food photo. Multiple rows per inventory item are
expected over time — that history is what powers freshness trend
analysis (see app/api/freshness.py).
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Enum,
    JSON,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class FreshnessCategory(str, enum.Enum):
    FRESH = "fresh"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    NEAR_SPOILAGE = "near_spoilage"
    SPOILED = "spoiled"


class FreshnessAssessment(Base):
    __tablename__ = "freshness_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Links this assessment to one food_inventory row.
    # ondelete="CASCADE": if the inventory item is deleted, its
    # assessment history is deleted with it (no orphaned rows).
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("food_inventory.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Denormalized owner reference for fast, direct ownership checks.
    # Mirrors the existing food_inventory.user_id column style
    # (plain UUID column, no FK constraint) for consistency with the
    # rest of this project rather than introducing a new pattern.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Relative path under backend/media/uploads/, e.g. "2026/09/abc123.jpg".
    # The raw image bytes are never stored in PostgreSQL.
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # ---- Heuristic computer-vision results (NOT a trained ML model) ----

    freshness_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    freshness_category: Mapped[FreshnessCategory] = mapped_column(
        Enum(
            FreshnessCategory,
            name="freshness_category",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    spoilage_probability: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0-1.0

    color_analysis: Mapped[dict] = mapped_column(JSON, nullable=False)
    texture_analysis: Mapped[dict] = mapped_column(JSON, nullable=False)

    mold_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bruising_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    physical_damage_detected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    quality_assessment: Mapped[str] = mapped_column(String(500), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Speeds up "history for this item, most recent first" queries
        # used by the freshness trend endpoint.
        Index("ix_freshness_item_created", "inventory_item_id", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<FreshnessAssessment item={self.inventory_item_id} "
            f"score={self.freshness_score} category={self.freshness_category}>"
        )
