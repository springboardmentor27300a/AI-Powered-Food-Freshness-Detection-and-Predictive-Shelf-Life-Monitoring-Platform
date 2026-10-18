from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse

from backend.app.utils.dependencies import require_admin
from backend.app.services.admin_service import AdminService
from backend.app.services.audit_service import AuditService
from backend.app.schemas.user_schema import UserResponse
from backend.app.schemas.admin_schema import (
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
    StorageRuleCreateRequest,
    StorageRuleUpdateRequest,
    StorageRuleResponse,
    SystemConfigResponse,
    SystemConfigUpdateRequest,
    AdminDashboardResponse,
    AiStatisticsResponse,
    AuditLogListResponse,
    SystemHealthResponse,
)

router = APIRouter(prefix="/admin", tags=["Administrator Console"], dependencies=[Depends(require_admin)])


# ==============================================================================
# 1. Dashboard Overview
# ==============================================================================
@router.get(
    "/dashboard",
    response_model=AdminDashboardResponse,
    summary="Administrator platform overview metrics"
)
async def get_admin_dashboard(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Retrieve live system overview KPIs: total users, active/inactive counts,
    total inventory, fresh/spoiled counts, avg quality score, and recent audits.
    """
    return AdminService.get_dashboard_overview()


# ==============================================================================
# 2. User & Role Management
# ==============================================================================
@router.get(
    "/users",
    summary="List, search, and filter platform users"
)
async def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by assigned role"),
    status: Optional[str] = Query(None, description="Filter by status ('active', 'deactivated')"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    View all registered users with search, multi-role filtering, status filtering, and pagination.
    """
    return AdminService.list_users(search=search, role=role, status=status, limit=limit, skip=skip)


@router.get(
    "/users/{user_id}",
    summary="Inspect individual user record and audit metadata"
)
async def get_user_details(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Retrieve comprehensive user details cross-referenced with inventory and inspection metrics.
    """
    return AdminService.get_user_details(user_id)


@router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
    summary="Reassign user operational role"
)
async def update_user_role(
    user_id: str,
    data: UserRoleUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Change a user's assigned role (Consumer, Retailer, Warehouse Operator, Food Quality Inspector, Admin).
    Guards against removing the last platform administrator.
    """
    return AdminService.update_user_role(user_id=user_id, new_role=data.role, admin_user=admin_user)


@router.patch(
    "/users/{user_id}/activate",
    response_model=UserResponse,
    summary="Reactivate a deactivated user account"
)
async def activate_user(
    user_id: str,
    data: Optional[UserStatusUpdateRequest] = None,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Reactivate user access and append an administrative audit log.
    """
    reason = data.reason if data else None
    return AdminService.activate_user(user_id=user_id, admin_user=admin_user, reason=reason)


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserResponse,
    summary="Deactivate user account and revoke API access"
)
async def deactivate_user(
    user_id: str,
    data: Optional[UserStatusUpdateRequest] = None,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Deactivate account (soft-delete), preventing login and protected API calls.
    Admins are prevented from deactivating their own active session.
    """
    reason = data.reason if data else None
    return AdminService.deactivate_user(user_id=user_id, admin_user=admin_user, reason=reason)


# ==============================================================================
# 3. AI & Computer Vision Monitoring
# ==============================================================================
@router.get(
    "/ai/statistics",
    response_model=AiStatisticsResponse,
    summary="AI Computer Vision and shelf-life prediction monitoring"
)
async def get_ai_statistics(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Inspect model prediction counts (Fresh, Marginal, Spoiled), average confidence,
    quality score distribution, activity timeline, and processing errors.
    """
    return AdminService.get_ai_statistics()


# ==============================================================================
# 4. Audit Logs
# ==============================================================================
@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="Query platform security and administrative audit trail"
)
async def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action (e.g. ROLE_CHANGE, USER_DEACTIVATION)"),
    actor_email: Optional[str] = Query(None, description="Filter by actor email"),
    target_resource: Optional[str] = Query(None, description="Filter by resource (e.g. users, storage_rules)"),
    status: Optional[str] = Query(None, description="Filter by event status ('success', 'failure')"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Query append-only audit logs with search, multi-field filtering, and pagination.
    """
    return AuditService.list_logs(
        action=action,
        actor_email=actor_email,
        target_resource=target_resource,
        status=status,
        limit=limit,
        skip=skip
    )


# ==============================================================================
# 5. Storage Condition Rules Management
# ==============================================================================
@router.get(
    "/storage-rules",
    response_model=List[StorageRuleResponse],
    summary="List all category storage condition rules"
)
async def get_storage_rules(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Fetch global storage temperature and humidity tolerances used by Warehouse Operators.
    """
    return AdminService.get_storage_rules()


@router.post(
    "/storage-rules",
    response_model=StorageRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Define a new category storage condition rule"
)
async def create_storage_rule(
    data: StorageRuleCreateRequest,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Create a new storage rule with min/max temperature and humidity validation.
    """
    return AdminService.create_storage_rule(data, admin_user)


@router.put(
    "/storage-rules/{rule_id}",
    response_model=StorageRuleResponse,
    summary="Update existing category storage condition rule"
)
async def update_storage_rule(
    rule_id: str,
    data: StorageRuleUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Update storage rule parameters with range consistency checks.
    """
    return AdminService.update_storage_rule(rule_id, data, admin_user)


@router.delete(
    "/storage-rules/{rule_id}",
    summary="Delete custom storage rule"
)
async def delete_storage_rule(
    rule_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Remove custom category storage condition rule.
    """
    return AdminService.delete_storage_rule(rule_id, admin_user)


# ==============================================================================
# 6. System Health & Platform Monitoring
# ==============================================================================
@router.get(
    "/system/health",
    response_model=SystemHealthResponse,
    summary="Live system health and dependency probe"
)
async def get_system_health(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Measure live MongoDB Atlas ping latency, check OpenCV vision engine status,
    verify upload directory permissions, and inspect recent system error counts.
    """
    return AdminService.get_system_health()


# ==============================================================================
# 7. Safe System Configuration
# ==============================================================================
@router.get(
    "/system/config",
    response_model=SystemConfigResponse,
    summary="Inspect safe platform-level configuration"
)
async def get_system_config(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Retrieve non-sensitive platform feature flags and thresholds (zero secrets exposed).
    """
    return AdminService.get_system_config()


@router.put(
    "/system/config",
    response_model=SystemConfigResponse,
    summary="Update safe platform-level configuration"
)
async def update_system_config(
    data: SystemConfigUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Update feature flags, auto-quarantine threshold, and notification settings.
    """
    return AdminService.update_system_config(data, admin_user)


# ==============================================================================
# 8. Reports & Analytics Export
# ==============================================================================
@router.get(
    "/reports/analytics",
    summary="Platform-wide aggregated administrative report"
)
async def get_reports_analytics(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Comprehensive system analytics across users, freshness, and inventory.
    """
    return AdminService.get_reports_analytics()


@router.get(
    "/reports/export-csv",
    summary="Export platform users audit spreadsheet (CSV)"
)
async def export_users_csv(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Stream downloadable CSV spreadsheet containing all platform user accounts.
    """
    csv_content = AdminService.export_users_csv()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="platform_users_export.csv"'}
    )
