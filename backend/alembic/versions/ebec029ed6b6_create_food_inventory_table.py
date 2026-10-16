"""create food inventory table

Revision ID: ebec029ed6b6
Revises: 0001
Create Date: 2026-09-03

"""

from typing import Sequence, Union

from alembic import op


revision: str = "ebec029ed6b6"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The food_inventory table already exists because it was
    # created from the SQLAlchemy model during development.
    # This migration only records the schema change in Alembic.
    pass


def downgrade() -> None:
    # Keep the existing table when downgrading because this
    # migration does not create or modify the table.
    pass