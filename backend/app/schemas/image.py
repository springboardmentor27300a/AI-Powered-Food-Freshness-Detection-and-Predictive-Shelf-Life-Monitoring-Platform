import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field


class FoodImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: uuid.UUID
    stored_filename: str
    original_filename: Optional[str] = None
    content_type: str
    file_size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    uploaded_by: uuid.UUID
    uploaded_at: datetime

    @computed_field
    @property
    def url(self) -> str:
        return f"/uploads/{self.stored_filename}"
