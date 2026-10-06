"""
/api/analytics — role-aware dashboard data. All authenticated users may
call these; the frontend picks which widgets to show per role. Endpoints
that are meaningfully admin-only (full platform overview) are gated.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.user import User, UserRole
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/inventory")
def inventory_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics_service.inventory_overview(db)


@router.get("/freshness")
def freshness_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics_service.freshness_overview(db)


@router.get("/storage")
def storage_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics_service.storage_overview(db)


@router.get("/platform")
def platform_overview(
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
):
    return analytics_service.platform_overview(db)
