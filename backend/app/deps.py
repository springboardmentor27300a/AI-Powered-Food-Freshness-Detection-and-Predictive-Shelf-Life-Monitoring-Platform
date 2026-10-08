"""
Shared FastAPI dependencies:

- get_current_user : resolves the JWT from the Authorization header and loads
                     the matching user from PostgreSQL.
- require_roles    : factory used to protect routes with role-based access.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_access_token

# tokenUrl points at the OAuth2-compatible login endpoint so Swagger UI's
# "Authorize" button works out of the box.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode the JWT and return the current user; 401 when missing/invalid."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_raw = payload.get("sub")
    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None:
        # Account was deleted after the token was issued.
        raise credentials_exception
    return user


def require_roles(*allowed_roles: str):
    """
    Dependency factory enforcing role-based access.

    Usage:
        @router.post("/batches", dependencies=[Depends(require_roles("administrator"))])
    or to also receive the user:
        user: User = Depends(require_roles("retail_manager", "warehouse_operator"))
    """

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            allowed = ", ".join(allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Your role ('{current_user.role}') is not permitted. "
                       f"Allowed roles: {allowed}.",
            )
        return current_user

    return role_checker
