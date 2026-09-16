from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User


security = HTTPBearer()


# ============================================================
# CREATE ACCESS TOKEN
# ============================================================

def create_access_token(data: dict):

    to_encode = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update(
        {
            "exp": expire,
        }
    )

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
    db: Session = Depends(get_db),
):

    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:

        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[
                settings.ALGORITHM
            ],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except JWTError:

        raise credentials_exception

    try:

        user_id = int(user_id)

    except (TypeError, ValueError):

        raise credentials_exception

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


# ============================================================
# ROLE-BASED ACCESS CONTROL
# ============================================================

def require_roles(*allowed_roles):

    def role_checker(
        current_user: User = Depends(
            get_current_user
        ),
    ):

        if current_user.role not in allowed_roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to access this resource."
                ),
            )

        return current_user

    return role_checker


# ============================================================
# ROLE HELPERS
# ============================================================

def is_consumer(
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "consumer":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Consumer access required.",
        )

    return current_user


def is_retail_manager(
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "retail_manager":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Retail Manager access required.",
        )

    return current_user


def is_warehouse_operator(
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "warehouse_operator":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Warehouse Operator access required.",
        )

    return current_user


def is_food_quality_inspector(
    current_user: User = Depends(
        get_current_user
    ),
):

    if (
        current_user.role
        != "food_quality_inspector"
    ):

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Food Quality Inspector "
                "access required."
            ),
        )

    return current_user


def is_administrator(
    current_user: User = Depends(
        get_current_user
    ),
):

    if current_user.role != "administrator":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    return current_user