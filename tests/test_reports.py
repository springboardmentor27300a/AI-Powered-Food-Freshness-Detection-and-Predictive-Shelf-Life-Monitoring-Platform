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


def test_visual_reports_summary_cards_and_charts():
    headers = get_consumer_headers()
    res = client.get("/api/reports/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # 1. Summary Cards Verification
    assert "summary_cards" in data
    cards = data["summary_cards"]
    assert "total_products" in cards
    assert "fresh_products" in cards
    assert "expired_products" in cards
    assert "spoiled_products" in cards
    assert "at_risk_products" in cards
    assert "not_analyzed_products" in cards
    assert "nearing_expiry_products" in cards
    assert "percentages" in cards

    # Mutually exclusive sum check
    total = cards["total_products"]
    sum_core = (
        cards["fresh_products"] +
        cards["expired_products"] +
        cards["spoiled_products"] +
        cards["at_risk_products"] +
        cards["not_analyzed_products"]
    )
    assert sum_core == total

    # 2. Charts Verification (All 6 charts)
    assert "charts" in data
    charts = data["charts"]

    # Chart A: Freshness Distribution (Doughnut)
    assert "freshness_distribution" in charts
    chart_a = charts["freshness_distribution"]
    assert set(chart_a["labels"]) == {"Fresh", "At Risk", "Spoiled", "Expired", "Not Analyzed"}
    assert sum(chart_a["counts"]) == total

    # Chart B: Food Inventory Status (Bar)
    assert "inventory_status" in charts
    chart_b = charts["inventory_status"]
    assert len(chart_b["labels"]) == 6
    assert "Nearing Expiry" in chart_b["labels"][5]

    # Chart C: Category-Wise Food Status (Stacked Bar)
    assert "category_status" in charts
    chart_c = charts["category_status"]
    assert "categories" in chart_c
    assert "fresh" in chart_c
    assert "at_risk" in chart_c
    assert "spoiled" in chart_c
    assert "expired" in chart_c
    assert "not_analyzed" in chart_c

    # Chart D: Expiry Timeline (Bar/Line)
    assert "expiry_timeline" in charts
    chart_d = charts["expiry_timeline"]
    assert len(chart_d["buckets"]) == 6
    assert sum(chart_d["counts"]) == total

    # Chart E: Freshness Score Distribution (Histogram)
    assert "freshness_score_distribution" in charts
    chart_e = charts["freshness_score_distribution"]
    assert len(chart_e["ranges"]) == 5
    assert "total_analyzed" in chart_e
    assert chart_e["total_analyzed"] <= total

    # Chart F: Food Waste Analysis (Bar)
    assert "food_waste" in charts
    chart_f = charts["food_waste"]
    assert "total_waste_items" in chart_f
    assert "total_waste_quantity" in chart_f
    assert "waste_by_category" in chart_f


def test_visual_reports_filtering():
    headers = get_consumer_headers()

    # Filter by category
    res_cat = client.get("/api/reports/summary?category=Fruits", headers=headers)
    assert res_cat.status_code == 200
    data_cat = res_cat.json()
    for item in data_cat["items"]:
        assert item["category"] == "Fruits"

    # Filter by status
    res_status = client.get("/api/reports/summary?status=Fresh", headers=headers)
    assert res_status.status_code == 200
    data_status = res_status.json()
    for item in data_status["items"]:
        assert item["computed_status"] == "Fresh"

    # Filter by search
    res_search = client.get("/api/reports/summary?search=Certified", headers=headers)
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert len(data_search["items"]) >= 1
    assert "Certified" in data_search["items"][0]["food_name"]

    # Filter by expiry horizon
    res_horizon = client.get("/api/reports/summary?expiry_horizon=3days", headers=headers)
    assert res_horizon.status_code == 200
    data_horizon = res_horizon.json()
    for item in data_horizon["items"]:
        days = item.get("days_to_expiry")
        if days is not None:
            assert 0 <= days <= 3


def test_filtered_csv_export():
    headers = get_consumer_headers()
    res = client.get("/api/reports/export-csv?category=Fruits&status=Fresh", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    content = res.text
    # Verify header row
    assert "Food Name" in content
    assert "Days to Expiry" in content
    assert "Inventory Status" in content
    assert "Nearing Expiry" in content
    assert "Last Analyzed" in content


def test_pdf_report_export():
    headers = get_consumer_headers()
    res = client.get("/api/reports/export-pdf", headers=headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    assert "attachment" in res.headers.get("content-disposition", "")
    assert res.content.startswith(b"%PDF")
    # Multi-page visual report with embedded Pie & Bar charts and tables should be well over 3KB
    assert len(res.content) > 3000


def test_filtered_pdf_report_export():
    headers = get_consumer_headers()
    res = client.get("/api/reports/export-pdf?category=Fruits&status=Fresh&expiry_horizon=all", headers=headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers.get("content-type", "")
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 3000

