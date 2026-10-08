from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
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
# REQUEST SCHEMAS
# ============================================================

class UserRoleUpdate(BaseModel):
    role: str


class UserStatusUpdate(BaseModel):
    is_active: bool


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

@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    selected_role = (
        payload.role or ""
    ).strip().lower()

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

    # --------------------------------------------------------
    # Prevent administrator from changing their own role.
    # --------------------------------------------------------

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "You cannot change your own "
                "administrator role"
            ),
        )

    user.role = selected_role

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update user role",
        )

    return {
        "message": "User role updated successfully",
        "user": serialize_user(user),
    }


# ============================================================
# UPDATE USER ACTIVE STATUS
# ============================================================

@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
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

    # --------------------------------------------------------
    # Prevent administrator from deactivating their own
    # account.
    # --------------------------------------------------------

    if (
        user.id == current_user.id
        and not payload.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    user.is_active = payload.is_active

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update user status",
        )

    return {
        "message": (
            "User activated successfully"
            if payload.is_active
            else "User deactivated successfully"
        ),
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
# ADMIN - COMPLETE PLATFORM FOOD DATA
# ============================================================
#
# Administrator Reports receives the complete platform
# inventory from this endpoint.
#
# Existing /foods endpoint remains user-specific.
# Existing prediction and inventory workflows are unchanged.
#
# This endpoint includes:
# - Food information
# - Category
# - Owner/user information
# - Owner role
# - Owner account status
# - Dates
# - Storage information
# - Milestone 3 intelligence outputs
# ============================================================

@router.get("/foods")
def get_all_platform_foods(
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    rows = (
        db.query(Food, User)
        .outerjoin(
            User,
            Food.user_id == User.id,
        )
        .order_by(
            Food.created_at.desc()
        )
        .all()
    )

    result = []

    for food, owner in rows:

        result.append(
            {
                # ------------------------------------------------
                # FOOD IDENTIFICATION
                # ------------------------------------------------
                "id": food.id,
                "user_id": food.user_id,

                # ------------------------------------------------
                # OWNER / ROLE INFORMATION
                # ------------------------------------------------
                "user_name": (
                    owner.name
                    if owner
                    else "Unknown User"
                ),
                "user_email": (
                    owner.email
                    if owner
                    else ""
                ),
                "user_role": (
                    owner.role
                    if owner
                    else "consumer"
                ),
                "user_is_active": (
                    owner.is_active
                    if owner
                    else False
                ),

                # ------------------------------------------------
                # FOOD INFORMATION
                # ------------------------------------------------
                "food_name": food.food_name,

                # ------------------------------------------------
                # CATEGORY
                # ------------------------------------------------
                "category": (
                    food.category
                    if food.category
                    else None
                ),

                "freshness_status": (
                    food.freshness_status
                ),
                "freshness_score": (
                    food.freshness_score
                ),
                "image_path": food.image_path,

                # ------------------------------------------------
                # DATES
                # ------------------------------------------------
                "manufacturing_date": (
                    food.manufacturing_date
                ),
                "expiry_date": (
                    food.expiry_date
                ),
                "created_at": food.created_at,

                # ------------------------------------------------
                # STORAGE
                # ------------------------------------------------
                "storage_condition": (
                    food.storage_condition
                ),
                "storage_temperature": (
                    food.storage_temperature
                ),
                "storage_humidity": (
                    food.storage_humidity
                ),
                "packaging_type": (
                    food.packaging_type
                ),
                "storage_duration": (
                    food.storage_duration
                ),
                "air_circulation": (
                    food.air_circulation
                ),
                "light_exposure": (
                    food.light_exposure
                ),

                # ------------------------------------------------
                # MILESTONE 3 OUTPUTS
                # ------------------------------------------------
                "remaining_shelf_life": (
                    food.remaining_shelf_life
                ),
                "shelf_life_confidence": (
                    food.shelf_life_confidence
                ),
                "shelf_life_risk": (
                    food.shelf_life_risk
                ),
                "storage_compliance_score": (
                    food.storage_compliance_score
                ),
                "overall_health_score": (
                    food.overall_health_score
                ),
            }
        )

    return result


# ============================================================
# SYSTEM STATUS
# ============================================================

@router.get("/system-status")
def get_system_status(
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    # --------------------------------------------------------
    # Verify database connectivity.
    # --------------------------------------------------------

    try:
        db.query(User).limit(1).all()

        database_status = "operational"

    except Exception:
        database_status = "unavailable"

    # --------------------------------------------------------
    # Overall platform status.
    # --------------------------------------------------------

    overall_status = (
        "operational"
        if database_status == "operational"
        else "degraded"
    )

    return {
        "status": overall_status,
        "authentication": "operational",
        "inventory_api": "operational",
        "prediction_api": "operational",
        "administration_api": "operational",
        "database": database_status,
    }


# ============================================================
# SYSTEM STATUS COMPATIBILITY ENDPOINT
# ============================================================

@router.get("/system")
def get_system_status_legacy(
    db: Session = Depends(get_db),
    current_user=Depends(require_administrator),
):
    return get_system_status(
        db=db,
        current_user=current_user,
    )