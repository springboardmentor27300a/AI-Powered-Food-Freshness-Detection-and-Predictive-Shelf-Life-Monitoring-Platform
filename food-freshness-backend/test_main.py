"""
Comprehensive Test Suite - Food Freshness Monitoring Platform
Covers: Auth, Food CRUD, Freshness Analytics, Role-Based Access, Notifications
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Use isolated SQLite test DB (no PostgreSQL needed for tests) ──
TEST_DATABASE_URL = "sqlite:///./test_freshness.db"

import os
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from main import app, get_db
from database import Base
import models

# ── Setup test DB ──────────────────────────────────────────────────
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ── Helpers ────────────────────────────────────────────────────────
def register_and_login(role="consumer"):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={
        "name": "Test User",
        "email": email,
        "password": "testpassword123",
        "role": role
    })
    res = client.post("/login", json={"email": email, "password": "testpassword123"})
    token = res.json()["access_token"]
    return email, token


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════════════════
# SECTION 1 - Health Check
# ══════════════════════════════════════════════════════════════════

def test_api_health():
    """API root should return alive message."""
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["message"] == "Food freshness API is alive"


# ══════════════════════════════════════════════════════════════════
# SECTION 2 - Authentication & User Management
# ══════════════════════════════════════════════════════════════════

def test_register_new_user():
    """A new user should register successfully."""
    email = f"test_{uuid.uuid4().hex}@example.com"
    res = client.post("/register", json={
        "name": "Jane Doe",
        "email": email,
        "password": "password123",
        "role": "consumer"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == email
    assert data["role"] == "consumer"
    assert "id" in data


def test_register_duplicate_email_rejected():
    """Registering with the same email twice should fail."""
    email = f"dupe_{uuid.uuid4().hex}@example.com"
    payload = {"name": "User", "email": email, "password": "pass123", "role": "consumer"}
    client.post("/register", json=payload)
    res = client.post("/register", json=payload)
    assert res.status_code == 400


def test_login_valid_credentials():
    """Valid login should return a JWT access token."""
    email, token = register_and_login()
    assert token is not None
    assert len(token) > 20


def test_login_wrong_password():
    """Wrong password should return 401."""
    email, _ = register_and_login()
    res = client.post("/login", json={"email": email, "password": "wrongpassword"})
    assert res.status_code == 401


def test_login_nonexistent_user():
    """Login with unknown email should return 401."""
    res = client.post("/login", json={"email": "nobody@nowhere.com", "password": "abc"})
    assert res.status_code == 401


def test_get_current_user_me():
    """Authenticated user should be able to fetch their own profile."""
    email, token = register_and_login()
    res = client.get("/me", headers=auth_header(token))
    assert res.status_code == 200
    assert res.json()["email"] == email


def test_unauthorized_access_blocked():
    """Protected routes should return 401 without a token."""
    for route in ["/food", "/me", "/freshness-summary", "/notifications"]:
        res = client.get(route)
        assert res.status_code == 401, f"Expected 401 on {route}, got {res.status_code}"


def test_invalid_token_rejected():
    """A fake/invalid JWT should be rejected."""
    res = client.get("/food", headers={"Authorization": "Bearer fake.token.here"})
    assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════
# SECTION 3 - Food Item CRUD
# ══════════════════════════════════════════════════════════════════

def test_add_food_item():
    """Authenticated user should be able to add a food item."""
    _, token = register_and_login()
    res = client.post("/food", json={
        "name": "Apple",
        "category": "Fruits",
        "quantity": 5,
        "expiry_date": "2026-12-31",
        "batch_number": "BATCH001",
        "storage_temp": 4.0,
        "humidity": 60.0,
        "packaging_type": "Loose"
    }, headers=auth_header(token))
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Apple"
    assert data["category"] == "Fruits"
    return data["id"], token


def test_list_food_items():
    """User should see their own food items."""
    _, token = register_and_login()
    client.post("/food", json={
        "name": "Banana", "category": "Fruits", "quantity": 3,
        "expiry_date": "2026-11-30", "packaging_type": "Loose"
    }, headers=auth_header(token))
    res = client.get("/food", headers=auth_header(token))
    assert res.status_code == 200
    items = res.json()
    assert any(i["name"] == "Banana" for i in items)


def test_edit_food_item():
    """User should be able to update their food item."""
    _, token = register_and_login()
    add_res = client.post("/food", json={
        "name": "Mango", "category": "Fruits", "quantity": 2,
        "expiry_date": "2026-10-15", "packaging_type": "Loose"
    }, headers=auth_header(token))
    food_id = add_res.json()["id"]

    edit_res = client.put(f"/food/{food_id}", json={
        "name": "Ripe Mango", "category": "Fruits", "quantity": 1,
        "expiry_date": "2026-10-10", "packaging_type": "Sealed Container"
    }, headers=auth_header(token))
    assert edit_res.status_code == 200
    assert edit_res.json()["name"] == "Ripe Mango"


def test_delete_food_item():
    """User should be able to delete their food item."""
    _, token = register_and_login()
    add_res = client.post("/food", json={
        "name": "Lettuce", "category": "Vegetables", "quantity": 1,
        "expiry_date": "2026-10-05", "packaging_type": "Open"
    }, headers=auth_header(token))
    food_id = add_res.json()["id"]

    del_res = client.delete(f"/food/{food_id}", headers=auth_header(token))
    assert del_res.status_code == 200

    # Confirm it's gone
    list_res = client.get("/food", headers=auth_header(token))
    ids = [i["id"] for i in list_res.json()]
    assert food_id not in ids


def test_cannot_delete_other_users_item():
    """User A should not be able to delete User B's food item."""
    _, token_a = register_and_login()
    _, token_b = register_and_login()

    add_res = client.post("/food", json={
        "name": "Strawberry", "category": "Fruits", "quantity": 10,
        "expiry_date": "2026-10-20", "packaging_type": "Loose"
    }, headers=auth_header(token_a))
    food_id = add_res.json()["id"]

    # User B tries to delete User A's item
    del_res = client.delete(f"/food/{food_id}", headers=auth_header(token_b))
    assert del_res.status_code == 404


