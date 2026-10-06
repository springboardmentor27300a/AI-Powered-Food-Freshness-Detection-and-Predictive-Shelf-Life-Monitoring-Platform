import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.recommendation import RecommendationPriority, RecommendationType


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: uuid.UUID
    type: RecommendationType
    priority: RecommendationPriority
    title: str
    message: str
    based_on: str
    created_at: datetime


class RecommendationListResponse(BaseModel):
    items: list[RecommendationOut]
    total: int
