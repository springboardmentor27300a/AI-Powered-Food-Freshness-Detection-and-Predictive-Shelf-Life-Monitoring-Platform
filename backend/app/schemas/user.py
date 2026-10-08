from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ============================================================
# AVAILABLE USER ROLES
# ============================================================

ALLOWED_ROLES = {
    "consumer",
    "retail_manager",
    "warehouse_operator",
    "food_quality_inspector",
    "administrator",
}


# ============================================================
# USER REGISTRATION
# ============================================================

class UserCreate(BaseModel):

    name: str

    email: EmailStr

    password: str = Field(
        min_length=6
    )

    # Role selected during registration
    role: str = "consumer"


# ============================================================
# USER LOGIN
# ============================================================

class UserLogin(BaseModel):

    email: EmailStr

    password: str


# ============================================================
# USER RESPONSE
# ============================================================

class UserResponse(BaseModel):

    id: int

    name: str

    email: EmailStr

    role: str

    is_active: bool

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# LOGIN TOKEN RESPONSE
# ============================================================

class TokenResponse(BaseModel):

    access_token: str

    token_type: str

    role: str