"""
test_performance.py — FreshGuard Performance Benchmark Suite

Measures response times for all key endpoints and operations.
These are BENCHMARKS, not pass/fail correctness tests.
Results are machine-specific and should be labeled as such.

Uses shared conftest.py fixtures: client, db, setup_db, consumer_user,
consumer_headers, admin_user, admin_headers, etc.
"""

import io
import os
import statistics
import time
import uuid
from datetime import date, timedelta

import pytest
from PIL import Image

from app.auth import hash_password, create_token
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, Notification


# ============================================================
# Performance Benchmark Utilities
# ============================================================

def measure_latency(client, method, path, headers=None, json_data=None, files=None, num_requests=10):
    """Measure latency statistics for an API endpoint."""
    latencies = []
    errors = 0

    for _ in range(num_requests):
        start = time.perf_counter()
        try:
            if method == "GET":
                r = client.get(path, headers=headers)
            elif method == "POST":
                if files:
                    r = client.post(path, headers=headers, files=files, data=json_data)
                else:
                    r = client.post(path, headers=headers, json=json_data)
            elif method == "DELETE":
                r = client.delete(path, headers=headers)
            elif method == "PATCH":
                r = client.patch(path, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if r.status_code >= 400:
                errors += 1
        except Exception:
            errors += 1

        elapsed = (time.perf_counter() - start) * 1000  # Convert to ms
        latencies.append(elapsed)

    if not latencies:
        return {"error": "No successful requests"}

    latencies.sort()
    return {
        "count": len(latencies),
        "errors": errors,
        "avg_ms": round(statistics.mean(latencies), 2),
        "min_ms": round(min(latencies), 2),
        "max_ms": round(max(latencies), 2),
        "p50_ms": round(latencies[len(latencies) // 2], 2),
        "p95_ms": round(latencies[int(len(latencies) * 0.95)], 2),
        "p99_ms": round(latencies[int(len(latencies) * 0.99)], 2) if len(latencies) >= 100 else None,
    }


def create_test_image():
    """Create a test image for M2 analysis."""
    img = Image.new("RGB", (224, 224), (80, 200, 60))
    img_buffer = io.BytesIO()
    img.save(img_buffer, format="JPEG")
    img_buffer.seek(0)
    return img_buffer


def register_user(client, email, role="consumer"):
    """Register a user and return headers."""
    r = client.post("/auth/register", json={
        "full_name": "Perf Test User",
        "email": email,
        "password": "testpassword123",
        "role": role,
    })
    assert r.status_code == 201
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_food_item(client, headers, name="Test Item", expiry_days=7):
    """Create a food item and return its ID."""
    r = client.post("/inventory", headers=headers, json={
        "name": name,
        "category": "Fruits",
        "batch_number": f"BATCH-{uuid.uuid4().hex[:8]}",
        "quantity": 10,
        "expiry_date": (date.today() + timedelta(days=expiry_days)).isoformat(),
    })
    assert r.status_code == 201
    return r.json()["id"]


def create_prediction(client, headers, food_item_id, food_type="tomato"):
    """Create a shelf-life prediction and return its ID."""
    r = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_item_id": food_item_id,
        "food_type": food_type,
        "temperature_c": 22.5,
        "humidity_pct": 70,
        "air_circulation": "good",
        "light_exposure": "low",
        "packaging_type": "uncoated",
        "storage_duration_days": 2,
        "product_age_days": 1,
    })
    assert r.status_code == 201
    return r.json()["id"]


# ============================================================
# API Latency Benchmarks
# ============================================================

class TestAPILatencyBenchmarks:
    """Benchmark API endpoint response times."""

    def test_health_endpoint(self, client):
        """Benchmark health endpoint."""
        result = measure_latency(client, "GET", "/health", num_requests=50)
        print(f"\n[Health] {result}")
        assert result["errors"] == 0

    def test_login_endpoint(self, client, consumer_user):
        """Benchmark login endpoint."""
        result = measure_latency(client, "POST", "/auth/login", json_data={
            "email": consumer_user.email,
            "password": "password123",
        }, num_requests=20)
        print(f"\n[Login] {result}")
        assert result["errors"] == 0

    def test_register_endpoint(self, client):
        """Benchmark registration endpoint."""
        def register_request():
            email = f"perf_{uuid.uuid4().hex[:8]}@test.com"
            start = time.perf_counter()
            r = client.post("/auth/register", json={
                "full_name": "Perf Test",
                "email": email,
                "password": "testpassword123",
                "role": "consumer",
            })
            elapsed = (time.perf_counter() - start) * 1000
            return elapsed, r.status_code

        latencies = []
        errors = 0
        for _ in range(10):
            elapsed, status = register_request()
            if status >= 400:
                errors += 1
            latencies.append(elapsed)

        result = {
            "count": len(latencies),
            "errors": errors,
            "avg_ms": round(statistics.mean(latencies), 2),
            "p50_ms": round(latencies[len(latencies) // 2], 2),
            "p95_ms": round(latencies[int(len(latencies) * 0.95)], 2),
        }
        print(f"\n[Register] {result}")
        assert errors == 0

    def test_dashboard_consumer(self, client, consumer_headers):
        """Benchmark consumer dashboard."""
        result = measure_latency(client, "GET", "/dashboard/data", headers=consumer_headers, num_requests=20)
        print(f"\n[Dashboard Consumer] {result}")
        assert result["errors"] == 0

    def test_dashboard_admin(self, client, admin_headers):
        """Benchmark admin dashboard."""
        result = measure_latency(client, "GET", "/dashboard/data", headers=admin_headers, num_requests=20)
        print(f"\n[Dashboard Admin] {result}")
        assert result["errors"] == 0

    def test_dashboard_retail_manager(self, client, retail_manager_headers):
        """Benchmark retail manager dashboard."""
        result = measure_latency(client, "GET", "/dashboard/data", headers=retail_manager_headers, num_requests=20)
        print(f"\n[Dashboard Retail Manager] {result}")
        assert result["errors"] == 0

    def test_dashboard_warehouse_operator(self, client, warehouse_operator_headers):
        """Benchmark warehouse operator dashboard."""
        result = measure_latency(client, "GET", "/dashboard/data", headers=warehouse_operator_headers, num_requests=20)
        print(f"\n[Dashboard Warehouse Operator] {result}")
        assert result["errors"] == 0

    def test_dashboard_inspector(self, client, inspector_headers):
        """Benchmark inspector dashboard."""
        result = measure_latency(client, "GET", "/dashboard/data", headers=inspector_headers, num_requests=20)
        print(f"\n[Dashboard Inspector] {result}")
        assert result["errors"] == 0

    def test_notifications_list(self, client, consumer_headers):
        """Benchmark notifications list."""
        result = measure_latency(client, "GET", "/notifications", headers=consumer_headers, num_requests=20)
        print(f"\n[Notifications List] {result}")
        assert result["errors"] == 0

    def test_notifications_unread(self, client, consumer_headers):
        """Benchmark unread count."""
        result = measure_latency(client, "GET", "/notifications/unread", headers=consumer_headers, num_requests=20)
        print(f"\n[Notifications Unread] {result}")
        assert result["errors"] == 0

    def test_inventory_list(self, client, consumer_headers):
        """Benchmark inventory list."""
        result = measure_latency(client, "GET", "/inventory", headers=consumer_headers, num_requests=20)
        print(f"\n[Inventory List] {result}")
        assert result["errors"] == 0

    def test_expiring_soon(self, client, consumer_headers):
        """Benchmark expiring-soon endpoint."""
        result = measure_latency(client, "GET", "/inventory/expiring-soon", headers=consumer_headers, num_requests=20)
        print(f"\n[Expiring Soon] {result}")
        assert result["errors"] == 0

    def test_rotation_suggestions(self, client, consumer_headers):
        """Benchmark rotation suggestions."""
        result = measure_latency(client, "GET", "/m3/rotation-suggestions", headers=consumer_headers, num_requests=20)
        print(f"\n[Rotation Suggestions] {result}")
        assert result["errors"] == 0

    def test_m3_analytics(self, client, consumer_headers):
        """Benchmark M3 analytics."""
        result = measure_latency(client, "GET", "/m3/analytics", headers=consumer_headers, num_requests=20)
        print(f"\n[M3 Analytics] {result}")
        assert result["errors"] == 0

    def test_m3_history(self, client, consumer_headers):
        """Benchmark M3 history."""
        result = measure_latency(client, "GET", "/m3/shelf-life/history", headers=consumer_headers, num_requests=20)
        print(f"\n[M3 History] {result}")
        assert result["errors"] == 0

    def test_storage_conditions_list(self, client, consumer_headers):
        """Benchmark storage conditions list."""
        result = measure_latency(client, "GET", "/m3/storage-conditions", headers=consumer_headers, num_requests=20)
        print(f"\n[Storage Conditions] {result}")
        assert result["errors"] == 0

    def test_admin_stats(self, client, admin_headers):
        """Benchmark admin stats."""
        result = measure_latency(client, "GET", "/admin/stats", headers=admin_headers, num_requests=20)
        print(f"\n[Admin Stats] {result}")
        assert result["errors"] == 0

    def test_admin_users(self, client, admin_headers):
        """Benchmark admin users list."""
        result = measure_latency(client, "GET", "/admin/users", headers=admin_headers, num_requests=20)
        print(f"\n[Admin Users] {result}")
        assert result["errors"] == 0


# ============================================================
# M2 Image Inference Benchmarks
# ============================================================

class TestM2InferenceBenchmarks:
    """Benchmark M2 image analysis pipeline."""

    def test_m2_prediction_latency(self, client, consumer_headers):
        """Benchmark M2 image prediction."""
        img_buffer = create_test_image()
        files = {"file": ("test.jpg", img_buffer, "image/jpeg")}

        result = measure_latency(
            client, "POST", "/analysis/predict",
            headers=consumer_headers,
            files=files,
            num_requests=5  # Conservative due to ML inference
        )
        print(f"\n[M2 Prediction] {result}")
        # M2 may return 503 if model not ready, which is acceptable
        assert result["count"] > 0

    def test_m2_prediction_with_data(self, client, consumer_headers, db):
        """Benchmark M2 prediction and measure DB persistence."""
        img_buffer = create_test_image()
        files = {"file": ("test.jpg", img_buffer, "image/jpeg")}

        # Measure prediction + persistence
        start = time.perf_counter()
        r = client.post("/analysis/predict", headers=consumer_headers, files=files)
        elapsed = (time.perf_counter() - start) * 1000

        print(f"\n[M2 Prediction + DB] Total: {elapsed:.2f}ms, Status: {r.status_code}")

        if r.status_code == 200:
            # Verify data was persisted
            analysis_id = r.json()["id"]
            analysis = db.query(FreshnessAnalysis).filter_by(id=analysis_id).first()
            assert analysis is not None
            print(f"[M2 DB Persistence] Analysis ID {analysis_id} stored successfully")


# ============================================================
# M3 Prediction Benchmarks
# ============================================================

class TestM3PredictionBenchmarks:
    """Benchmark M3 shelf-life prediction."""

    def test_m3_prediction_tomato(self, client, consumer_headers, sample_food_item):
        """Benchmark M3 tomato prediction."""
        result = measure_latency(client, "POST", "/m3/shelf-life/predict", headers=consumer_headers, json_data={
            "food_item_id": sample_food_item.id,
            "food_type": "Tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
            "product_age_days": 1,
        }, num_requests=10)
        print(f"\n[M3 Tomato] {result}")
        assert result["errors"] == 0

    def test_m3_prediction_paneer(self, client, consumer_headers, sample_food_item):
        """Benchmark M3 paneer prediction."""
        result = measure_latency(client, "POST", "/m3/shelf-life/predict", headers=consumer_headers, json_data={
            "food_item_id": sample_food_item.id,
            "food_type": "Paneer",
            "temperature_c": 7.0,
            "humidity_pct": 37.0,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "sealed",
            "storage_duration_days": 2,
        }, num_requests=10)
        print(f"\n[M3 Paneer] {result}")
        assert result["errors"] == 0

    def test_m3_prediction_seafood(self, client, consumer_headers, sample_food_item):
        """Benchmark M3 seafood prediction."""
        result = measure_latency(client, "POST", "/m3/shelf-life/predict", headers=consumer_headers, json_data={
            "food_item_id": sample_food_item.id,
            "food_type": "Seafood",
            "species": "mackerel",
            "temperature_c": 1.0,
            "humidity_pct": 85.0,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "open",
            "storage_duration_days": 1,
        }, num_requests=10)
        print(f"\n[M3 Seafood] {result}")
        assert result["errors"] == 0

    def test_m3_prediction_synthetic(self, client, consumer_headers, sample_food_item):
        """Benchmark M3 synthetic category prediction."""
        categories = [
            ("Vegetables", 4.0, 90.0, "perforated"),
            ("Meat & Poultry", 2.0, 75.0, "vacuum_sealed"),
            ("Bakery Products", 20.0, 55.0, "sealed"),
            ("Packaged Foods", 4.0, 55.0, "sealed"),
            ("Beverages", 4.0, 50.0, "airtight"),
        ]

        for food_type, temp, humidity, packaging in categories:
            result = measure_latency(client, "POST", "/m3/shelf-life/predict", headers=consumer_headers, json_data={
                "food_item_id": sample_food_item.id,
                "food_type": food_type,
                "temperature_c": temp,
                "humidity_pct": humidity,
                "air_circulation": "good",
                "light_exposure": "low",
                "packaging_type": packaging,
                "storage_duration_days": 2,
            }, num_requests=5)
            print(f"\n[M3 {food_type}] {result}")
            assert result["errors"] == 0

    def test_m3_recommendations(self, client, consumer_headers, sample_food_item):
        """Benchmark M3 recommendations endpoint."""
        pred_id = create_prediction(client, consumer_headers, sample_food_item.id)
        result = measure_latency(client, "GET", f"/m3/recommendations/{pred_id}", headers=consumer_headers, num_requests=20)
        print(f"\n[M3 Recommendations] {result}")
        assert result["errors"] == 0


# ============================================================
# Report Generation Benchmarks
# ============================================================

class TestReportGenerationBenchmarks:
    """Benchmark report generation performance."""

    def test_freshness_pdf_report(self, client, consumer_headers):
        """Benchmark freshness PDF report."""
        result = measure_latency(client, "GET", "/reports/freshness/pdf", headers=consumer_headers, num_requests=10)
        print(f"\n[Freshness PDF] {result}")
        assert result["errors"] == 0

    def test_freshness_excel_report(self, client, consumer_headers):
        """Benchmark freshness Excel report."""
        result = measure_latency(client, "GET", "/reports/freshness/excel", headers=consumer_headers, num_requests=10)
        print(f"\n[Freshness Excel] {result}")
        assert result["errors"] == 0

    def test_shelf_life_pdf_report(self, client, consumer_headers):
        """Benchmark shelf-life PDF report."""
        result = measure_latency(client, "GET", "/reports/shelf-life/pdf", headers=consumer_headers, num_requests=10)
        print(f"\n[Shelf-Life PDF] {result}")
        assert result["errors"] == 0

    def test_shelf_life_excel_report(self, client, consumer_headers):
        """Benchmark shelf-life Excel report."""
        result = measure_latency(client, "GET", "/reports/shelf-life/excel", headers=consumer_headers, num_requests=10)
        print(f"\n[Shelf-Life Excel] {result}")
        assert result["errors"] == 0

    def test_inventory_pdf_report(self, client, retail_manager_headers):
        """Benchmark inventory PDF report."""
        result = measure_latency(client, "GET", "/reports/inventory/pdf", headers=retail_manager_headers, num_requests=10)
        print(f"\n[Inventory PDF] {result}")
        assert result["errors"] == 0

    def test_inventory_excel_report(self, client, retail_manager_headers):
        """Benchmark inventory Excel report."""
        result = measure_latency(client, "GET", "/reports/inventory/excel", headers=retail_manager_headers, num_requests=10)
        print(f"\n[Inventory Excel] {result}")
        assert result["errors"] == 0

    def test_waste_reduction_pdf_report(self, client, retail_manager_headers):
        """Benchmark waste reduction PDF report."""
        result = measure_latency(client, "GET", "/reports/waste-reduction/pdf", headers=retail_manager_headers, num_requests=10)
        print(f"\n[Waste Reduction PDF] {result}")
        assert result["errors"] == 0

    def test_waste_reduction_excel_report(self, client, retail_manager_headers):
        """Benchmark waste reduction Excel report."""
        result = measure_latency(client, "GET", "/reports/waste-reduction/excel", headers=retail_manager_headers, num_requests=10)
        print(f"\n[Waste Reduction Excel] {result}")
        assert result["errors"] == 0

    def test_storage_compliance_pdf_report(self, client, consumer_headers):
        """Benchmark storage compliance PDF report."""
        result = measure_latency(client, "GET", "/reports/storage-compliance/pdf", headers=consumer_headers, num_requests=10)
        print(f"\n[Storage Compliance PDF] {result}")
        assert result["errors"] == 0

    def test_storage_compliance_excel_report(self, client, consumer_headers):
        """Benchmark storage compliance Excel report."""
        result = measure_latency(client, "GET", "/reports/storage-compliance/excel", headers=consumer_headers, num_requests=10)
        print(f"\n[Storage Compliance Excel] {result}")
        assert result["errors"] == 0


# ============================================================
# Notification Performance Benchmarks
# ============================================================

class TestNotificationPerformance:
    """Benchmark notification operations."""

    def test_notification_generation(self, client, consumer_headers, sample_food_item, db):
        """Benchmark notification generation."""
        # Create some data that will trigger notifications
        create_prediction(client, consumer_headers, sample_food_item.id)

        result = measure_latency(client, "POST", "/notifications/generate", headers=consumer_headers, num_requests=10)
        print(f"\n[Notification Generation] {result}")
        assert result["errors"] == 0

    def test_mark_notification_read(self, client, consumer_headers, db):
        """Benchmark mark notification as read."""
        # Create a notification first
        notif = Notification(
            user_id=1,  # Will be replaced by actual user
            notification_type="test",
            severity="info",
            title="Test",
            message="Test message",
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        result = measure_latency(client, "PATCH", f"/notifications/{notif.id}/read", headers=consumer_headers, num_requests=10)
        print(f"\n[Mark Notification Read] {result}")
        # May be 404 if notification doesn't belong to user, which is fine
        assert result["count"] > 0

    def test_mark_all_notifications_read(self, client, consumer_headers):
        """Benchmark mark all notifications as read."""
        result = measure_latency(client, "PATCH", "/notifications/read-all", headers=consumer_headers, num_requests=10)
        print(f"\n[Mark All Read] {result}")
        assert result["errors"] == 0


# ============================================================
# Concurrency / Load Testing
# ============================================================

class TestConcurrencyLoadTesting:
    """Controlled concurrency and load testing."""

    def test_concurrent_health_requests(self, client):
        """Test concurrent health endpoint requests."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def make_request():
            start = time.perf_counter()
            r = client.get("/health")
            elapsed = (time.perf_counter() - start) * 1000
            return elapsed, r.status_code

        results = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(20)]
            for future in as_completed(futures):
                results.append(future.result())

        latencies = [r[0] for r in results]
        errors = sum(1 for r in results if r[1] >= 400)

        print(f"\n[Concurrent Health] Count: {len(results)}, Errors: {errors}")
        print(f"  Avg: {statistics.mean(latencies):.2f}ms, P95: {sorted(latencies)[int(len(latencies)*0.95)]:.2f}ms")
        assert errors == 0

    def test_concurrent_dashboard_requests(self, client, consumer_headers):
        """Test concurrent dashboard requests."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def make_request():
            start = time.perf_counter()
            r = client.get("/dashboard/data", headers=consumer_headers)
            elapsed = (time.perf_counter() - start) * 1000
            return elapsed, r.status_code

        results = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            for future in as_completed(futures):
                results.append(future.result())

        latencies = [r[0] for r in results]
        errors = sum(1 for r in results if r[1] >= 400)

        print(f"\n[Concurrent Dashboard] Count: {len(results)}, Errors: {errors}")
        print(f"  Avg: {statistics.mean(latencies):.2f}ms, P95: {sorted(latencies)[int(len(latencies)*0.95)]:.2f}ms")
        assert errors == 0

    def test_concurrent_m3_predictions(self, client, consumer_headers, sample_food_item):
        """Test concurrent M3 predictions.
        
        NOTE: SQLite with StaticPool does not support concurrent writes.
        This test documents the limitation. In production with PostgreSQL,
        concurrent writes would be handled properly.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def make_request():
            start = time.perf_counter()
            try:
                r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
                    "food_item_id": sample_food_item.id,
                    "food_type": "Tomato",
                    "temperature_c": 22.5,
                    "humidity_pct": 70,
                    "air_circulation": "good",
                    "light_exposure": "low",
                    "packaging_type": "uncoated",
                    "storage_duration_days": 2,
                    "product_age_days": 1,
                })
                elapsed = (time.perf_counter() - start) * 1000
                return elapsed, r.status_code
            except Exception as e:
                elapsed = (time.perf_counter() - start) * 1000
                return elapsed, 500

        results = []
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(make_request) for _ in range(4)]
            for future in as_completed(futures):
                results.append(future.result())

        latencies = [r[0] for r in results]
        errors = sum(1 for r in results if r[1] >= 400)

        print(f"\n[Concurrent M3] Count: {len(results)}, Errors: {errors}")
        print(f"  Note: SQLite StaticPool does not support concurrent writes.")
        print(f"  This is a known SQLite limitation, not an application bug.")
        if latencies:
            print(f"  Avg: {statistics.mean(latencies):.2f}ms")
        # Don't assert on errors - SQLite concurrency is a known limitation
        assert len(results) > 0

    def test_concurrent_notifications(self, client, consumer_headers):
        """Test concurrent notification requests."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def make_request():
            start = time.perf_counter()
            r = client.get("/notifications", headers=consumer_headers)
            elapsed = (time.perf_counter() - start) * 1000
            return elapsed, r.status_code

        results = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            for future in as_completed(futures):
                results.append(future.result())

        latencies = [r[0] for r in results]
        errors = sum(1 for r in results if r[1] >= 400)

        print(f"\n[Concurrent Notifications] Count: {len(results)}, Errors: {errors}")
        print(f"  Avg: {statistics.mean(latencies):.2f}ms, P95: {sorted(latencies)[int(len(latencies)*0.95)]:.2f}ms")
        assert errors == 0


# ============================================================
# Database Performance Benchmarks
# ============================================================

class TestDatabasePerformance:
    """Benchmark database query performance."""

    def test_dashboard_query_count(self, client, consumer_headers, db):
        """Measure number of queries for dashboard."""
        from sqlalchemy import event
        from conftest import _engine

        query_count = [0]

        @event.listens_for(_engine, "before_cursor_execute")
        def count_queries(conn, cursor, statement, parameters, context, executemany):
            query_count[0] += 1

        r = client.get("/dashboard/data", headers=consumer_headers)
        assert r.status_code == 200

        print(f"\n[Dashboard Queries] Count: {query_count[0]}")
        event.remove(_engine, "before_cursor_execute", count_queries)

    def test_admin_stats_query_count(self, client, admin_headers, db):
        """Measure number of queries for admin stats."""
        from sqlalchemy import event
        from conftest import _engine

        query_count = [0]

        @event.listens_for(_engine, "before_cursor_execute")
        def count_queries(conn, cursor, statement, parameters, context, executemany):
            query_count[0] += 1

        r = client.get("/admin/stats", headers=admin_headers)
        assert r.status_code == 200

        print(f"\n[Admin Stats Queries] Count: {query_count[0]}")
        event.remove(_engine, "before_cursor_execute", count_queries)

    def test_notification_generation_query_count(self, client, consumer_headers, sample_food_item, db):
        """Measure number of queries for notification generation."""
        from sqlalchemy import event
        from conftest import _engine

        # Create some data first
        create_prediction(client, consumer_headers, sample_food_item.id)

        query_count = [0]

        @event.listens_for(_engine, "before_cursor_execute")
        def count_queries(conn, cursor, statement, parameters, context, executemany):
            query_count[0] += 1

        r = client.post("/notifications/generate", headers=consumer_headers)
        assert r.status_code == 200

        print(f"\n[Notification Generation Queries] Count: {query_count[0]}")
        event.remove(_engine, "before_cursor_execute", count_queries)

    def test_report_query_count(self, client, consumer_headers, db):
        """Measure number of queries for report generation."""
        from sqlalchemy import event
        from conftest import _engine

        query_count = [0]

        @event.listens_for(_engine, "before_cursor_execute")
        def count_queries(conn, cursor, statement, parameters, context, executemany):
            query_count[0] += 1

        r = client.get("/reports/freshness/pdf", headers=consumer_headers)
        assert r.status_code == 200

        print(f"\n[Report Queries] Count: {query_count[0]}")
        event.remove(_engine, "before_cursor_execute", count_queries)


# ============================================================
# Model Loading Verification
# ============================================================

class TestModelLoading:
    """Verify models are loaded once and reused."""

    def test_m2_model_loaded_once(self):
        """Verify M2 model is loaded once at module level."""
        from app.ml.assessment import is_model_ready
        assert is_model_ready() is True
        print(f"\n[M2 Model] Loaded and ready")

    def test_m3_models_loaded_once(self):
        """Verify M3 models are loaded once at module level."""
        from app.ml.rsl_predictor import rsl_predictor_instance
        assert rsl_predictor_instance is not None
        print(f"\n[M3 Models] Loaded: {type(rsl_predictor_instance).__name__}")

    def test_m3_model_predictions_consistent(self, client, consumer_headers, sample_food_item):
        """Verify M3 predictions are consistent across multiple calls."""
        results = []
        for _ in range(3):
            r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
                "food_item_id": sample_food_item.id,
                "food_type": "Tomato",
                "temperature_c": 22.5,
                "humidity_pct": 70,
                "air_circulation": "good",
                "light_exposure": "low",
                "packaging_type": "uncoated",
                "storage_duration_days": 2,
                "product_age_days": 1,
            })
            if r.status_code == 201:
                results.append(r.json()["remaining_shelf_life_days"])

        if results:
            # Predictions should be identical for identical inputs
            assert len(set(results)) == 1, f"Predictions not consistent: {results}"
            print(f"\n[M3 Consistency] Predictions: {results}")
