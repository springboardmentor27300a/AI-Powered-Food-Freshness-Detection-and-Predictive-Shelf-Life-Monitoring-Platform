"""
End-to-end integration and smoke verification test.
Tests:
1. All 14 HTML page routes return 200 OK.
2. All CSS and JS static assets return 200 OK.
3. Health and readiness probes report database connected.
4. All 5 role logins return valid tokens and roles.
5. Role-protected API endpoints execute and return 200 OK.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_all_frontend_pages_return_200():
    pages = [
        "/",
        "/index.html",
        "/login.html",
        "/register.html",
        "/dashboard.html",
        "/warehouse-dashboard.html",
        "/retailer-dashboard.html",
        "/dashboard-inspector.html",
        "/admin-dashboard.html",
        "/inventory.html",
        "/add-food.html",
        "/reports.html",
        "/profile.html",
        "/executive-dashboard.html",
    ]
    for p in pages:
        res = client.get(p)
        assert res.status_code == 200, f"Page {p} returned status {res.status_code}"


def test_static_css_and_js_assets_return_200():
    assets = [
        "/css/style.css",
        "/css/dashboard.css",
        "/css/auth.css",
        "/js/api.js",
        "/js/auth.js",
        "/js/dashboard.js",
        "/js/warehouse.js",
        "/js/retailer.js",
        "/js/inspector.js",
        "/js/admin.js",
    ]
    for a in assets:
        res = client.get(a)
        assert res.status_code == 200, f"Asset {a} returned status {res.status_code}"
        assert len(res.content) > 50, f"Asset {a} was empty"


def test_health_and_readiness_probes():
    h = client.get("/health")
    assert h.status_code == 200
    assert h.json()["database"] == "connected"

    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "connected"


@pytest.mark.parametrize(
    "role_name,email,password,test_endpoint",
    [
        ("Consumer", "consumer@foodfresh.com", "ConsumerPass123!", "/api/inventory"),
        ("Retailer", "retailer@foodfresh.com", "RetailerPass123!", "/api/retailer/dashboard"),
        ("Inspector", "inspector@foodfresh.com", "InspectorPass123!", "/api/inspector/dashboard"),
        ("Warehouse", "warehouse@foodfresh.com", "WarehousePass123!", "/api/inventory"),
        ("Admin", "admin@foodfresh.com", "AdminPass123!", "/api/admin/dashboard"),
    ],
)
def test_all_5_role_logins_and_protected_endpoints(role_name, email, password, test_endpoint):
    login_res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_res.status_code == 200, f"Login failed for {email}: {login_res.text}"
    data = login_res.json()
    token = data["access_token"]
    user = data["user"]
    assert token is not None and len(token) > 20
    assert user["email"] == email

    # Call protected endpoint
    api_res = client.get(test_endpoint, headers={"Authorization": f"Bearer {token}"})
    assert api_res.status_code == 200, f"Query to {test_endpoint} failed for {role_name}: {api_res.text}"


def test_upload_food_image_and_ai_scan_endpoints():
    import io
    # Minimal 1x1 valid JPEG byte payload
    img_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"

    login_res = client.post("/api/auth/login", json={"email": "consumer@foodfresh.com", "password": "ConsumerPass123!"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test image upload
    upload_res = client.post(
        "/api/inventory/upload-image",
        files={"file": ("apple.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        headers=headers,
    )
    assert upload_res.status_code == 200
    img_url = upload_res.json()["image_url"]
    assert "/uploads/" in img_url

    # 2. Test quick scan endpoint
    quick_res = client.post(
        "/api/freshness/quick-scan",
        files={"file": ("apple.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"category": "Fruits", "food_name": "Honeycrisp Apple"},
        headers=headers,
    )
    assert quick_res.status_code == 200
    scan_data = quick_res.json()
    assert scan_data["success"] is True
    assert "visual_score" in scan_data
    assert "freshness_label" in scan_data
    assert "estimated_shelf_life_days" in scan_data

    # 3. Test inventory item analyze endpoint
    inv_res = client.get("/api/inventory", headers=headers)
    items = inv_res.json()
    if items:
        item_id = items[0]["id"]
        analyze_res = client.post(
            "/api/freshness/analyze",
            json={"inventory_id": item_id, "image_url": img_url},
            headers=headers,
        )
        assert analyze_res.status_code == 200
        assert "freshness_score" in analyze_res.json()


def test_freshness_history_endpoint():
    login_res = client.post("/api/auth/login", json={"email": "consumer@foodfresh.com", "password": "ConsumerPass123!"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/freshness/history?limit=10", headers=headers)
    assert res.status_code == 200
    records = res.json()
    assert isinstance(records, list)
    if records:
        assert "freshness_score" in records[0]
        assert "food_name" in records[0]
        assert "freshness_label" in records[0]


def test_cross_role_access_restriction_matrix():
    # 1. Consumer attempting admin and retailer endpoints -> 403
    c_login = client.post("/api/auth/login", json={"email": "consumer@foodfresh.com", "password": "ConsumerPass123!"})
    c_token = c_login.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    res_admin = client.get("/api/admin/dashboard", headers=c_headers)
    assert res_admin.status_code == 403

    res_retail = client.get("/api/retailer/dashboard", headers=c_headers)
    assert res_retail.status_code == 403

    # 2. Retailer attempting admin endpoint -> 403
    r_login = client.post("/api/auth/login", json={"email": "retailer@foodfresh.com", "password": "RetailerPass123!"})
    r_token = r_login.json()["access_token"]
    r_headers = {"Authorization": f"Bearer {r_token}"}

    res_r_admin = client.get("/api/admin/dashboard", headers=r_headers)
    assert res_r_admin.status_code == 403

    # 3. Warehouse attempting admin endpoint -> 403
    w_login = client.post("/api/auth/login", json={"email": "warehouse@foodfresh.com", "password": "WarehousePass123!"})
    w_token = w_login.json()["access_token"]
    w_headers = {"Authorization": f"Bearer {w_token}"}

    res_w_admin = client.get("/api/admin/dashboard", headers=w_headers)
    assert res_w_admin.status_code == 403

    # 4. Admin has access to all dashboards -> 200
    a_login = client.post("/api/auth/login", json={"email": "admin@foodfresh.com", "password": "AdminPass123!"})
    a_token = a_login.json()["access_token"]
    a_headers = {"Authorization": f"Bearer {a_token}"}

    assert client.get("/api/admin/dashboard", headers=a_headers).status_code == 200
    assert client.get("/api/retailer/dashboard", headers=a_headers).status_code == 200
    assert client.get("/api/inspector/dashboard", headers=a_headers).status_code == 200
    assert client.get("/api/inventory", headers=a_headers).status_code == 200
