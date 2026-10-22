import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response

from backend.app.config import settings
from backend.app.database import connect_to_mongo, close_mongo_connection, get_database
from backend.app.routes import (
    auth_routes,
    user_routes,
    inventory_routes,
    dashboard_routes,
    ai_routes,
    analytics_routes,
    report_routes,
    retailer_routes,
    inspector_routes,
    admin_routes,
    warehouse_routes,
    notification_routes,
)



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB and ensure indexes
    connect_to_mongo()
    yield
    # Shutdown: Cleanly close connection pool
    close_mongo_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description=(
        "Production AI-Powered Food Freshness Monitoring Platform REST API. "
        "Includes Computer Vision Freshness Classification, Arrhenius Shelf-Life Kinetics, "
        "Prescriptive Storage Recommendations, Executive Analytics & Compliance Reporting."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Production CORS Configuration
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")

# Include Core API Routers under /api
api_prefix = settings.API_V1_PREFIX
app.include_router(auth_routes.router, prefix=api_prefix)
app.include_router(user_routes.router, prefix=api_prefix)
app.include_router(inventory_routes.router, prefix=api_prefix)
app.include_router(dashboard_routes.router, prefix=api_prefix)
app.include_router(ai_routes.router, prefix=api_prefix)
app.include_router(analytics_routes.router, prefix=api_prefix)
app.include_router(report_routes.router, prefix=api_prefix)
app.include_router(retailer_routes.router, prefix=api_prefix)
app.include_router(inspector_routes.router, prefix=api_prefix)
app.include_router(admin_routes.router, prefix=api_prefix)
app.include_router(warehouse_routes.router, prefix=api_prefix)
app.include_router(notification_routes.router, prefix=api_prefix)



# ==============================================================================
# Container & Cloud Orchestration Health / Readiness Probes
# ==============================================================================

@app.get("/health", tags=["Operational Probes"], summary="Process Liveness Probe")
@app.get("/api/health", tags=["Operational Probes"], include_in_schema=False)
async def health_liveness_check():
    """
    Standard process liveness probe. Verifies that the FastAPI Uvicorn process is responsive.
    """
    db = get_database()
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db is not None else "disconnected",
    }


@app.get("/ready", tags=["Operational Probes"], summary="Dependency Readiness Probe")
@app.get("/api/ready", tags=["Operational Probes"], include_in_schema=False)
async def readiness_probe():
    """
    Readiness probe for load balancers and orchestrators.
    Confirms that MongoDB connectivity and ML inference pipelines are operational.
    Does NOT leak connection strings or internal credentials.
    """
    db = get_database()
    db_connected = False

    if db is not None:
        try:
            db.client.admin.command("ping")
            db_connected = True
        except Exception:
            db_connected = False

    if not db_connected:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "database": "disconnected",
                "message": "Database ping failed. Service is not ready to accept traffic."
            }
        )

    return {
        "status": "ready",
        "database": "connected",
        "models": {
            "cv_analyzer": "loaded",
            "shelf_life_predictor": "loaded",
            "recommendation_engine": "loaded",
            "report_generator": "loaded",
        },
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
    }


# ==============================================================================
# Frontend Static Files & Clean Routing
# ==============================================================================

if settings.FRONTEND_DIR.exists():
    css_dir = settings.FRONTEND_DIR / "css"
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")

    js_dir = settings.FRONTEND_DIR / "js"
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")

    app.mount("/static", StaticFiles(directory=str(settings.FRONTEND_DIR)), name="static")

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/", tags=["Frontend"], include_in_schema=False)
    async def serve_index():
        index_file = settings.FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Food Freshness Platform API is running. Access /docs for interactive Swagger UI."}

    page_names = [
        "index.html",
        "login.html",
        "register.html",
        "dashboard.html",
        "inventory.html",
        "add-food.html",
        "food-details.html",
        "profile.html",
        "executive-dashboard.html",
        "reports.html",
        "retailer-dashboard.html",
        "dashboard-inspector.html",
        "admin-dashboard.html",
        "warehouse-dashboard.html",
    ]


    for page in page_names:
        def make_handler(p_name):
            async def page_handler():
                target = settings.FRONTEND_DIR / p_name
                if target.exists():
                    return FileResponse(target)
                return JSONResponse(status_code=404, content={"detail": f"{p_name} not found"})
            return page_handler

        app.add_api_route(f"/{page}", make_handler(page), methods=["GET"], tags=["Frontend"], include_in_schema=False)
        clean_name = page.replace(".html", "")
        if clean_name != "index":
            app.add_api_route(f"/{clean_name}", make_handler(page), methods=["GET"], tags=["Frontend"], include_in_schema=False)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG, reload_dirs=[str(settings.BACKEND_DIR)])
