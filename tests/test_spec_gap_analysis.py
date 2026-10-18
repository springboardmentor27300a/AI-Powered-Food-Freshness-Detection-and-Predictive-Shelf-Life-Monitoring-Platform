import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ml.freshness_score_engine import freshness_scoring_engine
from backend.app.models.inventory_model import normalize_food_category, FoodCategory

client = TestClient(app)


def get_admin_token() -> str:
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin@foodfresh.com", "password": "AdminPass123!"},
    )
    if login_res.status_code != 200:
        import uuid
        uid = uuid.uuid4().hex[:6]
        client.post("/api/auth/register", json={
            "name": f"Admin {uid}", "email": f"adm_{uid}@foodfresh.com", "password": "AdminPass123!", "confirm_password": "AdminPass123!", "role": "Admin"
        })
        login_res = client.post("/api/auth/login", json={"email": f"adm_{uid}@foodfresh.com", "password": "AdminPass123!"})
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


def get_consumer_token() -> str:
    login_res = client.post(
        "/api/auth/login",
        json={"email": "consumer@foodfresh.com", "password": "ConsumerPass123!"},
    )
    if login_res.status_code != 200:
        import uuid
        uid = uuid.uuid4().hex[:6]
        client.post("/api/auth/register", json={
            "name": f"Consumer {uid}", "email": f"cons_{uid}@foodfresh.com", "password": "ConsumerPass123!", "confirm_password": "ConsumerPass123!", "role": "Consumer"
        })
        login_res = client.post("/api/auth/login", json={"email": f"cons_{uid}@foodfresh.com", "password": "ConsumerPass123!"})
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


@pytest.fixture
def admin_token():
    return get_admin_token()


@pytest.fixture
def consumer_token():
    return get_consumer_token()


def test_weighted_scoring_engine_pillars():
    """Verify the 4-pillar weighted formula: 40% Visual + 25% Storage + 20% Shelf-Life + 15% Product Age."""
    today = date.today()
    res = freshness_scoring_engine.calculate_weighted_freshness(
        visual_score=90.0,
        category="Fruits",
        purchase_date_val=today - timedelta(days=2),
        expiry_date_val=today + timedelta(days=12),
        storage_temperature=4.0,  # Ideal for fruits
        storage_humidity=90.0,    # Ideal for fruits
        air_circulation="Standard",
        light_exposure="Dark",
        predicted_remaining_days=10.0,
        mold_detected=False,
    )

    assert "composite_freshness_score" in res
    assert res["freshness_category"] in ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"]
    assert res["freshness_category"] == "Fresh"
    assert res["sub_scores"]["visual_weight"] == 0.40
    assert res["sub_scores"]["storage_weight"] == 0.25
    assert res["sub_scores"]["shelf_life_weight"] == 0.20
    assert res["sub_scores"]["product_age_weight"] == 0.15
    assert res["confidence_score"] >= 0.85
    assert res["is_safe_for_consumption"] is True


def test_five_freshness_categories():
    """Verify discrete 5-category classification thresholds."""
    assert freshness_scoring_engine.classify_freshness_category(95.0) == "Fresh"
    assert freshness_scoring_engine.classify_freshness_category(85.0) == "Fresh"
    assert freshness_scoring_engine.classify_freshness_category(75.0) == "Good"
    assert freshness_scoring_engine.classify_freshness_category(60.0) == "Acceptable"
    assert freshness_scoring_engine.classify_freshness_category(45.0) == "Near Spoilage"
    assert freshness_scoring_engine.classify_freshness_category(30.0) == "Spoiled"
    assert freshness_scoring_engine.classify_freshness_category(95.0, mold_detected=True) == "Spoiled"


