"""
Comprehensive Test Suite for Warehouse Operator Temperature Control and Storage Monitoring Module.
Covers RBAC, Storage Zones, Authoritative Server-Side Temperature Validation,
Equipment Controller Adapters (PLC Modbus ACK vs Offline fallback), Alerts, and Audit Logs.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_user_token(role: str, email_prefix: str = "wh_user") -> tuple[str, dict]:
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
        },
    )
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"

    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user = login_res.json()["user"]
    return token, user


def get_admin_token() -> str:
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin@foodfresh.com", "password": "AdminPass123!"},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


# ==============================================================================
# 1. RBAC & Access Control Tests
# ==============================================================================

def test_warehouse_unauthorized_access():
    res = client.get("/api/warehouse/zones")
    assert res.status_code == 401


def test_warehouse_forbidden_for_consumer_and_retailer():
    consumer_token, _ = get_user_token("Consumer", "wh_consumer")
    res = client.get(
        "/api/warehouse/zones",
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert res.status_code == 403

    retailer_token, _ = get_user_token("Retailer", "wh_retailer")
    res2 = client.get(
        "/api/warehouse/zones",
        headers={"Authorization": f"Bearer {retailer_token}"},
    )
    assert res2.status_code == 403


def test_warehouse_authorized_roles():
    for role in ["Warehouse Operator", "Warehouse Manager", "Supply Chain Operator"]:
        token, _ = get_user_token(role, f"wh_{role.lower().replace(' ', '_')}")
        res = client.get(
            "/api/warehouse/zones",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200, f"Role {role} failed access: {res.text}"
        zones = res.json()
        assert isinstance(zones, list)
        assert len(zones) >= 4


def test_warehouse_admin_bypass():
    admin_token = get_admin_token()
    res = client.get(
        "/api/warehouse/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200


# ==============================================================================
# 2. Storage Zones & Live Telemetry Retrieval
# ==============================================================================

def test_get_storage_zones_and_dairy_chamber():
    token, _ = get_user_token("Warehouse Operator", "wh_zones")
    res = client.get(
        "/api/warehouse/zones",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    zones = res.json()
    assert len(zones) >= 4

    # Locate Dairy cold room
    dairy_zone = next((z for z in zones if z["zone_id"] == "ZONE-COLD-B-DAIRY"), None)
    assert dairy_zone is not None
    assert dairy_zone["name"] == "Chamber B - Dairy & Deli Cold Room"
    assert dairy_zone["category"] == "Dairy"
    assert dairy_zone["permitted_temp_min"] <= 0.0
    assert dairy_zone["permitted_temp_max"] >= 4.0
    assert dairy_zone["equipment_status"] == "CONNECTED"
    assert len(dairy_zone["stored_products"]) >= 1

    # Verify dairy products stored
    prods = [p["product_name"] for p in dairy_zone["stored_products"]]
    assert any("Milk" in p for p in prods)


def test_get_storage_zone_by_id_and_not_found():
    token, _ = get_user_token("Warehouse Operator", "wh_zone_id")
    res = client.get(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    zone = res.json()
    assert zone["zone_id"] == "ZONE-COLD-B-DAIRY"

    # Non-existent zone
    res_404 = client.get(
        "/api/warehouse/zones/ZONE-UNKNOWN-999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_404.status_code == 404


def test_get_zone_temperature_telemetry():
    token, _ = get_user_token("Warehouse Operator", "wh_telemetry")
    res = client.get(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY/temperature",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == "ZONE-COLD-B-DAIRY"
    assert "current_target_temperature" in data
    assert "actual_measured_temperature" in data
    assert "permitted_temp_min" in data
    assert "permitted_temp_max" in data
    assert "regulatory_source" in data
    assert "equipment_status" in data
    assert "recent_readings" in data
    assert "active_alerts" in data


def test_get_zone_temperature_history():
    token, _ = get_user_token("Warehouse Operator", "wh_history")
    res = client.get(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY/temperature/history?hours=24",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == "ZONE-COLD-B-DAIRY"
    assert "points" in data
    assert isinstance(data["points"], list)


# ==============================================================================
# 3. Temperature Control & Safe Adjustment Workflow (Dairy & 4°C Target)
# ==============================================================================

def test_safe_temperature_adjustment_dairy_to_4c():
    """
    Test setting target temperature of 4°C for Dairy Storage Zone (Chamber B)
    with connected Honeywell PLC controller.
    """
    token, operator = get_user_token("Warehouse Operator", "wh_cmd_4c")

    payload = {
        "requested_temperature": 4.0,
        "reason": "Cold-chain optimization and seasonal energy efficiency calibration per FDA 2022 guidelines.",
    }

    res = client.post(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY/temperature/commands",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, f"Command execution failed: {res.text}"
    cmd_data = res.json()

    assert cmd_data["command_id"].startswith("CMD-")
    assert cmd_data["zone_id"] == "ZONE-COLD-B-DAIRY"
    assert cmd_data["requested_target"] == 4.0
    assert cmd_data["status"] == "Applied"
    assert cmd_data["applied_to_hardware"] is True
    assert "Honeywell" in cmd_data["controller_response"]["controller_model"]
    assert "modbus_packet" in cmd_data["controller_response"]
    assert cmd_data["controller_response"]["modbus_packet"]["register_address"] == "40028"

    # Verify zone now reflects 4.0°C target
    zone_res = client.get(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert zone_res.status_code == 200
    assert zone_res.json()["target_temperature"] == 4.0

    # Verify command status endpoint
    cmd_status_res = client.get(
        f"/api/warehouse/temperature/commands/{cmd_data['command_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cmd_status_res.status_code == 200
    assert cmd_status_res.json()["command_id"] == cmd_data["command_id"]
    assert cmd_status_res.json()["status"] == "Applied"


def test_temperature_adjustment_rejected_when_exceeding_dairy_range():
    """
    Test authoritative server-side rule validation:
    Reject target temperature of 6.5°C for Dairy (exceeds max 4.0°C limit for milk).
    """
    token, _ = get_user_token("Warehouse Operator", "wh_invalid_high")

    payload = {
        "requested_temperature": 6.5,
        "reason": "Attempting invalid warm setpoint.",
    }

    res = client.post(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY/temperature/commands",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
    err_body = res.json()["detail"]
    assert "Permitted Temperature Range Violation" in err_body["error"]
    assert err_body["permitted_temp_max"] == 4.0
    assert "FDA" in err_body["regulatory_source"] or "Pasteurized Milk" in err_body["regulatory_source"]


def test_temperature_adjustment_rejected_when_below_dairy_freezing_limit():
    """
    Test authoritative server-side rule validation:
    Reject target temperature of -3.0°C for Dairy (below 0.0°C limit, prevents freezing emulsion).
    """
    token, _ = get_user_token("Warehouse Operator", "wh_invalid_low")

    payload = {
        "requested_temperature": -3.0,
        "reason": "Attempting subzero freezing setpoint in milk cooler.",
    }

    res = client.post(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY/temperature/commands",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
    err_body = res.json()["detail"]
    assert "Permitted Temperature Range Violation" in err_body["error"]
    assert err_body["permitted_temp_min"] >= 0.0


def test_offline_controller_safe_fallback():
    """
    When adjusting a zone with OFFLINE controller (ZONE-AMBIENT-D):
    System must save software target WITHOUT claiming physical actuation.
    """
    token, _ = get_user_token("Warehouse Operator", "wh_offline_ctrl")

    payload = {
        "requested_temperature": 18.5,
        "reason": "Seasonal ambient warehouse target recalibration.",
    }

    res = client.post(
        "/api/warehouse/zones/ZONE-AMBIENT-D/temperature/commands",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()

    assert data["applied_to_hardware"] is False
    assert "Software Target Saved (Physical Controller Offline)" in data["status"]
    assert "Physical refrigeration compressors and cooling loops were NOT adjusted" in data["message"]


# ==============================================================================
# 4. Storage Alerts and Audit Logs
# ==============================================================================

def test_warehouse_alerts_endpoint():
    token, _ = get_user_token("Warehouse Operator", "wh_alerts")
    res = client.get(
        "/api/warehouse/alerts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    alerts = res.json()
    assert isinstance(alerts, list)


def test_warehouse_audit_logs_contain_temperature_adjustments():
    token, operator = get_user_token("Warehouse Operator", "wh_audits")

    # Perform an adjustment
    client.post(
        "/api/warehouse/zones/ZONE-COLD-B-DAIRY/temperature/commands",
        json={
            "requested_temperature": 3.2,
            "reason": "Chamber load pre-cooling prior to delivery batch intake.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # Fetch audit logs
    audit_res = client.get(
        "/api/warehouse/audit-logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 1
    assert any("TEMPERATURE" in l["action"] for l in logs)


def test_warehouse_dashboard_kpis_endpoint():
    token, _ = get_user_token("Warehouse Operator", "wh_kpis")
    res = client.get(
        "/api/warehouse/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_zones"] >= 4
    assert data["controller_online_count"] >= 3
    assert "compliant_zones" in data
    assert "zones" in data
