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


def test_item_prescriptive_recommendations():
    headers = get_consumer_headers()
    today = date.today()

    create_res = client.post("/api/inventory", json={
        "food_name": "Recommendation Test Apples",
        "category": "Fruits",
        "quantity": 5.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),  # Near expiry
        "storage_type": "Refrigerated",
        "storage_temperature": 12.0,  # Elevated temperature triggering recommendation
        "storage_humidity": 45.0
    }, headers=headers)
    item_id = create_res.json()["id"]

    res = client.get(f"/api/recommendations/{item_id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "recommendations" in data
    recs = data["recommendations"]

    assert "storage_recommendations" in recs
    assert len(recs["storage_recommendations"]) > 0
    # Should detect temperature is too high (> 6°C for fruits)
    assert any("above" in r.lower() or "lower" in r.lower() for r in recs["storage_recommendations"])

    assert "consumption_recommendations" in recs
    assert "fefo_priority" in recs
    assert "recommended_markdown_discount_pct" in recs