def test_food_categories_expansion():
    """Verify all 8 specification food categories and normalization."""
    categories = [
        "Fruits", "Vegetables", "Dairy Products", "Meat & Poultry",
        "Seafood", "Bakery Products", "Packaged Foods", "Beverages"
    ]
    for cat in categories:
        norm = normalize_food_category(cat)
        assert norm in [e.value for e in FoodCategory]

    # Verify alias mappings
    assert normalize_food_category("Dairy") == "Dairy Products"
    assert normalize_food_category("Meat") == "Meat & Poultry"
    assert normalize_food_category("Fish") == "Seafood"
    assert normalize_food_category("Bakery") == "Bakery Products"
    assert normalize_food_category("Packaged Food") == "Packaged Foods"


def test_user_profile_and_password(consumer_token):
    """Verify user extended profile retrieval, update, and password change endpoints."""
    headers = {"Authorization": f"Bearer {consumer_token}"}

    # 1. Get extended profile
    res = client.get("/api/users/profile/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "name" in data
    assert "email" in data
    assert "role" in data

    # 2. Update profile
    update_res = client.put(
        "/api/users/profile",
        headers=headers,
        json={"name": "Test Consumer Updated", "organization": "Quality Food Lab", "phone": "+1234567890"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["user"]["name"] == "Test Consumer Updated"


def test_unified_notifications_and_alerts(admin_token):
    """Verify unified notification and alert system endpoints (Module 10)."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Notifications list
    res_notif = client.get("/api/notifications", headers=headers)
    assert res_notif.status_code == 200
    notif_data = res_notif.json()
    assert "notifications" in notif_data
    assert len(notif_data["notifications"]) >= 1

    notif_id = notif_data["notifications"][0]["id"]
    read_res = client.post(f"/api/notifications/{notif_id}/read", headers=headers)
    assert read_res.status_code == 200

    # 2. Unread count
    count_res = client.get("/api/notifications/unread-count", headers=headers)
    assert count_res.status_code == 200
    assert "unread_count" in count_res.json()

    # 3. Alerts list
    res_alerts = client.get("/api/alerts", headers=headers)
    assert res_alerts.status_code == 200
    alert_data = res_alerts.json()
    assert "alerts" in alert_data
    assert len(alert_data["alerts"]) >= 1

    # 4. Alert summary
    res_summary = client.get("/api/alerts/summary", headers=headers)
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert "total_alerts" in summary

    # 5. Acknowledge alert
    alert_id = alert_data["alerts"][0]["id"]
    ack_res = client.post(f"/api/alerts/{alert_id}/acknowledge", headers=headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["success"] is True


def test_specialized_reports(admin_token):
    """Verify Module 11 specialized reports (Freshness, Shelf-life, Quality, Waste, Compliance)."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Freshness report
    r_fresh = client.get("/api/reports/freshness", headers=headers)
    assert r_fresh.status_code == 200
    assert "distribution" in r_fresh.json()
    assert "category_averages" in r_fresh.json()

    # Shelf-life report
    r_shelf = client.get("/api/reports/shelf-life", headers=headers)
    assert r_shelf.status_code == 200
    assert "lifespan_intervals" in r_shelf.json()

    # Inventory quality report
    r_qual = client.get("/api/reports/inventory-quality", headers=headers)
    assert r_qual.status_code == 200
    assert "defect_breakdown" in r_qual.json()

    # Waste reduction report
    r_waste = client.get("/api/reports/waste-reduction", headers=headers)
    assert r_waste.status_code == 200
    assert "waste_avoided_kg" in r_waste.json()

    # Storage compliance report
    r_comp = client.get("/api/reports/storage-compliance", headers=headers)
    assert r_comp.status_code == 200
    assert "compliance_rate_pct" in r_comp.json()


def test_binary_pdf_and_excel_export(admin_token):
    """Verify Module 11 PDF and Excel binary export endpoints."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. PDF Export
    pdf_res = client.get("/api/reports/export-pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF")
    assert len(pdf_res.content) > 500

    # 2. Excel (XLSX) Export
    excel_res = client.get("/api/reports/export-excel", headers=headers)
    assert excel_res.status_code == 200
    assert "spreadsheetml" in excel_res.headers["content-type"]
    assert excel_res.content.startswith(b"PK\x03\x04")  # Standard ZIP magic bytes for XLSX
    assert len(excel_res.content) > 1000
