# Backend: FastAPI + TensorFlow + OpenCV + Motor
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# OpenCV runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt reportlab==4.2.5

# Model + application code
COPY ml/freshness_model.keras /app/ml/freshness_model.keras
COPY ml/ /app/ml/
COPY routes/ /app/routes/
COPY main.py models.py database.py dependencies.py /app/

# Persisted scan images survive container restarts via a mounted volume
RUN mkdir -p /app/uploads/scans
VOLUME ["/app/uploads"]

EXPOSE 8000

# Health check: TF model load can take ~20-30 s, hence a generous start_period
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -sf http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
