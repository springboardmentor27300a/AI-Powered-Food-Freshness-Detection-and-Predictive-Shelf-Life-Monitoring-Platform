"""
test_synthetic_m3.py — Verification Suite for Synthetic M3 Extension Categories

Validates:
1. All 5 synthetic categories accepted (Vegetables, Meat & Poultry, Bakery, Packaged Foods, Beverages)
2. Synthetic models correctly selected with prefix SYNTHETIC_ML_
3. data_type tag is strictly "SYNTHETIC"
4. Domain bounds validation functions properly on synthetic models
5. Unsupported packaging and out-of-bounds parameters are properly rejected (HTTP 422)
6. Database persistence preserves synthetic metadata and predictions

Uses shared conftest.py fixtures: client, db, setup_db, consumer_user, consumer_headers, etc.
"""

import pytest
import app.models  # noqa: F401 - Ensure all SQLAlchemy models are registered on Base.metadata


def get_auth_headers(client, email="synth_tester@example.com"):
    reg = client.post("/auth/register", json={
        "full_name": "Synthetic Tester",
        "email": email,
        "password": "testpassword123",
        "role": "consumer",
    })
    if reg.status_code == 201:
        token = reg.json()["access_token"]
    else:
        login = client.post("/auth/login", json={"email": email, "password": "testpassword123"})
        token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_synthetic_vegetables(client):
    headers = get_auth_headers(client, "synth_veg@example.com")
    res = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Vegetables",
        "temperature_c": 4.0,
        "humidity_pct": 90.0,
        "storage_duration_days": 2.0,
        "packaging_type": "perforated"
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["food_type"] == "vegetables"
    assert data["data_type"] == "SYNTHETIC"
    assert data["model_type"] == "SYNTHETIC_ML_RandomForestRegressor"
    assert data["remaining_shelf_life_days"] >= 0


def test_synthetic_meat_poultry(client):
    headers = get_auth_headers(client, "synth_meat@example.com")
    res = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Meat & Poultry",
        "temperature_c": 2.0,
        "humidity_pct": 75.0,
        "storage_duration_days": 1.0,
        "packaging_type": "vacuum_sealed"
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["food_type"] == "meat_poultry"
    assert data["data_type"] == "SYNTHETIC"
    assert data["model_type"] == "SYNTHETIC_ML_RandomForestRegressor"
    assert data["remaining_shelf_life_days"] >= 0


def test_synthetic_bakery(client):
    headers = get_auth_headers(client, "synth_bakery@example.com")
    res = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Bakery Products",
        "temperature_c": 20.0,
        "humidity_pct": 55.0,
        "storage_duration_days": 1.0,
        "packaging_type": "sealed"
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["food_type"] == "bakery"
    assert data["data_type"] == "SYNTHETIC"
    assert data["model_type"] == "SYNTHETIC_ML_RandomForestRegressor"
    assert data["remaining_shelf_life_days"] >= 0


def test_synthetic_packaged_foods(client):
    headers = get_auth_headers(client, "synth_pkg@example.com")
    res = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Packaged Foods",
        "temperature_c": 4.0,
        "humidity_pct": 55.0,
        "storage_duration_days": 3.0,
        "packaging_type": "sealed"
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["food_type"] == "packaged_foods"
    assert data["data_type"] == "SYNTHETIC"
    assert data["model_type"] == "SYNTHETIC_ML_RandomForestRegressor"
    assert data["remaining_shelf_life_days"] >= 0


def test_synthetic_beverages(client):
    headers = get_auth_headers(client, "synth_bev@example.com")
    res = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Beverages",
        "temperature_c": 4.0,
        "humidity_pct": 50.0,
        "storage_duration_days": 2.0,
        "packaging_type": "airtight"
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["food_type"] == "beverages"
    assert data["data_type"] == "SYNTHETIC"
    assert data["model_type"] == "SYNTHETIC_ML_RandomForestRegressor"
    assert data["remaining_shelf_life_days"] >= 0


def test_synthetic_domain_validation(client):
    headers = get_auth_headers(client, "synth_domain@example.com")
    
    # 1. Vegetables out of temperature bounds (25°C > max 12°C)
    res_veg = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Vegetables",
        "temperature_c": 25.0,
        "humidity_pct": 90.0,
        "storage_duration_days": 2.0,
        "packaging_type": "perforated"
    })
    assert res_veg.status_code == 422
    assert "outside validated ML domain" in res_veg.json()["detail"]

    # 2. Meat invalid packaging for synthetic domain
    res_meat = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Meat & Poultry",
        "temperature_c": 2.0,
        "humidity_pct": 75.0,
        "storage_duration_days": 1.0,
        "packaging_type": "paper"  # not in allowed_packaging for meat
    })
    assert res_meat.status_code == 422
    assert "outside validated ML domain" in res_meat.json()["detail"]


def test_synthetic_persistence_in_history(client):
    headers = get_auth_headers(client, "synth_persist@example.com")
    client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Beverages",
        "temperature_c": 4.0,
        "humidity_pct": 50.0,
        "storage_duration_days": 2.0,
        "packaging_type": "airtight"
    })
    
    history_res = client.get("/m3/shelf-life/history", headers=headers)
    assert history_res.status_code == 200
    items = history_res.json()
    assert len(items) >= 1
    assert items[0]["data_type"] == "SYNTHETIC"
    assert "SYNTHETIC_ML_" in items[0]["model_type"]
