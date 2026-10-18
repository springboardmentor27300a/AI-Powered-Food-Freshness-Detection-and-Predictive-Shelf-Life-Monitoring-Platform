import uuid
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


def test_registration_validation():
    # 1. Invalid role should be rejected
    res = client.post("/api/auth/register", json={
        "name": "Invalid Role User",
        "email": "invalid_role_m1@test.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "TotallyUnknownRole"
    })
    assert res.status_code == 422

    # Admin registration succeeds
    adm_email = f"admin_reg_{uuid.uuid4().hex[:6]}@test.com"
    res_adm = client.post("/api/auth/register", json={
        "name": "Registered Admin",
        "email": adm_email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "Admin"
    })
    assert res_adm.status_code == 201
    assert res_adm.json()["role"] == "Admin"

    # 2. Password mismatch should be rejected
    res = client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "mismatch@test.com",
        "password": "Password123!",
        "confirm_password": "DifferentPassword123!",
        "role": "Consumer"
    })
    assert res.status_code == 422

    # 3. Successful registration
    test_email = f"tester_{date.today().strftime('%Y%m%d')}_{date.today().day}@example.com"
    res = client.post("/api/auth/register", json={
        "name": "Integration Tester",
        "email": test_email,
        "password": "TestPassword123!",
        "confirm_password": "TestPassword123!",
        "role": "Consumer"
    })
    # Could be 201 or 400 if already created in earlier test run
    assert res.status_code in [201, 400]


def test_login_and_auth_me():
    # 1. Invalid login credentials
    res = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "WrongPassword999!"
    })
    assert res.status_code == 401

    # 2. Valid consumer login
    res = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "consumer@foodfresh.com"
    token = data["access_token"]

    # 3. Verify /api/auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "consumer@foodfresh.com"

    # 4. Accessing /me without token fails
    assert client.get("/api/auth/me").status_code == 401


def test_role_based_access_control():
    # Login as consumer
    res_c = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    c_token = res_c.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # Consumer should NOT have permission to list all users
    res_users_c = client.get("/api/users", headers=c_headers)
    assert res_users_c.status_code == 403

    # Login as Admin
    res_a = client.post("/api/auth/login", json={
        "email": "admin@foodfresh.com",
        "password": "AdminPass123!"
    })
    assert res_a.status_code == 200
    a_token = res_a.json()["access_token"]
    a_headers = {"Authorization": f"Bearer {a_token}"}

    # Admin SHOULD have permission to list all users
    res_users_a = client.get("/api/users", headers=a_headers)
    assert res_users_a.status_code == 200
    assert len(res_users_a.json()) >= 1


def test_inventory_crud_and_validation():
    # Login as consumer
    res_login = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    today = date.today()

    # 1. Validation: Expiry earlier than purchase should fail
    bad_item = {
        "food_name": "Invalid Date Food",
        "category": "Fruits",
        "quantity": 2.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }
    assert client.post("/api/inventory", json=bad_item, headers=headers).status_code == 422

    # 2. Validation: Negative quantity should fail
    bad_qty = {
        "food_name": "Negative Food",
        "category": "Fruits",
        "quantity": -5.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated"
    }
    assert client.post("/api/inventory", json=bad_qty, headers=headers).status_code == 422

    # 3. Create valid food item
    valid_item = {
        "food_name": "Organic Honeycrisp Apple",
        "category": "Fruits",
        "quantity": 5.0,
        "unit": "kg",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 4.0,
        "storage_humidity": 60.0,
        "location": "Bottom Bin A",
        "batch_number": "TEST-CRISP-01"
    }
    create_res = client.post("/api/inventory", json=valid_item, headers=headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    item_id = created_data["id"]
    assert created_data["freshness_status"] == "Not Analyzed"
    assert created_data["food_name"] == "Organic Honeycrisp Apple"

    # 4. Get inventory list and verify search filter
    list_res = client.get("/api/inventory?search=Honeycrisp", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 5. Get individual item details
    detail_res = client.get(f"/api/inventory/{item_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == item_id

    # 6. Update item
    update_res = client.put(f"/api/inventory/{item_id}", json={
        "quantity": 4.2,
        "location": "Top Crisper Drawer"
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["quantity"] == 4.2
    assert update_res.json()["location"] == "Top Crisper Drawer"

    # 7. Delete item
    del_res = client.delete(f"/api/inventory/{item_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 8. Verifying item is gone
    get_after_del = client.get(f"/api/inventory/{item_id}", headers=headers)
    assert get_after_del.status_code == 404


def test_dashboard_stats():
    res_login = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/dashboard/stats", headers=headers)
    assert res.status_code == 200
    stats = res.json()
    assert "total_food_items" in stats
    assert "total_quantity" in stats
    assert "items_expiring_soon" in stats
    assert "freshness_analysis_pending" in stats
    assert "spoiled_items" in stats
    assert "storage_alerts" in stats


def test_future_endpoints_milestone_readiness():
    res_login = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    today = date.today()
    item_res = client.post("/api/inventory", json={
        "food_name": "Milestone Test Avocado",
        "category": "Fruits",
        "quantity": 3.0,
        "unit": "pieces",
        "purchase_date": today.strftime("%Y-%m-%d"),
        "expiry_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
        "storage_type": "Refrigerated",
        "storage_temperature": 4.0,
        "storage_humidity": 65.0
    }, headers=headers)
    assert item_res.status_code == 201
    item_id = item_res.json()["id"]

    res_fresh = client.post("/api/freshness/analyze", json={
        "inventory_id": item_id,
        "image_url": "/uploads/sample.jpg"
    }, headers=headers)
    assert res_fresh.status_code == 200
    assert res_fresh.json().get("success") is True or "analysis" in res_fresh.json()

    res_spoilage = client.post("/api/spoilage/detect", json={
        "inventory_id": item_id,
        "gas_sensor_ppm": 12.5
    }, headers=headers)
    assert res_spoilage.status_code == 200

    res_shelf = client.post("/api/shelf-life/predict", json={
        "inventory_id": item_id,
        "current_temp": 4.0,
        "current_humidity": 65.0
    }, headers=headers)
    assert res_shelf.status_code == 200

