import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.storage import AirCirculation, LightExposure


class StorageReadingCreate(BaseModel):
    batch_id: Optional[uuid.UUID] = None
    storage_location: str
    temperature_c: float
    humidity_pct: float = Field(ge=0, le=100)
    air_circulation: Optional[AirCirculation] = None
    light_exposure: Optional[LightExposure] = None


class StorageReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: Optional[uuid.UUID] = None
    storage_location: str
    temperature_c: float
    humidity_pct: float
    air_circulation: Optional[AirCirculation] = None
    light_exposure: Optional[LightExposure] = None
    is_compliant: bool
    compliance_notes: Optional[str] = None
    recorded_by: uuid.UUID
    recorded_at: datetime


class StorageReadingListResponse(BaseModel):
    items: list[StorageReadingOut]
    total: int


class StorageTrendPoint(BaseModel):
    recorded_at: datetime
    temperature_c: float
    humidity_pct: float


class StorageTrendResponse(BaseModel):
    storage_location: str
    points: list[StorageTrendPoint]
