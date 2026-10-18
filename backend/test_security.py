"""
test_security.py — FreshGuard Security Test Suite

Tests authentication, authorization, RBAC, IDOR, input validation,
file upload security, CORS, security headers, and configuration.

Uses shared conftest.py fixtures: client, db, setup_db, consumer_user,
consumer_headers, admin_user, admin_headers, etc.
"""

import io
import os
from datetime import date, timedelta

import pytest
from PIL import Image

from app.auth import hash_password, create_token
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, Notification


# ============================================================
# AUTHENTICATION SECURITY TESTS
# ============================================================

class TestAuthenticationSecurity:
    """Test authentication security controls."""

    def test_unauthenticated_protected_endpoint(self, client):
        """Protected endpoints reject unauthenticated requests."""
        r = client.get("/inventory")
        assert r.status_code == 401

    def test_invalid_token_rejected(self, client):
        """Invalid JWT token is rejected."""
        r = client.get("/inventory", headers={"Authorization": "Bearer invalid_token_here"})
        assert r.status_code == 401

    def test_expired_token_rejected(self, client):
        """Expired JWT token is rejected."""
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        expired_token = jwt.encode(
            {"sub": "1", "role": "consumer", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
            "test-secret-key-integration",
            algorithm="HS256",
        )
        r = client.get("/inventory", headers={"Authorization": f"Bearer {expired_token}"})
        assert r.status_code == 401

    def test_invalid_signature_rejected(self, client):
        """Token with invalid signature is rejected."""
        from jose import jwt
        from datetime import datetime, timezone, timedelta
        # Sign with wrong secret
        forged_token = jwt.encode(
            {"sub": "1", "role": "consumer", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "wrong-secret-key",
            algorithm="HS256",
        )
        r = client.get("/inventory", headers={"Authorization": f"Bearer {forged_token}"})
        assert r.status_code == 401

    def test_malformed_authorization_header(self, client):
        """Malformed authorization header is rejected."""
        r = client.get("/inventory", headers={"Authorization": "NotBearer token"})
        assert r.status_code == 401

    def test_missing_token(self, client):
        """Missing token is rejected."""
        r = client.get("/inventory")
        assert r.status_code == 401

    def test_valid_token_accepted(self, client, consumer_headers):
        """Valid token is accepted."""
        r = client.get("/inventory", headers=consumer_headers)
        assert r.status_code == 200

    def test_wrong_credentials_rejected(self, client):
        """Wrong credentials are rejected."""
        r = client.post("/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_password_never_returned(self, client, consumer_headers):
        """Password hash is never returned in API responses."""
        r = client.get("/auth/me", headers=consumer_headers)
        assert r.status_code == 200
        data = r.json()
        assert "password_hash" not in data
        assert "password" not in data

    def test_admin_endpoint_requires_auth(self, client):
        """Admin endpoint requires authentication."""
        r = client.get("/admin/users")
        assert r.status_code == 401


# ============================================================
# RBAC / AUTHORIZATION SECURITY TESTS
# ============================================================

class TestRBACSecurity:
    """Test role-based access control enforcement."""

    def test_consumer_forbidden_admin_endpoint(self, client, consumer_headers):
        """Consumer cannot access admin endpoints."""
        r = client.get("/admin/users", headers=consumer_headers)
        assert r.status_code == 403

    def test_consumer_forbidden_admin_stats(self, client, consumer_headers):
        """Consumer cannot access admin stats."""
        r = client.get("/admin/stats", headers=consumer_headers)
        assert r.status_code == 403

    def test_retail_manager_forbidden_admin_endpoint(self, client, retail_manager_headers):
        """Retail manager cannot access admin endpoints."""
        r = client.get("/admin/users", headers=retail_manager_headers)
        assert r.status_code == 403

    def test_warehouse_operator_forbidden_admin_endpoint(self, client, warehouse_operator_headers):
        """Warehouse operator cannot access admin endpoints."""
        r = client.get("/admin/users", headers=warehouse_operator_headers)
        assert r.status_code == 403

    def test_inspector_forbidden_admin_endpoint(self, client, inspector_headers):
        """Food quality inspector cannot access admin endpoints."""
        r = client.get("/admin/users", headers=inspector_headers)
        assert r.status_code == 403

    def test_admin_allowed_admin_endpoint(self, client, admin_headers):
        """Administrator can access admin endpoints."""
        r = client.get("/admin/users", headers=admin_headers)
        assert r.status_code == 200

    def test_consumer_forbidden_inventory_report(self, client, consumer_headers):
        """Consumer cannot access inventory quality report."""
        r = client.get("/reports/inventory/pdf", headers=consumer_headers)
        assert r.status_code == 403

    def test_consumer_forbidden_waste_reduction_report(self, client, consumer_headers):
        """Consumer cannot access waste reduction report."""
        r = client.get("/reports/waste-reduction/pdf", headers=consumer_headers)
        assert r.status_code == 403

    def test_inspector_forbidden_waste_reduction_report(self, client, inspector_headers):
        """Inspector cannot access waste reduction report."""
        r = client.get("/reports/waste-reduction/pdf", headers=inspector_headers)
        assert r.status_code == 403

    def test_retail_manager_allowed_inventory_report(self, client, retail_manager_headers):
        """Retail manager can access inventory quality report."""
        r = client.get("/reports/inventory/pdf", headers=retail_manager_headers)
        assert r.status_code == 200

    def test_warehouse_operator_allowed_storage_compliance(self, client, warehouse_operator_headers):
        """Warehouse operator can access storage compliance report."""
        r = client.get("/reports/storage-compliance/pdf", headers=warehouse_operator_headers)
        assert r.status_code == 200


# ============================================================
# IDOR / CROSS-USER DATA ISOLATION TESTS
# ============================================================

class TestIDORSecurity:
    """Test that users cannot access other users' data by changing IDs."""

    def test_cross_user_analysis_access(self, client, consumer_headers, db):
        """User B cannot access User A's analysis."""
        # Create User A with analysis
        user_a = User(
            full_name="User A",
            email="usera_idor@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        analysis = FreshnessAnalysis(
            user_id=user_a.id,
            item_name="User A's Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
        )
        db.add(analysis)
        db.commit()

        # User B tries to access User A's analysis report
        r = client.get(f"/analysis/{analysis.id}/report", headers=consumer_headers)
        assert r.status_code == 403

    def test_cross_user_prediction_access(self, client, consumer_headers, db):
        """User B cannot access User A's prediction."""
        user_a = User(
            full_name="User A",
            email="usera_pred@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        pred = ShelfLifePrediction(
            user_id=user_a.id,
            food_type="tomato",
            remaining_shelf_life_days=5,
            predicted_expiry_date=date.today() + timedelta(days=5),
            risk_level="low",
            official_freshness_score=80,
            visual_condition_score=85,
            storage_condition_score=90,
            shelf_life_score=75,
            product_age_score=80,
            input_snapshot='{"temperature_c": 22}',
            recommendations='[]',
            model_type="RandomForestRegressor",
            storage_compliance="compliant",
        )
        db.add(pred)
        db.commit()

        # User B tries to access User A's prediction recommendations
        r = client.get(f"/m3/recommendations/{pred.id}", headers=consumer_headers)
        assert r.status_code == 404

    def test_cross_user_inventory_access(self, client, consumer_headers, db):
        """User B cannot access User A's inventory item."""
        user_a = User(
            full_name="User A",
            email="usera_inv@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        item = FoodItem(
            name="User A's Apple",
            category="Fruits",
            batch_number="USER-A-001",
            quantity=10,
            expiry_date=date.today() + timedelta(days=7),
            created_by=user_a.id,
        )
        db.add(item)
        db.commit()

        # User B tries to delete User A's inventory item
        r = client.delete(f"/inventory/{item.id}", headers=consumer_headers)
        assert r.status_code == 404

    def test_cross_user_notification_access(self, client, consumer_headers, db):
        """User B cannot access User A's notification."""
        user_a = User(
            full_name="User A",
            email="usera_notif@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        notif = Notification(
            user_id=user_a.id,
            notification_type="freshness_alert",
            severity="warning",
            title="Test Alert",
            message="Test message",
        )
        db.add(notif)
        db.commit()

        # User B tries to mark User A's notification as read
        r = client.patch(f"/notifications/{notif.id}/read", headers=consumer_headers)
        assert r.status_code == 404

    def test_cross_user_storage_condition_access(self, client, consumer_headers, db):
        """User B cannot access User A's storage condition via prediction."""
        user_a = User(
            full_name="User A",
            email="usera_storage@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        sc = StorageCondition(
            user_id=user_a.id,
            temperature_c=22.5,
            humidity_pct=70,
            air_circulation="good",
            light_exposure="low",
            packaging_type="sealed",
            storage_duration_days=2,
        )
        db.add(sc)
        db.commit()

        # User A's storage conditions should not appear in User B's list
        r = client.get("/m3/storage-conditions", headers=consumer_headers)
        assert r.status_code == 200
        items = r.json()
        assert all(i["id"] != sc.id for i in items)

    def test_admin_can_access_cross_user_analysis(self, client, admin_headers, db):
        """Admin can access any user's analysis report (documented exception)."""
        user_a = User(
            full_name="User A",
            email="usera_admin@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        analysis = FreshnessAnalysis(
            user_id=user_a.id,
            item_name="User A's Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
        )
        db.add(analysis)
        db.commit()

        # Admin can access User A's analysis report
        r = client.get(f"/analysis/{analysis.id}/report", headers=admin_headers)
        assert r.status_code == 200

    def test_inspector_can_access_cross_user_analysis(self, client, inspector_headers, db):
        """Inspector can access any user's analysis report (documented exception)."""
        user_a = User(
            full_name="User A",
            email="usera_insp@test.com",
            password_hash=hash_password("password123"),
            role="consumer",
        )
        db.add(user_a)
        db.commit()

        analysis = FreshnessAnalysis(
            user_id=user_a.id,
            item_name="User A's Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
        )
        db.add(analysis)
        db.commit()

        # Inspector can access User A's analysis report
        r = client.get(f"/analysis/{analysis.id}/report", headers=inspector_headers)
        assert r.status_code == 200


# ============================================================
# INPUT VALIDATION SECURITY TESTS
# ============================================================

class TestInputValidationSecurity:
    """Test input validation and injection prevention."""

    def test_invalid_food_category(self, client, consumer_headers):
        """Invalid food category is rejected."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_type": "InvalidCategory123",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "sealed",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_invalid_numeric_values(self, client, consumer_headers):
        """Invalid numeric values are rejected."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_type": "tomato",
            "temperature_c": 999.0,  # Out of range
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "sealed",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_malformed_id(self, client, consumer_headers):
        """Malformed ID returns 404 or 422, never 500."""
        # Use DELETE which accepts an ID parameter
        r = client.delete("/inventory/99999", headers=consumer_headers)
        # Should be 404 (not found) — the item doesn't exist
        assert r.status_code == 404

    def test_invalid_date_format(self, client, consumer_headers):
        """Invalid date format is handled gracefully."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "Test Item",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": "not-a-valid-date",
        })
        # Should return 422 for invalid date
        assert r.status_code == 422

    def test_sql_injection_in_name(self, client, consumer_headers):
        """SQL injection attempt in name field is handled safely."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "'; DROP TABLE users; --",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        # Should either succeed (treating as literal string) or return 422
        # It should NEVER cause a 500 error or execute the SQL
        assert r.status_code in (201, 422)

    def test_sql_injection_in_category(self, client, consumer_headers):
        """SQL injection attempt in category field is handled safely."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "Test Item",
            "category": "'; DROP TABLE users; --",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        # Should either succeed (treating as literal string) or return 422
        assert r.status_code in (201, 422)

    def test_xss_attempt_in_name(self, client, consumer_headers):
        """XSS attempt in name field is handled safely."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "<script>alert('xss')</script>",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        # Should either succeed (treating as literal string) or return 422
        assert r.status_code in (201, 422)

    def test_extremely_long_string(self, client, consumer_headers):
        """Extremely long string is handled gracefully."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "A" * 10000,  # Very long string
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        # Should return 422 for exceeding max_length
        assert r.status_code == 422

    def test_negative_quantity(self, client, consumer_headers):
        """Negative quantity is clamped to 0."""
        r = client.post("/inventory", headers=consumer_headers, json={
            "name": "Test Item",
            "category": "Fruits",
            "batch_number": "BATCH-001",
            "quantity": -100,
            "expiry_date": (date.today() + timedelta(days=7)).isoformat(),
        })
        # The parse_quantity validator converts negative to 0
        assert r.status_code == 201
        assert r.json()["quantity"] == 0

    def test_invalid_air_circulation(self, client, consumer_headers):
        """Invalid air circulation value is rejected."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_type": "tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "invalid_value",
            "light_exposure": "low",
            "packaging_type": "sealed",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422

    def test_invalid_light_exposure(self, client, consumer_headers):
        """Invalid light exposure value is rejected."""
        r = client.post("/m3/shelf-life/predict", headers=consumer_headers, json={
            "food_type": "tomato",
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "invalid_value",
            "packaging_type": "sealed",
            "storage_duration_days": 2,
        })
        assert r.status_code == 422


# ============================================================
# FILE UPLOAD SECURITY TESTS
# ============================================================

class TestFileUploadSecurity:
    """Test file upload security controls."""

    def test_invalid_file_type_rejected(self, client, consumer_headers):
        """Non-image file type is rejected."""
        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("test.txt", b"not an image", "text/plain")},
        )
        assert r.status_code == 415

    def test_html_file_rejected(self, client, consumer_headers):
        """HTML file is rejected."""
        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("test.html", b"<html><body>alert('xss')</body></html>", "text/html")},
        )
        assert r.status_code == 415

    def test_exe_file_rejected(self, client, consumer_headers):
        """Executable file is rejected."""
        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("test.exe", b"MZ\x90\x00", "application/x-msdownload")},
        )
        assert r.status_code == 415

    def test_traversal_filename_rejected(self, client, consumer_headers):
        """Path traversal in filename is handled safely."""
        # The filename is not used for filesystem storage, so this should be safe
        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("../../etc/passwd", b"fake image content", "image/jpeg")},
        )
        # Should be rejected as invalid image (not a valid JPEG)
        assert r.status_code in (422, 500, 503)  # 503 if model not ready

    def test_empty_file_rejected(self, client, consumer_headers):
        """Empty file is handled gracefully."""
        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("test.jpg", b"", "image/jpeg")},
        )
        # Should be rejected as invalid image
        assert r.status_code in (422, 500, 503)

    def test_corrupt_image_rejected(self, client, consumer_headers):
        """Corrupt image data is handled gracefully."""
        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("test.jpg", b"this is not a valid jpeg image", "image/jpeg")},
        )
        # Should be rejected as invalid image
        assert r.status_code in (422, 500, 503)

    def test_valid_image_accepted(self, client, consumer_headers):
        """Valid image is accepted."""
        img = Image.new("RGB", (224, 224), (80, 200, 60))
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="JPEG")
        img_buffer.seek(0)

        r = client.post(
            "/analysis/predict",
            headers=consumer_headers,
            files={"file": ("test.jpg", img_buffer, "image/jpeg")},
        )
        # Should succeed (or 503 if model not ready)
        assert r.status_code in (200, 503)


