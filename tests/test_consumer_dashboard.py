import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.database import get_freshness_records_collection, get_users_collection

client = TestClient(app)


def get_login_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def consumer_token():
    return get_login_token("consumer@foodfresh.com", "ConsumerPass123!")


@pytest.fixture(scope="module")
def demo_consumer_token():
    return get_login_token("demo@foodfresh.com", "DemoPass123!")


@pytest.fixture(scope="module")
def admin_token():
    return get_login_token("admin@foodfresh.com", "AdminPass123!")


@pytest.fixture(scope="module")
def consumer_user():
    col = get_users_collection()
    user = col.find_one({"email": "consumer@foodfresh.com"})
    assert user is not None
    return user


@pytest.fixture(scope="module")
def demo_consumer_user():
    col = get_users_collection()
    user = col.find_one({"email": "demo@foodfresh.com"})
    assert user is not None
    return user


def test_storage_guidelines_endpoint(consumer_token):
    """Verifies that GET /api/freshness/storage-guidelines returns full food guidelines."""
    headers = {"Authorization": f"Bearer {consumer_token}"}
    response = client.get("/api/freshness/storage-guidelines", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "guidelines" in data
    assert "Fruits" in data["guidelines"]
    assert "Vegetables" in data["guidelines"]
    assert "Dairy" in data["guidelines"]
    assert "Meat" in data["guidelines"]

    fruits = data["guidelines"]["Fruits"]
    assert fruits["temp_min"] <= fruits["temp_max"]
    assert "ethylene" in fruits
    assert "tips" in fruits


def test_shelf_life_simulation_endpoint(consumer_token):
    """Verifies Arrhenius kinetic simulation endpoint POST /api/shelf-life/simulate."""
    headers = {"Authorization": f"Bearer {consumer_token}"}
    payload = {
        "category": "Fruits",
        "food_name": "Granny Smith Apples",
        "storage_temperature": 4.0,
        "storage_humidity": 90.0,
        "current_freshness_score": 95.0,
        "packaging_type": "Standard Pack",
    }
    response = client.post("/api/shelf-life/simulate", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["predicted_remaining_days"] > 0
    assert "daily_degradation_rate_pct" in data
    assert "temp_acceleration_factor" in data
    assert "storage_stress_level" in data
    assert "forecast_7_days" in data
    assert len(data["forecast_7_days"]) == 7


def test_quick_scan_saves_user_id_and_returns_id(consumer_token, consumer_user):
    """Verifies that quick_scan associates authenticated user_id with the record."""
    headers = {"Authorization": f"Bearer {consumer_token}"}
    data = {
        "category": "Fruits",
        "food_name": "Fresh Organic Strawberries",
        "storage_temperature": "2.0",
        "storage_humidity": "92.0",
    }
    response = client.post("/api/freshness/quick-scan", data=data, headers=headers)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert res["id"] is not None
    assert res["user_id"] == str(consumer_user["_id"])
    assert res["freshness_score"] > 0
    assert res["confidence"] > 0


def test_get_freshness_history_scoping(consumer_token, demo_consumer_token, consumer_user, demo_consumer_user):
    """Verifies that non-admin consumers only see their own scan history."""
    fresh_col = get_freshness_records_collection()
    if fresh_col is None:
        pytest.skip("MongoDB not connected")

    # Insert test records for consumer 1 and consumer 2
    r1 = fresh_col.insert_one({
        "user_id": consumer_user["_id"],
        "food_name": "Consumer 1 Melon Specific Scan",
        "category": "Fruits",
        "freshness_score": 90.0,
        "freshness_label": "Fresh",
        "analysis_date": datetime.now(timezone.utc),
    })
    r2 = fresh_col.insert_one({
        "user_id": demo_consumer_user["_id"],
        "food_name": "Demo Consumer 2 Steak Specific Scan",
        "category": "Meat",
        "freshness_score": 85.0,
        "freshness_label": "Fresh",
        "analysis_date": datetime.now(timezone.utc),
    })

    try:
        # Consumer 1 requests history
        headers1 = {"Authorization": f"Bearer {consumer_token}"}
        resp1 = client.get("/api/freshness/history", headers=headers1)
        assert resp1.status_code == 200
        items1 = resp1.json()
        names1 = [i["food_name"] for i in items1]
        assert "Consumer 1 Melon Specific Scan" in names1
        assert "Demo Consumer 2 Steak Specific Scan" not in names1

        # Consumer 2 requests history
        headers2 = {"Authorization": f"Bearer {demo_consumer_token}"}
        resp2 = client.get("/api/freshness/history", headers=headers2)
        assert resp2.status_code == 200
        items2 = resp2.json()
        names2 = [i["food_name"] for i in items2]
        assert "Demo Consumer 2 Steak Specific Scan" in names2
        assert "Consumer 1 Melon Specific Scan" not in names2
    finally:
        fresh_col.delete_one({"_id": r1.inserted_id})
        fresh_col.delete_one({"_id": r2.inserted_id})


def test_get_freshness_record_detail_and_authorization(consumer_token, demo_consumer_token, admin_token, consumer_user):
    """Verifies GET /api/freshness/history/{record_id} and cross-user authorization enforcement."""
    fresh_col = get_freshness_records_collection()
    if fresh_col is None:
        pytest.skip("MongoDB not connected")

    rec = fresh_col.insert_one({
        "user_id": consumer_user["_id"],
        "food_name": "Honeycrisp Apple Sample",
        "category": "Fruits",
        "freshness_score": 92.0,
        "freshness_label": "Fresh",
        "confidence": 0.96,
        "sub_scores": {"visual": 92.0, "olfactory": 90.0},
        "color_score": 94.0,
        "texture_score": 91.0,
        "detected_defects": [],
        "mold_detected": False,
        "bruising_detected": False,
        "estimated_shelf_life_days": 8.5,
        "analysis_date": datetime.now(timezone.utc),
    })
    rec_id = str(rec.inserted_id)

    try:
        # 1. Owner can access record
        headers1 = {"Authorization": f"Bearer {consumer_token}"}
        res1 = client.get(f"/api/freshness/history/{rec_id}", headers=headers1)
        assert res1.status_code == 200
        detail = res1.json()
        assert detail["id"] == rec_id
        assert detail["food_name"] == "Honeycrisp Apple Sample"
        assert "recommendations" in detail

        # 2. Other user receives 403 Forbidden
        headers2 = {"Authorization": f"Bearer {demo_consumer_token}"}
        res2 = client.get(f"/api/freshness/history/{rec_id}", headers=headers2)
        assert res2.status_code == 403

        # 3. Admin can access any record
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        res_admin = client.get(f"/api/freshness/history/{rec_id}", headers=headers_admin)
        assert res_admin.status_code == 200
    finally:
        fresh_col.delete_one({"_id": rec.inserted_id})


def test_shelf_life_commodities_catalog_endpoint():
    """Verifies that GET /api/shelf-life/commodities returns catalogue of recognized food items."""
    response = client.get("/api/shelf-life/commodities")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["count"] > 20
    assert any(c["display_name"] == "Apples" for c in data["commodities"])
    assert any(c["display_name"] == "Fresh Chicken Breast" for c in data["commodities"])
    assert any("emoji" in c for c in data["commodities"])


def test_custom_food_item_shelf_life_prediction(consumer_token):
    """Verifies that entering a custom food item accurately predicts shelf life and storage conditions."""
    headers = {"Authorization": f"Bearer {consumer_token}"}

    # 1. Custom food item: Mango
    mango_payload = {
        "food_name": "Fresh Alphonso Mango",
        "category": "Fruits",
        "storage_temperature": 12.0,
        "storage_humidity": 85.0,
        "current_freshness_score": 90.0,
        "packaging_type": "Standard Pack",
    }
    res_mango = client.post("/api/shelf-life/simulate", json=mango_payload, headers=headers)
    assert res_mango.status_code == 200
    mango_data = res_mango.json()
    assert mango_data["success"] is True
    assert "Mango" in mango_data["food_name"]
    assert mango_data["emoji"] == "🥭"
    assert mango_data["predicted_remaining_days"] > 0
    assert "forecast_7_days" in mango_data
    assert len(mango_data["forecast_7_days"]) == 7

    # 2. Custom food item: Chicken Breast under cold (1.5°C) vs warm abusive (25°C)
    chicken_cold = {
        "food_name": "Chicken Breast",
        "category": "Meat",
        "storage_temperature": 1.5,
        "storage_humidity": 75.0,
        "current_freshness_score": 95.0,
        "packaging_type": "Standard Pack",
    }
    res_cold = client.post("/api/shelf-life/simulate", json=chicken_cold, headers=headers)
    assert res_cold.status_code == 200
    cold_data = res_cold.json()
    assert cold_data["emoji"] == "🍗"

    chicken_warm = {
        "food_name": "Chicken Breast",
        "category": "Meat",
        "storage_temperature": 25.0,
        "storage_humidity": 75.0,
        "current_freshness_score": 95.0,
        "packaging_type": "Standard Pack",
    }
    res_warm = client.post("/api/shelf-life/simulate", json=chicken_warm, headers=headers)
    assert res_warm.status_code == 200
    warm_data = res_warm.json()

    # Temperature abuse significantly increases Arrhenius decay rate and lowers shelf life
    assert warm_data["temp_acceleration_factor"] > cold_data["temp_acceleration_factor"]
    assert warm_data["predicted_remaining_days"] < cold_data["predicted_remaining_days"]


def test_quick_scan_with_image_address(consumer_token):
    """Verifies that quick scan processes food images supplied via image address / data URI."""
    headers = {"Authorization": f"Bearer {consumer_token}"}
    
    # 1x1 PNG transparent data URI
    tiny_png_data_uri = (
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    payload = {
        "image_url": tiny_png_data_uri,
        "category": "Fruits",
        "food_name": "Scanned Red Apple via Address",
        "storage_temperature": "4.0",
        "storage_humidity": "90.0",
    }
    response = client.post("/api/freshness/quick-scan", data=payload, headers=headers)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert res["id"] is not None
    assert res["freshness_score"] > 0
    assert res["estimated_shelf_life_days"] > 0
    assert "image_url" in res
    assert res["image_url"].startswith("/uploads/")


