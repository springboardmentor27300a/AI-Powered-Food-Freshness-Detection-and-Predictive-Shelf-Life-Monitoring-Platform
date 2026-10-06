import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.report import FreshnessCategory, ReportStatus
from app.schemas.analysis import CNNPredictionOut, VisualAnalysisOut
from app.schemas.image import FoodImageOut
from app.schemas.shelf_life import ShelfLifePredictionOut


class GenerateReportRequest(BaseModel):
    batch_id: uuid.UUID
    image_id: uuid.UUID
    notes: Optional[str] = None


class FreshnessReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_number: str
    batch_id: uuid.UUID
    visual_component_score: float
    storage_component_score: float
    shelf_life_component_score: float
    product_age_component_score: float
    freshness_score: float
    freshness_category: FreshnessCategory
    spoilage_probability_pct: float
    storage_conditions_snapshot: Optional[dict] = None
    recommendations_snapshot: Optional[list] = None
    inspector_id: uuid.UUID
    status: ReportStatus
    notes: Optional[str] = None
    created_at: datetime


class FreshnessReportDetail(FreshnessReportOut):
    image: Optional[FoodImageOut] = None
    cnn_prediction: Optional[CNNPredictionOut] = None
    visual_analysis: Optional[VisualAnalysisOut] = None
    shelf_life_prediction: Optional[ShelfLifePredictionOut] = None
    batch_code: Optional[str] = None
    food_item_name: Optional[str] = None
    inspector_name: Optional[str] = None


class FreshnessReportListResponse(BaseModel):
    items: list[FreshnessReportOut]
    total: int
    page: int
    page_size: int
