"""
Milestone 4 End-to-End Validation Script:
Verifies the complete architectural hierarchy and workflow:
Administrator
     ↓
Creates/approves Retail Manager
     ↓
Retail Manager
     ↓
Creates Warehouse Hub
     ↓
Assigns Warehouse Operator
     ↓
Warehouse Operator
     ↓
Manages inventory, batches, storage conditions
"""

import urllib.request
import json
import uuid
import sys

BASE_URL = "http://127.0.0.1:8000"

def api_call(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except Exception:
            return e.code, {"error": err_content}
    except Exception as e:
        return 500, {"error": str(e)}

def run_tests():
    print("=" * 75)
    print("🥬 FRESHSENSE AI — MILESTONE 4 WORKFLOW E2E VALIDATION SUITE")
    print("=" * 75)

    test_id = uuid.uuid4().hex[:6]

    # 1. Health check
    status, res = api_call("GET", "/")
    assert status == 200 and res.get("status") == "online", f"Health check failed: {res}"
    print(f"✅ STEP 1: API Gateway Healthy -> {res.get('service')} on MongoDB Atlas")

    # 2. Administrator Creates/Approves a Retail Manager
    rm_email = f"retail_manager_{test_id}@freshmart.com"
    rm_payload = {
        "name": f"Marcus Vance {test_id}",
        "email": rm_email,
        "password": "password123",
        "organization": f"FreshMart Apex Hub #{test_id}",
        "phone": "+1 (555) 019-9999"
    }
    status, rm_user = api_call("POST", "/api/admin/create-retail-manager", rm_payload)
    assert status == 200, f"Admin create Retail Manager failed ({status}): {rm_user}"
    assert rm_user.get("role") == "Retail Manager", "Role mismatch"
    assert rm_user.get("is_approved") is True, "Admin-created Retail Manager must be approved"
    print(f"✅ STEP 2: Administrator created & approved Retail Manager: '{rm_user['name']}' (ID: {rm_user['id']})")

    # 3. Administrator inspects user directory
    status, users_list = api_call("GET", "/api/admin/users")
    assert status == 200 and len(users_list) > 0, "Users list empty"
    print(f"✅ STEP 3: Admin inspected user governance table ({len(users_list)} registered accounts)")

    # 4. Administrator tests approval toggle (Revoke and Re-approve)
    rm_id = rm_user["id"]
    status, rev_res = api_call("POST", f"/api/admin/users/{rm_id}/revoke")
    assert status == 200 and rev_res.get("user", {}).get("is_approved") is False, "Revoke failed"
    status, app_res = api_call("POST", f"/api/admin/users/{rm_id}/approve")
    assert status == 200 and app_res.get("user", {}).get("is_approved") is True, "Re-approve failed"
    print(f"✅ STEP 4: Administrator Approval & Revocation toggle verified for user {rm_id}")

    # 5. Log in as Retail Manager to get token
    status, login_res = api_call("POST", "/api/auth/login", {"email": rm_email, "password": "password123"})
    assert status == 200, f"Retail Manager login failed ({status}): {login_res}"
    rm_token = login_res["access_token"]
    print(f"✅ STEP 5: Retail Manager authenticated (JWT Bearer Token issued)")

    # 6. Retail Manager Creates a Warehouse Hub
    wh_code = f"WH-METRO-{test_id.upper()}"
    wh_payload = {
        "name": f"Metro Fresh Cold Hub #{test_id.upper()}",
        "code": wh_code,
        "location": "Zone 4, Continental Logistics Park",
        "capacity_kg": 15000.0,
        "temperature_range_c": "1.5°C - 3.5°C",
        "humidity_range_pct": "88% - 92%"
    }
    status, wh_doc = api_call("POST", "/api/warehouses", wh_payload, token=rm_token)
    assert status == 200, f"Create warehouse hub failed ({status}): {wh_doc}"
    assert wh_doc.get("code") == wh_code, "Warehouse code mismatch"
    assert wh_doc.get("created_by_name") == rm_user["name"], "Created by Retail Manager mismatch"
    print(f"✅ STEP 6: Retail Manager created Warehouse Hub: '{wh_doc['name']}' ({wh_doc['code']})")

    # 7. Create a Warehouse Operator account to be assigned
    op_email = f"operator_{test_id}@greenvalley.com"
    # Pre-seed OTP in email_verifications
    op_reg_payload = {
        "name": f"Liam Chen {test_id}",
        "email": op_email,
        "password": "password123",
        "role": "Warehouse Operator",
        "verification_code": "888999",
        "organization": "GreenValley Cold Logistics"
    }
    # Pre-insert OTP verification
    status_otp, otp_res = api_call("POST", "/api/auth/send-verification-code", {"email": op_email})
    v_code = otp_res.get("verification_code", "888999")
    op_reg_payload["verification_code"] = v_code

    status, op_reg_res = api_call("POST", "/api/auth/register", op_reg_payload)
    assert status == 200, f"Operator registration failed ({status}): {op_reg_res}"
    op_user = op_reg_res["user"]
    op_token = op_reg_res["access_token"]
    print(f"✅ STEP 7: Warehouse Operator registered: '{op_user['name']}' (ID: {op_user['id']})")

    # 8. Retail Manager assigns the Warehouse Operator to the Warehouse Hub
    assign_payload = {
        "operator_id": op_user["id"],
        "operator_name": op_user["name"],
        "operator_email": op_user["email"]
    }
    status, wh_assigned = api_call("POST", f"/api/warehouses/{wh_code}/assign-operator", assign_payload, token=rm_token)
    assert status == 200, f"Assign operator failed ({status}): {wh_assigned}"
    assert wh_assigned.get("assigned_operator_id") == op_user["id"], "Operator assignment ID mismatch"
    assert wh_assigned.get("assigned_operator_name") == op_user["name"], "Operator name mismatch"
    print(f"✅ STEP 8: Retail Manager assigned Warehouse Operator '{op_user['name']}' to Hub '{wh_code}'")

    # 9. Warehouse Operator manages inventory and registers a produce batch
    batch_payload = {
        "batch_id": f"BATCH-{test_id.upper()}-APL01",
        "product_name": "Gala Apples (Cold Vault)",
        "category": "Fruits",
        "warehouse_id": wh_code,
        "warehouse_name": wh_doc["name"],
        "quantity_kg": 850.0,
        "unit_price_per_kg": 2.75,
        "harvest_date": "2026-08-28",
        "expiry_date": "2026-09-28",
        "freshness_score": 94,
        "storage_temp_celsius": 2.8,
        "storage_humidity_percent": 89.0
    }
    status, batch_res = api_call("POST", "/api/inventory/register-batch", batch_payload, token=op_token)
    assert status == 200, f"Operator register batch failed ({status}): {batch_res}"
    assert batch_res.get("batch_id") == batch_payload["batch_id"], "Batch ID mismatch"
    print(f"✅ STEP 9: Warehouse Operator registered batch '{batch_res['batch_id']}' in assigned Hub '{wh_code}'")

    # 10. Warehouse Operator adjusts storage climate conditions live
    climate_payload = {
        "warehouse_id": wh_code,
        "temperature_celsius": 2.4,
        "humidity_percent": 90.0,
        "airflow_cfm": 450.0
    }
    status, clim_res = api_call("POST", "/api/storage/update-conditions", climate_payload)
    assert status == 200, f"Climate update failed ({status}): {clim_res}"
    assert clim_res.get("compliance_status") == "Compliant", "Climate compliance status mismatch"
    print(f"✅ STEP 10: Warehouse Operator adjusted live storage conditions (2.4°C, 90.0% RH, Compliant)")

    # 11. Run bio-kinetic shelf-life simulation on the batch
    sim_payload = {
        "category": "Fruits",
        "harvest_date": "2026-08-28",
        "storage_temp_celsius": 2.4,
        "storage_humidity_percent": 90.0,
        "packaging_type": "Modified Atmosphere (MAP)",
        "air_circulation": "Optimal (Active)",
        "visual_score": 94
    }
    status, sim_res = api_call("POST", "/api/prediction/simulate-conditions", sim_payload)
    assert status == 200, f"Shelf-life simulation failed ({status}): {sim_res}"
    print(f"✅ STEP 11: Arrhenius Bio-Kinetic Shelf-Life Prediction executed: {sim_res.get('remaining_days')} days remaining (Gain: +{sim_res.get('extension_gain_days')}d)")

    # 12. Retail Manager buys the batch through marketplace
    status, buy_res = api_call("POST", f"/api/inventory/batches/{batch_res['batch_id']}/buy", {"buyer_store": rm_user.get("organization")}, token=rm_token)
    assert status == 200, f"Retail buy failed ({status}): {buy_res}"
    assert buy_res.get("status") == "Sold", "Batch status must be Sold"
    print(f"✅ STEP 12: Retail Manager procured batch '{buy_res['batch_id']}' (Status: {buy_res['status']})")

    # 13. System Hierarchy Inspection
    status, hier_res = api_call("GET", "/api/admin/hierarchy")
    assert status == 200, f"Hierarchy fetch failed ({status}): {hier_res}"
    print(f"✅ STEP 13: Administrator full architectural hierarchy verified ({hier_res.get('total_warehouse_hubs')} hubs, {hier_res.get('total_retail_managers')} retail managers)")

    # 14. Inventory Audit CSV Export
    status, _ = api_call("GET", "/api/reports/export/csv")
    assert status == 200, "CSV export failed"
    print("✅ STEP 14: Laboratory Inventory Audit CSV Export verified")

    print("\n" + "=" * 75)
    print("🎉 ALL 14 MILESTONE 4 WORKFLOW VALIDATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
