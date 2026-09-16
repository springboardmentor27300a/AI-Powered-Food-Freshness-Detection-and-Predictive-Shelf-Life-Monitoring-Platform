from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine
from app.models.user import User
from app.models.food import Food

from app.routers.auth import router as auth_router
from app.routers.food import router as food_router
from app.routers.prediction import router as prediction_router
from app.routers.upload import router as upload_router


# ============================================================
# DATABASE TABLE INITIALIZATION
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Food Freshness Monitoring Platform",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# STATIC UPLOAD FILES
# ============================================================
# Food images are stored in backend/uploads.
# The frontend needs /uploads/... to be publicly readable so that
# uploaded and OpenCV-annotated images can be displayed in reports.

BACKEND_DIR = Path(__file__).resolve().parents[1]
UPLOADS_DIR = BACKEND_DIR / "uploads"

UPLOADS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="uploads",
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(auth_router)
app.include_router(food_router)
app.include_router(prediction_router)
app.include_router(upload_router)


# ============================================================
# ROOT HEALTH CHECK
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Food Freshness Monitoring Platform API is running"
    }