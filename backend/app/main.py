"""
FastAPI application entry point.

Run from the backend/ folder:
    uvicorn app.main:app --reload

Interactive API docs are served at:
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
from app.routers import (
    alerts,
    analytics,
    auth,
    batches,
    dashboard,
    analysis,
    insights,
    recommendations,
    reports,
    shelf_life,
    storage,
)

logger = logging.getLogger(__name__)


def _apply_lightweight_migrations():
    """Base.create_all() does not add columns to already-existing tables.

    Milestone 3 adds optional live storage-condition columns to `food_batches`;
    running a guarded ALTER TABLE keeps existing databases working without a
    heavy migration framework. Every statement is idempotent.
    """
    statements = (
        "ALTER TABLE food_batches ADD COLUMN IF NOT EXISTS temperature_c DOUBLE PRECISION",
        "ALTER TABLE food_batches ADD COLUMN IF NOT EXISTS humidity_pct DOUBLE PRECISION",
        "ALTER TABLE food_batches ADD COLUMN IF NOT EXISTS air_circulation VARCHAR(20)",
        "ALTER TABLE food_batches ADD COLUMN IF NOT EXISTS light_exposure VARCHAR(20)",
    )
    with engine.begin() as conn:
        for statement in statements:
            try:
                conn.execute(text(statement))
            except Exception as e:  # pragma: no cover - defensive
                logger.warning(f"Migration step failed (continuing on): {statement} -> {e}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create database tables on startup and initialize ML models."""
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()

    # Pre-load ML models at startup
    try:
        from app.ml.freshness_scorer import FreshnessClassifier
        classifier = FreshnessClassifier()
        if classifier.pytorch_model is not None:
            logger.info("PyTorch freshness CNN model loaded successfully.")
        else:
            logger.info("No trained PyTorch model found. Using CV-only analysis.")
    except Exception as e:
        logger.warning(f"Could not pre-load ML models: {e}")

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.API_VERSION,
    description=(
        "Backend API for the Food Freshness Monitoring Platform.\n\n"
        "**Milestone 2 scope:** AI image-based freshness detection, "
        "spoilage detection, quality scoring, and freshness reports.\n\n"
        "**Milestone 3 scope:** shelf-life prediction, storage-condition monitoring, "
        "a weighted freshness scoring engine, recommendations, inventory insights, "
        "analytics dashboards, alerts and PDF/Excel report export.\n\n"
        "**Milestone 4 scope:** 5 dedicated role dashboards (Consumer, Retail Manager, "
        "Warehouse Operator, Food Quality Inspector, Administrator), single centralized "
        "Reports page with 5 report types, full PDF/Excel exports, and production deployment readiness."
    ),
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Authentication", "description": "Register, login and profile endpoints."},
        {"name": "Food Batches", "description": "Create, search, update and delete food batches."},
        {"name": "Dashboard", "description": "Aggregated statistics and expiry alerts."},
        {"name": "Image Analysis", "description": "Upload food images for AI freshness analysis and spoilage detection."},
        {"name": "Freshness Reports", "description": "Generate and view comprehensive freshness assessment reports."},
        {"name": "Shelf-Life Prediction", "description": "Rule-based remaining shelf-life estimation and prediction history."},
        {"name": "Storage Conditions", "description": "Record and analyze storage temperature, humidity, air and light."},
        {"name": "Recommendations", "description": "Storage, consumption, rotation and waste-reduction suggestions."},
        {"name": "Inventory Insights", "description": "Aggregated inventory health and at-risk product insights."},
        {"name": "Analytics", "description": "Freshness, shelf-life, storage, risk and trend analytics."},
        {"name": "Alerts", "description": "In-app notifications generated from real batch state."},
        {"name": "Health", "description": "Service health checks."},
    ],
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(batches.router)
app.include_router(dashboard.router)
app.include_router(analysis.router)
app.include_router(reports.router)
app.include_router(shelf_life.router)
app.include_router(storage.router)
app.include_router(recommendations.router)
app.include_router(insights.router)
app.include_router(analytics.router)
app.include_router(alerts.router)


@app.get("/", tags=["Health"], include_in_schema=False)
def root():
    return {"status": "ok", "service": settings.PROJECT_NAME, "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
