from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
)

from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
)

from app.services.auth import (
    create_user,
    get_user_by_email,
    verify_password,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================
# AUTH HEALTH
# ============================================================

@router.get("/health")
def auth_health():
    return {
        "status": "Authentication module is working"
    }


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        user.email,
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    new_user = create_user(
        db=db,
        name=user.name,
        email=user.email,
        password=user.password,
    )

    return new_user


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login_user(
    user: UserLogin,
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        user.email,
    )

    # --------------------------------------------------------
    # USER NOT FOUND
    # --------------------------------------------------------

    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # --------------------------------------------------------
    # PASSWORD VERIFICATION
    # --------------------------------------------------------

    if not verify_password(
        user.password,
        existing_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # --------------------------------------------------------
    # ACCOUNT STATUS
    # --------------------------------------------------------

    if not existing_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # --------------------------------------------------------
    # CREATE JWT TOKEN
    # --------------------------------------------------------

    access_token = create_access_token(
        data={
            "sub": str(existing_user.id),
            "email": existing_user.email,
        }
    )

    # --------------------------------------------------------
    # LOGIN RESPONSE
    # --------------------------------------------------------

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": existing_user.role,
    }


# ============================================================
# CURRENT USER / PROFILE
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user=Depends(get_current_user),
):
    return current_user