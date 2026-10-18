import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.user_model import UserRole

client = TestClient(app)


def get_token(role: str, email_prefix: str = "testuser") -> tuple[str, dict]:
    uid = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{uid}@example.com"
    password = "TestPassword123!"

    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": f"Test {role} {uid}",
            "email": email,
            "password": password,
            "confirm_password": password,
            "role": role,
        }
    )
    assert reg_res.status_code == 201

    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    user = login_res.json()["user"]
    return token, user


def get_admin_token() -> tuple[str, dict]:
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin@foodfresh.com", "password": "AdminPass123!"}
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"], login_res.json()["user"]


# ==============================================================================
# 1. Dashboard Overview & Real MongoDB KPIs
# ==============================================================================
def test_admin_dashboard_kpis_and_metrics():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/admin/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_users" in data
    assert data["total_users"] >= 1
    assert "active_users" in data
    assert "inactive_users" in data
    assert "total_analyses" in data
    assert "total_inventory" in data
    assert "avg_quality_score" in data
    assert "system_health" in data
    assert "users_by_role" in data
    assert "recent_users" in data
    assert "recent_audits" in data


# ==============================================================================
# 2. User Management Listing, Search & Filters
# ==============================================================================
def test_admin_list_users_search_and_filters():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Unfiltered list
    res_all = client.get("/api/admin/users?limit=50", headers=headers)
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert "items" in data_all
    assert len(data_all["items"]) >= 1

    # 2. Search filter
    res_search = client.get("/api/admin/users?search=admin", headers=headers)
    assert res_search.status_code == 200
    items_search = res_search.json()["items"]
    assert any("admin" in u["email"].lower() for u in items_search)

    # 3. Role filter
    res_role = client.get("/api/admin/users?role=Consumer", headers=headers)
    assert res_role.status_code == 200
    for u in res_role.json()["items"]:
        assert u["role"] == "Consumer"

    # 4. Status filter
    res_active = client.get("/api/admin/users?status=active", headers=headers)
    assert res_active.status_code == 200
    for u in res_active.json()["items"]:
        assert u["status"] == "active"


# ==============================================================================
# 3. User Details Inspection
# ==============================================================================
def test_admin_view_user_details():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a fresh user
    _, user = get_token("Consumer", "usr_detail")
    user_id = user["id"]

    res = client.get(f"/api/admin/users/{user_id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == user_id
    assert data["email"] == user["email"]
    assert "inventory_items_count" in data
    assert "inspections_count" in data


# ==============================================================================
# 4. Role Reassignment for Normal Users & Audit Trail
# ==============================================================================
def test_admin_role_reassignment():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    _, user = get_token("Consumer", "role_change")
    user_id = user["id"]

    # Change to Retailer
    res1 = client.patch(
        f"/api/admin/users/{user_id}/role",
        headers=headers,
        json={"role": "Retailer"}
    )
    assert res1.status_code == 200
    assert res1.json()["role"] == "Retailer"

    # Change to Warehouse Operator
    res2 = client.patch(
        f"/api/admin/users/{user_id}/role",
        headers=headers,
        json={"role": "Warehouse Operator"}
    )
    assert res2.status_code == 200
    assert res2.json()["role"] in ["Warehouse Operator", "Warehouse Manager"]

    # Change to Food Quality Inspector
    res3 = client.patch(
        f"/api/admin/users/{user_id}/role",
        headers=headers,
        json={"role": "Food Quality Inspector"}
    )
    assert res3.status_code == 200
    assert res3.json()["role"] == "Food Quality Inspector"

    # Verify audit log recorded
    res_audit = client.get("/api/admin/audit-logs?action=ROLE_CHANGE", headers=headers)
    assert res_audit.status_code == 200
    audits = res_audit.json()["items"]
    assert any(a["target_id"] == user_id for a in audits)


# ==============================================================================
# 5. User Activation & Deactivation Access Revocation
# ==============================================================================
def test_admin_activate_and_deactivate_user():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    user_token, user = get_token("Consumer", "deact_test")
    user_id = user["id"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Normal user can access protected inventory
    res_inv_before = client.get("/api/inventory", headers=user_headers)
    assert res_inv_before.status_code == 200

    # 2. Admin deactivates user
    res_deact = client.patch(
        f"/api/admin/users/{user_id}/deactivate",
        headers=headers,
        json={"status": "deactivated", "reason": "Compliance investigation"}
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["status"] == "deactivated"
    assert res_deact.json()["is_active"] is False

    # 3. Deactivated user is immediately rejected from protected API with 403
    res_inv_after = client.get("/api/inventory", headers=user_headers)
    assert res_inv_after.status_code == 403
    assert "deactivated" in res_inv_after.json()["detail"].lower()

    # 4. Deactivated user cannot log in
    res_login_deact = client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": "TestPassword123!"}
    )
    assert res_login_deact.status_code == 403
    assert "deactivated" in res_login_deact.json()["detail"].lower()

    # 5. Admin reactivates user
    res_act = client.patch(
        f"/api/admin/users/{user_id}/activate",
        headers=headers,
        json={"status": "active", "reason": "Investigation cleared"}
    )
    assert res_act.status_code == 200
    assert res_act.json()["status"] == "active"
    assert res_act.json()["is_active"] is True

    # 6. User can log in again
    res_login_ok = client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": "TestPassword123!"}
    )
    assert res_login_ok.status_code == 200
    new_token = res_login_ok.json()["access_token"]

    # 7. User can access inventory again
    res_inv_reactivated = client.get("/api/inventory", headers={"Authorization": f"Bearer {new_token}"})
    assert res_inv_reactivated.status_code == 200


def test_admin_cannot_deactivate_self():
    admin_token, admin_user = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}
    admin_id = admin_user["id"]

    res = client.patch(
        f"/api/admin/users/{admin_id}/deactivate",
        headers=headers,
        json={"status": "deactivated"}
    )
    assert res.status_code == 400
    assert "cannot deactivate" in res.json()["detail"].lower()


# ==============================================================================
# 6. AI Computer Vision Monitoring
# ==============================================================================
def test_admin_ai_monitoring_statistics():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/admin/ai/statistics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_analyses" in data
    assert "fresh_predictions" in data
    assert "marginal_predictions" in data
    assert "spoiled_predictions" in data
    assert "avg_confidence" in data
    assert "avg_quality_score" in data
    assert "prediction_distribution" in data
    assert "activity_timeline" in data


# ==============================================================================
# 7. Audit Logs Querying & Privacy
# ==============================================================================
def test_admin_audit_logs():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/admin/audit-logs?limit=20", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "items" in data
    assert "total" in data

    # Verify sensitive fields are not stored in audit logs
    for item in data["items"]:
        assert "password" not in str(item).lower() or "[redacted]" in str(item).lower()


# ==============================================================================
# 8. Storage Rules Management CRUD & Range Validation
# ==============================================================================
def test_admin_storage_rules_crud_and_validation():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. List rules
    res_list = client.get("/api/admin/storage-rules", headers=headers)
    assert res_list.status_code == 200
    assert isinstance(res_list.json(), list)

    # 2. Invalid range validation (min_temperature > max_temperature)
    res_invalid = client.post(
        "/api/admin/storage-rules",
        headers=headers,
        json={
            "category": f"TestCategory_{uuid.uuid4().hex[:4]}",
            "min_temperature": 15.0,
            "max_temperature": 5.0,  # Invalid
            "recommended_temperature": 10.0,
            "min_humidity": 50.0,
            "max_humidity": 80.0,
        }
    )
    assert res_invalid.status_code == 422

    # 3. Create valid rule
    cat_name = f"ExoticFruits_{uuid.uuid4().hex[:6]}"
    res_create = client.post(
        "/api/admin/storage-rules",
        headers=headers,
        json={
            "category": cat_name,
            "min_temperature": 8.0,
            "max_temperature": 14.0,
            "recommended_temperature": 11.0,
            "min_humidity": 80.0,
            "max_humidity": 90.0,
            "storage_conditions": "Tropical Crisp Chiller",
            "applicable_zone": "Zone T - Tropical",
        }
    )
    assert res_create.status_code == 201
    rule = res_create.json()
    rule_id = rule["id"]
    assert rule["category"] == cat_name

    # 4. Update rule
    res_update = client.put(
        f"/api/admin/storage-rules/{rule_id}",
        headers=headers,
        json={"recommended_temperature": 10.5}
    )
    assert res_update.status_code == 200
    assert res_update.json()["recommended_temperature"] == 10.5

    # 5. Delete rule
    res_del = client.delete(f"/api/admin/storage-rules/{rule_id}", headers=headers)
    assert res_del.status_code == 200


# ==============================================================================
# 9. System Health & Safe Configuration Management
# ==============================================================================
def test_admin_system_health_and_config():
    admin_token, _ = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. System health
    res_health = client.get("/api/admin/system/health", headers=headers)
    assert res_health.status_code == 200
    health_data = res_health.json()
    assert health_data["status"] in ["healthy", "degraded"]
    assert "database" in health_data
    assert "ping_latency_ms" in health_data["database"]

    # 2. System config get (ensure zero secret leakage)
    res_cfg = client.get("/api/admin/system/config", headers=headers)
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    assert "app_name" in cfg
    assert "public_registration_enabled" in cfg
    assert "MONGO_URI" not in cfg
    assert "JWT_SECRET" not in cfg

    # 3. System config update
    res_upd = client.put(
        "/api/admin/system/config",
        headers=headers,
        json={"auto_quarantine_score_threshold": 45.0}
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["auto_quarantine_score_threshold"] == 45.0


# ==============================================================================
# 10. Google Auth & Admin Escalation Protection
# ==============================================================================
def test_google_auth_and_admin_escalation_protection():
    # Simulate a Google JWT ID Token payload (base64url header.payload.signature)
    import base64
    import json

    uid = uuid.uuid4().hex[:8]
    email = f"googleuser_{uid}@gmail.com"
    payload = {
        "sub": f"google_sub_{uid}",
        "email": email,
        "name": f"Google Test User {uid}",
        "email_verified": True,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    simulated_token = f"dummyheader.{encoded}.dummysignature"

    # Attempt Google auth with role="Admin" (should be strictly forced to Consumer!)
    res = client.post(
        "/api/auth/google",
        json={"id_token": simulated_token, "role": "Admin"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    # Admin self-assignment was rejected; assigned default Consumer
    assert data["user"]["role"] != "Admin"
    assert data["user"]["role"] == "Consumer"
    assert data["user"]["auth_provider"] == "google"


# ==============================================================================
# 11. Strict RBAC Enforcement: Non-Admins Forbidden from Admin APIs
# ==============================================================================
@pytest.mark.parametrize("role", ["Consumer", "Retailer", "Warehouse Manager", "Food Quality Inspector"])
def test_non_admins_forbidden_from_admin_endpoints(role):
    token, _ = get_token(role, f"rbac_{role.lower().replace(' ', '_')}")
    headers = {"Authorization": f"Bearer {token}"}

    endpoints = [
        ("GET", "/api/admin/dashboard"),
        ("GET", "/api/admin/users"),
        ("GET", "/api/admin/audit-logs"),
        ("GET", "/api/admin/storage-rules"),
        ("GET", "/api/admin/system/health"),
        ("GET", "/api/admin/system/config"),
        ("GET", "/api/admin/ai/statistics"),
    ]

    for method, path in endpoints:
        if method == "GET":
            res = client.get(path, headers=headers)
        assert res.status_code == 403, f"Expected 403 Forbidden for role {role} on {path}, got {res.status_code}"


def test_unauthenticated_forbidden_from_admin_endpoints():
    res = client.get("/api/admin/dashboard")
    assert res.status_code == 401
