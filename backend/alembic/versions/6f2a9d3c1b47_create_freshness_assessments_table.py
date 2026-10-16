"""create freshness_assessments table

Revision ID: 6f2a9d3c1b47
Revises: ebec029ed6b6
Create Date: 2026-09-13

This migration is purely additive for Milestone 2 (Food Image
Analysis & Freshness Assessment). It does NOT modify, drop, or alter
the existing "users" or "food_inventory" tables in any way - it only
creates one new table with a foreign key pointing at food_inventory.id.
"""
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "6f2a9d3c1b47"
down_revision = "ebec029ed6b6"
branch_labels = None
depends_on = None

freshness_category_enum = postgresql.ENUM(
    "fresh",
    "good",
    "acceptable",
    "near_spoilage",
    "spoiled",
    name="freshness_category",
)


def upgrade() -> None:
    freshness_category_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "freshness_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "inventory_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("food_inventory.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("image_path", sa.String(length=500), nullable=False),
        sa.Column("freshness_score", sa.Integer(), nullable=False),
        sa.Column(
            "freshness_category",
            postgresql.ENUM(
                "fresh",
                "good",
                "acceptable",
                "near_spoilage",
                "spoiled",
                name="freshness_category",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("spoilage_probability", sa.Float(), nullable=False),
        sa.Column("color_analysis", sa.JSON(), nullable=False),
        sa.Column("texture_analysis", sa.JSON(), nullable=False),
        sa.Column("mold_detected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "bruising_detected", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "physical_damage_detected",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("quality_assessment", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_freshness_assessments_inventory_item_id",
        "freshness_assessments",
        ["inventory_item_id"],
    )
    op.create_index(
        "ix_freshness_assessments_user_id", "freshness_assessments", ["user_id"]
    )
    op.create_index(
        "ix_freshness_item_created",
        "freshness_assessments",
        ["inventory_item_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_freshness_item_created", table_name="freshness_assessments")
    op.drop_index("ix_freshness_assessments_user_id", table_name="freshness_assessments")
    op.drop_index(
        "ix_freshness_assessments_inventory_item_id", table_name="freshness_assessments"
    )
    op.drop_table("freshness_assessments")
    freshness_category_enum.drop(op.get_bind(), checkfirst=True)
