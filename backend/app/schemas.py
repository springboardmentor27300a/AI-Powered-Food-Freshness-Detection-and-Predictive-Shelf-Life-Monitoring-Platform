"""
Pydantic schemas: request validation and response serialization for the API.
"""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.constants import FOOD_CATEGORIES, ROLES, UNITS

RoleLiteral = Literal["consumer", "retail_manager", "warehouse_operator", "quality_inspector", "administrator"]
CategoryLiteral = Literal[
    "Fruits", "Vegetables", "Dairy Products", "Meat & Poultry",
    "Seafood", "Bakery Products", "Packaged Foods", "Beverages",
]
UnitLiteral = Literal["kg", "g", "litres", "pieces", "packets"]

FreshnessLiteral = Literal["Fresh", "Expiring Soon", "Expired"]
ImageClassificationLiteral = Literal["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"]
RiskLevelLiteral = Literal["low", "moderate", "high", "critical"]


# ---------------------------------------------------------------------------
# Auth / users
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: RoleLiteral

    @field_validator("full_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be blank")
        return v.strip()

    @field_validator("role")
    @classmethod
    def role_allowed(cls, v: str) -> str:
        if v not in ROLES:
            raise ValueError(f"Role must be one of: {', '.join(ROLES)}")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# Food batches
# ---------------------------------------------------------------------------
class BatchBase(BaseModel):
    food_name: str = Field(min_length=2, max_length=150)
    category: CategoryLiteral
    quantity: float = Field(gt=0)
    available_quantity: float | None = Field(default=None, ge=0)
    unit: UnitLiteral
    received_date: date
    expiry_date: date
    storage_location: str = Field(min_length=2, max_length=150)
    packaging_type: str = Field(min_length=2, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    # Milestone 3 - optional live storage-condition fields.
    temperature_c: float | None = Field(default=None, ge=-50, le=60)
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    air_circulation: Literal["good", "moderate", "poor"] | None = None
    light_exposure: Literal["appropriate", "low", "moderate", "high", "controlled", "excessive", "not_applicable"] | None = None

    @field_validator("food_name", "storage_location", "packaging_type")
    @classmethod
    def strip_text(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v


class BatchCreate(BatchBase):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "food_name": "Apple",
            "category": "Fruits",
            "quantity": 25,
            "available_quantity": 20,
            "unit": "kg",
            "received_date": "2026-08-21",
            "expiry_date": "2026-09-02",
            "storage_location": "Cold Storage A - Shelf 3",
            "packaging_type": "Crates",
            "notes": "Organic produce from local farm",
        }
    })


