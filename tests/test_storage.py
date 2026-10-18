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


def test_log_and_get_storage_conditions():
    headers = get_consumer_headers()
    today = date.today()

    # Create food item
    create_res = client.post("/api/inventory", json={
        "food_name": "Sensor Milk Carton",
        "category": "Dairy",
        "quantity": 1.0,
        "unit": "liters",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }, headers=headers)
    item_id = create_res.json()["id"]

    # Log telemetry
    log_res = client.post("/api/storage/conditions", json={
        "inventory_id": item_id,
        "temperature": 3.8,
        "humidity": 68.0,
        "storage_location": "Dairy Chiller Rack 2"
    }, headers=headers)
    assert log_res.status_code == 200
    assert log_res.json()["success"] is True

    # Retrieve telemetry
    get_res = client.get(f"/api/storage/conditions?inventory_id={item_id}", headers=headers)
    assert get_res.status_code == 200
    records = get_res.json()
    assert isinstance(records, list)
    assert len(records) >= 1
    assert records[0]["temperature"] == 3.8
