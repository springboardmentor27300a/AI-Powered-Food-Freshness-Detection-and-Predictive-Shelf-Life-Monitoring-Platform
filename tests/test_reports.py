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


def test_reports_summary_endpoint():
    headers = get_consumer_headers()
    res = client.get("/api/reports/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "items" in data
    assert "metrics" in data["summary"]
    assert "compliance_status" in data["summary"]


def test_reports_csv_export():
    headers = get_consumer_headers()
    res = client.get("/api/reports/export-csv", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "attachment" in res.headers.get("content-disposition", "")
    # Check that CSV header row is present
    content = res.text
    assert "Food Name" in content
    assert "Category" in content
    assert "Freshness Score" in content


def test_batch_certificate_generation():
    headers = get_consumer_headers()
    today = date.today()

    create_res = client.post("/api/inventory", json={
        "food_name": "Certified Strawberries",
        "category": "Fruits",
        "quantity": 10.0,
        "unit": "packs",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }, headers=headers)
    item_id = create_res.json()["id"]

    res = client.get(f"/api/reports/batch/{item_id}", headers=headers)
    assert res.status_code == 200
    cert = res.json()
    assert "certificate_id" in cert
    assert cert["certificate_id"].startswith("CERT-")
    assert "visual_quality_score" in cert
    assert "predicted_remaining_shelf_life_days" in cert
    assert "compliance_summary" in cert
