"""
FastAPI application entrypoint — Food Freshness Monitoring Platform
Milestone 1: Authentication & Registration module.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, users, inventory, freshness, storage, analysis, alerts, admin, reports
from app.config import settings
from app.database import Base, engine
from app.models.inventory import FoodInventory
from app.models.freshness_assessment import FreshnessAssessment
from app.models.storage_condition import StorageCondition

# Create tables on startup if they don't exist (in addition to Alembic migrations).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Authentication & Role-Based Access Control module for the "
    "Food Freshness Monitoring Platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(inventory.router)
app.include_router(freshness.router)
app.include_router(storage.router)
app.include_router(analysis.router)
app.include_router(alerts.router)
app.include_router(admin.router)
app.include_router(reports.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
