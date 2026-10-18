"""Add isolated M2 v2 assessment history."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.database import Base
import app.models  # noqa: F401 - register the core application tables


revision: str = "20261015_01"
down_revision: Union[str, Sequence[str], None] = "7d97512829cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The historical baseline revision was published as a no-op. Create only
    # missing core application tables before adding the M2 foreign key. SQLAlchemy
    # checkfirst leaves existing tables and their data untouched. Keep the M2
    # table in this revision below so its indexes and schema remain explicit.
    core_tables = [table for table in Base.metadata.sorted_tables if table.name != "m2_analyses"]
    Base.metadata.create_all(bind=op.get_bind(), tables=core_tables)

    op.create_table(
        "m2_analyses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_name", sa.String(length=120), nullable=True),
        sa.Column("declared_category", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("food_subtype", sa.String(length=120), nullable=True),
        sa.Column("capability_status", sa.String(length=32), nullable=False),
        sa.Column("assessment_status", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("model_id", sa.String(length=120), nullable=True),
        sa.Column("classification", sa.String(length=40), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("quality_score", sa.Integer(), nullable=True),
        sa.Column("spoilage_probability", sa.Float(), nullable=True),
        sa.Column("image_format", sa.String(length=12), nullable=False),
        sa.Column("image_width", sa.Integer(), nullable=False),
        sa.Column("image_height", sa.Integer(), nullable=False),
        sa.Column("visual_analysis_json", sa.Text(), nullable=False),
        sa.Column("defects_json", sa.Text(), nullable=False),
        sa.Column("class_probabilities_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_m2_analyses_user_id", "m2_analyses", ["user_id"])
    op.create_index("ix_m2_analyses_category", "m2_analyses", ["category"])
    op.create_index("ix_m2_analyses_assessment_status", "m2_analyses", ["assessment_status"])
    op.create_index("ix_m2_analyses_created_at", "m2_analyses", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_m2_analyses_created_at", table_name="m2_analyses")
    op.drop_index("ix_m2_analyses_assessment_status", table_name="m2_analyses")
    op.drop_index("ix_m2_analyses_category", table_name="m2_analyses")
    op.drop_index("ix_m2_analyses_user_id", table_name="m2_analyses")
    op.drop_table("m2_analyses")
