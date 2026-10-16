"""create storage_conditions table

Revision ID: a1c7e5f2d938
Revises: 6f2a9d3c1b47
Create Date: 2026-09-20

This migration is purely additive for Milestone 3 (Storage Condition
Monitoring). It does NOT modify, drop, or alter "users",
"food_inventory", or "freshness_assessments" in any way - it only
creates one new table with a foreign key pointing at food_inventory.id.
"""
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a1c7e5f2d938"
down_revision = "6f2a9d3c1b47"
branch_labels = None
depends_on = None

storage_compliance_status_enum = postgresql.ENUM(
    "suitable",
    "warning",
    "critical",
    name="storage_compliance_status",
)


def upgrade() -> None:
    storage_compliance_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "storage_conditions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "inventory_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("food_inventory.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("temperature_celsius", sa.Float(), nullable=False),
        sa.Column("humidity_percent", sa.Float(), nullable=False),
        sa.Column("air_circulation", sa.String(length=50), nullable=True),
        sa.Column("light_exposure", sa.String(length=50), nullable=True),
        sa.Column("packaging_type", sa.String(length=100), nullable=True),
        sa.Column(
            "compliance_status",
            postgresql.ENUM(
                "suitable",
                "warning",
                "critical",
                name="storage_compliance_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("compliance_notes", sa.String(length=500), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_storage_conditions_inventory_item_id", "storage_conditions", ["inventory_item_id"]
    )
    op.create_index("ix_storage_conditions_user_id", "storage_conditions", ["user_id"])
    op.create_index(
        "ix_storage_conditions_item_recorded",
        "storage_conditions",
        ["inventory_item_id", "recorded_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_storage_conditions_item_recorded", table_name="storage_conditions")
    op.drop_index("ix_storage_conditions_user_id", table_name="storage_conditions")
    op.drop_index("ix_storage_conditions_inventory_item_id", table_name="storage_conditions")
    op.drop_table("storage_conditions")
    storage_compliance_status_enum.drop(op.get_bind(), checkfirst=True)
