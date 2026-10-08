from urllib.parse import quote_plus
import os
from sqlalchemy import create_engine, text
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

# Create the MySQL database if it doesn't exist.
server_url = f"mysql+pymysql://{settings.mysql_user}:{quote_plus(settings.mysql_password)}@{settings.mysql_host}:{settings.mysql_port}/"
server_engine = create_engine(server_url, pool_pre_ping=True)
with server_engine.connect() as conn:
    conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{settings.mysql_database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
server_engine.dispose()

from app.core.database import SessionLocal
from app.models import User, FoodItem, FoodBatch, FreshnessAssessment, Alert
from app.db_init import ensure_schema
from app.seed import seed
from app.routers import auth, inventory, freshness, dashboard, alerts, reports, storage

# Create missing tables and safely upgrade older Milestone schemas.
ensure_schema()

# Add starter food items only if food_items is empty.
with SessionLocal() as db:
    seed(db)

app=FastAPI(title="FreshGuard — Food Freshness Monitoring Platform",version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):(5173|5174|5175|5176)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in [auth.router,inventory.router,freshness.router,dashboard.router,alerts.router,reports.router,storage.router]:
    app.include_router(r)

app.mount("/uploads", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "uploads")), name="uploads")

@app.get("/")
def root():
    return {"name":"FreshGuard","version":"3.0.0","status":"running"}

@app.get("/health")
def health():
    return {"status":"ok"}
