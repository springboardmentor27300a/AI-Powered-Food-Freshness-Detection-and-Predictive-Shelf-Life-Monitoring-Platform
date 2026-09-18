from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# --- AUTH SCHEMAS ---

class EmailVerificationRequest(BaseModel):
    email: EmailStr = Field(..., example="alice@example.com")

class EmailVerificationResponse(BaseModel):
    email: str
    message: str
    verification_code: str
    expires_in_seconds: int = 300

class UserRegister(BaseModel):
    name: str = Field(..., example="Alice Smith")
    email: EmailStr = Field(..., example="alice@example.com")
    password: str = Field(..., min_length=6, example="password123")
    role: str = Field(..., example="Warehouse Operator") # "Consumer" | "Retail Manager" | "Warehouse Operator" | "Food Quality Inspector" | "Administrator"
    verification_code: str = Field(..., example="854912") # 6-digit Email Verification OTP Code
    
    # Role-specific metadata
    organization: Optional[str] = Field(None, example="FreshMart Superstores")
    warehouse_id: Optional[str] = Field(None, example="WH-CENTRAL-01")
    warehouse_name: Optional[str] = Field(None, example="GreenValley Central Cold Storage")
    badge_id: Optional[str] = Field(None, example="INSP-99201")
    phone: Optional[str] = Field(None, example="+1 (555) 234-5678")
    admin_key: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., example="alice@example.com")

class ResetPasswordRequest(BaseModel):
    email: EmailStr = Field(..., example="alice@example.com")
    verification_code: str = Field(..., example="854912")
    new_password: str = Field(..., min_length=6, example="newpassword123")

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization: Optional[str] = None
    warehouse_id: Optional[str] = None
    warehouse_name: Optional[str] = None
    badge_id: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- INVENTORY & BATCH SCHEMAS ---

class BatchCreate(BaseModel):
    batch_id: Optional[str] = None
    product_name: str
    category: str
    warehouse_id: str
    warehouse_name: str
    quantity_kg: float
    unit_price_per_kg: float
    harvest_date: str
    expiry_date: str
    freshness_score: int = Field(90, ge=0, le=100)
    freshness_status: str = "Fresh"
    spoilage_indicators: List[str] = []
    storage_temp_celsius: float = 4.0
    storage_humidity_percent: float = 85.0
    image_url: Optional[str] = None

class BatchBuy(BaseModel):
    buyer_store: str

class BatchResponse(BaseModel):
    id: str
    batch_id: str
    product_name: str
    category: str
    warehouse_id: str
    warehouse_name: str
    quantity_kg: float
    initial_quantity_kg: float
    unit_price_per_kg: float
    harvest_date: str
    registered_date: str
    expiry_date: str
    freshness_score: int
    freshness_status: str
    spoilage_indicators: List[str]
    storage_temp_celsius: float
    storage_humidity_percent: float
    image_url: Optional[str]
    registered_by: str
    status: str
    purchased_by_user_id: Optional[str] = None
    purchased_by_name: Optional[str] = None
    purchased_by_store: Optional[str] = None
    purchase_date: Optional[str] = None

# --- WAREHOUSE SCHEMAS ---

class WarehouseCreate(BaseModel):
    name: str
    code: str
    location: str
    capacity_kg: float
    temperature_range_c: str = "2°C - 4°C"
    humidity_range_pct: str = "85% - 90%"

class WarehouseResponse(BaseModel):
    id: str
    name: str
    code: str
    location: str
    capacity_kg: float
    current_utilization_kg: float
    temperature_range_c: str
    humidity_range_pct: str
    created_at: str

# --- CATEGORY SCHEMAS ---

class CategoryResponse(BaseModel):
    id: str
    name: str
    code: str
    icon: str
    description: str

# --- MILESTONE 2: IMAGE ANALYSIS & FRESHNESS ASSESSMENT SCHEMAS ---

class DefectRegion(BaseModel):
    x: float = Field(..., description="X coordinate percentage (0-100)")
    y: float = Field(..., description="Y coordinate percentage (0-100)")
    width: float = Field(..., description="Width percentage (0-100)")
    height: float = Field(..., description="Height percentage (0-100)")
    label: str = Field(..., description="e.g. Fungal Mold Colony, Surface Bruise, Tissue Softening")
    severity: str = Field("Low", description="Low | Medium | High | Critical")
    confidence: float = Field(0.95, description="Confidence score 0.0 - 1.0")

class ColorAnalysis(BaseModel):
    chlorophyll_vitality_percent: float = Field(..., description="Vibrancy of natural pigmentation")
    browning_index_percent: float = Field(..., description="Oxidation / surface browning percentage")
    dominant_color_hex: str = Field("#22C55E", description="Extracted dominant pigment color hex")
    color_status: str = Field("Optimal", description="Optimal | Slight Oxidation | Severe Discoloration")

class TextureAnalysis(BaseModel):
    surface_firmness_percent: float = Field(..., description="Firmness and skin integrity")
    epidermal_breakdown_percent: float = Field(..., description="Cell rupture and bruising percentage")
    moisture_retention_percent: float = Field(..., description="Estimated cellular moisture content")
    texture_status: str = Field("Crisp", description="Crisp | Softening | Degraded | Decomposed")

class WeightedScoreBreakdown(BaseModel):
    visual_score: int = Field(..., description="Visual Condition (40% weight)")
    storage_score: int = Field(..., description="Storage Conditions (25% weight)")
    shelf_life_score: int = Field(..., description="Shelf-Life Prediction (20% weight)")
    age_score: int = Field(..., description="Product Age (15% weight)")
    composite_score: int = Field(..., ge=0, le=100, description="Overall PRD Weighted Score")

