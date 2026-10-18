from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from backend.app.schemas.user_schema import UserResponse
from backend.app.models.user_model import UserRole, normalize_role


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., description="Target role to assign to the user")

    @field_validator("role")
    @classmethod
    def validate_target_role(cls, v: str) -> str:
        norm = normalize_role(v)
        allowed = UserRole.list()
        if norm not in allowed:
            raise ValueError(f"Invalid target role '{v}'. Allowed roles: {', '.join(allowed)}")
        return norm


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Account status ('active' or 'deactivated')")
    reason: Optional[str] = Field(None, max_length=500, description="Administrative justification")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in ["active", "deactivated"]:
            raise ValueError("Status must be either 'active' or 'deactivated'")
        return s


class StorageRuleCreateRequest(BaseModel):
    category: str = Field(..., min_length=2, max_length=50, description="Food category (e.g., Dairy, Fruits)")
    min_temperature: float = Field(..., description="Minimum permitted storage temperature (°C)")
    max_temperature: float = Field(..., description="Maximum permitted storage temperature (°C)")
    recommended_temperature: float = Field(..., description="Recommended optimal temperature (°C)")
    min_humidity: float = Field(default=40.0, ge=0.0, le=100.0, description="Minimum relative humidity (%)")
    max_humidity: float = Field(default=95.0, ge=0.0, le=100.0, description="Maximum relative humidity (%)")
    storage_conditions: str = Field(default="Chilled Refrigeration", max_length=200)
    applicable_zone: str = Field(default="Zone A - Cold Room", max_length=100)

    @field_validator("max_temperature")
    @classmethod
    def validate_temp_range(cls, v: float, info) -> float:
        if "min_temperature" in info.data and v < info.data["min_temperature"]:
            raise ValueError("max_temperature cannot be less than min_temperature")
        return v

    @field_validator("max_humidity")
    @classmethod
    def validate_humidity_range(cls, v: float, info) -> float:
        if "min_humidity" in info.data and v < info.data["min_humidity"]:
            raise ValueError("max_humidity cannot be less than min_humidity")
        return v


class StorageRuleUpdateRequest(BaseModel):
    min_temperature: Optional[float] = None
    max_temperature: Optional[float] = None
    recommended_temperature: Optional[float] = None
    min_humidity: Optional[float] = None
    max_humidity: Optional[float] = None
    storage_conditions: Optional[str] = None
    applicable_zone: Optional[str] = None


class StorageRuleResponse(BaseModel):
    id: str
    category: str
    min_temperature: float
    max_temperature: float
    recommended_temperature: float
    min_humidity: float
    max_humidity: float
    storage_conditions: str
    applicable_zone: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SystemConfigResponse(BaseModel):
    app_name: str
    version: str
    environment: str
    public_registration_enabled: bool
    ai_inference_enabled: bool
    fefo_auto_markdown_enabled: bool
    auto_quarantine_score_threshold: float
    max_upload_size_mb: int
    temperature_alert_tolerance_c: float
    notification_email_alerts_enabled: bool
    updated_at: Optional[datetime] = None


class SystemConfigUpdateRequest(BaseModel):
    public_registration_enabled: Optional[bool] = None
    ai_inference_enabled: Optional[bool] = None
    fefo_auto_markdown_enabled: Optional[bool] = None
    auto_quarantine_score_threshold: Optional[float] = Field(None, ge=0.0, le=100.0)
    max_upload_size_mb: Optional[int] = Field(None, ge=1, le=100)
    temperature_alert_tolerance_c: Optional[float] = Field(None, ge=0.1, le=20.0)
    notification_email_alerts_enabled: Optional[bool] = None


class AuditLogResponse(BaseModel):
    id: str
    timestamp: datetime
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    target_id: Optional[str] = None
    target_resource: Optional[str] = None
    previous_value: Optional[Any] = None
    new_value: Optional[Any] = None
    status: str = "success"
    metadata: Optional[Dict[str, Any]] = None


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    limit: int
    skip: int


class AiStatisticsResponse(BaseModel):
    total_analyses: int
    fresh_predictions: int
    marginal_predictions: int
    spoiled_predictions: int
    avg_confidence: float
    avg_quality_score: float
    prediction_distribution: Dict[str, float]
    error_count: int
    activity_timeline: List[Dict[str, Any]]


class SystemHealthResponse(BaseModel):
    status: str
    database: Dict[str, Any]
    auth_service: str
    ai_service: str
    storage_service: str
    recent_errors_count: int
    timestamp: datetime


class AdminDashboardResponse(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    total_analyses: int
    fresh_items: int
    spoiled_items: int
    avg_quality_score: float
    total_inventory: int
    system_health: str
    users_by_role: Dict[str, int]
    recent_users: List[UserResponse]
    recent_audits: List[AuditLogResponse]
