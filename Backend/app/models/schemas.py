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

