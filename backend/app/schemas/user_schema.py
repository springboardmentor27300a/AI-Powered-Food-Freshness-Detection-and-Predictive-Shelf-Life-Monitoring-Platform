from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from backend.app.models.user_model import UserRole


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name")
    email: EmailStr = Field(..., description="User Email Address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (at least 6 characters)")
    confirm_password: str = Field(..., description="Confirm Password")
    role: str = Field(default=UserRole.CONSUMER.value, description="Role in food ecosystem")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Name cannot be empty or blank")
        return trimmed

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        # Normalize Quality Inspector or Admin aliases if provided
        v_clean = v.strip().lower()
        if v_clean in ["quality inspector", "food quality inspector"]:
            v = UserRole.FOOD_QUALITY_INSPECTOR.value
        elif v_clean in ["admin", "administrator"]:
            v = UserRole.ADMIN.value

        all_roles = UserRole.list()
        if v not in all_roles:
            raise ValueError(f"Invalid role '{v}'. Allowed roles: {', '.join(all_roles)}")
        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User Email Address")
    password: str = Field(..., description="Password")


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: Optional[str] = "active"
    is_active: Optional[bool] = True
    last_login: Optional[datetime] = None
    auth_provider: Optional[str] = "local"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google ID Token (JWT) from Google Identity Services")
    role: Optional[str] = Field(default=None, description="Requested operational role (Admin is rejected)")


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = None


class UserProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="Updated Full Name")
    phone: Optional[str] = Field(None, max_length=30, description="Contact phone number")
    organization: Optional[str] = Field(None, max_length=150, description="Company, store, facility, or lab name")
    preferences: Optional[dict] = Field(default_factory=dict, description="User notification and unit preferences")


class UserPasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=6, description="Current existing password")
    new_password: str = Field(..., min_length=6, max_length=128, description="New secure password")
    confirm_new_password: str = Field(..., description="Confirm new password")

    @field_validator("confirm_new_password")
    @classmethod
    def validate_new_passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("New passwords do not match")
        return v


