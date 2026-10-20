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


def test_create_inventory_item_success():
    headers = get_consumer_headers()
    today = date.today()
    payload = {
        "food_name": "Organic Honeycrisp Apple",
        "category": "Fruits",
        "quantity": 3.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 4.0,
        "storage_humidity": 65.0,
        "location": "Crisper A",
        "batch_number": "BATCH-TEST-001"
    }
    res = client.post("/api/inventory", json=payload, headers=headers)
    assert res.status_code == 201
    item = res.json()
    assert item["food_name"] == "Organic Honeycrisp Apple"
    assert item["freshness_status"] == "Not Analyzed"
    assert "id" in item


def test_create_inventory_invalid_dates():
    headers = get_consumer_headers()
    today = date.today()
    payload = {
        "food_name": "Invalid Date Food",
        "category": "Vegetables",
        "quantity": 2.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),  # earlier than purchase
        "storage_type": "Refrigerated"
    }
    res = client.post("/api/inventory", json=payload, headers=headers)
    assert res.status_code == 422


def test_create_inventory_invalid_quantity():
    headers = get_consumer_headers()
    today = date.today()
    payload = {
        "food_name": "Negative Qty Food",
        "category": "Dairy",
        "quantity": -10.0,
        "unit": "liters",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }
    res = client.post("/api/inventory", json=payload, headers=headers)
    assert res.status_code == 422


def test_list_inventory_and_filters():
    headers = get_consumer_headers()

    # List all
    res = client.get("/api/inventory", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)

    # Search filter
    res_search = client.get("/api/inventory?search=Honeycrisp", headers=headers)
    assert res_search.status_code == 200

    # Category filter
    res_cat = client.get("/api/inventory?category=Fruits", headers=headers)
    assert res_cat.status_code == 200
    for item in res_cat.json():
        assert item["category"] == "Fruits"


def test_update_and_delete_inventory_item():
    headers = get_consumer_headers()
    today = date.today()

    # Create temporary item
    create_res = client.post("/api/inventory", json={
        "food_name": "Temp Lettuce",
        "category": "Vegetables",
        "quantity": 1.5,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }, headers=headers)
    item_id = create_res.json()["id"]

    # Update item
    update_res = client.put(f"/api/inventory/{item_id}", json={
        "quantity": 2.2,
        "location": "Upper Cold Shelf"
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["quantity"] == 2.2
    assert update_res.json()["location"] == "Upper Cold Shelf"

    # Delete item
    del_res = client.delete(f"/api/inventory/{item_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Confirm deletion
    get_res = client.get(f"/api/inventory/{item_id}", headers=headers)
    assert get_res.status_code == 404


def test_seed_dataset_inventory_endpoint():
    headers = get_consumer_headers()
    res = client.post("/api/inventory/seed-dataset", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["count"] >= 20
    assert "dataset food items" in data["message"].lower()

    # Verify seeded items contain dataset references
    inv_res = client.get("/api/inventory?search=Capsicum", headers=headers)
    assert inv_res.status_code == 200
    items = inv_res.json()
    assert any("DS-VEG-CAP" in (item.get("batch_number") or "") for item in items)


def test_seed_dataset_deduplication():
    headers = get_consumer_headers()
    # 1. Subsequent seed call
    res_second = client.post("/api/inventory/seed-dataset", headers=headers)
    assert res_second.status_code == 200
    data = res_second.json()
    assert data["success"] is True
    assert data["inserted"] == 0
    assert data["skipped"] >= 30
    assert "already present" in data["message"].lower() or "already loaded" in data["message"].lower()


def test_inventory_name_field_interoperability():
    headers = get_consumer_headers()
    today = date.today()
    payload = {
        "name": "Interoperable Golden Pear",
        "category": "Fruits",
        "quantity": 2.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=10)).strftime("%Y-%m-%d"),
        "storage_type": "refrigerator",  # tests lowercase normalization
    }
    res = client.post("/api/inventory", json=payload, headers=headers)
    assert res.status_code == 201
    item = res.json()
    assert item["food_name"] == "Interoperable Golden Pear"
    assert item["name"] == "Interoperable Golden Pear"
    assert item["storage_type"] == "Refrigerated"

    # Cleanup
    client.delete(f"/api/inventory/{item['id']}", headers=headers)


def test_inventory_sorting_options():
    headers = get_consumer_headers()
    for sort_param in ["expiry_date", "purchase_date", "food_name", "quantity"]:
        res_asc = client.get(f"/api/inventory?sort_by={sort_param}&sort_order=asc", headers=headers)
        assert res_asc.status_code == 200
        res_desc = client.get(f"/api/inventory?sort_by={sort_param}&sort_order=desc", headers=headers)
        assert res_desc.status_code == 200

