"""add store_id to users

Revision ID: c3d8f1a9b2e4
Revises: a1c7e5f2d938
Create Date: 2026-10-13

Adds ONE nullable column, users.store_id (plus an index). Nothing is
dropped or rewritten and no existing row is given a store: every
existing user starts with store_id = NULL, which means "not assigned -
only sees inventory they created". An Administrator assigns stores
afterwards (PATCH /api/users/{id}/store). Inventory rows are not
touched; an item belongs to the store of the user who created it.
"""
import sqlalchemy as sa
from alembic import op

revision = "c3d8f1a9b2e4"
down_revision = "a1c7e5f2d938"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("store_id", sa.String(length=100), nullable=True))
    op.create_index("ix_users_store_id", "users", ["store_id"])


def downgrade() -> None:
    op.drop_index("ix_users_store_id", table_name="users")
    op.drop_column("users", "store_id")
