from typing import List, Dict, Any, Optional
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.app.database import get_users_collection
from backend.app.models.user_model import UserRole, user_helper
from backend.app.utils.security import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Extract and validate current authenticated user from Bearer token.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or invalid format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    users_col = get_users_collection()
    if users_col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is currently unavailable.",
        )

    try:
        user = users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = users_col.find_one({"_id": user_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Enforce account activation status
    if user.get("is_active") is False or user.get("status") == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact platform administrator.",
        )

    # Attach string id for easy access
    user_dict = user_helper(user)
    user_dict["_id"] = user["_id"]
    return user_dict


def require_roles(allowed_roles: List[str]):
    """
    Role-Based Access Control (RBAC) dependency factory.
    Admins automatically bypass role restrictions.
    """
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", UserRole.CONSUMER.value)

        # Admin always has platform-wide access
        if user_role == UserRole.ADMIN.value:
            return current_user

        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{user_role}' lacks sufficient permissions for this operation. Allowed roles: {', '.join(allowed_roles)}.",
            )
        return current_user

    return role_checker


# Quick role dependencies
require_admin = require_roles([UserRole.ADMIN.value])


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    Extract current authenticated user if Bearer token is provided, otherwise return None.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except Exception:
        return None
