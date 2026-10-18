from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ProductStorageSummary(BaseModel):
    product_name: str
    category: str
    permitted_temp_min: float
    permitted_temp_max: float
    target_temperature: float
    regulatory_source: str
    notes: Optional[str] = None
    batch_number: Optional[str] = None
    current_freshness_score: Optional[float] = None
    estimated_shelf_life_days: Optional[float] = None


class StorageReadingResponse(BaseModel):
    reading_id: Optional[str] = None
    zone_id: str
    temperature: float
    humidity: float
    ethylene_ppm: Optional[float] = 0.0
    sensor_id: Optional[str] = "SENSOR-AUTO-01"
    sensor_status: str = "online"
    is_violation: bool = False
    recorded_at: datetime


class StorageZoneResponse(BaseModel):
    zone_id: str
    name: str
    category: str
    target_temperature: float
    target_humidity: float
    permitted_temp_min: float
    permitted_temp_max: float
    permitted_humidity_min: float
    permitted_humidity_max: float
    current_temperature: Optional[float] = None
    current_humidity: Optional[float] = None
    sensor_status: str = "online"
    equipment_status: str = "CONNECTED"  # CONNECTED, ONLINE, STANDBY, OFFLINE
    controller_type: str = "VIRTUAL_PLC"
    controller_endpoint: Optional[str] = None
    controller_model: Optional[str] = None
    controller_last_ack: Optional[datetime] = None
    regulatory_source: Optional[str] = None
    capacity_limit: Optional[float] = 5000.0
    capacity_used: Optional[float] = 0.0
    capacity_unit: Optional[str] = "kg"
    status: str = "Optimal"  # Optimal, Warning, Alert, Offline
    stored_products: List[ProductStorageSummary] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TemperatureRuleResponse(BaseModel):
    rule_id: str
    category: str
    product_name: Optional[str] = None
    min_temperature: float
    max_temperature: float
    target_temperature: float
    min_humidity: Optional[float] = None
    max_humidity: Optional[float] = None
    regulatory_source: str
    notes: Optional[str] = None


class TemperatureAdjustmentRequest(BaseModel):
    requested_temperature: float = Field(..., description="Proposed target temperature in degrees Celsius.")
    reason: str = Field(..., min_length=3, max_length=500, description="Audit justification for temperature modification.")
    force_override: Optional[bool] = Field(default=False, description="Emergency override flag (restricted to managers/admins).")


class TemperatureCommandResponse(BaseModel):
    command_id: str
    zone_id: str
    zone_name: str
    previous_target: float
    requested_target: float
    status: str  # Pending, Sent, Acknowledged, Applied, Software Target Saved (Physical Controller Offline), Failed, Timed Out
    applied_to_hardware: bool
    reason: str
    operator_email: str
    operator_role: str
    controller_response: Optional[Dict[str, Any]] = None
    verification_reading: Optional[Dict[str, Any]] = None
    message: str
    created_at: datetime


class StorageAlertResponse(BaseModel):
    alert_id: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    item_name: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    status: str
    created_at: datetime


class WarehouseAuditLogResponse(BaseModel):
    log_id: str
    timestamp: datetime
    actor_email: str
    actor_role: str
    action: str
    target_resource: str
    status: str
    metadata: Optional[Dict[str, Any]] = None


class WarehouseTelemetryPoint(BaseModel):
    timestamp: str
    temperature: float
    humidity: float
    target_temp: float
    min_temp: float
    max_temp: float
    sensor_status: str


class WarehouseTelemetryHistoryResponse(BaseModel):
    zone_id: str
    zone_name: str
    category: str
    current_temperature: float
    current_humidity: float
    target_temperature: float
    permitted_temp_min: float
    permitted_temp_max: float
    regulatory_source: str
    equipment_status: str
    points: List[WarehouseTelemetryPoint]


class WarehouseDashboardOverview(BaseModel):
    total_zones: int
    compliant_zones: int
    active_alerts_count: int
    controller_online_count: int
    total_monitored_products: int
    zones: List[StorageZoneResponse]
