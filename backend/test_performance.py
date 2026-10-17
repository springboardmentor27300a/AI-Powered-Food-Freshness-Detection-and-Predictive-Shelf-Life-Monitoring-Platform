"""
FreshSense AI - Automated Performance & Latency Benchmark Suite
Measures round-trip response times across AI inference, storage telemetry,
inventory CRUD, analytical aggregations, and document export engines.
"""

import os
import sys
import time
import requests
from pathlib import Path

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8001")
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"

def benchmark_endpoint(name, func, runs=3, max_allowed_sec=2.0):
    durations = []
    result = None
    for i in range(runs):
        start = time.perf_counter()
        result = func()
        elapsed = time.perf_counter() - start
        durations.append(elapsed)

    avg_ms = (sum(durations) / len(durations)) * 1000
    min_ms = min(durations) * 1000
    max_ms = max(durations) * 1000

    status = "PASS" if (avg_ms / 1000.0) <= max_allowed_sec else "WARN"
    print(f"[{status}] {name:32} | Avg: {avg_ms:6.1f}ms | Min: {min_ms:6.1f}ms | Max: {max_ms:6.1f}ms | Limit: {max_allowed_sec * 1000:.0f}ms")
    return avg_ms, result

def run_benchmarks():
    print("=" * 75)
    print("FRESHSENSE AI - PERFORMANCE & LATENCY BENCHMARK SUITE")
    print(f"Target Backend: {BACKEND_URL}")
    print("=" * 75)

    # 1. Health Endpoint
    benchmark_endpoint("GET /health", lambda: requests.get(f"{BACKEND_URL}/health"), runs=5, max_allowed_sec=0.2)

    # 2. Statistics Endpoint
    benchmark_endpoint("GET /statistics", lambda: requests.get(f"{BACKEND_URL}/statistics"), runs=3, max_allowed_sec=0.5)

    # 3. Inventory Endpoint
    benchmark_endpoint("GET /inventory", lambda: requests.get(f"{BACKEND_URL}/inventory"), runs=3, max_allowed_sec=0.5)

    # 4. Storage Analysis Endpoint
    storage_payload = {
        "category": "Fruits",
        "temperature": 4.0,
        "humidity": 85.0,
        "air_circulation": "Good",
        "light_exposure": "Low"
    }
    benchmark_endpoint("POST /storage-analysis", lambda: requests.post(f"{BACKEND_URL}/storage-analysis", json=storage_payload), runs=3, max_allowed_sec=0.3)

    # 5. Shelf-Life Estimation Endpoint
    shelf_payload = {
        "category": "Dairy",
        "freshness_score": 88.0,
        "temperature": 3.5,
        "humidity": 70.0
    }
    benchmark_endpoint("POST /shelf-life", lambda: requests.post(f"{BACKEND_URL}/shelf-life", json=shelf_payload), runs=3, max_allowed_sec=0.3)

    # 6. Admin Analytics Endpoint
    benchmark_endpoint("GET /admin/analytics", lambda: requests.get(f"{BACKEND_URL}/admin/analytics"), runs=3, max_allowed_sec=0.5)

    # 7. Excel Report Export (OpenPyXL generation)
    benchmark_endpoint("GET /reports/export-excel", lambda: requests.get(f"{BACKEND_URL}/reports/export-excel"), runs=3, max_allowed_sec=1.5)

    # 8. PDF Report Export (ReportLab generation)
    benchmark_endpoint("GET /reports/export-pdf", lambda: requests.get(f"{BACKEND_URL}/reports/export-pdf"), runs=3, max_allowed_sec=1.5)

    # 9. Neural Inference & Full CV Pipeline Benchmark
    fresh_sample = next((DATASET_DIR / "fresh").glob("*.jpg"), None)
    if fresh_sample and fresh_sample.exists():
        with open(fresh_sample, "rb") as f:
            sample_bytes = f.read()

        def run_prediction():
            return requests.post(
                f"{BACKEND_URL}/predict",
                files={"file": ("test_sample.jpg", sample_bytes, "image/jpeg")},
                data={"category": "Fruits", "temperature": 4.0, "humidity": 85.0}
            )

        print("-" * 75)
        print("Benchmarking Neural Network & Computer Vision Pipeline (MobileNetV2)...")
        # Warmup
        run_prediction()
        # Benchmark
        benchmark_endpoint("POST /predict (AI Pipeline)", run_prediction, runs=3, max_allowed_sec=2.0)
    else:
        print("[SKIP] No dataset sample image found for /predict benchmark")

    print("=" * 75)
    print("ALL PERFORMANCE BENCHMARKS EXECUTED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    run_benchmarks()
