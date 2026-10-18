import uuid
from datetime import date
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_registration_success():
    email = f"auth_test_{uuid.uuid4().hex[:10]}@example.com"
    payload = {
        "name": "Auth Test User",
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "Consumer"
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == email
    assert "password_hash" not in data


def test_registration_duplicate_email():
    payload = {
        "name": "Duplicate Tester",
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!",
        "confirm_password": "ConsumerPass123!",
        "role": "Consumer"
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"].lower()


def test_registration_validation_errors():
    # Passwords do not match
    res1 = client.post("/api/auth/register", json={
        "name": "Mismatch Tester",
        "email": "mismatch@example.com",
        "password": "Password123!",
        "confirm_password": "WrongPassword123!",
        "role": "Consumer"
    })
    assert res1.status_code == 422

    # Invalid role is rejected
    res2 = client.post("/api/auth/register", json={
        "name": "Invalid Role Tester",
        "email": "invalid_role@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "SuperUserHacker"
    })
    assert res2.status_code == 422

    # Registering as Admin is allowed
    res3 = client.post("/api/auth/register", json={
        "name": "New Admin User",
        "email": f"new_admin_{uuid.uuid4().hex[:6]}@example.com",
        "password": "AdminPass123!",
        "confirm_password": "AdminPass123!",
        "role": "Admin"
    })
    assert res3.status_code == 201
    assert res3.json()["role"] == "Admin"


def test_login_success_and_jwt_format():
    res = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "consumer@foodfresh.com"


def test_login_invalid_credentials():
    res = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "WrongPassword999!"
    })
    assert res.status_code == 401


def test_auth_me_protected_route():
    # Login to obtain token
    res_login = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Valid token
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "consumer@foodfresh.com"

    # Missing token
    res_unauth = client.get("/api/auth/me")
    assert res_unauth.status_code == 401

    # Malformed token
    res_bad = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert res_bad.status_code == 401