class BatchUpdate(BaseModel):
    food_name: str | None = Field(default=None, min_length=2, max_length=150)
    category: CategoryLiteral | None = None
    quantity: float | None = Field(default=None, gt=0)
    available_quantity: float | None = Field(default=None, ge=0)
    unit: UnitLiteral | None = None
    received_date: date | None = None
    expiry_date: date | None = None
    storage_location: str | None = Field(default=None, min_length=2, max_length=150)
    packaging_type: str | None = Field(default=None, min_length=2, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    temperature_c: float | None = Field(default=None, ge=-50, le=60)
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    air_circulation: Literal["good", "moderate", "poor"] | None = None
    light_exposure: Literal["appropriate", "low", "moderate", "high", "controlled", "excessive", "not_applicable"] | None = None


class BatchOut(BatchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: str
    user_id: int
    created_at: datetime
    updated_at: datetime
    freshness_status: FreshnessLiteral
    days_to_expiry: int
    # Granular dynamic expiry labels (computed from the real expiry date).
    expiry_priority_status: str = "SAFE"
    priority_level: str = "LOW"


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardSummary(BaseModel):
    total_batches: int
    total_available_quantity: float
    fresh_count: int
    expiring_soon_count: int
    expired_count: int
    recent_batches: list[BatchOut]
    expiring_alerts: list[BatchOut]


class Message(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Image Analysis
# ---------------------------------------------------------------------------
class ImageAnalysisRequest(BaseModel):
    """Optional metadata sent alongside the image upload."""
    food_name: str = Field(min_length=1, max_length=150, default="Unknown Food")
    food_category: CategoryLiteral | None = None
    batch_id: str | None = Field(default=None, max_length=40)


class SpoilageIndicatorOut(BaseModel):
    name: str
    detected: bool
    probability: float
    severity: str
    description: str
    affected_area_pct: float
    confidence: float = 1.0
    evidence: dict | None = None


class ColorAnalysisOut(BaseModel):
    degradation_score: float
    dominant_colors: list[dict]
    distribution: dict


class TextureAnalysisOut(BaseModel):
    edge_density: float
    contrast: float
    roughness: float
    change_score: float


class SpoilageIndicatorsSummary(BaseModel):
    mold_detected: bool
    mold_area_pct: float
    bruise_detected: bool
    bruise_area_pct: float
    damage_detected: bool
    damage_area_pct: float


class AnalysisDetailsOut(BaseModel):
    color_analysis: ColorAnalysisOut | None = None
    texture_analysis: TextureAnalysisOut | None = None
    spoilage_indicators: SpoilageIndicatorsSummary | None = None
    spoilage_detection: dict | None = None


class CNNPredictionOut(BaseModel):
    model: str
    predictions: list[dict]
    best: dict


class ImageAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    food_name: str
    food_category: str | None
    classification: ImageClassificationLiteral
    confidence_score: float
    freshness_score: float
    image_quality_score: float
    color_score: float
    texture_score: float
    mold_risk: float
    bruise_risk: float
    damage_risk: float
    color_status: str
    texture_status: str
    mold_indicator: str
    bruise_severity: str
    damage_severity: str
    spoilage_detected: bool
    spoilage_probability: float
    risk_level: RiskLevelLiteral
    recommended_action: str
    estimated_shelf_life_days: int | None
    analysis_details: dict | None
    batch_id_ref: str | None
    created_at: datetime
    # Additive fields describing how the verdict was reached and how certain it
    # is.  ``result_basis`` keeps MODEL-based and HEURISTIC results explicitly
    # distinguishable.
    result_basis: str = "heuristic_cv"
    spoilage_uncertainty: float = 0.0
    visual_confidence: float = 0.0


class SpoilageDetectionResponse(BaseModel):
    spoilage_detected: bool
    overall_spoilage_probability: float
    risk_level: str
    spoilage_types: list[str]
    indicators: list[SpoilageIndicatorOut]
    summary: str
    uncertainty: float = 0.0
    result_basis: str = "heuristic_cv"


# ---------------------------------------------------------------------------
# Freshness Reports
# ---------------------------------------------------------------------------
class FreshnessReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: str
    food_name: str
    food_category: str | None
    classification: str
    confidence_score: float
    freshness_score: float
    spoilage_detected: bool
    spoilage_probability: float
    risk_level: str
    recommended_action: str
    estimated_shelf_life_days: int | None
    report_data: dict | None
    batch_id_ref: str | None
    days_to_expiry: int | None
    inventory_freshness_status: str | None
    created_at: datetime


class ReportSummary(BaseModel):
    total_reports: int
    classification_counts: dict
    risk_level_counts: dict
    avg_confidence: float
    spoilage_detected_count: int
    recent_reports: list[FreshnessReportResponse]


# ---------------------------------------------------------------------------
# Milestone 3 - storage conditions
# ---------------------------------------------------------------------------
class StorageReadingCreate(BaseModel):
    temperature_c: float | None = Field(default=None, ge=-50, le=60, description="Current temperature in Celsius")
    humidity_pct: float | None = Field(default=None, ge=0, le=100, description="Current relative humidity (%)")
    air_circulation: Literal["good", "moderate", "poor"] | None = None
    light_exposure: Literal["appropriate", "low", "moderate", "high", "controlled", "excessive", "not_applicable"] | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("humidity_pct")
    @classmethod
    def validate_humidity_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("Humidity cannot be negative.")
        return v


class StorageReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id_ref: str
    temperature_c: float | None
    humidity_pct: float | None
    air_circulation: str | None
    light_exposure: str | None
    compliance_score: int | None
    notes: str | None
    recorded_at: datetime


class ParameterStatusOut(BaseModel):
    value: float | str | None
    recommended: str
    status: str
    explanation: str
    assessment: str
    impact: str
    recommendation: str


class StorageRequirementsOut(BaseModel):
    scope: str
    key: str
    temperature_min_c: float | None
    temperature_max_c: float | None
    recommended_temperature_c: float | None
    humidity_min_pct: float | None
    humidity_max_pct: float | None
    recommended_humidity_pct: float | None
    air_circulation: str
    light_requirement: str
    recommended_duration_days: int
    maximum_duration_days: int
    packaging_requirement: str
    storage_environment: str
    refrigeration_required: bool
    notes: str


class StorageAnalysisOut(BaseModel):
    batch_id: str
    food_name: str
    category: str
    requirements: StorageRequirementsOut
    current_conditions: dict
    temperature: ParameterStatusOut
    humidity: ParameterStatusOut
    air_circulation: ParameterStatusOut
    light_exposure: ParameterStatusOut
    duration: ParameterStatusOut
    packaging: ParameterStatusOut
    storage_environment: ParameterStatusOut
    compliance_score: int
    condition_status: str
    condition_summary: str
    shelf_life_impact: str
    sub_scores: dict
    shelf_life_delta_days: int
    optimization_recommendations: list[str]
    has_storage_data: bool
    storage_type: str
    storage_start_date: date
    current_date: date
    days_stored: int
    remaining_storage_duration_days: int
    available_quantity: float | None = None
    unit: str | None = None
    shelf_life: dict | None = None
    image_analysis_context: dict | None = None
    recommendations: list[dict] = Field(default_factory=list)
    consumption_priority: str | None = None
    waste_reduction: str | None = None


# ---------------------------------------------------------------------------
# Milestone 3 - shelf-life prediction
# ---------------------------------------------------------------------------
class ShelfLifePredictionOut(BaseModel):
    batch_id: str
    food_name: str
    category: str
    estimated_remaining_days: int
    expected_expiry_date: date
    calendar_remaining_days: int
    freshness_score: float | None
    shelf_life_score: float
    storage_condition_score: float
    spoilage_risk: str
    risk_score: float
    factors: list[str]
    predicted_on: date
    storage_delta_days: int
    base_shelf_life_days: int


class ShelfLifeHistoryPoint(BaseModel):
    predicted_on: date
    estimated_remaining_days: int
    expected_expiry_date: date
    freshness_score: float | None
    spoilage_risk: str


# ---------------------------------------------------------------------------
# Milestone 3 - overall freshness scoring
# ---------------------------------------------------------------------------
class FreshnessScoreOut(BaseModel):
    batch_id: str
    food_name: str
    category: str
    visual_condition_score: float
    storage_condition_score: float
    shelf_life_score: float
    product_age_score: float
    overall_score: float
    freshness_status: str
    weights: dict
    notes: list[str]


# ---------------------------------------------------------------------------
# Milestone 3 - recommendations & alerts
# ---------------------------------------------------------------------------
class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    message: str
    priority: str
    source: str
    status: str
    batch_id_ref: str | None
    created_at: datetime


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_type: str
    severity: str
    message: str
    is_read: bool
    batch_id_ref: str | None
    created_at: datetime


class AlertAck(BaseModel):
    alert_ids: list[int] | None = None
