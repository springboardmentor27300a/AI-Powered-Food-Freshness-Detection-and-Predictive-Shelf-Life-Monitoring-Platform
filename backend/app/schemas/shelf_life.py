import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.shelf_life import RiskLevel, ShelfLifeMethod


class ShelfLifePredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: uuid.UUID
    method: ShelfLifeMethod
    model_version: str | None = None
    estimated_days_remaining: float
    estimated_expiry_date: date
    confidence_pct: float
    risk_level: RiskLevel
    factors: dict
    explanation: str
    created_at: datetime


class ShelfLifeRequest(BaseModel):
    """Optional overrides; if omitted, values are pulled from the batch's
    latest storage reading and the batch record itself."""
    storage_temperature_c: float | None = None
    humidity_pct: float | None = None
    freshness_score: float | None = None
