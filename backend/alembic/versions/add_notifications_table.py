"""Add notifications table.

Revision ID: add_notifications_table
Revises: 1d90ebd55815
"""

from alembic import op
import sqlalchemy as sa


revision = "add_notifications_table"
down_revision = "1d90ebd55815"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "severity",
            sa.String(length=20),
            nullable=False,
            server_default="info",
        ),
        sa.Column(
            "notification_type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("action_url", sa.String(length=500), nullable=True),
        sa.Column(
            "is_read",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_notifications_id",
        "notifications",
        ["id"],
        unique=False,
    )

    op.create_index(
        "ix_notifications_user_id",
        "notifications",
        ["user_id"],
        unique=False,
    )

    op.create_index(
        "ix_notifications_notification_type",
        "notifications",
        ["notification_type"],
        unique=False,
    )

    op.create_index(
        "ix_notifications_is_read",
        "notifications",
        ["is_read"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_notifications_is_read",
        table_name="notifications",
    )

    op.drop_index(
        "ix_notifications_notification_type",
        table_name="notifications",
    )

    op.drop_index(
        "ix_notifications_user_id",
        table_name="notifications",
    )

    op.drop_index(
        "ix_notifications_id",
        table_name="notifications",
    )

    op.drop_table("notifications")