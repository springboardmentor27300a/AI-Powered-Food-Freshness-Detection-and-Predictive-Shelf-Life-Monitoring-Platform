import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import Base, engine

# Import models before create_all so new tables are registered.
from models.user import User
from models.food_item import FoodItem
from models.batch import Batch
from models.prediction_history import PredictionHistory
from models.storage_reading import StorageReading
from models.freshness_assessment import FreshnessAssessment

from routes.food import router as food_router
from routes.batch import router as batch_router
from routes.auth import router as auth_router
from routes.freshness import router as freshness_router
from routes.shelf_life import router as shelf_life_router
from routes.storage import router as storage_router
from routes.recommendations import router as recommendations_router
from routes.inventory import router as inventory_router
from routes.analytics import router as analytics_router
from routes.alerts import router as alerts_router
from routes.reports import router as reports_router
from routes.assessments import router as assessments_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("foodtrace")

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FoodTrace API",
    version="4.0.0",
    description="AI-powered food freshness, shelf-life, storage compliance, recommendation, alert and reporting platform.",
)

allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in allowed_origins if item.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads/assessments", exist_ok=True)
app.mount("/assessment-images", StaticFiles(directory="uploads/assessments"), name="assessment-images")

@app.middleware("http")
async def request_logging(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info("%s %s -> %s %.1fms", request.method, request.url.path, response.status_code, elapsed)
    response.headers["X-FoodTrace-Response-Time-ms"] = f"{elapsed:.1f}"
    return response

for router in [
    food_router, batch_router, auth_router, freshness_router, shelf_life_router,
    storage_router, recommendations_router, inventory_router, analytics_router,
    alerts_router, reports_router, assessments_router,
]:
    app.include_router(router)

@app.get("/")
def home():
    return {"message": "FoodTrace API is running", "version": "4.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "service": "FoodTrace API", "version": "4.0.0"}
