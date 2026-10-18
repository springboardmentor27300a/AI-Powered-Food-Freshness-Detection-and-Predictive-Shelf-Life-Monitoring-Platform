from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.schemas.user_schema import (
    UserResponse,
    UserProfileUpdateRequest,
    UserPasswordChangeRequest,
)
from backend.app.services.auth_service import AuthService
from backend.app.utils.dependencies import get_current_user, require_admin
from backend.app.models.user_model import UserRole

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=List[UserResponse],
    summary="List all registered platform users (Admin only)"
)
async def list_users(
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Administrator endpoint to view all registered users in the platform.
    Requires Admin privileges.
    """
    return AuthService.list_all_users()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user details by ID"
)
async def get_user_by_id(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve user details by ID.
    Users can inspect their own record; Admins can inspect any user record.
    """
    if current_user.get("role") != UserRole.ADMIN.value and str(current_user.get("id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot view other users' profile data."
        )

    return AuthService.get_user_by_id(user_id)


@router.get(
    "/profile/me",
    summary="Get detailed user profile including contact and preferences"
)
async def get_my_extended_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve comprehensive profile details for the authenticated user.
    """
    from backend.app.database import get_users_collection
    from bson import ObjectId

    users_col = get_users_collection()
    user_id = current_user.get("id") or current_user.get("_id")
    try:
        user_doc = users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user_doc = users_col.find_one({"_id": user_id})

    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    return {
        "id": str(user_doc["_id"]),
        "name": user_doc.get("name"),
        "email": user_doc.get("email"),
        "role": user_doc.get("role"),
        "phone": user_doc.get("phone", ""),
        "organization": user_doc.get("organization", ""),
        "preferences": user_doc.get("preferences", {"units": "metric", "email_alerts": True}),
        "status": user_doc.get("status", "active"),
        "auth_provider": user_doc.get("auth_provider", "local"),
        "created_at": user_doc.get("created_at"),
        "updated_at": user_doc.get("updated_at"),
    }


@router.put(
    "/profile",
    summary="Update authenticated user profile information"
)
async def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Updates the authenticated user's display name, phone, organization, and preferences.
    """
    from datetime import datetime, timezone
    from backend.app.database import get_users_collection
    from bson import ObjectId

    users_col = get_users_collection()
    user_id = current_user.get("id") or current_user.get("_id")
    try:
        uid = ObjectId(user_id)
    except Exception:
        uid = user_id

    update_fields: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if payload.name:
        update_fields["name"] = payload.name.strip()
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.organization is not None:
        update_fields["organization"] = payload.organization.strip()
    if payload.preferences is not None:
        update_fields["preferences"] = payload.preferences

    users_col.update_one({"_id": uid}, {"$set": update_fields})
    updated_user = users_col.find_one({"_id": uid})

    return {
        "success": True,
        "message": "User profile updated successfully.",
        "user": {
            "id": str(updated_user["_id"]),
            "name": updated_user.get("name"),
            "email": updated_user.get("email"),
            "role": updated_user.get("role"),
            "phone": updated_user.get("phone", ""),
            "organization": updated_user.get("organization", ""),
            "preferences": updated_user.get("preferences", {}),
            "updated_at": updated_user.get("updated_at"),
        }
    }


@router.post(
    "/change-password",
    summary="Change user password securely"
)
async def change_password(
    payload: UserPasswordChangeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Validates current password, hashes the new password with bcrypt, and updates database.
    """
    from datetime import datetime, timezone
    from backend.app.database import get_users_collection
    from backend.app.utils.security import verify_password, hash_password
    from bson import ObjectId

    users_col = get_users_collection()
    user_id = current_user.get("id") or current_user.get("_id")
    try:
        uid = ObjectId(user_id)
    except Exception:
        uid = user_id

    user_doc = users_col.find_one({"_id": uid})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    stored_hash = user_doc.get("password_hash")
    if not stored_hash or not verify_password(payload.current_password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed. Please check your existing password."
        )

    new_hash = hash_password(payload.new_password)
    users_col.update_one(
        {"_id": uid},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}}
    )

    return {"success": True, "message": "Password changed successfully."}

