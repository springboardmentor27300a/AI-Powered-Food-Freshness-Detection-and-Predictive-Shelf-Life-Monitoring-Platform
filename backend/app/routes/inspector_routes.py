from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse

from backend.app.models.user_model import UserRole
from backend.app.utils.dependencies import require_roles
from backend.app.schemas.inspector_schema import (
    InspectionCreateRequest,
    InspectionReviewRequest,
    InspectionFlagRequest,
    AlertResolveRequest,
    InspectionResponse,
    InspectorDashboardResponse,
    QualityAnalyticsResponse,
)
from backend.app.services.inspector_service import FoodQualityInspectorService

router = APIRouter(
    prefix="/inspector",
    tags=["Food Quality Inspector"],
    dependencies=[Depends(require_roles([UserRole.FOOD_QUALITY_INSPECTOR.value]))],
)

# RBAC Dependency: Food Quality Inspector
inspector_guard = Depends(require_roles([UserRole.FOOD_QUALITY_INSPECTOR.value]))


@router.get(
    "/dashboard",
    response_model=InspectorDashboardResponse,
    summary="Inspector Operational Dashboard KPIs and Feeds"
)
async def get_inspector_dashboard(
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Returns high-level quality control KPIs, recent inspections, pending items,
    and active quality alerts.
    """
    return FoodQualityInspectorService.get_dashboard(current_user)


@router.get(
    "/inspections",
    response_model=List[InspectionResponse],
    summary="List and Filter Food Quality Inspections"
)
async def list_inspections(
    category: Optional[str] = Query(None, description="Category filter"),
    freshness_status: Optional[str] = Query(None, description="Freshness filter (Fresh, Moderately Fresh, Spoiled)"),
    status: Optional[str] = Query(None, description="Inspection status filter (Pending, Confirmed, Flagged, etc.)"),
    severity: Optional[str] = Query(None, description="Issue severity filter (Low, Medium, High, Critical)"),
    search: Optional[str] = Query(None, description="Free text search on product, batch or inspection ID"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Retrieves filtered inspection documents ordered by newest first.
    """
    return FoodQualityInspectorService.list_inspections(
        category=category,
        freshness_status=freshness_status,
        inspection_status=status,
        severity=severity,
        search=search,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        skip=skip,
    )


@router.post(
    "/inspections",
    response_model=InspectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit New Food Inspection with Multipart Image"
)
async def create_inspection_multipart(
    product_name: str = Form(..., min_length=2, max_length=120),
    category: str = Form(...),
    batch_number: Optional[str] = Form(None),
    inventory_id: Optional[str] = Form(None),
    storage_temperature: Optional[float] = Form(None),
    storage_humidity: Optional[float] = Form(None),
    storage_location: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Creates an inspection, processes the uploaded food image through the OpenCV computer vision
    pipeline, calculates Arrhenius shelf-life kinetics, audits storage condition compliance,
    and inserts the inspection record.
    """
    return FoodQualityInspectorService.create_inspection(
        product_name=product_name,
        category=category,
        batch_number=batch_number,
        inventory_id=inventory_id,
        storage_temperature=storage_temperature,
        storage_humidity=storage_humidity,
        storage_location=storage_location,
        notes=notes,
        image_file=file,
        image_url=image_url,
        current_user=current_user,
    )


@router.post(
    "/inspections/json",
    response_model=InspectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit New Food Inspection with JSON Payload"
)
async def create_inspection_json(
    data: InspectionCreateRequest,
    current_user: Dict[str, Any] = inspector_guard
):
    """
    JSON creation endpoint for API clients with pre-uploaded or external image references.
    """
    return FoodQualityInspectorService.create_inspection(
        product_name=data.product_name,
        category=data.category,
        batch_number=data.batch_number,
        inventory_id=data.inventory_id,
        storage_temperature=data.storage_temperature,
        storage_humidity=data.storage_humidity,
        storage_location=data.storage_location,
        notes=data.notes,
        image_file=None,
        image_url=data.image_url,
        current_user=current_user,
    )


@router.get(
    "/inspections/{inspection_id}",
    response_model=InspectionResponse,
    summary="Retrieve Inspection Details"
)
async def get_inspection(
    inspection_id: str,
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Fetches full inspection details, including original AI outputs and human review notes.
    """
    return FoodQualityInspectorService.get_inspection(inspection_id)


@router.patch(
    "/inspections/{inspection_id}/review",
    response_model=InspectionResponse,
    summary="Record Inspector Validation Decision"
)
async def review_inspection(
    inspection_id: str,
    data: InspectionReviewRequest,
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Validates the AI result ('Confirmed', 'Flagged', or 'Requires Further Inspection').
    Preserves original AI predictions unmodified for strict data traceability.
    """
    return FoodQualityInspectorService.review_inspection(inspection_id, data, current_user)


@router.patch(
    "/inspections/{inspection_id}/flag",
    response_model=InspectionResponse,
    summary="Flag Inspection for Quality or Spoilage Issues"
)
async def flag_inspection(
    inspection_id: str,
    data: InspectionFlagRequest,
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Flags an inspection with an issue type and severity, automatically raising an active alert.
    """
    return FoodQualityInspectorService.flag_inspection(inspection_id, data, current_user)


@router.get(
    "/inspection-history",
    response_model=List[InspectionResponse],
    summary="Inspection Audit Trail & History"
)
async def get_inspection_history(
    category: Optional[str] = Query(None),
    freshness_status: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Dedicated endpoint for the historical inspection log with multi-parameter filtering.
    """
    return FoodQualityInspectorService.list_inspections(
        category=category,
        freshness_status=freshness_status,
        inspection_status=status,
        severity=severity,
        search=search,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        skip=skip,
    )


@router.get(
    "/quality-analytics",
    response_model=QualityAnalyticsResponse,
    summary="Quality Control Aggregates & Trends"
)
async def get_quality_analytics(
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Returns real MongoDB-backed aggregates: freshness distribution, quality trends,
    spoilage trends, inspection velocity, and category breakdowns.
    """
    return FoodQualityInspectorService.get_quality_analytics()


@router.get(
    "/alerts",
    summary="List Quality & Spoilage Alerts"
)
async def get_quality_alerts(
    status: str = Query("all", description="Alert status filter: all, active, resolved"),
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Returns food quality alerts requiring inspector attention.
    """
    return FoodQualityInspectorService.get_alerts(status_filter=status)


@router.patch(
    "/alerts/{alert_id}/resolve",
    summary="Resolve Quality Alert"
)
async def resolve_quality_alert(
    alert_id: str,
    data: AlertResolveRequest,
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Resolves an active quality alert and records corrective notes and inspector identity.
    """
    return FoodQualityInspectorService.resolve_alert(alert_id, data, current_user)


@router.get(
    "/storage-review",
    summary="Storage Condition Reference Review"
)
async def get_storage_condition_review(
    category: str = Query(..., description="Food category"),
    temperature: Optional[float] = Query(None, description="Observed temperature in Celsius"),
    humidity: Optional[float] = Query(None, description="Observed relative humidity percentage"),
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Audits environmental conditions against food science category tolerances.
    """
    return FoodQualityInspectorService.get_storage_condition_review(
        category=category,
        current_temperature=temperature,
        current_humidity=humidity,
    )


@router.get(
    "/reports/export-csv",
    summary="Export Inspection Reports as CSV"
)
async def export_inspections_csv(
    current_user: Dict[str, Any] = inspector_guard
):
    """
    Streams a formal Quality Assurance Inspection Log spreadsheet (.csv).
    """
    return FoodQualityInspectorService.export_csv()
