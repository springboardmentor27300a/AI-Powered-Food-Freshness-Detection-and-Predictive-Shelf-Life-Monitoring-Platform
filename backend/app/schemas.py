from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

ROLES = {
    "consumer",
    "retail_manager",
    "warehouse_operator",
    "food_quality_inspector",
    "administrator",
}


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProfileUpdateRequest(BaseModel):
    """Request body for PUT /auth/me — all fields are optional.
    Provide current_password + new_password to change the password.
    """
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    current_password: Optional[str] = Field(default=None, min_length=1)
    new_password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class FoodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    batch_number: str = Field(min_length=1, max_length=80)
    quantity: int = Field(ge=0, default=1)
    expiry_date: date

    @field_validator("name", "category", "batch_number", mode="before")
    @classmethod
    def strip_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("quantity", mode="before")
    @classmethod
    def parse_quantity(cls, v):
        if isinstance(v, (str, float)):
            try:
                return max(0, int(float(v)))
            except (ValueError, TypeError):
                return 0
        return max(0, int(v or 0))

    @field_validator("expiry_date", mode="before")
    @classmethod
    def parse_expiry_date(cls, v):
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                from datetime import timedelta
                return date.today() + timedelta(days=7)
            try:
                return date.fromisoformat(v_clean)
            except ValueError:
                from datetime import datetime
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
                    try:
                        return datetime.strptime(v_clean, fmt).date()
                    except ValueError:
                        pass
        return v


