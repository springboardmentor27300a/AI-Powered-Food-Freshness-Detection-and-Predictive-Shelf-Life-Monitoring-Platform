"""Application Launcher for Food Freshness Platform.

Runs the FastAPI Uvicorn development server with optimized file watchers
that ignore .venv and OneDrive synchronization noise.
"""
from pathlib import Path
import sys
import uvicorn
from backend.app.config import BACKEND_DIR, settings

if __name__ == "__main__":
    print(f"Starting {settings.PROJECT_NAME} on http://{settings.HOST}:{settings.PORT}")
    print(f"Monitoring code changes in: {BACKEND_DIR}")
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        reload_dirs=[str(BACKEND_DIR)],
    )
