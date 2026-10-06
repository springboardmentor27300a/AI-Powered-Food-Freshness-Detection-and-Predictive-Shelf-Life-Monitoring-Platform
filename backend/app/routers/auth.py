"""
/api/auth — registration, login, current-user profile.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.auth import Token
from app.schemas.user import UserCreate, UserOut
from app.services.auth_service import authenticate_user, create_token_for_user, register_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    try:
        user = register_user(db, user_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Uses the standard OAuth2 password-flow form (username + password as
    form fields, not JSON) so this endpoint is directly compatible with
    FastAPI's built-in OAuth2PasswordBearer / Swagger 'Authorize' button.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_token_for_user(user)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    """
    JWTs are stateless, so there is nothing to invalidate server-side in
    Milestone 1. The frontend simply discards the token from memory/storage.
    A token-blacklist table (checked in get_current_user) is a documented
    extension point for a later milestone if immediate server-side
    revocation becomes a requirement.
    """
    return {"message": "Logout successful. Discard the token on the client."}
