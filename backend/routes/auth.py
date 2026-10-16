from typing import Literal

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from database import SessionLocal
from models.user import User
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


router = APIRouter(tags=["Authentication & Users"])
security = HTTPBearer(auto_error=False)


ROLES = Literal[
    "consumer",
    "retail manager",
    "warehouse operator",
    "food quality inspector",
    "administrator",
]


# =========================================================
# REQUEST MODELS
# =========================================================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: ROLES


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    name: str


# =========================================================
# CURRENT USER
# =========================================================

def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    payload = decode_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.id == int(payload["sub"]))
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User no longer exists"
            )

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    finally:
        db.close()


# =========================================================
# REGISTER
# =========================================================

@router.post("/register")
def register(data: RegisterRequest):

    email = data.email.strip().lower()
    name = data.name.strip()

    if len(name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Name must contain at least 2 characters"
        )

    if len(data.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters"
        )

    db = SessionLocal()

    try:

        existing_user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        user = User(
            name=name,
            email=email,
            password=hash_password(data.password),
            role=data.role,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_access_token(
            user.id,
            user.email,
            user.role
        )

        return {
            "message": "Account created successfully",
            "access_token": token,
            "token_type": "bearer",
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    finally:
        db.close()


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login(data: LoginRequest):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.email == data.email.strip().lower()
            )
            .first()
        )

        if not user or not verify_password(
            data.password,
            user.password
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        token = create_access_token(
            user.id,
            user.email,
            user.role
        )

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    finally:
        db.close()


# =========================================================
# PROFILE
# =========================================================

@router.get("/profile")
def get_profile(user=Depends(current_user)):
    return user


@router.put("/profile")
def update_profile(
    data: ProfileUpdate,
    user=Depends(current_user)
):

    name = data.name.strip()

    if len(name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Name must contain at least 2 characters"
        )

    db = SessionLocal()

    try:

        record = (
            db.query(User)
            .filter(User.id == user["id"])
            .first()
        )

        if not record:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        record.name = name

        db.commit()
        db.refresh(record)

        return {
            "message": "Profile updated",
            "id": record.id,
            "name": record.name,
            "email": record.email,
            "role": record.role,
        }

    finally:
        db.close()


# =========================================================
# ADMIN USER MANAGEMENT
# =========================================================

@router.get("/admin/users")
def get_all_users(user=Depends(current_user)):

    if user["role"] != "administrator":
        raise HTTPException(
            status_code=403,
            detail="Access denied. Administrator only."
        )

    db = SessionLocal()

    try:

        users = db.query(User).all()

        return [
            {
                "id": item.id,
                "name": item.name,
                "email": item.email,
                "role": item.role,
            }
            for item in users
        ]

    finally:
        db.close()