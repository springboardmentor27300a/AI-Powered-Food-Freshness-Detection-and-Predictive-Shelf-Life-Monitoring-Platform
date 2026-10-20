from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from backend.app.schemas.user_schema import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
    GoogleAuthRequest,
)

from backend.app.services.auth_service import AuthService
from backend.app.services.audit_service import AuditService
from backend.app.utils.dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
async def register(data: UserRegisterRequest):
    """
    Register a new user in the platform.
    Public registration supports Consumer, Retailer, Warehouse Manager,
    Food Manufacturer, Supply Chain Operator, Food Quality Inspector, and Admin roles.
    """
    new_user = AuthService.register_user(data)
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and obtain JWT token"
)
async def login(data: UserLoginRequest):
    """
    Log in with email and password to receive a signed JWT Bearer access token.
    """
    return AuthService.authenticate_user(data)


@router.post(
    "/google",
    response_model=TokenResponse,
    summary="Authenticate or register using Google Sign-In"
)
async def google_auth(data: GoogleAuthRequest):
    """
    Verify Google ID token, resolve user identity by Google 'sub',
    issue signed JWT token, and prevent Admin role self-escalation.
    """
    return AuthService.authenticate_google_user(data)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile"
)
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve profile details of the currently authenticated user based on the provided JWT token.
    """
    return current_user


@router.get(
    "/dashboard-access",
    summary="Validate authoritative role-based dashboard assignment"
)
async def get_role_dashboard_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns the single authoritative dashboard and permitted workspace for the authenticated user's role.
    """
    role = current_user.get("role", "Consumer")

    role_dashboard_map = {
        "Consumer": "dashboard.html",
        "Retailer": "retailer-dashboard.html",
        "Food Quality Inspector": "dashboard-inspector.html",
        "Quality Inspector": "dashboard-inspector.html",
        "Warehouse Operator": "warehouse-dashboard.html",
        "Warehouse Manager": "warehouse-dashboard.html",
        "Supply Chain Operator": "warehouse-dashboard.html",
        "Admin": "admin-dashboard.html",
    }

    assigned = role_dashboard_map.get(role, "dashboard.html")

    return {
        "user_id": str(current_user["_id"]),
        "role": role,
        "assigned_dashboard": assigned,
        "allowed_dashboards": [assigned],
    }


@router.post(
    "/logout",
    summary="Invalidate user session and record audit event"
)
async def logout(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Log out user. If authenticated, records audit log of the logout event.
    """
    if current_user:
        AuditService.log_event(
            action="USER_LOGOUT",
            actor_id=str(current_user.get("_id", "")),
            actor_email=current_user.get("email"),
            actor_role=current_user.get("role"),
            target_resource="users",
            status="success",
        )
    return {"success": True, "message": "Successfully logged out."}


