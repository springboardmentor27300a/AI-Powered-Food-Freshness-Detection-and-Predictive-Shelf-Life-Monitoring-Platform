# FreshGuard Backend Dockerfile
# Multi-stage build for production-ready container

# ============================================================
# Stage 1: Builder
# ============================================================
FROM python:3.10-slim AS builder

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (smaller image, faster build)
# Versions match the working FreshGuard environment (torch 2.1.1+cpu, torchvision 0.16.1+cpu)
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch==2.1.1 torchvision==0.16.1; \
    else \
      pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch==2.1.1+cpu torchvision==0.16.1+cpu; \
    fi

# Install remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================
# Stage 2: Production
# ============================================================
FROM python:3.10-slim AS production

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r freshguard && useradd -r -g freshguard freshguard

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source
COPY app ./app

# Copy Alembic migrations
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini

# Create directory for trained models
RUN mkdir -p /app/app/ml/saved_models && \
    chown -R freshguard:freshguard /app

# Switch to non-root user
USER freshguard

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run Alembic migrations then start production server (no reload)
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