class ConsumerScanCreate(BaseModel):
    product_name: str = Field("Honeycrisp Apple", example="Honeycrisp Apple")
    category: str = Field("Fruits", example="Fruits")
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    sample_id: Optional[str] = None
    storage_temp_celsius: Optional[float] = 3.5
    storage_humidity_percent: Optional[float] = 85.0
    days_since_purchase: Optional[int] = 2
    user_id: Optional[str] = None
    user_name: Optional[str] = None

class ConsumerScanResponse(BaseModel):
    id: str
    scan_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    product_name: str
    category: str
    image_url: Optional[str] = None
    visual_score: int
    composite_score: int
    status: str  # Fresh | Good | Acceptable | Near Spoilage | Spoiled
    spoilage_probability_percent: float
    mold_detected: bool
    mold_spot_count: int
    bruise_detected: bool
    bruise_percent: float
    defect_regions: List[DefectRegion] = []
    color_analysis: ColorAnalysis
    texture_analysis: TextureAnalysis
    weighted_breakdown: WeightedScoreBreakdown
    remaining_shelf_life_days: int
    storage_temp_celsius: float
    storage_humidity_percent: float
    days_since_purchase: int
    safety_verdict: str  # Safe to Consume | Consume Soon | Cook / Process Only | Discard - Hazardous
    diagnosis: str
    spoilage_indicators: List[str]
    household_storage_tips: List[str]
    culinary_recipes: List[str]
    confidence_score: float
    scanned_at: str


# --- MILESTONE 3: SHELF-LIFE PREDICTION, STORAGE MONITORING & RECOMMENDATIONS SCHEMAS ---

class DecayCurvePoint(BaseModel):
    day: int
    predicted_score: int
    optimal_score: int
    status: str

class ShelfLifeSimulationRequest(BaseModel):
    category: str = Field("Fruits", example="Fruits")
    harvest_date: Optional[str] = Field("2026-08-20", example="2026-08-20")
    storage_temp_celsius: float = Field(3.5, example=3.5)
    storage_humidity_percent: float = Field(87.0, example=87.0)
    packaging_type: str = Field("Modified Atmosphere (MAP)", example="Modified Atmosphere (MAP)")  # "Vacuum Sealed" | "Modified Atmosphere (MAP)" | "Perforated Polyethylene" | "Open Container / Ambient"
    air_circulation: str = Field("Optimal (Active)", example="Optimal (Active)")  # "Optimal (Active)" | "Moderate" | "Stagnant"
    visual_score: int = Field(90, ge=0, le=100, example=90)

class ShelfLifeSimulationResponse(BaseModel):
    remaining_days: int
    remaining_hours: int
    decay_rate_multiplier: float
    optimal_temp_celsius: float
    optimal_humidity_percent: float
    optimal_packaging: str
    weighted_freshness_score: int
    freshness_status: str
    risk_level: str
    predicted_expiry_date: str
    extension_gain_days: int
    day_by_day_curve: List[DecayCurvePoint]
    key_factors: List[str]
    recommendation: str

class StorageZoneTelemetry(BaseModel):
    zone_id: str
    zone_name: str
    warehouse_id: str
    warehouse_name: str
    temperature_celsius: float
    humidity_percent: float
    airflow_cfm: float
    light_lux: float
    target_temp_c: float
    target_humidity_pct: float
    compliance_status: str  # "Compliant" | "Minor Excursion" | "Critical"
    active_alerts_count: int = 0
    last_updated: str

class StorageExcursionAlert(BaseModel):
    alert_id: str
    zone_id: str
    zone_name: str
    warehouse_name: str
    parameter: str  # "Temperature" | "Humidity" | "Airflow"
    current_value: float
    threshold_value: float
    severity: str  # "Minor" | "Moderate" | "Critical"
    duration_minutes: int
    root_cause: str
    corrective_action: str
    is_resolved: bool = False
    timestamp: str

class FEFOQueueItem(BaseModel):
    batch_id: str
    product_name: str
    category: str
    warehouse_name: str
    quantity_kg: float
    unit_price_per_kg: float
    expiry_date: str
    remaining_days: int
    freshness_score: int
    freshness_status: str
    urgency_level: str  # "Critical FEFO Dispatch" | "High Priority" | "Standard Velocity"
    suggested_channel: str
    potential_revenue_loss: float

class DynamicMarkdownItem(BaseModel):
    batch_id: str
    product_name: str
    category: str
    warehouse_name: str
    quantity_kg: float
    original_price_per_kg: float
    discount_percent: int
    discounted_price_per_kg: float
    remaining_days: int
    freshness_score: int
    reason: str
    urgency: str
    potential_revenue_saved: float

class EthyleneMatrixRule(BaseModel):
    emitter_category: str
    sensitive_category: str
    compatibility: str  # "Compatible" | "Incompatible" | "Caution"
    risk_summary: str
    separation_advice: str

class FreshnessAnalyticsOverview(BaseModel):
    total_batches_monitored: int
    total_kg_monitored: float
    avg_freshness_score: float
    critical_risk_batches: int
    economic_value_at_risk: float
    total_waste_diverted_kg: float
    total_waste_diverted_dollars: float
    overall_compliance_rate_percent: float
    shelf_life_distribution: dict
    category_health: List[dict]
