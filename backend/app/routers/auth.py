"""
Authentication routes:

    POST /auth/register  - create a new account (password hashed with bcrypt)
    POST /auth/login     - JSON login, returns JWT + user
    POST /auth/token     - OAuth2 form login (lets Swagger UI's Authorize work)
    GET  /auth/me        - current user's profile from the JWT
    GET  /auth/users     - administrator-only: list all users
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import User
from app.schemas import Message, Token, UserCreate, UserLogin, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_token(user: User) -> Token:
    """Create a signed JWT whose `sub` claim is the user id."""
    access_token = create_access_token(subject=str(user.id), extra_claims={"role": user.role})
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user. Passwords are bcrypt-hashed before storage."""
    existing = db.scalar(select(User).where(User.email == user_in.email.lower()))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try logging in instead.",
        )

    user = User(
        full_name=user_in.full_name.strip(),
        email=user_in.email.lower(),
        password_hash=hash_password(user_in.password),
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """JSON login used by the React frontend. Returns a JWT access token."""
    user = db.scalar(select(User).where(User.email == credentials.email.lower()))

    # Same error for "no such email" and "wrong password" so attackers cannot
    # discover which emails are registered.
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _build_token(user)


@router.post("/token", response_model=Token, include_in_schema=True)
def token_oauth2(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    OAuth2 password-flow endpoint (form-encoded).
    Primary purpose: make Swagger UI's built-in Authorize button functional.
    The username field receives the email address.
    """
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _build_token(user)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Return the profile of the authenticated user (decoded from the JWT)."""
    return current_user


@router.get("/users", response_model=list[UserOut],
            dependencies=[Depends(require_roles("administrator"))])
def list_all_users(db: Session = Depends(get_db)):
    """Administrator only: list every registered user on the platform."""
    return db.scalars(select(User).order_by(User.created_at)).all()


@router.delete("/users/{user_id}", response_model=Message,
               dependencies=[Depends(require_roles("administrator"))])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Administrator only: remove a user account and their batches."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User #{user_id} was not found.")
    db.delete(user)
    db.commit()
    return Message(message=f"User '{user.full_name}' and their batches were deleted.")
