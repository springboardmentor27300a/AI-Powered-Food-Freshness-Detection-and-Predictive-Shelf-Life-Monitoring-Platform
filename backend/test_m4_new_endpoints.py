"""
test_m4_new_endpoints.py -- Tests for newly added M4 endpoints

Covers:
  - PUT /auth/me  (profile update: name change, password change)
  - PUT /inventory/{food_id}  (inventory item partial update)
  - GET /auth/me  still works after profile update
"""

import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _register_and_login(client, suffix=""):
    payload = {
        "full_name": f"Test User{suffix}",
        "email": f"m4test{suffix}@example.com",
        "password": "TestPass1!",
        "role": "consumer",
    }
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["user"], data["access_token"]


# ---------------------------------------------------------------------------
# PUT /auth/me -- profile update
# ---------------------------------------------------------------------------

class TestPutAuthMe:
    def test_update_full_name(self, client):
        user, token = _register_and_login(client, suffix="_name1")
        resp = client.put(
            "/auth/me",
            json={"full_name": "Updated Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["full_name"] == "Updated Name"
        assert data["email"] == user["email"]

    def test_get_me_reflects_updated_name(self, client):
        user, token = _register_and_login(client, suffix="_name2")
        client.put(
            "/auth/me",
            json={"full_name": "Reflected Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Reflected Name"

    def test_change_password_success(self, client):
        _, token = _register_and_login(client, suffix="_pw1")
        resp = client.put(
            "/auth/me",
            json={"current_password": "TestPass1!", "new_password": "NewPass2@"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text

    def test_change_password_wrong_current(self, client):
        _, token = _register_and_login(client, suffix="_pw2")
        resp = client.put(
            "/auth/me",
            json={"current_password": "WrongPass!", "new_password": "NewPass2@"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401

    def test_new_password_without_current_fails(self, client):
        _, token = _register_and_login(client, suffix="_pw3")
        resp = client.put(
            "/auth/me",
            json={"new_password": "NewPass2@"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_empty_body_is_no_op(self, client):
        user, token = _register_and_login(client, suffix="_noop")
        resp = client.put(
            "/auth/me",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == user["full_name"]

    def test_unauthenticated_rejected(self, client):
        resp = client.put("/auth/me", json={"full_name": "Hacker"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PUT /inventory/{food_id} -- item update
# ---------------------------------------------------------------------------

def _create_item(client, token, suffix=""):
    payload = {
        "name": f"Apple{suffix}",
        "category": "Fruits",
        "batch_number": f"BATCH{suffix}",
        "quantity": 5,
        "expiry_date": str(date.today() + timedelta(days=30)),
    }
    resp = client.post("/inventory", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestPutInventory:
    def test_update_quantity(self, client):
        _, token = _register_and_login(client, suffix="_inv1")
        item = _create_item(client, token, suffix="Q")
        resp = client.put(
            f"/inventory/{item['id']}",
            json={"quantity": 99},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["quantity"] == 99
        assert resp.json()["name"] == item["name"]

    def test_update_expiry_date(self, client):
        _, token = _register_and_login(client, suffix="_inv2")
        item = _create_item(client, token, suffix="E")
        new_expiry = str(date.today() + timedelta(days=90))
        resp = client.put(
            f"/inventory/{item['id']}",
            json={"expiry_date": new_expiry},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["expiry_date"] == new_expiry

    def test_update_multiple_fields(self, client):
        _, token = _register_and_login(client, suffix="_inv3")
        item = _create_item(client, token, suffix="M")
        resp = client.put(
            f"/inventory/{item['id']}",
            json={"name": "Banana", "quantity": 20, "batch_number": "NEWBATCH"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Banana"
        assert data["quantity"] == 20
        assert data["batch_number"] == "NEWBATCH"

    def test_cannot_update_other_users_item(self, client):
        _, token_a = _register_and_login(client, suffix="_idor_a")
        _, token_b = _register_and_login(client, suffix="_idor_b")
        item = _create_item(client, token_a, suffix="IDOR")
        resp = client.put(
            f"/inventory/{item['id']}",
            json={"quantity": 0},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404

    def test_update_nonexistent_item(self, client):
        _, token = _register_and_login(client, suffix="_inv404")
        resp = client.put(
            "/inventory/999999",
            json={"quantity": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_unauthenticated_update_rejected(self, client):
        resp = client.put("/inventory/1", json={"quantity": 1})
        assert resp.status_code == 401

    def test_empty_body_is_no_op(self, client):
        _, token = _register_and_login(client, suffix="_inv_noop")
        item = _create_item(client, token, suffix="NOOP")
        resp = client.put(
            f"/inventory/{item['id']}",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["quantity"] == item["quantity"]
