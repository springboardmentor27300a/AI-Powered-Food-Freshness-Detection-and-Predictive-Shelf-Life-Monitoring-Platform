import uuid
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_retailer_inventory_crud_and_validation():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    # 1. Validation: Negative quantity should fail (422)
    bad_qty = {
        "food_name": "Negative Item",
        "category": "Fruits",
        "quantity": -2.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }
    assert client.post("/api/retailer/inventory", json=bad_qty, headers=headers).status_code == 422

    # 2. Validation: Expiry earlier than purchase should fail (422)
    bad_dates = {
        "food_name": "Backwards Date Item",
        "category": "Dairy",
        "quantity": 5.0,
        "unit": "packs",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }
    assert client.post("/api/retailer/inventory", json=bad_dates, headers=headers).status_code == 422

    # 3. Create Valid Product
    valid_prod = {
        "food_name": "Retail Organic Honeycrisp Apples",
        "category": "Fruits",
        "quantity": 50.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=10)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 4.0,
        "storage_humidity": 85.0,
        "location": "Aisle 3 Cold Display",
        "batch_number": "BATCH-RET-HC-01",
        "low_stock_threshold": 10.0
    }
    create_res = client.post("/api/retailer/inventory", json=valid_prod, headers=headers)
    assert create_res.status_code == 201
    item = create_res.json()
    item_id = item["id"]
    assert item["food_name"] == "Retail Organic Honeycrisp Apples"
    assert item["quantity"] == 50.0
    assert item["is_archived"] is False
    assert item["is_low_stock"] is False

    # 4. Get Product Details
    get_res = client.get(f"/api/retailer/inventory/{item_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == item_id

    # 5. Update Product Details
    update_res = client.put(f"/api/retailer/inventory/{item_id}", json={
        "location": "Aisle 3 Premium Display",
        "storage_temperature": 3.8
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["location"] == "Aisle 3 Premium Display"

    # 6. List Products with search
    list_res = client.get("/api/retailer/inventory?search=Honeycrisp", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert any(i["id"] == item_id for i in items)


def test_stock_management_and_negative_rejection():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    # Create product with 20 units
    create_res = client.post("/api/retailer/inventory", json={
        "food_name": "Stock Test Milk Bottles",
        "category": "Dairy",
        "quantity": 20.0,
        "unit": "liters",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "low_stock_threshold": 8.0
    }, headers=headers)
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]

    # Deduct 5 units (now 15)
    deduct_res = client.patch(f"/api/retailer/inventory/{item_id}/stock", json={
        "quantity": 5.0,
        "adjustment_type": "deduct",
        "reason": "Retail customer checkout"
    }, headers=headers)
    assert deduct_res.status_code == 200
    assert deduct_res.json()["quantity"] == 15.0
    assert deduct_res.json()["is_low_stock"] is False

    # Deduct 10 units (now 5, which is <= 8 threshold, so is_low_stock should be True)
    low_res = client.patch(f"/api/retailer/inventory/{item_id}/stock", json={
        "quantity": 10.0,
        "adjustment_type": "deduct",
        "reason": "Store promotion sale"
    }, headers=headers)
    assert low_res.status_code == 200
    assert low_res.json()["quantity"] == 5.0
    assert low_res.json()["is_low_stock"] is True

    # Rejection: Deducting more than current stock should fail (cannot be negative)
    fail_res = client.patch(f"/api/retailer/inventory/{item_id}/stock", json={
        "quantity": 10.0,
        "adjustment_type": "deduct",
        "reason": "Invalid excessive deduction"
    }, headers=headers)
    assert fail_res.status_code in [400, 422]

    # Add 15 units (now 20)
    add_res = client.patch(f"/api/retailer/inventory/{item_id}/stock", json={
        "quantity": 15.0,
        "adjustment_type": "add",
        "reason": "Delivery restocking"
    }, headers=headers)
    assert add_res.status_code == 200
    assert add_res.json()["quantity"] == 20.0
    assert add_res.json()["is_low_stock"] is False


def test_archive_product_functionality():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    create_res = client.post("/api/retailer/inventory", json={
        "food_name": "Seasonal Pumpkin Spice Bread",
        "category": "Bakery",
        "quantity": 12.0,
        "unit": "loaves",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=4)).strftime("%Y-%m-%d"),
        "storage_type": "Room Temperature"
    }, headers=headers)
    item_id = create_res.json()["id"]

    # Archive the item
    arch_res = client.patch(f"/api/retailer/inventory/{item_id}/archive", json={
        "is_archived": True,
        "reason": "End of seasonal promotion"
    }, headers=headers)
    assert arch_res.status_code == 200
    assert arch_res.json()["is_archived"] is True

    # Active inventory listing should not include it
    active_list = client.get("/api/retailer/inventory?is_archived=false", headers=headers).json()
    assert not any(i["id"] == item_id for i in active_list)

    # Archived inventory listing should include it
    arch_list = client.get("/api/retailer/inventory?is_archived=true", headers=headers).json()
    assert any(i["id"] == item_id for i in arch_list)


def test_cross_retailer_access_isolation():
    # User 1: Retailer
    token_ret1 = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers1 = {"Authorization": f"Bearer {token_ret1}"}
    today = date.today()

    create_res = client.post("/api/retailer/inventory", json={
        "food_name": "Retailer 1 Secret Stock",
        "category": "Fish",
        "quantity": 5.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
        "storage_type": "Cold Storage"
    }, headers=headers1)
    item_id = create_res.json()["id"]

    # Register Retailer 2
    email2 = f"retailer2_{uuid.uuid4().hex[:10]}@foodfresh.com"
    reg_res = client.post("/api/auth/register", json={
        "name": "Second Retailer Store",
        "email": email2,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "Retailer"
    })
    assert reg_res.status_code == 201

    token_ret2 = get_token(email2, "Password123!")
    headers2 = {"Authorization": f"Bearer {token_ret2}"}

    # Retailer 2 attempts to get Retailer 1's item -> MUST be 403 Forbidden!
    assert client.get(f"/api/retailer/inventory/{item_id}", headers=headers2).status_code == 403

    # Retailer 2 attempts to update Retailer 1's stock -> MUST be 403 Forbidden!
    assert client.patch(f"/api/retailer/inventory/{item_id}/stock", json={
        "quantity": 999.0,
        "adjustment_type": "set"
    }, headers=headers2).status_code == 403

    # Retailer 2 attempts to delete Retailer 1's item -> MUST be 403 Forbidden!
    assert client.delete(f"/api/retailer/inventory/{item_id}", headers=headers2).status_code == 403


def test_ai_freshness_analysis_on_retailer_product():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    create_res = client.post("/api/retailer/inventory", json={
        "food_name": "Retail Hass Avocados",
        "category": "Fruits",
        "quantity": 30.0,
        "unit": "pieces",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 4.0,
        "storage_humidity": 85.0
    }, headers=headers)
    item_id = create_res.json()["id"]

    # Trigger live analysis
    analyze_res = client.post(f"/api/retailer/inventory/{item_id}/analyze", json={}, headers=headers)
    assert analyze_res.status_code == 200
    data = analyze_res.json()
    assert data["success"] is True
    assert "analysis" in data
    assert "visual_score" in data["analysis"]
    assert "freshness_label" in data["analysis"]
    assert "shelf_life_prediction" in data
    assert "prescriptive_recommendations" in data

    # Verify updated inventory item has score
    updated_prod = client.get(f"/api/retailer/inventory/{item_id}", headers=headers).json()
    assert updated_prod["freshness_score"] is not None
    assert updated_prod["freshness_status"] in ["Fresh", "Moderate", "Moderately Fresh", "Spoiled"]


def test_expiry_tracking_and_shelf_life_monitoring():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Expiry tracking
    exp_res = client.get("/api/retailer/expiry?threshold_days=7", headers=headers)
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert "summary" in exp_data
    assert "expired" in exp_data
    assert "approaching_expiry" in exp_data
    assert "safe" in exp_data

    # Shelf-life monitoring
    shelf_res = client.get("/api/retailer/shelf-life", headers=headers)
    assert shelf_res.status_code == 200
    assert isinstance(shelf_res.json(), list)


def test_spoilage_alerts_and_acknowledgement():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    alerts_res = client.get("/api/retailer/alerts", headers=headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert isinstance(alerts, list)

    if len(alerts) > 0:
        alert_id = alerts[0]["id"]
        ack_res = client.patch(f"/api/retailer/alerts/{alert_id}/acknowledge", json={
            "note": "Checked product display; clearance tag applied."
        }, headers=headers)
        assert ack_res.status_code == 200
        assert ack_res.json()["success"] is True


def test_storage_monitoring_compliance():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    storage_res = client.get("/api/retailer/storage", headers=headers)
    assert storage_res.status_code == 200
    items = storage_res.json()
    assert isinstance(items, list)
    if len(items) > 0:
        assert "recommended_temperature" in items[0]
        assert "compliance_status" in items[0]


def test_waste_reduction_prioritization():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    waste_res = client.get("/api/retailer/waste-reduction", headers=headers)
    assert waste_res.status_code == 200
    data = waste_res.json()
    assert "summary" in data
    assert "urgent_action" in data
    assert "critical_clearance" in data


def test_retailer_analytics_and_csv_export():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Dashboard overview
    dash_res = client.get("/api/retailer/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "kpis" in dash_data
    assert "charts" in dash_data

    # Analytics
    analytics_res = client.get("/api/retailer/analytics", headers=headers)
    assert analytics_res.status_code == 200
    assert "kpis" in analytics_res.json()
    assert "charts" in analytics_res.json()

    # CSV Export
    csv_res = client.get("/api/retailer/reports/export-csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Product ID,Product Name,Category" in csv_res.text


def test_retailer_notifications():
    token = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    notif_res = client.get("/api/retailer/notifications", headers=headers)
    assert notif_res.status_code == 200
    assert isinstance(notif_res.json(), list)

    read_all = client.patch("/api/retailer/notifications/read-all", headers=headers)
    assert read_all.status_code == 200


def test_rbac_security_enforcement():
    # 1. Unauthenticated request -> 401
    assert client.get("/api/retailer/dashboard").status_code == 401

    # 2. Consumer role -> 403 Forbidden on Retailer endpoints
    token_consumer = get_token("consumer@foodfresh.com", "ConsumerPass123!")
    headers_consumer = {"Authorization": f"Bearer {token_consumer}"}
    assert client.get("/api/retailer/dashboard", headers=headers_consumer).status_code == 403
    assert client.get("/api/retailer/inventory", headers=headers_consumer).status_code == 403

    # 3. Warehouse Manager role -> 403 Forbidden on Retailer endpoints
    token_wh = get_token("warehouse@foodfresh.com", "WarehousePass123!")
    headers_wh = {"Authorization": f"Bearer {token_wh}"}
    assert client.get("/api/retailer/dashboard", headers=headers_wh).status_code == 403

    # 4. Retailer role -> 403 Forbidden on Admin endpoint (/api/users)
    token_ret = get_token("retailer@foodfresh.com", "RetailerPass123!")
    headers_ret = {"Authorization": f"Bearer {token_ret}"}
    assert client.get("/api/users", headers=headers_ret).status_code == 403
