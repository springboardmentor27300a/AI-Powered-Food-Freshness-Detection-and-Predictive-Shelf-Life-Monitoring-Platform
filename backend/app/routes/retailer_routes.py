from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from backend.app.models.user_model import UserRole
from backend.app.utils.dependencies import require_roles
from backend.app.schemas.retailer_schema import (
    RetailerProductCreateRequest,
    RetailerProductUpdateRequest,
    StockUpdateRequest,
    ArchiveRequest,
    AlertAcknowledgeRequest,
    RetailerItemResponse,
    RetailerAlertResponse,
    RetailerNotificationResponse,
)
from backend.app.services.retailer_service import RetailerService

router = APIRouter(
    prefix="/retailer",
    tags=["Retailer Operations & Management"],
    dependencies=[Depends(require_roles([UserRole.RETAILER.value]))]
)


# ==============================================================================
# 1. Retailer Dashboard & Overview
# ==============================================================================

@router.get(
    "/dashboard",
    summary="Retrieve Retailer Dashboard Overview (KPIs, Charts, Priorities)"
)
async def get_retailer_dashboard(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Returns aggregated KPIs, recent inventory, priority items, active alerts,
    and Chart.js datasets scoped exclusively to the authenticated retailer.
    """
    return RetailerService.get_retailer_dashboard(current_user)


# ==============================================================================
# 2. Inventory & Stock Management
# ==============================================================================

@router.get(
    "/inventory",
    response_model=List[RetailerItemResponse],
    summary="List Retailer Food Products with Multi-Filtering & Search"
)
async def list_retailer_inventory(
    search: Optional[str] = Query(None, description="Search by name, location, or batch"),
    category: Optional[str] = Query(None, description="Filter by food category"),
    freshness_status: Optional[str] = Query(None, description="Filter by freshness label"),
    expiry_status: Optional[str] = Query(None, description="Filter: expiring_soon, expired, safe, all"),
    is_archived: bool = Query(False, description="Filter archived products"),
    low_stock_only: bool = Query(False, description="Filter only products with low stock"),
    sort_by: str = Query("expiry_date", description="Field to sort by"),
    sort_order: str = Query("asc", description="Sort direction: asc or desc"),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Retrieve food inventory products owned strictly by the authenticated retailer.
    """
    return RetailerService.list_products(
        current_user=current_user,
        search=search,
        category=category,
        freshness_status=freshness_status,
        expiry_status=expiry_status,
        is_archived=is_archived,
        low_stock_only=low_stock_only,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post(
    "/inventory",
    response_model=RetailerItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a New Food Product to Retailer Inventory"
)
async def create_retailer_product(
    data: RetailerProductCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Creates a new inventory item owned by the retailer.
    """
    return RetailerService.create_product(data, current_user)


@router.get(
    "/inventory/{item_id}",
    response_model=RetailerItemResponse,
    summary="Get Retailer Product Details"
)
async def get_retailer_product(
    item_id: str,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Retrieves full details for a product owned by the retailer.
    Rejects cross-retailer access with 403 Forbidden.
    """
    return RetailerService.get_product(item_id, current_user)


@router.put(
    "/inventory/{item_id}",
    response_model=RetailerItemResponse,
    summary="Update Retailer Product Details"
)
async def update_retailer_product(
    item_id: str,
    data: RetailerProductUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Updates editable fields of a retailer product.
    """
    return RetailerService.update_product(item_id, data, current_user)


@router.patch(
    "/inventory/{item_id}/stock",
    response_model=RetailerItemResponse,
    summary="Update Stock Quantity with History Audit"
)
async def update_product_stock(
    item_id: str,
    data: StockUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Adjusts product stock count ('set', 'add', 'deduct').
    Validates against negative stock and appends a modification history entry.
    """
    return RetailerService.update_stock(item_id, data, current_user)


@router.patch(
    "/inventory/{item_id}/archive",
    response_model=RetailerItemResponse,
    summary="Archive or Unarchive Retailer Product"
)
async def archive_product(
    item_id: str,
    data: ArchiveRequest,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Toggles product archive status.
    """
    return RetailerService.archive_product(item_id, data.is_archived, data.reason, current_user)


@router.delete(
    "/inventory/{item_id}",
    summary="Permanently Delete Retailer Product"
)
async def delete_retailer_product(
    item_id: str,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Deletes an authorized retailer product.
    """
    return RetailerService.delete_product(item_id, current_user)


# ==============================================================================
# 3. AI Freshness Analysis
# ==============================================================================

@router.post(
    "/inventory/{item_id}/analyze",
    summary="Execute Live Computer Vision Freshness Analysis on Retailer Product"
)
async def analyze_product_freshness(
    item_id: str,
    image_url: Optional[str] = Body(None, embed=True, description="Optional image path or URL override"),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Runs computer vision feature extraction, Arrhenius kinetic shelf-life decay,
    and prescriptive action generation on the retailer's item.
    """
    return RetailerService.analyze_retailer_product(item_id, image_url, current_user)


# ==============================================================================
# 4. Expiry Tracking & Shelf-Life Monitoring
# ==============================================================================

@router.get(
    "/expiry",
    summary="Expiry Tracking Dashboard (Approaching, Expired & Safe Items)"
)
async def get_expiry_tracking(
    threshold_days: int = Query(7, ge=1, le=30, description="Warning horizon in days"),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Returns segregated lists of expired, approaching-expiry, and safe inventory items.
    """
    return RetailerService.get_expiry_tracking(current_user, threshold_days)


@router.get(
    "/shelf-life",
    summary="Shelf-Life Monitoring with Kinetic Decay & Environmental Context"
)
async def get_shelf_life_monitoring(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Lists retailer products with latest AI analysis date, predicted shelf life,
    and storage condition warnings.
    """
    return RetailerService.get_shelf_life_monitoring(current_user)


# ==============================================================================
# 5. Spoilage & Storage Alerts
# ==============================================================================

@router.get(
    "/alerts",
    response_model=List[RetailerAlertResponse],
    summary="List Retailer Spoilage, Expiry, and Storage Alerts"
)
async def get_retailer_alerts(
    status_filter: Optional[str] = Query("Active", description="Filter by status: Active, Acknowledged, all"),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Retrieves active or acknowledged alerts generated from actual inventory conditions.
    """
    return RetailerService.get_spoilage_alerts(current_user, status_filter)


@router.patch(
    "/alerts/{alert_id}/acknowledge",
    summary="Mark an Alert as Reviewed / Acknowledged"
)
async def acknowledge_retailer_alert(
    alert_id: str,
    data: AlertAcknowledgeRequest = Body(...),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Acknowledge a spoilage, expiry, or storage alert.
    """
    return RetailerService.acknowledge_alert(alert_id, data.note, current_user)


# ==============================================================================
# 6. Storage Monitoring & Compliance
# ==============================================================================

@router.get(
    "/storage",
    summary="Storage Environmental Monitoring & Compliance Audit"
)
async def get_storage_monitoring(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Audits actual stored temperatures and humidities against product food science standards.
    """
    return RetailerService.get_storage_monitoring(current_user)


# ==============================================================================
# 7. Food Waste Reduction & Stock Prioritization
# ==============================================================================

@router.get(
    "/waste-reduction",
    summary="Food Waste Reduction Prioritization & Dynamic Markdowns"
)
async def get_waste_reduction_prioritization(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Generates actionable stock prioritization (FEFO rotation, dynamic clearance discounts).
    """
    return RetailerService.get_waste_reduction_prioritization(current_user)


# ==============================================================================
# 8. Retail Analytics & Reports
# ==============================================================================

@router.get(
    "/analytics",
    summary="Retail Business Intelligence & Chart Datasets"
)
async def get_retailer_analytics(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Computes real-time retail store KPIs and Chart.js datasets based exclusively on the retailer's data.
    """
    return RetailerService.get_retailer_analytics(current_user)


@router.get(
    "/reports",
    summary="Retailer Compliance & Quality Summary Report"
)
async def get_retailer_reports(
    category: Optional[str] = Query(None, description="Category filter"),
    freshness_status: Optional[str] = Query(None, description="Freshness filter"),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Tabular summary report of authorized retailer stock.
    """
    return RetailerService.get_retailer_reports_summary(current_user, category, freshness_status)


@router.get(
    "/reports/export-csv",
    summary="Export Retailer Inventory Quality Audit as CSV"
)
async def export_retailer_csv(
    category: Optional[str] = Query(None, description="Category filter"),
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Streams a downloadable CSV spreadsheet containing only authorized retailer inventory records.
    """
    return RetailerService.export_retailer_csv(current_user, category)


# ==============================================================================
# 9. Notifications
# ==============================================================================

@router.get(
    "/notifications",
    response_model=List[RetailerNotificationResponse],
    summary="Retrieve Retailer System Notifications"
)
async def get_retailer_notifications(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Lists real-time notifications for approaching expiry, spoilage, or low stock.
    """
    return RetailerService.get_notifications(current_user)


@router.patch(
    "/notifications/{notif_id}/read",
    summary="Mark a Notification as Read"
)
async def mark_notification_read(
    notif_id: str,
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Marks individual notification as read.
    """
    return RetailerService.mark_notification_read(notif_id, current_user)


@router.patch(
    "/notifications/read-all",
    summary="Mark All Notifications as Read"
)
async def mark_all_notifications_read(
    current_user: Dict[str, Any] = Depends(require_roles([UserRole.RETAILER.value]))
):
    """
    Marks all notifications for retailer as read.
    """
    return RetailerService.mark_all_notifications_read(current_user)
