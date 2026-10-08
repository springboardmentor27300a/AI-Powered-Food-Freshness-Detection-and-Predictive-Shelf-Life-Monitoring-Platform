# Backend Dockerfile - Food Freshness Monitoring Platform
# Production container for the existing FastAPI application.

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# System libraries needed by OpenCV, Pillow and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies.
# torch/torchvision are installed CPU-only first (the app runs inference with
# map_location="cpu"); the resolver falls back to PyPI if the CPU index is
# unavailable, and requirements.txt is always satisfied afterwards.
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    (pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision || \
     echo "PyTorch CPU index unavailable - continuing with PyPI") && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code (see .dockerignore for excluded local state)
COPY . /app/

# Expose FastAPI port
EXPOSE 8000

# Health check against the existing /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

# Entrypoint waits for the database, creates tables, seeds demo data, then
# starts uvicorn with the existing application entry point.
CMD ["python", "docker_entrypoint.py"]
