"""Fix notification UUID columns.

Revision ID: fix_notification_uuid_columns
Revises: add_notifications_table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "fix_notification_uuid_columns"
down_revision = "add_notifications_table"
branch_labels = None
depends_on = None


def upgrade():
    # Existing notification table is empty, so these columns can
    # safely be changed from INTEGER to UUID.
    op.alter_column(
        "notifications",
        "user_id",
        existing_type=sa.Integer(),
        type_=postgresql.UUID(as_uuid=True),
        existing_nullable=True,
        postgresql_using="user_id::text::uuid",
    )

    op.alter_column(
        "notifications",
        "reference_id",
        existing_type=sa.Integer(),
        type_=postgresql.UUID(as_uuid=True),
        existing_nullable=True,
        postgresql_using="reference_id::text::uuid",
    )


def downgrade():
    op.alter_column(
        "notifications",
        "reference_id",
        existing_type=postgresql.UUID(as_uuid=True),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="reference_id::text::integer",
    )

    op.alter_column(
        "notifications",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="user_id::text::integer",
    )