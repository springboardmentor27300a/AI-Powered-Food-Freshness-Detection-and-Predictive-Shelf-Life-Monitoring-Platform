from typing import Dict, Any
from fastapi import APIRouter, Depends
from backend.app.schemas.inventory_schema import DashboardStatsResponse
from backend.app.services.inventory_service import InventoryService
from backend.app.models.user_model import UserRole
from backend.app.utils.dependencies import require_roles

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="Get aggregated dashboard statistics"
)
async def get_dashboard_stats(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.CONSUMER.value]))
):
    """
    Retrieve real-time statistical metrics for the dashboard:
    - Total Food Items
    - Total Quantity
    - Items Expiring Soon (< 3 days)
    - Freshness Analysis Pending
    - Spoiled Items
    - Storage Alerts
    - Category & Storage Type Breakdown
    """
    return InventoryService.get_dashboard_stats(current_user)
