"""
Warehouse & Cold-Chain Storage Control API Routes.
Exposes storage zone management, telemetry monitoring, product-specific temperature rules,
hardware controller command dispatching, and audit logs.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Path, Body, HTTPException, status

from backend.app.models.user_model import UserRole
from backend.app.utils.dependencies import require_roles
from backend.app.schemas.warehouse_schema import (
    StorageZoneResponse,
    StorageReadingResponse,
    TemperatureAdjustmentRequest,
    TemperatureCommandResponse,
    StorageAlertResponse,
    WarehouseAuditLogResponse,
    WarehouseTelemetryHistoryResponse,
    WarehouseDashboardOverview,
)
from backend.app.services.warehouse_service import WarehouseService

ALLOWED_WAREHOUSE_ROLES = [
    UserRole.WAREHOUSE_OPERATOR.value,
    UserRole.WAREHOUSE_MANAGER.value,
    UserRole.SUPPLY_CHAIN_OPERATOR.value,
]

router = APIRouter(
    prefix="/warehouse",
    tags=["Warehouse Operations & Cold-Chain Control"],
    dependencies=[Depends(require_roles(ALLOWED_WAREHOUSE_ROLES))],
)


# ==============================================================================
# 1. Warehouse Dashboard Overview
# ==============================================================================

@router.get(
    "/dashboard",
    response_model=WarehouseDashboardOverview,
    summary="Retrieve Warehouse Dashboard Overview & Zone KPIs",
)
async def get_warehouse_dashboard_overview(
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns aggregated KPIs, cold-chain compliance status, active controller connections,
    and storage zones with live sensor readings.
    """
    zones = WarehouseService.get_all_zones()
    alerts = WarehouseService.get_alerts()
    compliant = sum(1 for z in zones if z["status"] == "Optimal")
    online_controllers = sum(1 for z in zones if z["equipment_status"] in ["CONNECTED", "ONLINE"])
    total_prods = sum(len(z.get("stored_products", [])) for z in zones)

    return {
        "total_zones": len(zones),
        "compliant_zones": compliant,
        "active_alerts_count": len(alerts),
        "controller_online_count": online_controllers,
        "total_monitored_products": total_prods,
        "zones": zones,
    }


# ==============================================================================
# 2. Storage Zones Management
# ==============================================================================

@router.get(
    "/zones",
    response_model=List[StorageZoneResponse],
    summary="List All Storage Zones with Live Telemetry and Product Summaries",
)
async def list_storage_zones(
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns all configured cold storage zones, current setpoints, measured conditions,
    controller hardware statuses, and stored food products with permitted safety ranges.
    """
    return WarehouseService.get_all_zones()


@router.get(
    "/zones/{zone_id}",
    response_model=StorageZoneResponse,
    summary="Get Detailed Storage Zone Information",
)
async def get_storage_zone(
    zone_id: str = Path(..., description="Unique zone identifier, e.g. ZONE-COLD-B-DAIRY"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns storage zone specifications, current conditions, equipment controller link,
    and product-specific temperature rules.
    """
    zone = WarehouseService.get_zone_by_id(zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Storage zone '{zone_id}' not found.",
        )
    return zone


# ==============================================================================
# 3. Live Temperature Telemetry & History
# ==============================================================================

@router.get(
    "/zones/{zone_id}/temperature",
    summary="Get Current Temperature Telemetry, Target Setpoint, and Bounds",
)
async def get_zone_temperature_telemetry(
    zone_id: str = Path(..., description="Unique zone identifier"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns current target temperature setpoint, actual measured temperature,
    permitted regulatory safety range, equipment controller status, and recent readings.
    """
    return WarehouseService.get_zone_temperature_telemetry(zone_id)


@router.get(
    "/zones/{zone_id}/temperature/history",
    response_model=WarehouseTelemetryHistoryResponse,
    summary="Get Historical Temperature & Humidity Readings for Zone",
)
async def get_zone_temperature_history(
    zone_id: str = Path(..., description="Unique zone identifier"),
    hours: int = Query(24, ge=1, le=168, description="Number of past hours of telemetry"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns time series telemetry points for temperature and humidity against target setpoint
    and regulatory threshold envelopes.
    """
    return WarehouseService.get_zone_temperature_history(zone_id, hours=hours)


# ==============================================================================
# 4. Safe Temperature Adjustment Commands & Lifecycle
# ==============================================================================

@router.post(
    "/zones/{zone_id}/temperature/commands",
    response_model=TemperatureCommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Temperature Adjustment Command with Server Validation & Controller ACK",
)
async def submit_temperature_command(
    zone_id: str = Path(..., description="Target storage zone identifier"),
    payload: TemperatureAdjustmentRequest = Body(..., description="Requested target temperature and justification"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Submits a temperature adjustment command.
    Workflow:
    1. Validates requested target temperature against authoritative server-side rules.
    2. Records command in Pending state.
    3. Dispatches command to storage equipment controller (PLC/BACnet/Modbus).
    4. Confirms controller ACK and sets Applied state if connected.
    5. If equipment is offline, saves software target only without false physical claims.
    6. Logs an immutable audit event.
    """
    return await WarehouseService.execute_temperature_command(
        zone_id=zone_id,
        operator_user=current_user,
        requested_target=payload.requested_temperature,
        reason=payload.reason,
        force_override=payload.force_override or False,
    )


@router.get(
    "/temperature/commands/{command_id}",
    response_model=TemperatureCommandResponse,
    summary="Get Temperature Adjustment Command Status and Audit Lifecycle",
)
async def get_temperature_command_status(
    command_id: str = Path(..., description="Command reference ID, e.g. CMD-20261017-XXXX"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Check the execution lifecycle of a temperature adjustment command.
    States: Pending, Sent, Acknowledged, Applied, Software Target Saved (Physical Controller Offline), Failed.
    """
    cmd = WarehouseService.get_command_by_id(command_id)
    if not cmd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Temperature adjustment command '{command_id}' not found.",
        )
    return cmd


# ==============================================================================
# 5. Storage Alerts & Threshold Violations
# ==============================================================================

@router.get(
    "/alerts",
    response_model=List[StorageAlertResponse],
    summary="List Cold-Chain Storage Alerts and Equipment Advisories",
)
async def list_warehouse_alerts(
    zone_id: Optional[str] = Query(None, description="Filter by storage zone"),
    severity: Optional[str] = Query(None, description="Filter by severity: critical, high, medium, low"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns active environmental alerts, temperature excursions, and equipment status warnings.
    """
    return WarehouseService.get_alerts(zone_id=zone_id, severity=severity)


# ==============================================================================
# 6. Warehouse Audit Trail
# ==============================================================================

@router.get(
    "/audit-logs",
    response_model=List[WarehouseAuditLogResponse],
    summary="List Warehouse Temperature Adjustments and Controller Audit Trail",
)
async def list_warehouse_audit_logs(
    limit: int = Query(50, ge=1, le=200, description="Max audit entries to retrieve"),
    current_user: Dict[str, Any] = Depends(require_roles(ALLOWED_WAREHOUSE_ROLES)),
):
    """
    Returns timestamped audit logs for all temperature adjustment commands,
    before/after setpoint deltas, operator emails, and controller ACK confirmations.
    """
    return WarehouseService.get_audit_logs(limit=limit)
