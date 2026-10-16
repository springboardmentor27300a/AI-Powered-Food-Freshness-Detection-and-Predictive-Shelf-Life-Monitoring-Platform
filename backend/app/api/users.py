"""
User profile routes (protected by JWT).
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user's profile",
)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.get(
    "",
    response_model=List[UserResponse],
    summary="List all users (Administrator only) — example of role-based access control",
)
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
):
    return db.query(User).order_by(User.created_at.desc()).all()
