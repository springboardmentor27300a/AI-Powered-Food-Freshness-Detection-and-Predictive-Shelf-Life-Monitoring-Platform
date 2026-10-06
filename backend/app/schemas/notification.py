from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationBase(BaseModel):
    title: str
    message: str
    severity: str = "info"
    notification_type: str

    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    action_url: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: Optional[UUID] = None


class NotificationResponse(NotificationBase):
    id: int
    user_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationMarkRead(BaseModel):
    is_read: bool = True