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
