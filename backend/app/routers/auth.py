from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.models.user import User
from app.schemas import RegisterIn, LoginIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    role = data.role if data.role in {"consumer","retail_manager","warehouse_operator","quality_inspector"} else "consumer"
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password), role=role)
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": UserOut.model_validate(user).model_dump()}

@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": UserOut.model_validate(user).model_dump()}

@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user
