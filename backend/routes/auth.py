import logging
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from jose import jwt
from models import UserCreate, Token
from database import user_collection
from pydantic import BaseModel

from dependencies import get_current_user, require_roles, serialize_doc, SECRET_KEY
from ml.alert_helpers import notify_platform

logger = logging.getLogger("auth")

router = APIRouter()

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))


class LoginData(BaseModel):
    username: str
    password: str


class UserStatusUpdate(BaseModel):
    is_active: bool


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


@router.post("/signup", response_model=Token)
async def signup(user: UserCreate):
    # Check if user exists
    existing_user = await user_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    hashed_password = get_password_hash(user.password)
    user_dict = {
        "username": user.username,
        "email": user.email,
        "hashed_password": hashed_password,
        "role": user.role.value,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }

    await user_collection.insert_one(user_dict)
    logger.info("New user registered: %s (role=%s)", user.username, user.role.value)
    try:
        await notify_platform(
            f"New user '{user.username}' registered with role '{user.role.value}'.",
            severity="low",
        )
    except Exception as notify_error:
        logger.warning("Platform notification failed: %s", notify_error)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role.value}


@router.post("/login", response_model=Token)
async def login(login_data: LoginData):
    user = await user_collection.find_one({"username": login_data.username})
    if not user or not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Current user profile (resolved from the token + database)."""
    return serialize_doc(user | {"hashed_password": None})


@router.get("/users")
async def list_users(user: dict = Depends(require_roles("Administrator"))):
    """Administrator: list all platform users."""
    users = []
    async for doc in user_collection.find({}).sort("created_at", -1):
        doc.pop("hashed_password", None)
        users.append(serialize_doc(doc))
    return users


@router.patch("/users/{username}/status")
async def set_user_status(username: str, update: UserStatusUpdate,
                          user: dict = Depends(require_roles("Administrator"))):
    """Administrator: activate/deactivate a user account."""
    if username == user["username"]:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    doc = await user_collection.find_one({"username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    await user_collection.update_one({"username": username}, {"$set": {"is_active": update.is_active}})
    updated = await user_collection.find_one({"username": username})
    updated.pop("hashed_password", None)
    return serialize_doc(updated)
