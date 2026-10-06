"""
/api/admin — administrator-only user management and system stats.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserRoleUpdate
from app.services.inventory_service import get_inventory_summary

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.put("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: uuid.UUID,
    data: UserRoleUpdate,
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = data.role
    db.commit()
    db.refresh(user)
    return user


@router.get("/stats")
def system_stats(
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()
    users_by_role = {}
    for role in UserRole:
        users_by_role[role.value] = db.query(User).filter(User.role == role).count()
    inventory = get_inventory_summary(db)
    return {"total_users": total_users, "users_by_role": users_by_role, "inventory": inventory}
