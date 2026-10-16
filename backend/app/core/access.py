"""
Shared-inventory access rules.

Retail Managers, Warehouse Operators and Food Quality Inspectors work on the same stock, so they
can both VIEW each other's inventory items and the freshness / storage
records attached to them. Everyone else (consumers and administrators) keeps the original behaviour: they only see their own records.

Write rules are unchanged: only the creator can edit or delete an
inventory item. Warehouse Operators and Inspectors may add freshness
analyses and storage readings to shared items; those records are stamped with the
operator's own user_id.

To change who shares inventory, edit SHARED_INVENTORY_ROLES only.
"""

from sqlalchemy import true

from app.models.inventory import FoodInventory
from app.models.user import User, UserRole

SHARED_INVENTORY_ROLES = frozenset(
    {
        UserRole.RETAIL_MANAGER,
        UserRole.WAREHOUSE_OPERATOR,
        UserRole.FOOD_QUALITY_INSPECTOR,
    }
)


def has_shared_inventory_access(user: User) -> bool:
    return user.role in SHARED_INVENTORY_ROLES


def inventory_scope(user: User):
    """WHERE-clause limiting FoodInventory rows the user may view."""
    if has_shared_inventory_access(user):
        return true()
    return FoodInventory.user_id == user.id


def record_scope(user_id_column, user: User):
    """WHERE-clause for child records (assessments, storage readings)."""
    if has_shared_inventory_access(user):
        return true()
    return user_id_column == user.id
