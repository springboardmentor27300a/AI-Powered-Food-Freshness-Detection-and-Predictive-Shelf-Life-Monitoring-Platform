"""
test_e2e_workflow.py — FreshGuard End-to-End Workflow Test

Tests the complete user journey:
  REGISTER/LOGIN → UPLOAD FOOD IMAGE → M2 FRESHNESS ANALYSIS → STORE ANALYSIS
  → ENTER STORAGE CONDITIONS → M3 SHELF-LIFE PREDICTION → GENERATE RECOMMENDATIONS
  → INVENTORY INSIGHT → GENERATE ALERT → OPEN DASHBOARD → GENERATE REPORT
  → DOWNLOAD PDF → DOWNLOAD EXCEL

Uses real API calls and real database operations. No fake API responses.
"""

import io
import os
import sys
from datetime import date, timedelta

import pytest
from PIL import Image

from app.auth import hash_password, create_token
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, Notification


# ============================================================
# E2E Workflow Test
# ============================================================

class TestE2EWorkflow:
    """Complete end-to-end workflow test using real API calls."""

    def test_complete_user_journey(self, client, db):
        """
        Test the complete FreshGuard user journey from registration to report download.
        Uses real API calls and real database operations.
        """
        # -----------------------------------------------------------
        # 1. REGISTER / LOGIN
        # -----------------------------------------------------------
        reg_response = client.post("/auth/register", json={
            "full_name": "E2E Test User",
            "email": "e2e_workflow@test.com",
            "password": "testpassword123",
            "role": "consumer",
        })
        assert reg_response.status_code == 201, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Verify login works (token will differ due to JWT timestamp)
        login_response = client.post("/auth/login", json={
            "email": "e2e_workflow@test.com",
            "password": "testpassword123",
        })
        assert login_response.status_code == 200
        assert "access_token" in login_response.json()

        # -----------------------------------------------------------
        # 2. UPLOAD FOOD IMAGE (M2 Freshness Analysis)
        # -----------------------------------------------------------
        # Create a test image
        img = Image.new("RGB", (224, 224), (80, 200, 60))  # Green = fresh
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="JPEG")
        img_buffer.seek(0)

        analysis_response = client.post(
            "/analysis/predict",
            headers=headers,
            files={"file": ("test_apple.jpg", img_buffer, "image/jpeg")},
            data={"item_name": "E2E Test Apple"},
        )
        assert analysis_response.status_code == 200, f"Analysis failed: {analysis_response.text}"
        analysis_data = analysis_response.json()
        analysis_id = analysis_data["id"]

        # Verify analysis was stored in database
        stored_analysis = db.query(FreshnessAnalysis).filter_by(id=analysis_id).first()
        assert stored_analysis is not None
        assert stored_analysis.user_id is not None
        assert stored_analysis.classification in ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"]

        # -----------------------------------------------------------
        # 3. STORE ANALYSIS (already stored by the API)
        # -----------------------------------------------------------
        # Verify analysis history
        history_response = client.get("/analysis/history", headers=headers)
        assert history_response.status_code == 200
        history = history_response.json()
        assert len(history) >= 1
        assert any(h["id"] == analysis_id for h in history)

        # -----------------------------------------------------------
        # 4. ENTER STORAGE CONDITIONS (M3)
        # -----------------------------------------------------------
        # First create a food item to associate with the prediction
        food_response = client.post("/inventory", headers=headers, json={
            "name": "E2E Test Apple",
            "category": "Fruits",
            "batch_number": "E2E-BATCH-001",
            "quantity": 10,
            "expiry_date": (date.today() + timedelta(days=14)).isoformat(),
        })
        assert food_response.status_code == 201
        food_item_id = food_response.json()["id"]

        # -----------------------------------------------------------
        # 5. M3 SHELF-LIFE PREDICTION
        # -----------------------------------------------------------
        prediction_response = client.post("/m3/shelf-life/predict", headers=headers, json={
            "food_item_id": food_item_id,
            "food_type": "Tomato",
            "analysis_id": analysis_id,
            "visual_quality_score": analysis_data["quality_score"],
            "spoilage_probability": analysis_data["spoilage_probability"],
            "temperature_c": 22.5,
            "humidity_pct": 70,
            "air_circulation": "good",
            "light_exposure": "low",
            "packaging_type": "uncoated",
            "storage_duration_days": 2,
            "product_age_days": 1,
        })
        assert prediction_response.status_code == 201, f"Prediction failed: {prediction_response.text}"
        prediction_data = prediction_response.json()
        prediction_id = prediction_data["id"]

        # Verify prediction was stored in database
        stored_prediction = db.query(ShelfLifePrediction).filter_by(id=prediction_id).first()
        assert stored_prediction is not None
        assert stored_prediction.user_id is not None
        assert stored_prediction.remaining_shelf_life_days >= 0

        # -----------------------------------------------------------
        # 6. GENERATE RECOMMENDATIONS
        # -----------------------------------------------------------
        recommendations_response = client.get(f"/m3/recommendations/{prediction_id}", headers=headers)
        assert recommendations_response.status_code == 200
        recommendations = recommendations_response.json()
        assert isinstance(recommendations, list)

        # -----------------------------------------------------------
        # 7. INVENTORY INSIGHT (Expiring Soon)
        # -----------------------------------------------------------
        expiring_response = client.get("/inventory/expiring-soon?days=14", headers=headers)
        assert expiring_response.status_code == 200
        expiring_items = expiring_response.json()
        assert isinstance(expiring_items, list)

        # -----------------------------------------------------------
        # 8. GENERATE ALERT (Notifications)
        # -----------------------------------------------------------
        alert_response = client.post("/notifications/generate", headers=headers)
        assert alert_response.status_code == 200
        alert_data = alert_response.json()
        assert "count" in alert_data

        # Verify notifications were created
        notifications_response = client.get("/notifications", headers=headers)
        assert notifications_response.status_code == 200
        notifications_data = notifications_response.json()
        assert "notifications" in notifications_data
        assert "unread_count" in notifications_data

        # -----------------------------------------------------------
        # 9. OPEN DASHBOARD
        # -----------------------------------------------------------
        dashboard_response = client.get("/dashboard/data", headers=headers)
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        assert dashboard_data["role"] == "consumer"
        assert "analyses" in dashboard_data
        assert "predictions" in dashboard_data
        assert "storage_conditions" in dashboard_data
        assert "inventory" in dashboard_data

        # -----------------------------------------------------------
        # 10. GENERATE REPORT (Freshness Summary)
        # -----------------------------------------------------------
        report_response = client.get("/reports/freshness/pdf", headers=headers)
        assert report_response.status_code == 200
        assert report_response.headers["content-type"] == "application/pdf"
        assert report_response.content[:4] == b"%PDF"

        # -----------------------------------------------------------
        # 11. DOWNLOAD PDF (Shelf-Life Report)
        # -----------------------------------------------------------
        pdf_response = client.get("/reports/shelf-life/pdf", headers=headers)
        assert pdf_response.status_code == 200
        assert pdf_response.headers["content-type"] == "application/pdf"
        assert pdf_response.content[:4] == b"%PDF"

        # -----------------------------------------------------------
        # 12. DOWNLOAD EXCEL (Shelf-Life Report)
        # -----------------------------------------------------------
        excel_response = client.get("/reports/shelf-life/excel", headers=headers)
        assert excel_response.status_code == 200
        assert "spreadsheet" in excel_response.headers["content-type"]
        assert excel_response.content[:2] == b"PK"  # Valid xlsx zip header

        # -----------------------------------------------------------
        # 13. DOWNLOAD M2 ANALYSIS REPORT (Per-Analysis PDF)
        # -----------------------------------------------------------
        m2_report_response = client.get(f"/analysis/{analysis_id}/report", headers=headers)
        assert m2_report_response.status_code == 200
        assert m2_report_response.headers["content-type"] == "application/pdf"
        assert m2_report_response.content[:4] == b"%PDF"

        # -----------------------------------------------------------
        # Verify data flow: IDs are consistent across stages
        # -----------------------------------------------------------
        # The analysis_id from step 2 should match the one in history
        assert any(h["id"] == analysis_id for h in history)

        # The prediction_id from step 5 should be in the dashboard
        dashboard_pred_ids = [p["id"] for p in dashboard_data["predictions"]]
        assert prediction_id in dashboard_pred_ids

        # The food_item_id from step 4 should be in the dashboard inventory
        dashboard_inv_ids = [i["id"] for i in dashboard_data["inventory"]]
        assert food_item_id in dashboard_inv_ids


