"""
test_m3.py — FreshGuard M3 Shelf-Life Inference & Integration Test Suite

Tests:
  1. Approved Production ML Predictions (Tomato, Paneer, Seafood) -> REAL/TRACEABLE
  2. Unsupported / Blocked categories return HTTP 422 (e.g. Avocado, Apple, Mango)
  3. Out-of-domain input values return HTTP 422
  4. History, Recommendations, and Analytics data flow
"""

def get_auth_headers(client, email="m3user@example.com"):
    reg = client.post("/auth/register", json={
        "full_name": "M3 Integration Test User",
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


def test_approved_ml_predictions(client):
    headers = get_auth_headers(client, "approved_ml@example.com")

    # 1. Tomato ML Prediction
    res_tomato = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Tomato",
        "temperature_c": 22.5,
        "humidity_pct": 70.0,
        "storage_duration_days": 2.0,
        "packaging_type": "uncoated",
        "nled_level": 0,
        "bwc_level": 0
    })
    assert res_tomato.status_code == 201, res_tomato.text
    data_tomato = res_tomato.json()
    assert data_tomato["food_type"] == "tomato"
    assert data_tomato["data_type"] == "REAL/TRACEABLE"
    assert data_tomato["model_type"] == "ML_RandomForestRegressor"
    assert data_tomato["remaining_shelf_life_days"] >= 0
    assert data_tomato["confidence"] is None  # Transparent null confidence

    # 2. Paneer ML Prediction
    res_paneer = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Paneer",
        "temperature_c": 7.0,
        "humidity_pct": 37.0,
        "storage_duration_days": 2.0,
        "packaging_type": "sealed"
    })
    assert res_paneer.status_code == 201, res_paneer.text
    data_paneer = res_paneer.json()
    assert data_paneer["food_type"] == "paneer"
    assert data_paneer["data_type"] == "REAL/TRACEABLE"
    assert data_paneer["model_type"] == "ML_LinearRegression"
    assert data_paneer["remaining_shelf_life_days"] == 7
    assert data_paneer["confidence"] is None

    # 3. Seafood ML Prediction
    res_seafood = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Seafood",
        "species": "mackerel",
        "temperature_c": 1.0,
        "humidity_pct": 85.0,
        "storage_duration_days": 1.0,
        "packaging_type": "open"
    })
    assert res_seafood.status_code == 201, res_seafood.text
    data_seafood = res_seafood.json()
    assert data_seafood["food_type"] == "seafood"
    assert data_seafood["data_type"] == "REAL/TRACEABLE"
    assert data_seafood["model_type"] == "ML_RandomForestRegressor"
    assert data_seafood["remaining_shelf_life_days"] == 2
    assert data_seafood["confidence"] is None


def test_unsupported_categories_return_422(client):
    headers = get_auth_headers(client, "unsupported@example.com")
    unsupported_list = ["Avocado", "Apple", "Banana", "Dragonfruit", "Pineapple"]

    for cat in unsupported_list:
        res = client.post("/m3/shelf-life/predict", headers=headers, json={
            "food_type": cat,
            "temperature_c": 4.0,
            "humidity_pct": 75.0,
            "storage_duration_days": 1.0,
            "packaging_type": "sealed"
        })
        assert res.status_code == 422, f"Failed to reject category {cat}: {res.text}"
        assert res.json()["detail"] == "ML shelf-life prediction is currently unsupported for this food category."


def test_out_of_domain_inputs_return_422(client):
    headers = get_auth_headers(client, "ood@example.com")

    # 1. Tomato at 4°C (outside 20-25°C domain)
    res_tomato = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Tomato",
        "temperature_c": 4.0,
        "humidity_pct": 70.0,
        "storage_duration_days": 2.0,
        "packaging_type": "uncoated"
    })
    assert res_tomato.status_code == 422
    assert "outside validated ML domain" in res_tomato.json()["detail"]

    # 2. Paneer at 25°C (outside 4-8°C domain)
    res_paneer = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Paneer",
        "temperature_c": 25.0,
        "humidity_pct": 37.0,
        "storage_duration_days": 2.0,
        "packaging_type": "sealed"
    })
    assert res_paneer.status_code == 422

    # 3. Seafood duration 10 days (outside 0-3 days domain)
    res_seafood = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Seafood",
        "temperature_c": 1.0,
        "humidity_pct": 85.0,
        "storage_duration_days": 10.0,
        "packaging_type": "open"
    })
    assert res_seafood.status_code == 422


def test_history_recommendations_analytics(client):
    headers = get_auth_headers(client, "history@example.com")

    pred = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Paneer",
        "temperature_c": 7.0,
        "humidity_pct": 37.0,
        "storage_duration_days": 2.0,
        "packaging_type": "sealed"
    })
    assert pred.status_code == 201
    pred_id = pred.json()["id"]

    # History
    history = client.get("/m3/shelf-life/history", headers=headers)
    assert history.status_code == 200
    assert len(history.json()) >= 1

    # Recommendations
    recs = client.get(f"/m3/recommendations/{pred_id}", headers=headers)
    assert recs.status_code == 200
    assert len(recs.json()) >= 1

    # Analytics
    analytics = client.get("/m3/analytics", headers=headers)
    assert analytics.status_code == 200
    assert analytics.json()["total_predictions"] >= 1