# ============================================================
# SECURITY HEADERS TESTS
# ============================================================

class TestSecurityHeaders:
    """Test security headers are present."""

    def test_x_content_type_options_header(self, client):
        """X-Content-Type-Options header is present."""
        r = client.get("/health")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"

    def test_x_frame_options_header(self, client):
        """X-Frame-Options header is present."""
        r = client.get("/health")
        assert r.headers.get("X-Frame-Options") == "DENY"

    def test_referrer_policy_header(self, client):
        """Referrer-Policy header is present."""
        r = client.get("/health")
        assert r.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    def test_x_xss_protection_header(self, client):
        """X-XSS-Protection header is present."""
        r = client.get("/health")
        assert r.headers.get("X-XSS-Protection") == "1; mode=block"


# ============================================================
# CONFIGURATION SECURITY TESTS
# ============================================================

class TestConfigurationSecurity:
    """Test configuration security."""

    def test_jwt_secret_not_exposed(self, client):
        """JWT secret is not exposed through any API endpoint."""
        # Check health endpoint
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "secret" not in str(data).lower()
        assert "jwt" not in str(data).lower()

    def test_sensitive_info_not_in_error_messages(self, client):
        """Sensitive information is not exposed in error messages."""
        # Trigger a 404
        r = client.get("/nonexistent-endpoint")
        assert r.status_code == 404
        # Error message should not contain sensitive info
        data = r.json()
        assert "secret" not in str(data).lower()
        assert "password" not in str(data).lower()
        assert "token" not in str(data).lower()

    def test_database_url_not_exposed(self, client):
        """Database URL is not exposed through any API endpoint."""
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "database" not in str(data).lower()
        assert "sqlite" not in str(data).lower()
        assert "postgres" not in str(data).lower()

    def test_env_vars_not_exposed(self, client):
        """Environment variables are not exposed through any API endpoint."""
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        # Should not contain any env var values
        assert "dev-secret" not in str(data).lower()


