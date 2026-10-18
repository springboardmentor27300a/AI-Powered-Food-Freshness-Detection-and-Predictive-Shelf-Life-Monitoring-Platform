from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class UserRole(str, Enum):
    CONSUMER = "Consumer"
    RETAILER = "Retailer"
    WAREHOUSE_MANAGER = "Warehouse Manager"
    WAREHOUSE_OPERATOR = "Warehouse Operator"
    FOOD_MANUFACTURER = "Food Manufacturer"
    SUPPLY_CHAIN_OPERATOR = "Supply Chain Operator"
    FOOD_QUALITY_INSPECTOR = "Food Quality Inspector"
    ADMIN = "Admin"

    @classmethod
    def list(cls):
        return [role.value for role in cls]

    @classmethod
    def registerable_roles(cls):
        return [
            cls.CONSUMER.value,
            cls.RETAILER.value,
            cls.WAREHOUSE_MANAGER.value,
            cls.WAREHOUSE_OPERATOR.value,
            cls.FOOD_MANUFACTURER.value,
            cls.SUPPLY_CHAIN_OPERATOR.value,
            cls.FOOD_QUALITY_INSPECTOR.value,
            cls.ADMIN.value,
        ]

    @classmethod
    def operational_roles(cls):
        return [
            cls.CONSUMER.value,
            cls.RETAILER.value,
            cls.WAREHOUSE_OPERATOR.value,
            cls.WAREHOUSE_MANAGER.value,
            cls.FOOD_QUALITY_INSPECTOR.value,
        ]


def normalize_role(role_name: str) -> str:
    """Normalize input role strings into standard system roles."""
    if not role_name:
        return UserRole.CONSUMER.value
    r = role_name.strip().lower()
    if r in ["quality inspector", "food quality inspector"]:
        return UserRole.FOOD_QUALITY_INSPECTOR.value
    if r in ["warehouse operator", "warehouse manager"]:
        return UserRole.WAREHOUSE_OPERATOR.value if "operator" in r else UserRole.WAREHOUSE_MANAGER.value
    if r in ["retailer"]:
        return UserRole.RETAILER.value
    if r in ["consumer"]:
        return UserRole.CONSUMER.value
    if r in ["admin", "administrator"]:
        return UserRole.ADMIN.value
    # Direct match if found
    for role in UserRole.list():
        if role.lower() == r:
            return role
    return role_name.strip()


def user_helper(user: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to convert MongoDB user document into a serializable dict."""
    if not user:
        return {}
    status_val = user.get("status", "active")
    is_active_val = user.get("is_active", True if status_val == "active" else False)
    return {
        "id": str(user.get("_id")),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", UserRole.CONSUMER.value),
        "status": status_val,
        "is_active": is_active_val,
        "last_login": user.get("last_login"),
        "google_id": user.get("google_id"),
        "auth_provider": user.get("auth_provider", "local"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }

