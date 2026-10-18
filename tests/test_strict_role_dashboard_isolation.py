"""
Strict Role-Based Dashboard Isolation and RBAC Verification Tests.
Ensures that:
1. Every authenticated role receives only their assigned dashboard from GET /api/auth/dashboard-access.
2. Cross-role API requests are strictly rejected with HTTP 403 Forbidden.
3. Frontend HTML templates do not display selectable navigation links or cards for other roles' dashboards.
"""

import os
import re
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

ROLE_CREDENTIALS = {
    "Consumer": ("consumer@foodfresh.com", "ConsumerPass123!", "dashboard.html"),
    "Retailer": ("retailer@foodfresh.com", "RetailerPass123!", "retailer-dashboard.html"),
    "Food Quality Inspector": ("inspector@foodfresh.com", "InspectorPass123!", "dashboard-inspector.html"),
    "Warehouse Manager": ("warehouse@foodfresh.com", "WarehousePass123!", "warehouse-dashboard.html"),
    "Admin": ("admin@foodfresh.com", "AdminPass123!", "admin-dashboard.html"),
}


def get_token_for(email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.mark.parametrize("role_name,info", list(ROLE_CREDENTIALS.items()))
def test_authoritative_dashboard_access_endpoint(role_name, info):
    email, password, expected_dashboard = info
    token = get_token_for(email, password)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/auth/dashboard-access", headers=headers)
    assert res.status_code == 200, f"Failed for {role_name}: {res.text}"
    data = res.json()
    assert data["role"] == role_name
    assert data["assigned_dashboard"] == expected_dashboard
    assert data["allowed_dashboards"] == [expected_dashboard]


def test_strict_backend_cross_role_endpoint_isolation():
    """Verify that every role is rejected with 403 when calling unassigned role endpoints."""
    consumer_token = get_token_for("consumer@foodfresh.com", "ConsumerPass123!")
    retailer_token = get_token_for("retailer@foodfresh.com", "RetailerPass123!")
    inspector_token = get_token_for("inspector@foodfresh.com", "InspectorPass123!")
    warehouse_token = get_token_for("warehouse@foodfresh.com", "WarehousePass123!")

    # 1. Consumer is strictly forbidden from Warehouse, Retailer, Inspector, Admin endpoints
    for ep in ["/api/warehouse/dashboard", "/api/retailer/dashboard", "/api/inspector/dashboard", "/api/admin/dashboard"]:
        res = client.get(ep, headers={"Authorization": f"Bearer {consumer_token}"})
        assert res.status_code == 403, f"Consumer unexpectedly accessed {ep} with status {res.status_code}"

    # 2. Retailer is strictly forbidden from Warehouse, Inspector, Admin, and Consumer dashboard stats
    for ep in ["/api/warehouse/dashboard", "/api/inspector/dashboard", "/api/admin/dashboard", "/api/dashboard/stats"]:
        res = client.get(ep, headers={"Authorization": f"Bearer {retailer_token}"})
        assert res.status_code == 403, f"Retailer unexpectedly accessed {ep} with status {res.status_code}"

    # 3. Warehouse Operator is strictly forbidden from Retailer, Inspector, Admin, and Consumer dashboard stats
    for ep in ["/api/retailer/dashboard", "/api/inspector/dashboard", "/api/admin/dashboard", "/api/dashboard/stats"]:
        res = client.get(ep, headers={"Authorization": f"Bearer {warehouse_token}"})
        assert res.status_code == 403, f"Warehouse Operator unexpectedly accessed {ep} with status {res.status_code}"

    # 4. Food Quality Inspector is strictly forbidden from Warehouse, Retailer, Admin, and Consumer dashboard stats
    for ep in ["/api/warehouse/dashboard", "/api/retailer/dashboard", "/api/admin/dashboard", "/api/dashboard/stats"]:
        res = client.get(ep, headers={"Authorization": f"Bearer {inspector_token}"})
        assert res.status_code == 403, f"Inspector unexpectedly accessed {ep} with status {res.status_code}"


def test_frontend_dashboard_templates_have_no_cross_role_navigation():
    """Verify that none of the 5 dashboards display selectable links to other roles' dashboards."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_dir = os.path.join(base_dir, "frontend")

    # Mapping of dashboard file to list of forbidden cross-role dashboard link hrefs
    isolation_rules = {
        "dashboard.html": [
            "warehouse-dashboard.html",
            "retailer-dashboard.html",
            "dashboard-inspector.html",
            "admin-dashboard.html",
            "Warehouse Hub",
            "Retailer Hub",
            "Inspector Hub",
            "Admin Console",
        ],
        "warehouse-dashboard.html": [
            "retailer-dashboard.html",
            "dashboard-inspector.html",
            "admin-dashboard.html",
            "Retailer Hub",
            "Inspector Hub",
            "Admin Console",
        ],
        "retailer-dashboard.html": [
            "warehouse-dashboard.html",
            "dashboard-inspector.html",
            "admin-dashboard.html",
            "Warehouse Hub",
            "Inspector Hub",
            "Admin Console",
        ],
        "dashboard-inspector.html": [
            "warehouse-dashboard.html",
            "retailer-dashboard.html",
            "admin-dashboard.html",
            "Warehouse Hub",
            "Retailer Hub",
            "Admin Console",
        ],
        "admin-dashboard.html": [
            "warehouse-dashboard.html",
            "retailer-dashboard.html",
            "dashboard-inspector.html",
            "Warehouse Hub",
            "Retailer Hub",
            "Inspector Hub",
        ],
    }

    for html_file, forbidden_terms in isolation_rules.items():
        file_path = os.path.join(frontend_dir, html_file)
        assert os.path.isfile(file_path), f"File {html_file} not found"
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        for term in forbidden_terms:
            assert term not in content, f"Forbidden cross-role link/term '{term}' found in {html_file}"
