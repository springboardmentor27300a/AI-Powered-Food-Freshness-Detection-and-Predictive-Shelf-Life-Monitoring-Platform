"""
Role-authorization dependency factory.

Usage on a router:
    @router.post("/food", dependencies=[Depends(require_role(
        UserRole.RETAIL_MANAGER, UserRole.WAREHOUSE_OPERATOR, UserRole.ADMINISTRATOR
    ))])

This runs AFTER get_current_user (401 for bad/missing token) and raises
403 if the authenticated user's role isn't in the allowed set.
"""
from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole


def require_role(*allowed_roles: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not permitted to perform this action",
            )
        return current_user

    return role_checker
