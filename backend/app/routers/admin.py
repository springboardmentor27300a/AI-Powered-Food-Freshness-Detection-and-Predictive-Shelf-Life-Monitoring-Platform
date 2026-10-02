from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import Food
from app.models.user import User


router = APIRouter(
    prefix="/admin",
    tags=["Administration"],
)


# ============================================================
# ALLOWED ROLES
# ============================================================

ALLOWED_ROLES = {
    "consumer",
    "retail_manager",
    "warehouse_operator",
    "food_quality_inspector",
    "administrator",
}


# ============================================================
# ADMIN ACCESS CONTROL
# ============================================================

def require_administrator(
    current_user=Depends(get_current_user),
):
    if current_user.role != "administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )

    return current_user


# ============================================================
# USER SERIALIZATION
# ============================================================

def serialize_user(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


# ============================================================
# GET ALL USERS
# ============================================================

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        serialize_user(user)
        for user in users
    ]


# ============================================================
# UPDATE USER ROLE
# ============================================================

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    selected_role = role.strip().lower()

    if selected_role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user role",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Admin cannot change their own administrator role.
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own administrator role",
        )

    user.role = selected_role

    db.commit()
    db.refresh(user)

    return {
        "message": "User role updated successfully",
        "user": serialize_user(user),
    }


# ============================================================
# UPDATE USER ACTIVE STATUS
# ============================================================

@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    is_active: bool = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Admin cannot deactivate their own account.
    if user.id == current_user.id and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    user.is_active = is_active

    db.commit()
    db.refresh(user)

    return {
        "message": "User status updated successfully",
        "user": serialize_user(user),
    }


# ============================================================
# PLATFORM ANALYTICS
# ============================================================

@router.get("/analytics")
def get_platform_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    users = db.query(User).all()
    foods = db.query(Food).all()

    # --------------------------------------------------------
    # USER ANALYTICS
    # --------------------------------------------------------

    role_counts = {}

    for user in users:
        role = user.role or "consumer"

        role_counts[role] = (
            role_counts.get(role, 0) + 1
        )

    active_users = sum(
        1
        for user in users
        if user.is_active
    )

    inactive_users = (
        len(users) - active_users
    )

    # --------------------------------------------------------
    # FOOD ANALYTICS
    # --------------------------------------------------------

    fresh_or_good = 0
    pending = 0
    spoiled = 0
    expired = 0

    today = date.today()

    for food in foods:

        freshness = (
            food.freshness_status or ""
        ).strip().lower()

        if freshness in {
            "fresh",
            "good",
        }:
            fresh_or_good += 1

        elif freshness == "pending":
            pending += 1

        elif freshness in {
            "spoiled",
            "rotten",
        }:
            spoiled += 1

        if (
            food.expiry_date
            and food.expiry_date < today
        ):
            expired += 1

    return {
        "users": {
            "total": len(users),
            "active": active_users,
            "inactive": inactive_users,
            "by_role": role_counts,
        },
        "inventory": {
            "total": len(foods),
            "fresh_or_good": fresh_or_good,
            "pending": pending,
            "spoiled": spoiled,
            "expired": expired,
        },
    }


# ============================================================
# SYSTEM STATUS
# ============================================================

@router.get("/system")
def get_system_status(
    current_user=Depends(require_administrator),
):
    return {
        "status": "operational",
        "authentication": "operational",
        "inventory_api": "operational",
        "prediction_api": "operational",
        "administration_api": "operational",
    }