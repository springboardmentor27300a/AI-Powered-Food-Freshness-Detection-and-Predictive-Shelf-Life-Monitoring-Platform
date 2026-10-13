"""Shared auth dependencies: JWT extraction, current-user resolution, role/ownership enforcement.

Frontend sends `Authorization: Bearer <token>`; routes declare required roles or open access.
"""
import logging
import os

from bson import ObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from database import user_collection

logger = logging.getLogger("auth")

# SECRET_KEY is REQUIRED. A missing key in production is a fatal startup error;
# in development an ephemeral random key is generated (tokens reset on restart)
# with a loud warning so the platform can never silently run on a known secret.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        raise RuntimeError("SECRET_KEY environment variable must be set in production")
    import secrets as _secrets
    SECRET_KEY = _secrets.token_hex(32)
    logger.warning(
        "SECRET_KEY not set - generated an EPHEMERAL development key. "
        "All tokens are invalidated on restart. Set SECRET_KEY for stable sessions."
    )
ALGORITHM = os.getenv("ALGORITHM", "HS256")

bearer_scheme = HTTPBearer(auto_error=False)


def serialize_doc(doc: dict) -> dict:
    """Convert _id / ObjectId reference fields to strings for JSON responses."""
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    for key in ("item_id", "batch_id", "user_id", "created_by", "zone_id"):
        if isinstance(doc.get(key), ObjectId):
            doc[key] = str(doc[key])
    return doc


def to_object_id(value) -> ObjectId:
    """Validate a string as ObjectId, raising 400 on malformed input."""
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed id")


async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    """Resolve the JWT bearer token to the user document from MongoDB."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await user_collection.find_one({"username": username})
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    return user


def require_roles(*roles):
    """Dependency factory: allow only the given roles (Administrator always allowed)."""
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles and user["role"] != "Administrator":
            raise HTTPException(status_code=403, detail=f"Requires one of: {', '.join(roles)}")
        return user
    return checker
