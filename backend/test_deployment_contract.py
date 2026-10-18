from pathlib import Path

import yaml


FRONTEND_ORIGIN = "https://freshguard-frontend-qq1l.onrender.com"
API_ORIGIN = "https://freshguard-api-mp6c.onrender.com"


def _service(name):
    render_config = yaml.safe_load((Path(__file__).parents[1] / "render.yaml").read_text())
    return next(service for service in render_config["services"] if service["name"] == name)


def _env(service, key):
    return next(item["value"] for item in service["envVars"] if item["key"] == key)


def test_render_uses_the_assigned_frontend_and_api_origins():
    assert _env(_service("freshguard-api"), "CORS_ORIGINS") == FRONTEND_ORIGIN
    assert _env(_service("freshguard-frontend"), "VITE_API_URL") == API_ORIGIN


def test_health_routes_are_registered(client):
    health = client.get("/health")
    demo_health = client.get("/demo/health")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert demo_health.status_code == 200
    assert demo_health.json()["demo_mode"] is True


def test_login_and_current_user_routes_use_bearer_token(client, consumer_user):
    response = client.post(
        "/auth/login",
        json={"email": consumer_user.email, "password": "password123"},
    )
    assert response.status_code == 200
    token_response = response.json()
    assert token_response["token_type"] == "bearer"
    assert token_response["user"]["email"] == consumer_user.email
    assert token_response["access_token"]

    current_user = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token_response['access_token']}"},
    )
    assert current_user.status_code == 200
    assert current_user.json()["id"] == consumer_user.id


def test_cors_preflight_allows_the_production_frontend(client):
    response = client.options(
        "/auth/login",
        headers={
            "Origin": FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == FRONTEND_ORIGIN