# ══════════════════════════════════════════════════════════════════
# SECTION 4 - Freshness Analytics
# ══════════════════════════════════════════════════════════════════

def test_freshness_summary_returns_data():
    """Freshness summary endpoint should return valid structure."""
    _, token = register_and_login()
    client.post("/food", json={
        "name": "Orange", "category": "Fruits", "quantity": 1,
        "expiry_date": "2026-12-01", "packaging_type": "Loose"
    }, headers=auth_header(token))

    res = client.get("/freshness-summary", headers=auth_header(token))
    assert res.status_code == 200
    data = res.json()
    assert "total_items" in data
    assert "total_analyzed" in data
    assert "avg_quality_score" in data
    assert "fresh_count" in data
    assert "spoiled_count" in data
    assert data["total_items"] >= 1


def test_freshness_reports_endpoint():
    """Freshness reports endpoint should return a list."""
    _, token = register_and_login()
    res = client.get("/freshness-reports", headers=auth_header(token))
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_storage_log_endpoint():
    """Should be able to add a storage log for a food item."""
    _, token = register_and_login()
    add_res = client.post("/food", json={
        "name": "Carrot", "category": "Vegetables", "quantity": 5,
        "expiry_date": "2026-11-15", "packaging_type": "Refrigerated Pack"
    }, headers=auth_header(token))
    food_id = add_res.json()["id"]

    log_res = client.post(f"/food/{food_id}/storage-log", json={
        "temperature": 4.5,
        "humidity": 55.0,
        "air_circulation": "Good",
        "light_exposure": "Low"
    }, headers=auth_header(token))
    assert log_res.status_code == 200
    data = log_res.json()
    assert data["temperature"] == 4.5
    assert data["humidity"] == 55.0


