from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_login_rejects_invalid_credentials():
    response = client.post(
        "/api/auth/login",
        data={
            "username": "invalid_test_user",
            "password": "wrong_password",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_me_requires_authentication():
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout():
    response = client.post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json()["message"].startswith("Logout successful")