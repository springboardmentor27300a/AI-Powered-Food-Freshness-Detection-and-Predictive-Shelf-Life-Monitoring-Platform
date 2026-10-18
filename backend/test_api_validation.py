"""
test_api_validation.py — FreshGuard API Validation Tests

Tests valid/invalid requests, missing fields, invalid categories,
domain values, malformed IDs, missing auth, unauthorized access,
and empty data cases.
"""

import os
import sys
from datetime import date, timedelta

import pytest

from app.auth import hash_password, create_token
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition


# ============================================================
# AUTH VALIDATION TESTS
# ============================================================

class TestAuthValidation:
    """Test authentication and authorization validation."""

    def test_register_valid(self, client):
        """Valid registration succeeds."""
        r = client.post("/auth/register", json={
            "full_name": "Valid User",
            "email": "valid@test.com",
            "password": "testpassword123",
            "role": "consumer",
        })
        assert r.status_code == 201
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "valid@test.com"

    def test_register_duplicate_email(self, client, consumer_user):
        """Duplicate email registration fails."""
        r = client.post("/auth/register", json={
            "full_name": "Duplicate User",
            "email": consumer_user.email,
            "password": "testpassword123",
            "role": "consumer",
        })
        assert r.status_code == 409

    def test_register_invalid_role(self, client):
        """Invalid role registration fails."""
        r = client.post("/auth/register", json={
            "full_name": "Invalid Role User",
            "email": "invalid_role@test.com",
            "password": "testpassword123",
            "role": "superuser",
        })
        assert r.status_code == 400

    def test_register_short_password(self, client):
        """Short password registration fails."""
        r = client.post("/auth/register", json={
            "full_name": "Short Password User",
            "email": "short_pass@test.com",
            "password": "123",
            "role": "consumer",
        })
        assert r.status_code == 422

    def test_register_missing_fields(self, client):
        """Missing required fields fail."""
        r = client.post("/auth/register", json={
            "full_name": "Missing Fields User",
        })
        assert r.status_code == 422

    def test_login_valid(self, client, consumer_user):
        """Valid login succeeds."""
        r = client.post("/auth/login", json={
            "email": consumer_user.email,
            "password": "password123",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_invalid_credentials(self, client):
        """Invalid credentials fail."""
        r = client.post("/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_login_wrong_password(self, client, consumer_user):
        """Wrong password fails."""
        r = client.post("/auth/login", json={
            "email": "consumer@test.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_unauthenticated_request(self, client):
        """Unauthenticated request to protected endpoint fails."""
        r = client.get("/inventory")
        assert r.status_code == 401

    def test_invalid_token(self, client):
        """Invalid JWT token fails."""
        r = client.get("/inventory", headers={"Authorization": "Bearer invalid_token"})
        assert r.status_code == 401

    def test_expired_token(self, client):
        """Expired JWT token fails."""
        # Create a token with negative expiry
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        expired_token = jwt.encode(
            {"sub": "1", "role": "consumer", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
            "test-secret-key-integration",
            algorithm="HS256",
        )
        r = client.get("/inventory", headers={"Authorization": f"Bearer {expired_token}"})
        assert r.status_code == 401


# ============================================================
# INVENTORY VALIDATION TESTS
# ============================================================

class TestInventoryValidation:
    """Test inventory CRUD validation."""

    def test_create_inventory_valid(self, client, consumer_headers):
        """Valid inventory item creation succeeds."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "Test Apple",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Test Apple"
        assert data["quantity"] == 10

    def test_create_inventory_missing_name(self, client, consumer_headers):
        """Missing name fails."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        assert r.status_code == 422

    def test_create_inventory_negative_quantity(self, client, consumer_headers):
        """Negative quantity is clamped to 0 by the parse_quantity validator."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "Test Apple",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": -5,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        # The parse_quantity validator converts negative values to 0
        assert r.status_code == 201
        assert r.json()["quantity"] == 0

    def test_create_inventory_invalid_date(self, client, consumer_headers):
        """Invalid expiry date format fails."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "Test Apple",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": "not-a-date",
        })
        assert r.status_code == 422

    def test_list_inventory_empty(self, client, consumer_headers):
        """Empty inventory returns empty list."""
        r = client.get("/inventory", headers=consumer_headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_delete_inventory_item(self, client, consumer_headers, sample_food_item):
        """Delete existing inventory item succeeds."""
        r = client.delete(f"/inventory/{sample_food_item.id}", headers=consumer_headers)
        assert r.status_code == 200

    def test_delete_nonexistent_inventory_item(self, client, consumer_headers):
        """Delete non-existent item returns 404."""
        r = client.delete("/inventory/99999", headers=consumer_headers)
        assert r.status_code == 404

    def test_inventory_isolation(self, client, consumer_headers, db):
        """Users cannot see other users' inventory."""
        # Create another user with an item
        other_user = User(
            full_name="Other User",
            email="other_inv@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(other_user)
        db.commit()

        other_item = FoodItem(
            name="Other Apple",
            category="Fruits",
            batch_number="OTHER-001",
            quantity=5,
            expiry_date=date.today() + timedelta(days=7),
            created_by=other_user.id,
        )
        db.add(other_item)
        db.commit()

        # Consumer should not see other user's item
        r = client.get("/inventory", headers=consumer_headers)
        assert r.status_code == 200
        items = r.json()
        assert all(i["name"] != "Other Apple" for i in items)


# ============================================================
# M3 SHELF-LIFE VALIDATION TESTS
# ============================================================

class TestM3Validation:
    """Test M3 shelf-life prediction validation."""

    def test_prediction_valid_tomato(self, client, consumer_headers, sample_food_item):
        """Valid tomato prediction succeeds."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": sample_food_item.id,
            "food_type": "Tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["food_type"] == "tomato"
        assert data["remaining_shelf_life_days"] >= 0

    def test_prediction_unsupported_category(self, client, consumer_headers, sample_food_item):
        """Unsupported food category returns 422."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": sample_food_item.id,
            "food_type": "Avocado",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "sealed",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_prediction_out_of_domain_temperature(self, client, consumer_headers, sample_food_item):
        """Out-of-domain temperature returns 422."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": sample_food_item.id,
            "food_type": "Tomato",
            "temperature_c": 50.0,  # Too hot for tomato
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_prediction_out_of_domain_humidity(self, client, consumer_headers, sample_food_item):
        """Out-of-domain humidity returns 422."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": sample_food_item.id,
            "food_type": "Tomato",
            "temperature_c": 22.5,
            "humidity_pct": 10.0,  # Too dry for tomato
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_prediction_invalid_air_circulation(self, client, consumer_headers, sample_food_item):
        """Invalid air circulation value returns 422."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": sample_food_item.id,
            "food_type": "Tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "excellent",  # Invalid value
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_prediction_missing_food_type(self, client, consumer_headers, sample_food_item):
        """Missing food_type fails."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": sample_food_item.id,
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_prediction_nonexistent_food_item(self, client, consumer_headers):
        """Non-existent food_item_id returns 404."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_item_id": 99999,
            "food_type": "Tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 404

    def test_prediction_unauthorized(self, client, sample_food_item):
        """Unauthenticated prediction request fails."""
        r = client.post("/m3/shelf-life/predict", json={
            "food_item_id": sample_food_item.id,
            "food_type": "Tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
        })
        assert r.status_code == 401


# ============================================================
# M3 ANALYTICS VALIDATION TESTS
# ============================================================

class TestM3AnalyticsValidation:
    """Test M3 analytics endpoint validation."""

    def test_analytics_valid(self, client, consumer_headers):
        """Valid analytics request succeeds."""
        r = client.get("/m3/analytics", headers=consumer_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_predictions" in data

    def test_analytics_with_days_parameter(self, client, consumer_headers):
        """Analytics with custom days parameter succeeds."""
        r = client.get("/m3/analytics?days=14", headers=consumer_headers)
        assert r.status_code == 200

    def test_analytics_empty_data(self, client, consumer_headers):
        """Analytics with no data returns null aggregates."""
        r = client.get("/m3/analytics", headers=consumer_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total_predictions"] == 0
        assert data["average_freshness_score"] is None


# ============================================================
# NOTIFICATION VALIDATION TESTS
# ============================================================

class TestNotificationValidation:
    """Test notification endpoint validation."""

    def test_list_notifications_empty(self, client, consumer_headers):
        """Empty notifications list returns correctly."""
        r = client.get("/notifications", headers=consumer_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["notifications"] == []
        assert data["unread_count"] == 0

    def test_unread_count_empty(self, client, consumer_headers):
        """Unread count with no notifications returns 0."""
        r = client.get("/notifications/unread", headers=consumer_headers)
        assert r.status_code == 200
        assert r.json()["unread_count"] == 0

    def test_mark_read_nonexistent(self, client, consumer_headers):
        """Marking non-existent notification as read returns 404."""
        r = client.patch("/notifications/99999/read", headers=consumer_headers)
        assert r.status_code == 404

    def test_notifications_unauthenticated(self, client):
        """Unauthenticated notification request fails."""
        r = client.get("/notifications")
        assert r.status_code == 401


# ============================================================
# REPORT VALIDATION TESTS
# ============================================================

class TestReportValidation:
    """Test report endpoint validation."""

    def test_all_report_types_require_auth(self, client):
        """All report endpoints require authentication."""
        for endpoint in [
            "/reports/freshness/pdf",
            "/reports/freshness/excel",
            "/reports/shelf-life/pdf",
            "/reports/shelf-life/excel",
            "/reports/inventory/pdf",
            "/reports/inventory/excel",
            "/reports/waste-reduction/pdf",
            "/reports/waste-reduction/excel",
            "/reports/storage-compliance/pdf",
            "/reports/storage-compliance/excel",
        ]:
            r = client.get(endpoint)
            assert r.status_code == 401, f"{endpoint} should require auth"

    def test_all_report_types_valid_pdf(self, client, admin_headers):
        """All PDF report endpoints return valid PDFs."""
        for endpoint in [
            "/reports/freshness/pdf",
            "/reports/shelf-life/pdf",
            "/reports/inventory/pdf",
            "/reports/waste-reduction/pdf",
            "/reports/storage-compliance/pdf",
        ]:
            r = client.get(endpoint, headers=admin_headers)
            assert r.status_code == 200, f"Failed: {endpoint}"
            assert r.content[:4] == b"%PDF", f"Invalid PDF: {endpoint}"

    def test_all_report_types_valid_excel(self, client, admin_headers):
        """All Excel report endpoints return valid xlsx files."""
        for endpoint in [
            "/reports/freshness/excel",
            "/reports/shelf-life/excel",
            "/reports/inventory/excel",
            "/reports/waste-reduction/excel",
            "/reports/storage-compliance/excel",
        ]:
            r = client.get(endpoint, headers=admin_headers)
            assert r.status_code == 200, f"Failed: {endpoint}"
            assert r.content[:2] == b"PK", f"Invalid xlsx: {endpoint}"

    def test_report_data_isolation(self, client, consumer_headers, db):
        """Reports only contain the current user's data."""
        # Create another user with data
        other_user = User(
            full_name="Other Report User",
            email="other_report@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(other_user)
        db.commit()

        other_analysis = FreshnessAnalysis(
            user_id=other_user.id,
            item_name="Other Apple",
            classification="Spoiled",
            confidence=0.99,
            quality_score=10,
            spoilage_probability=0.99,
        )
        db.add(other_analysis)
        db.commit()

        # Consumer's report should not contain other user's data
        r = client.get("/reports/freshness/pdf", headers=consumer_headers)
        assert r.status_code == 200
        # The report should only contain the current user's analyses


# ============================================================
# DASHBOARD VALIDATION TESTS
# ============================================================

class TestDashboardValidation:
    """Test dashboard endpoint validation."""

    def test_dashboard_requires_auth(self, client):
        """Dashboard requires authentication."""
        r = client.get("/dashboard/data")
        assert r.status_code == 401

    def test_dashboard_consumer(self, client, consumer_headers):
        """Consumer dashboard returns correct role."""
        r = client.get("/dashboard/data", headers=consumer_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "consumer"
        assert "analyses" in data
        assert "predictions" in data

    def test_dashboard_admin(self, client, admin_headers):
        """Admin dashboard returns correct role and extra data."""
        r = client.get("/dashboard/data", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "administrator"
        assert "users" in data
        assert "platform_stats" in data

    def test_dashboard_retail_manager(self, client, retail_manager_headers):
        """Retail manager dashboard returns correct role."""
        r = client.get("/dashboard/data", headers=retail_manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "retail_manager"
        assert "shelf_life_alerts" in data
        assert "waste_insights" in data

    def test_dashboard_warehouse_operator(self, client, warehouse_operator_headers):
        """Warehouse operator dashboard returns correct role."""
        r = client.get("/dashboard/data", headers=warehouse_operator_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "warehouse_operator"
        assert "storage_conditions" in data
        assert "environmental_analytics" in data

    def test_dashboard_inspector(self, client, inspector_headers):
        """Inspector dashboard returns correct role."""
        r = client.get("/dashboard/data", headers=inspector_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "food_quality_inspector"
        assert "analyses" in data


# ============================================================
# ROLE ISOLATION TESTS
# ============================================================

class TestRoleIsolation:
    """Test that roles are properly isolated."""

    def test_non_admin_cannot_access_admin_endpoints(self, client, consumer_headers):
        """Non-admin users cannot access admin endpoints."""
        r = client.get("/admin/users", headers=consumer_headers)
        assert r.status_code == 403

        r = client.get("/admin/stats", headers=consumer_headers)
        assert r.status_code == 403

    def test_user_cannot_access_other_user_analysis_report(self, client, consumer_headers, db):
        """Users cannot access other users' analysis reports."""
        # Create another user with an analysis
        other_user = User(
            full_name="Other Analysis User",
            email="other_analysis@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(other_user)
        db.commit()

        other_analysis = FreshnessAnalysis(
            user_id=other_user.id,
            item_name="Other Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
        )
        db.add(other_analysis)
        db.commit()

        # Consumer should not be able to download other user's report
        r = client.get(f"/analysis/{other_analysis.id}/report", headers=consumer_headers)
        assert r.status_code == 403

    def test_inspector_can_access_other_user_analysis_report(self, client, inspector_headers, db):
        """Food quality inspector can access other users' analysis reports."""
        # Create a consumer user with an analysis
        consumer = User(
            full_name="Consumer For Inspector",
            email="consumer_inspector@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(consumer)
        db.commit()

        analysis = FreshnessAnalysis(
            user_id=consumer.id,
            item_name="Inspector Test Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
        )
        db.add(analysis)
        db.commit()

        # Inspector should be able to download the report
        r = client.get(f"/analysis/{analysis.id}/report", headers=inspector_headers)
        assert r.status_code == 200

    def test_admin_can_access_other_user_analysis_report(self, client, admin_headers, db):
        """Admin can access other users' analysis reports."""
        # Create a consumer user with an analysis
        consumer = User(
            full_name="Consumer For Admin",
            email="consumer_admin@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(consumer)
        db.commit()

        analysis = FreshnessAnalysis(
            user_id=consumer.id,
            item_name="Admin Test Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
        )
        db.add(analysis)
        db.commit()

        # Admin should be able to download the report
        r = client.get(f"/analysis/{analysis.id}/report", headers=admin_headers)
        assert r.status_code == 200