def test_get_storage_logs():
    """Should be able to retrieve storage logs for a food item."""
    _, token = register_and_login()
    add_res = client.post("/food", json={
        "name": "Tomato", "category": "Vegetables", "quantity": 3,
        "expiry_date": "2026-10-25", "packaging_type": "Loose"
    }, headers=auth_header(token))
    food_id = add_res.json()["id"]

    client.post(f"/food/{food_id}/storage-log", json={
        "temperature": 8.0, "humidity": 70.0,
        "air_circulation": "Moderate", "light_exposure": "Medium"
    }, headers=auth_header(token))

    logs_res = client.get(f"/food/{food_id}/storage-logs", headers=auth_header(token))
    assert logs_res.status_code == 200
    assert len(logs_res.json()) >= 1


# ══════════════════════════════════════════════════════════════════
# SECTION 5 - Role-Based Access Control
# ══════════════════════════════════════════════════════════════════

def test_admin_sees_all_food_items():
    """Admin should see food items from all users."""
    _, consumer_token = register_and_login(role="consumer")
    _, admin_token = register_and_login(role="admin")

    # Consumer adds an item
    client.post("/food", json={
        "name": "AdminTestFruit", "category": "Fruits", "quantity": 1,
        "expiry_date": "2026-12-01", "packaging_type": "Loose"
    }, headers=auth_header(consumer_token))

    # Admin fetches all items
    res = client.get("/food", headers=auth_header(admin_token))
    assert res.status_code == 200
    names = [i["name"] for i in res.json()]
    assert "AdminTestFruit" in names


def test_inspector_sees_all_food_items():
    """Inspector should see food items from all users."""
    _, consumer_token = register_and_login(role="consumer")
    _, inspector_token = register_and_login(role="inspector")

    client.post("/food", json={
        "name": "InspectorTestVeg", "category": "Vegetables", "quantity": 2,
        "expiry_date": "2026-11-01", "packaging_type": "Open"
    }, headers=auth_header(consumer_token))

    res = client.get("/food", headers=auth_header(inspector_token))
    assert res.status_code == 200
    names = [i["name"] for i in res.json()]
    assert "InspectorTestVeg" in names


def test_retail_manager_sees_all_food_items():
    """Retail Manager should see food items from all users."""
    _, consumer_token = register_and_login(role="consumer")
    _, retail_token = register_and_login(role="retail_manager")

    client.post("/food", json={
        "name": "RetailTestItem", "category": "Dairy", "quantity": 4,
        "expiry_date": "2026-10-30", "packaging_type": "Sealed Container"
    }, headers=auth_header(consumer_token))

    res = client.get("/food", headers=auth_header(retail_token))
    assert res.status_code == 200
    names = [i["name"] for i in res.json()]
    assert "RetailTestItem" in names


def test_consumer_only_sees_own_items():
    """Consumer should NOT see other users' food items."""
    _, consumer_a_token = register_and_login(role="consumer")
    _, consumer_b_token = register_and_login(role="consumer")

    client.post("/food", json={
        "name": "PrivateItemA", "category": "Fruits", "quantity": 1,
        "expiry_date": "2026-12-01", "packaging_type": "Loose"
    }, headers=auth_header(consumer_a_token))

    res = client.get("/food", headers=auth_header(consumer_b_token))
    assert res.status_code == 200
    names = [i["name"] for i in res.json()]
    assert "PrivateItemA" not in names


# ══════════════════════════════════════════════════════════════════
# SECTION 6 - Notifications
# ══════════════════════════════════════════════════════════════════

def test_notifications_endpoint():
    """Notifications endpoint should return response with alerts and count."""
    _, token = register_and_login()
    res = client.get("/notifications", headers=auth_header(token))
    assert res.status_code == 200
    data = res.json()
    # API returns {"alerts": [...], "count": N}
    assert "alerts" in data
    assert "count" in data
    assert isinstance(data["alerts"], list)
    assert isinstance(data["count"], int)


# ══════════════════════════════════════════════════════════════════
# Cleanup
# ══════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    # Dispose all DB connections before deleting the file (Windows fix)
    engine.dispose()
    import os, time
    time.sleep(0.5)
    try:
        if os.path.exists("test_freshness.db"):
            os.remove("test_freshness.db")
    except PermissionError:
        pass  # File still locked, leave it — just a test artifact

