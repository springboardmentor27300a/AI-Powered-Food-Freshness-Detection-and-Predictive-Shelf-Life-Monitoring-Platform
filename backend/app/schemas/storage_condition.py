"""
Pydantic schemas for the Storage Condition Monitoring module (Milestone 3).
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.storage_condition import ComplianceStatus


class StorageConditionCreate(BaseModel):
    temperature_celsius: float = Field(..., ge=-30, le=60)
    humidity_percent: float = Field(..., ge=0, le=100)
    air_circulation: Optional[str] = Field(default=None, max_length=50)
    light_exposure: Optional[str] = Field(default=None, max_length=50)
    packaging_type: Optional[str] = Field(default=None, max_length=100)


class StorageConditionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    inventory_item_id: uuid.UUID
    user_id: uuid.UUID
    temperature_celsius: float
    humidity_percent: float
    air_circulation: Optional[str] = None
    light_exposure: Optional[str] = None
    packaging_type: Optional[str] = None
    compliance_status: ComplianceStatus
    compliance_notes: str
    recorded_at: datetime
