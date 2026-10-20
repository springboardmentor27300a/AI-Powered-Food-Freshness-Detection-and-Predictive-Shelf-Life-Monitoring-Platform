import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_retailer_headers():
    res = client.post("/api/auth/login", json={
        "email": "retailer@foodfresh.com",
        "password": "RetailerPass123!"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_retailer_dashboard_kpis_and_charts():
    headers = get_retailer_headers()
    res = client.get("/api/retailer/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    kpis = data["kpis"]
    assert "total_products" in kpis
    assert "fresh_products" in kpis
    assert "at_risk_products" in kpis
    assert "spoiled_products" in kpis
    assert "products_nearing_expiry" in kpis
    assert "total_food_waste" in kpis
    assert "charts" in data
    assert "freshness_distribution" in data["charts"]
    assert "category_breakdown" in data["charts"]
    assert "recent_scans" in data


def test_retailer_crud_and_sorting():
    headers = get_retailer_headers()
    today = date.today()

    # 1. Create product
    payload = {
        "food_name": "Retail Test Gala Apples",
        "category": "Fruits",
        "quantity": 40.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=10)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 3.0,
        "storage_humidity": 70.0,
        "location": "Aisle 4 Chiller",
        "batch_number": "BATCH-RET-999",
        "low_stock_threshold": 10.0
    }
    create_res = client.post("/api/retailer/inventory", json=payload, headers=headers)
    assert create_res.status_code == 201
    item = create_res.json()
    item_id = item["id"]
    assert item["food_name"] == "Retail Test Gala Apples"

    # 2. Get product details
    get_res = client.get(f"/api/retailer/inventory/{item_id}", headers=headers)
    assert get_res.status_code == 200
    details = get_res.json()
    assert details["quantity"] == 40.0
    assert len(details.get("stock_history", [])) >= 1

    # 3. Search by name & ID
    search_name_res = client.get("/api/retailer/inventory?search=Gala", headers=headers)
    assert search_name_res.status_code == 200
    assert any(p["id"] == item_id for p in search_name_res.json())

    search_id_res = client.get(f"/api/retailer/inventory?search={item_id}", headers=headers)
    assert search_id_res.status_code == 200
    assert any(p["id"] == item_id for p in search_id_res.json())

    # 4. Sorting
    sort_res = client.get("/api/retailer/inventory?sort_by=quantity&sort_order=desc", headers=headers)
    assert sort_res.status_code == 200
    items = sort_res.json()
    assert len(items) >= 1

    # 5. Update product (edit)
    update_payload = {
        "food_name": "Retail Test Gala Apples Deluxe",
        "quantity": 38.0,
        "location": "Aisle 4 Front Display"
    }
    put_res = client.put(f"/api/retailer/inventory/{item_id}", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["food_name"] == "Retail Test Gala Apples Deluxe"
    assert updated["location"] == "Aisle 4 Front Display"

    # 6. Adjust Stock
    stock_payload = {
        "quantity": 25.0,
        "adjustment_type": "set",
        "reason": "Mid-week floor recount"
    }
    patch_res = client.patch(f"/api/retailer/inventory/{item_id}/stock", json=stock_payload, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["quantity"] == 25.0

    # 7. Delete product
    del_res = client.delete(f"/api/retailer/inventory/{item_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 8. Verify 404 after deletion
    verify_res = client.get(f"/api/retailer/inventory/{item_id}", headers=headers)
    assert verify_res.status_code == 404
