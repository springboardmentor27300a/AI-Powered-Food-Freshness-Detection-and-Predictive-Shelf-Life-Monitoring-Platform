"""
Business logic for registration and login.
"""
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate


def register_user(db: Session, user_in: UserCreate) -> User:
    existing = (
        db.query(User)
        .filter((User.username == user_in.username) | (User.email == user_in.email))
        .first()
    )
    if existing:
        raise ValueError("Username or email already registered")

    user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=UserRole.CONSUMER,  # self-registration always defaults to Consumer
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_token_for_user(user: User) -> str:
    return create_access_token(data={"sub": str(user.id), "role": user.role.value})