# ============================================================
# E2E Role-Based Workflow Tests
# ============================================================

class TestE2ERoleWorkflows:
    """Test that each role can complete its appropriate workflow."""

    def test_consumer_workflow(self, client, db):
        """Consumer can access personal freshness, shelf-life, and storage reports."""
        # Register as consumer
        reg = client.post("/auth/register", json={
            "full_name": "E2E Consumer",
            "email": "e2e_consumer@test.com",
            "password": "testpassword123",
            "role": "consumer",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Consumer can access freshness report
        r = client.get("/reports/freshness/pdf", headers=headers)
        assert r.status_code == 200

        # Consumer can access shelf-life report
        r = client.get("/reports/shelf-life/pdf", headers=headers)
        assert r.status_code == 200

        # Consumer can access storage compliance report
        r = client.get("/reports/storage-compliance/pdf", headers=headers)
        assert r.status_code == 200

        # Consumer CANNOT access inventory quality report
        r = client.get("/reports/inventory/pdf", headers=headers)
        assert r.status_code == 403

        # Consumer CANNOT access waste reduction report
        r = client.get("/reports/waste-reduction/pdf", headers=headers)
        assert r.status_code == 403

    def test_retail_manager_workflow(self, client, db):
        """Retail manager can access product freshness, inventory, shelf-life, and waste-risk reports."""
        reg = client.post("/auth/register", json={
            "full_name": "E2E Retail Manager",
            "email": "e2e_retail@test.com",
            "password": "testpassword123",
            "role": "retail_manager",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Retail manager can access all their reports
        for endpoint in [
            "/reports/freshness/pdf",
            "/reports/shelf-life/pdf",
            "/reports/inventory/pdf",
            "/reports/waste-reduction/pdf",
            "/reports/storage-compliance/pdf",
        ]:
            r = client.get(endpoint, headers=headers)
            assert r.status_code == 200, f"Retail manager should access {endpoint}"

    def test_warehouse_operator_workflow(self, client, db):
        """Warehouse operator can access inventory, storage compliance, and freshness reports."""
        reg = client.post("/auth/register", json={
            "full_name": "E2E Warehouse Operator",
            "email": "e2e_warehouse@test.com",
            "password": "testpassword123",
            "role": "warehouse_operator",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Warehouse operator can access inventory, storage compliance, and freshness
        for endpoint in [
            "/reports/freshness/pdf",
            "/reports/shelf-life/pdf",
            "/reports/inventory/pdf",
            "/reports/storage-compliance/pdf",
        ]:
            r = client.get(endpoint, headers=headers)
            assert r.status_code == 200, f"Warehouse operator should access {endpoint}"

        # Warehouse operator CAN access waste reduction report
        r = client.get("/reports/waste-reduction/pdf", headers=headers)
        assert r.status_code == 200

    def test_admin_workflow(self, client, db):
        """Administrator can access all report types."""
        reg = client.post("/auth/register", json={
            "full_name": "E2E Admin",
            "email": "e2e_admin@test.com",
            "password": "testpassword123",
            "role": "administrator",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Admin can access all reports
        for endpoint in [
            "/reports/freshness/pdf",
            "/reports/shelf-life/pdf",
            "/reports/inventory/pdf",
            "/reports/waste-reduction/pdf",
            "/reports/storage-compliance/pdf",
        ]:
            r = client.get(endpoint, headers=headers)
            assert r.status_code == 200, f"Admin should access {endpoint}"

        # Admin can access admin endpoints
        r = client.get("/admin/users", headers=headers)
        assert r.status_code == 200

        r = client.get("/admin/stats", headers=headers)
        assert r.status_code == 200

    def test_inspector_workflow(self, client, db):
        """Food quality inspector can access freshness and shelf-life reports."""
        reg = client.post("/auth/register", json={
            "full_name": "E2E Inspector",
            "email": "e2e_inspector@test.com",
            "password": "testpassword123",
            "role": "food_quality_inspector",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Inspector can access freshness and shelf-life reports
        for endpoint in [
            "/reports/freshness/pdf",
            "/reports/shelf-life/pdf",
            "/reports/storage-compliance/pdf",
        ]:
            r = client.get(endpoint, headers=headers)
            assert r.status_code == 200, f"Inspector should access {endpoint}"

        # Inspector CANNOT access waste reduction report
        r = client.get("/reports/waste-reduction/pdf", headers=headers)
        assert r.status_code == 403
