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


def test_shelf_life_prediction_arrhenius():
    headers = get_consumer_headers()
    today = date.today()

    # Create food item
    create_res = client.post("/api/inventory", json={
        "food_name": "Shelf Life Test Berries",
        "category": "Fruits",
        "quantity": 1.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=8)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 4.0,
        "storage_humidity": 70.0
    }, headers=headers)
    item_id = create_res.json()["id"]

    # Predict shelf life under normal refrigerated conditions (4°C)
    res_cold = client.post("/api/shelf-life/predict", json={
        "inventory_id": item_id,
        "current_temp": 4.0
    }, headers=headers)
    assert res_cold.status_code == 200
    pred_cold = res_cold.json()["prediction"]
    assert "predicted_remaining_days" in pred_cold
    assert "forecast_7_days" in pred_cold
    assert len(pred_cold["forecast_7_days"]) == 7

    # Predict under warm abusive condition (28°C) -> temperature acceleration factor increases decay
    res_warm = client.post("/api/shelf-life/predict", json={
        "inventory_id": item_id,
        "current_temp": 28.0
    }, headers=headers)
    assert res_warm.status_code == 200
    pred_warm = res_warm.json()["prediction"]
    assert pred_warm["predicted_remaining_days"] <= pred_cold["predicted_remaining_days"]
    assert pred_warm["temp_acceleration_factor"] > pred_cold["temp_acceleration_factor"]


def test_spoilage_detection_endpoint():
    headers = get_consumer_headers()
    today = date.today()

    create_res = client.post("/api/inventory", json={
        "food_name": "Spoilage Probe Fish",
        "category": "Fish",
        "quantity": 2.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }, headers=headers)
    item_id = create_res.json()["id"]

    res = client.post("/api/spoilage/detect", json={
        "inventory_id": item_id,
        "gas_sensor_ppm": 25.0
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "spoilage_probability" in data
    assert "spoilage_risk_level" in data
    assert 0.0 <= data["spoilage_probability"] <= 1.0
