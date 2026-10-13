import logging
import os
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, inventory, ml, shelf_life, storage, recommendations, analytics, alerts, reports, executive
from database import ensure_indexes

# ---------------------------------------------------------------------------
# Logging: clean structured console output for the whole app (no secrets).
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("app")

# ---------------------------------------------------------------------------
# CORS: configurable via CORS_ORIGIN (comma-separated). Defaults keep local
# development working; production must set the variable explicitly.
# ---------------------------------------------------------------------------
_raw_origins = os.getenv(
    "CORS_ORIGIN",
    "http://localhost:5173,http://127.0.0.1:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="Food Freshness Monitoring Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    await ensure_indexes()
    logger.info("Application startup complete (CORS origins: %s)", ", ".join(ALLOWED_ORIGINS))


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(ml.router, prefix="/api/ml", tags=["ml"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

# Milestone 3 routers
app.include_router(shelf_life.router, prefix="/api/shelf-life", tags=["shelf-life"])
app.include_router(storage.router, prefix="/api/storage", tags=["storage"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["recommendations"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

# Milestone 4 routers
app.include_router(executive.router, prefix="/api/executive", tags=["executive"])


@app.get("/")
async def root():
    return {"message": "Welcome to Food Freshness Monitoring Platform API"}


@app.get("/api/health")
async def health():
    """Liveness + readiness: database ping and AI model availability."""
    from database import client
    try:
        await client.admin.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"unreachable: {e}"

    model_loaded = None
    try:
        from routes.ml import model  # already imported at app startup
        model_loaded = model is not None
    except Exception:
        model_loaded = False

    status = "ok" if db_status == "connected" else "degraded"
    return {
        "status": status,
        "database": db_status,
        "model_loaded": model_loaded,
        "time": datetime.now(timezone.utc).isoformat(),
    }
