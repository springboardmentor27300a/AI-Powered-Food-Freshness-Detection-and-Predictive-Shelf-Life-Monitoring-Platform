import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_admin_headers():
    res = client.post("/api/auth/login", json={
        "email": "admin@foodfresh.com",
        "password": "AdminPass123!"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_executive_analytics_kpis_and_charts():
    headers = get_admin_headers()
    res = client.get("/api/analytics/executive", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "kpis" in data
    kpis = data["kpis"]
    assert "total_inventory_items" in kpis
    assert "total_inventory_quantity" in kpis
    assert "total_freshness_analyses" in kpis
    assert "fresh_items_count" in kpis
    assert "moderately_fresh_count" in kpis
    assert "spoiled_or_high_risk_count" in kpis
    assert "average_quality_score" in kpis
    assert "average_predicted_remaining_days" in kpis
    assert "items_approaching_expiry" in kpis
    assert "active_storage_alerts" in kpis
    assert "estimated_inventory_waste_usd" in kpis

    assert "charts" in data
    charts = data["charts"]
    assert "freshness_distribution" in charts
    assert "category_analysis" in charts
    assert "shelf_life_distribution" in charts
    assert "storage_monitoring" in charts

    assert "insights" in data
    assert isinstance(data["insights"], list)
    assert len(data["insights"]) >= 1


def test_executive_analytics_filtering():
    headers = get_admin_headers()
    # Filter by category
    res = client.get("/api/analytics/executive?category=Fruits", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
