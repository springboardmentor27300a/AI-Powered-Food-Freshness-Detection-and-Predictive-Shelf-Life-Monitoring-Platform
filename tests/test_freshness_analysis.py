import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_consumer_headers():
    res = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_freshness_analysis_execution():
    headers = get_consumer_headers()
    today = date.today()

    # 1. Create a food item to inspect
    create_res = client.post("/api/inventory", json={
        "food_name": "Vision Test Tomato",
        "category": "Vegetables",
        "quantity": 1.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }, headers=headers)
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # 2. Trigger AI Freshness Analysis
    analyze_res = client.post("/api/freshness/analyze", json={
        "inventory_id": item_id
    }, headers=headers)
    assert analyze_res.status_code == 200
    data = analyze_res.json()
    assert data["success"] is True
    assert "analysis" in data
    analysis = data["analysis"]
    assert "visual_score" in analysis
    assert 0.0 <= analysis["visual_score"] <= 100.0
    assert analysis["freshness_label"] in ["Fresh", "Expiring Soon", "Spoiled"]

    # 3. Verify inventory record was updated in database
    get_item = client.get(f"/api/inventory/{item_id}", headers=headers)
    assert get_item.status_code == 200
    updated_item = get_item.json()
    assert updated_item["freshness_status"] == analysis["freshness_label"]
    assert updated_item["freshness_score"] == analysis["visual_score"]


def test_freshness_analysis_nonexistent_item():
    headers = get_consumer_headers()
    res = client.post("/api/freshness/analyze", json={
        "inventory_id": "000000000000000000000000"
    }, headers=headers)
    assert res.status_code == 404
