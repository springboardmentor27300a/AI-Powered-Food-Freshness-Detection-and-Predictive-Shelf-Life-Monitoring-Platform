from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


# ============================================================
# USER REGISTRATION
# ============================================================

class UserCreate(BaseModel):

    name: str

    email: EmailStr

    password: str


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

    # Role of logged-in user
    role: str