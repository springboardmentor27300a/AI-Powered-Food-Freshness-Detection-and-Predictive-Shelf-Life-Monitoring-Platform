
"""
Security utilities for the Food Freshness Monitoring Platform.

Provides:
- Password hashing and verification using bcrypt
- JWT access-token creation
- JWT access-token decoding and validation
"""

import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from dotenv import load_dotenv
import bcrypt
from jose import JWTError, jwt

from backend.app.config import settings


# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

# Load backend/.env
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE, override=False)


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Returns:
        A bcrypt password hash.
    """
    if not isinstance(password, str) or not password:
        raise ValueError("Password must be a non-empty string.")

    password_bytes = password.encode("utf-8")

    # bcrypt supports passwords up to 72 bytes.
    if len(password_bytes) > 72:
        raise ValueError("Password must not exceed 72 UTF-8 bytes.")

    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Verify a plain-text password against a stored bcrypt hash.

    Returns False if the hash is missing, malformed, or incompatible.
    """
    if not isinstance(plain_password, str):
        return False

    if not isinstance(hashed_password, str) or not hashed_password:
        return False

    try:
        password_bytes = plain_password.encode("utf-8")

        if len(password_bytes) > 72:
            return False

        return bcrypt.checkpw(
            password_bytes,
            hashed_password.encode("utf-8"),
        )

    except (ValueError, TypeError, UnicodeError):
        return False


# ============================================================
# JWT CONFIGURATION
# ============================================================

def _get_jwt_secret() -> str:
    """
    Read the JWT signing secret from application settings or
    environment variables.
    """

    secret = (
        getattr(settings, "JWT_SECRET_KEY", None)
        or getattr(settings, "JWT_SECRET", None)
        or getattr(settings, "SECRET_KEY", None)
        or os.getenv("JWT_SECRET_KEY")
        or os.getenv("JWT_SECRET")
        or os.getenv("SECRET_KEY")
    )

    if not isinstance(secret, str) or not secret.strip():
        raise RuntimeError(
            "JWT secret is missing. Configure JWT_SECRET_KEY, "
            "JWT_SECRET, or SECRET_KEY in backend/.env."
        )

    secret = secret.strip()

    # Avoid accidentally using a placeholder secret.
    if secret.lower() in {
        "your-secret-key",
        "change-me",
        "replace-with-a-new-random-secret",
    }:
        raise RuntimeError(
            "The JWT secret is still a placeholder. "
            "Configure a secure secret in backend/.env."
        )

    return secret


def _get_jwt_algorithm() -> str:
    """Get the configured JWT algorithm."""

    algorithm = (
        getattr(settings, "JWT_ALGORITHM", None)
        or os.getenv("JWT_ALGORITHM")
        or "HS256"
    )

    if not isinstance(algorithm, str) or not algorithm.strip():
        return "HS256"

    return algorithm.strip()


def _get_token_expiry_minutes() -> int:
    """Read the configured access-token lifetime."""

    expiry = (
        getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", None)
        or os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")
        or 1440
    )

    try:
        expiry = int(expiry)
    except (TypeError, ValueError):
        expiry = 1440

    if expiry <= 0:
        expiry = 1440

    return expiry


# ============================================================
# JWT ACCESS TOKENS
# ============================================================

def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    The supplied data is copied before adding token claims.
    """
    if not isinstance(data, dict):
        raise TypeError("Token data must be a dictionary.")

    to_encode = data.copy()

    if expires_delta is None:
        expires_delta = timedelta(
            minutes=_get_token_expiry_minutes()
        )

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    to_encode["iat"] = now
    to_encode["exp"] = expire

    return jwt.encode(
        to_encode,
        _get_jwt_secret(),
        algorithm=_get_jwt_algorithm(),
    )


def decode_access_token(
    token: str,
) -> Optional[dict[str, Any]]:
    """
    Decode and validate a JWT access token.

    Returns the token claims if valid, otherwise None.
    """
    if not isinstance(token, str) or not token.strip():
        return None

    try:
        payload = jwt.decode(
            token,
            _get_jwt_secret(),
            algorithms=[_get_jwt_algorithm()],
        )

        return payload

    except (JWTError, ValueError, TypeError):
        return None


def verify_access_token(
    token: str,
) -> Optional[dict[str, Any]]:
    """
    Compatibility helper for code that calls verify_access_token().
    """
    return decode_access_token(token)