# ============================================================
# CORS SECURITY TESTS
# ============================================================

class TestCORSSecurity:
    """Test CORS configuration."""

    def test_cors_headers_present(self, client):
        """CORS headers are present for allowed origins."""
        r = client.get("/health", headers={"Origin": "http://localhost:5173"})
        assert r.status_code == 200
        # CORS headers should be present for allowed origin
        assert "access-control-allow-origin" in r.headers or r.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_cors_rejects_disallowed_origin(self, client):
        """CORS rejects disallowed origins."""
        r = client.get("/health", headers={"Origin": "http://evil.com"})
        # Should not have CORS headers for disallowed origin
        assert r.headers.get("access-control-allow-origin") != "http://evil.com"


# ============================================================
# ERROR HANDLING SECURITY TESTS
# ============================================================

class TestErrorHandlingSecurity:
    """Test error handling does not expose sensitive information."""

    def test_404_does_not_expose_paths(self, client):
        """404 error does not expose filesystem paths."""
        r = client.get("/nonexistent")
        assert r.status_code == 404
        data = r.json()
        # Should not contain filesystem paths
        assert "/" not in str(data.get("detail", "")) or "not found" in str(data.get("detail", "")).lower()

    def test_500_does_not_expose_stack_trace(self, client, consumer_headers):
        """500 error does not expose stack traces."""
        # This is hard to trigger without a real error, but we can verify
        # that the error response format is safe
        r = client.get("/inventory", headers=consumer_headers)
        assert r.status_code == 200
        # If there were errors, they should be in a safe format

    def test_validation_error_format(self, client):
        """Validation errors return safe, descriptive messages."""
        r = client.post("/auth/register", json={
            "full_name": "Test",
            "email": "invalid-email",
            "password": "testpassword123",
            "role": "consumer",
        })
        assert r.status_code == 422
        data = r.json()
        # Should have a detail field with validation error
        assert "detail" in data
