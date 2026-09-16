from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models.user import User


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:

    return pwd_context.hash(password)


# ============================================================
# PASSWORD VERIFICATION
# ============================================================

def verify_password(
    password: str,
    password_hash: str,
) -> bool:

    return pwd_context.verify(
        password,
        password_hash,
    )


# ============================================================
# GET USER BY EMAIL
# ============================================================

def get_user_by_email(
    db: Session,
    email: str,
):

    return (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )


# ============================================================
# CREATE USER
# ============================================================

def create_user(
    db: Session,
    name: str,
    email: str,
    password: str,
    role: str = "consumer",
):

    password_hash = hash_password(
        password
    )

    new_user = User(
        name=name,
        email=email,
        password_hash=password_hash,
        role=role,
        is_active=True,
    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

    return new_user