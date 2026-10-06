"""
FastAPI application entrypoint.
Wires together CORS, routers, static file serving for uploaded images,
and a startup DB table check.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database import Base, engine
from app.routers import (admin, analytics, auth, batches, food, images,
                          inventory, recommendations, reports, shelf_life,
                          storage, users,notifications,waste_reduction)

# Import models so they're registered on Base.metadata before create_all.
from app.models import batch, food_item, user, notification  # noqa: F401
from app.models import analysis, food_image, recommendation, report, shelf_life as shelf_life_model  # noqa: F401
from app.models import storage as storage_model  # noqa: F401

app = FastAPI(
    title="FoodCare API",
    description=(
        "AI-Based Food Freshness Monitoring and Shelf-Life Prediction Platform. "
        "Milestone 1: Authentication, RBAC, Inventory. "
        "Milestone 2: Image upload, CNN + OpenCV analysis, Freshness Reports. "
        "Milestone 3: Shelf-life prediction, storage monitoring, recommendations, analytics."
    ),
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(food.router)
app.include_router(batches.router)
app.include_router(inventory.router)
app.include_router(admin.router)
app.include_router(images.router)
app.include_router(reports.router)
app.include_router(shelf_life.router)
app.include_router(storage.router)
app.include_router(recommendations.router)
app.include_router(waste_reduction.router)
app.include_router(analytics.router)
app.include_router(notifications.router)



@app.on_event("startup")
def on_startup():
    # create_all is additive/non-destructive: it only creates tables that
    # don't exist yet, so all Milestone 1 data and tables are preserved.
    # Alembic migrations are set up (see alembic/) for future versioned changes.
    Base.metadata.create_all(bind=engine)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


# Serve uploaded images at /uploads/<filename> — read-only static mount,
# separate from the API. Actual uploads only ever happen through
# POST /api/images/upload, which validates and generates the filename.
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {
        "message": "FoodCare API — Food Freshness Monitoring and Shelf-Life Prediction Platform",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
