import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_admin_can_list_users():
    # Login as Admin
    res_a = client.post("/api/auth/login", json={
        "email": "admin@foodfresh.com",
        "password": "AdminPass123!"
    })
    token = res_a.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_users = client.get("/api/users", headers=headers)
    assert res_users.status_code == 200
    users = res_users.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    # Ensure password hashes are never exposed
    for u in users:
        assert "password_hash" not in u


def test_consumer_forbidden_from_listing_users():
    # Login as Consumer
    res_c = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res_c.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_users = client.get("/api/users", headers=headers)
    assert res_users.status_code == 403
    assert "access denied" in res_users.json()["detail"].lower()


def test_user_can_view_own_profile_by_id():
    res_c = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    user_data = res_c.json()["user"]
    user_id = user_data["id"]
    token = res_c.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_self = client.get(f"/api/users/{user_id}", headers=headers)
    assert res_self.status_code == 200
    assert res_self.json()["id"] == user_id
