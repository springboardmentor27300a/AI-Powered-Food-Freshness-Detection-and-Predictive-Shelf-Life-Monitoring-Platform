"""
Pydantic schemas for user creation, update, and API responses.
Kept separate from the SQLAlchemy model so API contracts can evolve
independently of the DB schema.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.user import UserRole


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    # Role is intentionally NOT accepted from the client on self-registration
    # in the router logic; new self-registered accounts always default to
    # CONSUMER. Admins assign other roles via /api/admin/users/{id}/role.


class UserUpdateProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
