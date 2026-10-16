"""
Admin-only platform statistics endpoint (Milestone 3).

Reuses the existing require_roles(UserRole.ADMINISTRATOR) dependency,
the same RBAC pattern already used by the existing GET /api/users
endpoint in app/api/users.py.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.freshness_assessment import FreshnessAssessment
from app.models.inventory import FoodInventory
from app.models.storage_condition import StorageCondition
from app.models.user import User, UserRole
from app.schemas.admin import AdminStatsResponse

router = APIRouter(tags=["Admin"])


@router.get(
    "/api/admin/stats",
    response_model=AdminStatsResponse,
    summary="Platform-wide statistics (Administrator only)",
)
def get_admin_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
):
    total_users = db.query(func.count(User.id)).scalar() or 0

    users_by_role = dict(
        db.query(User.role, func.count(User.id)).group_by(User.role).all()
    )
    users_by_role = {role.value: count for role, count in users_by_role.items()}

    total_inventory_items = db.query(func.count(FoodInventory.id)).scalar() or 0
    total_assessments = db.query(func.count(FreshnessAssessment.id)).scalar() or 0
    total_storage_readings = db.query(func.count(StorageCondition.id)).scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        users_by_role=users_by_role,
        total_inventory_items=total_inventory_items,
        total_freshness_assessments=total_assessments,
        total_storage_readings=total_storage_readings,
    )