class FoodResponse(FoodCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_by: int


class FoodUpdate(BaseModel):
    """Request body for PUT /inventory/{id} — all fields are optional."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    category: Optional[str] = Field(default=None, min_length=1, max_length=60)
    batch_number: Optional[str] = Field(default=None, min_length=1, max_length=80)
    quantity: Optional[int] = Field(default=None, ge=0)
    expiry_date: Optional[date] = None


# ============================================================
# M2 — Freshness Analysis Schemas
# ============================================================

from datetime import datetime
from typing import Dict, Optional, Any, Literal


class ColorAnalysisResult(BaseModel):
    dominant_color_hex: str
    mean_saturation: float
    mean_brightness: float
    browning_index: float
    dark_spot_ratio: float
    discoloration_index: float


class TextureAnalysisResult(BaseModel):
    surface_roughness: float
    local_contrast: float
    texture_uniformity: float


class VisualAnalysisResult(BaseModel):
    color: ColorAnalysisResult
    texture: TextureAnalysisResult


class ScoreBreakdown(BaseModel):
    note: str
    p_fresh: float
    confidence_component: float
    colour_component: float
    texture_component: float


class ModelPredictionDetail(BaseModel):
    predicted_class: str
    food_item: str
    is_fresh_class: bool
    all_class_probabilities: Dict[str, float]


class FreshnessPredictionResponse(BaseModel):
    id: Optional[int] = None
    classification: str
    confidence: float
    quality_score: int
    spoilage_probability: float
    model_prediction: ModelPredictionDetail
    visual_analysis: VisualAnalysisResult
    score_breakdown: ScoreBreakdown



class AnalysisHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_name: Optional[str]
    classification: str
    confidence: float
    quality_score: int
    spoilage_probability: float
    created_at: datetime


class AnalysisTrendPoint(BaseModel):
    date: date
    assessment_count: int
    average_quality_score: float
    average_spoilage_probability: float


class AnalysisTrendsResponse(BaseModel):
    days: int
    assessment_count: int
    points: list[AnalysisTrendPoint]


# ============================================================
# M3 — Shelf-life, storage, scoring, and analytics
# ============================================================

class StorageConditionCreate(BaseModel):
    food_item_id: Optional[int] = None
    analysis_id: Optional[int] = None
    temperature_c: float = Field(ge=-30, le=60)
    humidity_pct: float = Field(ge=0, le=100)
    air_circulation: Literal["good", "moderate", "poor"] = "moderate"
    light_exposure: Literal["low", "moderate", "high"] = "moderate"
    packaging_type: str = Field(default="sealed", max_length=50)
    storage_duration_days: int = Field(default=0, ge=0, le=3650)


class StorageConditionResponse(StorageConditionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    observed_at: datetime


class ShelfLifePredictionRequest(StorageConditionCreate):
    food_type: str = Field(min_length=2, max_length=80)
    analysis_id: Optional[int] = None
    storage_condition_id: Optional[int] = None
    freshness_classification: str = Field(default="Acceptable", max_length=40)
    visual_quality_score: int = Field(default=70, ge=0, le=100)
    spoilage_probability: float = Field(default=0.3, ge=0, le=1)
    product_age_days: int = Field(default=0, ge=0, le=3650)
    species: Optional[str] = Field(default=None, max_length=60)
    nled_level: int = Field(default=0, ge=0, le=25)
    bwc_level: int = Field(default=0, ge=0, le=9)


class ScoreComponents(BaseModel):
    visual_condition_score: int
    storage_condition_score: int
    shelf_life_score: int
    product_age_score: int


class Recommendation(BaseModel):
    priority: str
    action: str
    reason: str


class ShelfLifePredictionResponse(BaseModel):
    id: int
    food_type: str
    data_type: str = "REAL/TRACEABLE"
    remaining_shelf_life_days: int
    predicted_expiry_date: date
    confidence: Optional[float] = None
    risk_level: str
    official_freshness_score: int
    score_components: ScoreComponents
    storage_impact: Dict[str, float]
    storage_compliance: Optional[str] = None
    recommendations: list[Recommendation]
    model_type: str
    created_at: datetime


class M3AnalyticsResponse(BaseModel):
    total_predictions: int
    average_freshness_score: Optional[float] = None
    average_remaining_shelf_life_days: Optional[float] = None
    risk_counts: Dict[str, int]
    freshness_trend: list[Dict[str, Any]]
    shelf_life_trend: list[Dict[str, Any]]
    storage_condition_impact: Optional[Dict[str, Optional[float]]] = None
    expiring_soon_count: int = 0
    expired_count: int = 0
    high_risk_count: int = 0


# ============================================================
# B1 — Expiring-soon inventory response
# ============================================================

class ExpiringSoonItem(BaseModel):
    """Inventory item enriched with expiry urgency and latest M3 prediction data."""
    model_config = ConfigDict(from_attributes=True)

    # Core inventory fields (mirrors FoodResponse)
    id: int
    name: str
    category: str
    batch_number: str
    quantity: int
    expiry_date: date

    # Computed urgency fields
    days_until_expiry: int        # negative means already expired
    is_expired: bool

    # Latest M3 prediction data — None when no prediction exists for this item
    risk_level: Optional[str] = None
    official_freshness_score: Optional[int] = None
    remaining_shelf_life_days: Optional[int] = None


# ============================================================
# B2 — Rotation suggestion response
# ============================================================

class RotationSuggestion(BaseModel):
    """Single FEFO rotation suggestion for one inventory item."""
    model_config = ConfigDict(from_attributes=True)

    # Rank within this response (1 = consume/move first)
    priority_rank: int

    # Inventory identity
    food_item_id: int
    name: str
    category: str
    batch_number: str
    quantity: int
    expiry_date: date

    # Urgency
    days_until_expiry: int   # negative means already expired
    is_expired: bool

    # Human-readable explanation of why this item ranks here
    reason: str

    # Latest M3 prediction data — None when no prediction exists
    risk_level: Optional[str] = None
    official_freshness_score: Optional[int] = None
    storage_compliance: Optional[str] = None


class RotationSuggestionsResponse(BaseModel):
    """Full FEFO rotation suggestion list."""
    total_items: int
    expired_count: int
    suggestion_basis: str   # e.g. "FEFO (expiry date + freshness score)"
    suggestions: list[RotationSuggestion]


# ============================================================
# M4 — Notification Schemas
# ============================================================

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    notification_type: str
    severity: str
    title: str
    message: str
    related_item_id: Optional[int] = None
    related_prediction_id: Optional[int] = None
    related_analysis_id: Optional[int] = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
    total_count: int
