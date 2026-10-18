from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class InspectionStatus(str, Enum):
    PENDING = "Pending"
    UNDER_REVIEW = "Under Review"
    CONFIRMED = "Confirmed"
    FLAGGED = "Flagged"
    REQUIRES_FURTHER_INSPECTION = "Requires Further Inspection"
    COMPLETED = "Completed"


class InspectorDecision(str, Enum):
    CONFIRMED = "Confirmed"
    FLAGGED = "Flagged"
    REQUIRES_FURTHER_INSPECTION = "Requires Further Inspection"
    PENDING = "Pending"


class IssueType(str, Enum):
    NONE = "None"
    SPOILAGE_SUSPECTED = "Spoilage Suspected"
    LOW_QUALITY = "Low Quality"
    AI_RESULT_REQUIRES_REVIEW = "AI Result Requires Review"
    STORAGE_VIOLATION = "Storage Violation"
    SHORT_REMAINING_SHELF_LIFE = "Short Remaining Shelf Life"
    IMAGE_QUALITY_PROBLEM = "Image Quality Problem"
    OTHER = "Other"


class IssueSeverity(str, Enum):
    NONE = "None"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class InspectionCreateRequest(BaseModel):
    product_name: str = Field(..., min_length=2, max_length=120, description="Product / food item name")
    category: str = Field(..., description="Food category (Fruits, Vegetables, Dairy, etc.)")
    batch_number: Optional[str] = Field(None, max_length=64, description="Lot or batch traceability code")
    inventory_id: Optional[str] = Field(None, description="Optional linked inventory item ID")
    image_url: Optional[str] = Field(None, description="Optional pre-uploaded image URL")
    storage_temperature: Optional[float] = Field(None, description="Current ambient temperature in Celsius")
    storage_humidity: Optional[float] = Field(None, description="Current ambient relative humidity percentage")
    storage_location: Optional[str] = Field(None, description="Display case, cold room, or storage bay tag")
    notes: Optional[str] = Field(None, description="Initial inspector notes or sample provenance")


class InspectionReviewRequest(BaseModel):
    decision: str = Field(..., description="Inspector decision: 'Confirmed', 'Flagged', or 'Requires Further Inspection'")
    reason: Optional[str] = Field(None, max_length=250, description="Summary reason for decision")
    comments: Optional[str] = Field(None, max_length=1000, description="Detailed inspector notes or instructions")
    adjusted_shelf_life: Optional[float] = Field(None, ge=0, description="Optional manual shelf-life assessment in days")


class InspectionFlagRequest(BaseModel):
    issue_type: str = Field(..., description="Categorized issue type (e.g. Spoilage Suspected, Storage Violation)")
    severity: str = Field(default="Medium", description="Severity level: Low, Medium, High, Critical")
    reason: str = Field(..., min_length=3, max_length=250, description="Justification for flagging")
    comments: Optional[str] = Field(None, max_length=1000, description="Corrective actions or inspection guidance")


class AlertResolveRequest(BaseModel):
    resolution_notes: Optional[str] = Field(None, max_length=1000, description="Actions taken to resolve quality alert")
    action_taken: Optional[str] = Field(None, max_length=120, description="Action code or outcome summary")


# ------------------------------------------------------------------------------
# Response Models
# ------------------------------------------------------------------------------

class AIAnalysisResultModel(BaseModel):
    classification: str = "Not Analyzed"
    confidence: float = 0.0
    quality_score: float = 0.0
    spoilage_risk: str = "Low"
    spoilage_probability: float = 0.0
    estimated_shelf_life_days: float = 0.0
    detected_defects: List[str] = []
    mold_detected: bool = False
    mold_coverage_pct: float = 0.0
    bruising_detected: bool = False
    physical_damage_detected: bool = False
    browning_index: float = 0.0
    roughness_index: float = 0.0
    color_score: float = 0.0
    texture_score: float = 0.0
    analyzed_at: Optional[str] = None


class StorageReviewModel(BaseModel):
    current_temperature: Optional[float] = None
    current_humidity: Optional[float] = None
    recommended_temperature: float = 4.0
    permitted_temp_min: float = 1.0
    permitted_temp_max: float = 6.0
    recommended_humidity: float = 85.0
    permitted_humidity_min: float = 75.0
    permitted_humidity_max: float = 95.0
    storage_location: Optional[str] = None
    status: str = "Normal"
    notes: Optional[str] = None


class InspectorReviewModel(BaseModel):
    decision: str = "Pending"
    reason: Optional[str] = None
    comments: Optional[str] = None
    issue_type: Optional[str] = None
    severity: Optional[str] = None
    reviewed_at: Optional[str] = None
    inspector_id: Optional[str] = None
    inspector_name: Optional[str] = None
    inspector_adjusted_shelf_life: Optional[float] = None


class InspectionResponse(BaseModel):
    id: str
    inspection_id: str
    inspector_id: str
    inspector_name: str
    inspector_email: str
    product_name: str
    category: str
    batch_number: Optional[str] = None
    inventory_id: Optional[str] = None
    image_reference: Optional[str] = None
    storage_review: StorageReviewModel
    ai_result: AIAnalysisResultModel
    inspector_review: InspectorReviewModel
    status: str
    created_at: str
    updated_at: str


class InspectorKPIs(BaseModel):
    total_inspections: int = 0
    today_inspections: int = 0
    pending_reviews: int = 0
    fresh_items: int = 0
    moderate_items: int = 0
    spoiled_items: int = 0
    spoilage_alerts: int = 0
    flagged_results: int = 0
    average_quality_score: float = 0.0
    average_ai_confidence: float = 0.0


class InspectorDashboardResponse(BaseModel):
    kpis: InspectorKPIs
    recent_inspections: List[InspectionResponse] = []
    pending_reviews: List[InspectionResponse] = []
    active_alerts: List[Dict[str, Any]] = []


class QualityAnalyticsResponse(BaseModel):
    kpis: InspectorKPIs
    freshness_distribution: Dict[str, int]
    quality_trends: List[Dict[str, Any]] = []
    spoilage_trends: List[Dict[str, Any]] = []
    inspection_activity: List[Dict[str, Any]] = []
    category_breakdown: List[Dict[str, Any]] = []
