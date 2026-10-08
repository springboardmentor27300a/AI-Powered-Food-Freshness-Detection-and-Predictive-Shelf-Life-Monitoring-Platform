"""
Security utilities.

- Passwords are hashed with bcrypt via passlib. Plain-text passwords are never
  stored and never logged.
- JWT access tokens are signed with HS256 using SECRET_KEY from environment.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# bcrypt automatically salts each password; deprecated="auto" supports rehashing old schemes later.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password for storage in the users table."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Constant-time verification of a plain password against a stored bcrypt hash."""
    try:
        return pwd_context.verify(plain_password, password_hash)
    except ValueError:
        return False


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """
    Create a signed JWT for `subject` (the user id).
    Token contains an `exp` claim so stolen tokens stop working after expiry.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Return the token claims, or None when the token is invalid/expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
