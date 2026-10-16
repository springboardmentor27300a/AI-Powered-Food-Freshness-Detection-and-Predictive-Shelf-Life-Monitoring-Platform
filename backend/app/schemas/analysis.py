"""
Combined response schemas for the Milestone 3 per-item analysis
endpoint (shelf life, health score, recommendations, storage,
alerts) and the account-wide alerts endpoint.
"""
import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.freshness_assessment import FreshnessCategory
from app.models.storage_condition import ComplianceStatus


class ShelfLifeResponse(BaseModel):
    remaining_shelf_life_days: int
    original_expiry_date: date
    analysis_date: date
    forecasted_expiry_date: date
    is_expired: bool = False
    risk_level: str
    risk_reasons: List[str] = []
    factors: List[str]
    matched_food_rule: Optional[str] = None
    storage_method_used: Optional[str] = None
    method: str


class ShelfLifeTrendPoint(BaseModel):
    assessment_date: datetime
    remaining_shelf_life_days: int
    freshness_category: Optional[FreshnessCategory] = None
    freshness_score: Optional[int] = None


class ShelfLifeTrendResponse(BaseModel):
    current: ShelfLifeResponse
    points: List[ShelfLifeTrendPoint]
    has_sufficient_history: bool


class HealthScoreResponse(BaseModel):
    visual_condition_score: float
    storage_condition_score: float
    shelf_life_score: float
    product_age_score: float
    overall_food_health_score: int


class RecommendationResponse(BaseModel):
    type: str
    message: str


class AlertResponse(BaseModel):
    type: str
    severity: str
    message: str
    inventory_item_id: uuid.UUID
    food_name: str


class StorageGuidanceResponse(BaseModel):
    basis: str
    rule_label: Optional[str] = None
    recommended_method: str
    temperature_range_c: Optional[List[float]] = None
    humidity_range_percent: Optional[List[float]] = None
    packaging: str
    handling: str
    actual_method: Optional[str] = None
    has_readings: bool
    comparison_notes: List[str]


class ItemAnalysisResponse(BaseModel):
    inventory_item_id: uuid.UUID
    shelf_life: ShelfLifeTrendResponse
    health_score: HealthScoreResponse
    recommendations: List[RecommendationResponse]
    latest_storage_condition: Optional[dict] = None
    storage_guidance: Optional[StorageGuidanceResponse] = None
    alerts: List[AlertResponse]
    disclaimer: str = (
        "Shelf-life, health score, and recommendation values are estimates "
        "based on heuristic computer-vision analysis and entered storage "
        "data. They are not a food-safety certification or guarantee, and a low "
        "risk level does not prove food is safe to eat."
    )
