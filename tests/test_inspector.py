import io
import uuid
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# Helper to register and obtain auth token
def get_user_token(role: str, email_prefix: str = "testuser") -> tuple[str, dict]:
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
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"

    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password}
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user = login_res.json()["user"]
    return token, user


def get_admin_token() -> str:
    # Use seeded admin
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin@foodfresh.com", "password": "AdminPass123!"}
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


# ==============================================================================
# 1. Food Quality Inspector Dashboard & KPIs
# ==============================================================================
def test_inspector_dashboard():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_dash")

    res = client.get(
        "/api/inspector/dashboard",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert "total_inspections" in data["kpis"]
    assert "pending_reviews" in data["kpis"]
    assert "fresh_items" in data["kpis"]
    assert "spoilage_alerts" in data["kpis"]
    assert "average_quality_score" in data["kpis"]
    assert "recent_inspections" in data
    assert "active_alerts" in data


# ==============================================================================
# 2. Image-Based Food Inspection Submission (Multipart Form)
# ==============================================================================
def test_create_inspection_multipart():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_multi")

    # Synthetic 1x1 PNG image
    fake_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc`\x00\x00"
        b"\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    files = {
        "file": ("sample_apple.png", io.BytesIO(fake_png), "image/png")
    }
    data = {
        "product_name": "Organic Honeycrisp Apples",
        "category": "Fruits",
        "batch_number": "BATCH-HNY-2026",
        "storage_temperature": "4.5",
        "storage_humidity": "88.0",
        "storage_location": "Bay A Crisper",
        "notes": "Crisp skin, uniform pigmentation, zero visual bruising.",
    }

    res = client.post(
        "/api/inspector/inspections",
        data=data,
        files=files,
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert res.status_code == 201, f"Failed: {res.text}"
    insp = res.json()

    assert insp["product_name"] == "Organic Honeycrisp Apples"
    assert insp["category"] == "Fruits"
    assert insp["batch_number"] == "BATCH-HNY-2026"
    assert insp["inspection_id"].startswith("INS-")
    assert insp["image_reference"] is not None

    # Verify AI result payload
    ai = insp["ai_result"]
    assert "quality_score" in ai
    assert "classification" in ai
    assert "confidence" in ai
    assert "estimated_shelf_life_days" in ai
    assert "spoilage_risk" in ai
    assert isinstance(ai["detected_defects"], list)

    # Verify Storage Review payload
    st = insp["storage_review"]
    assert st["current_temperature"] == 4.5
    assert st["status"] == "Normal"


# ==============================================================================
# 3. JSON Inspection Submission & Details Inspection
# ==============================================================================
def test_create_inspection_json_and_get():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_json")

    payload = {
        "product_name": "Hydroponic Butterhead Lettuce",
        "category": "Vegetables",
        "batch_number": "VEG-BTR-99",
        "storage_temperature": 3.8,
        "storage_humidity": 92.0,
        "storage_location": "Hydroponic Bay 3",
        "notes": "Inspected upon grower delivery intake.",
    }

    create_res = client.post(
        "/api/inspector/inspections/json",
        json=payload,
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["inspection_id"]

    # Retrieve by inspection_id
    get_res = client.get(
        f"/api/inspector/inspections/{created_id}",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["inspection_id"] == created_id
    assert retrieved["product_name"] == "Hydroponic Butterhead Lettuce"
    assert retrieved["status"] == "Pending"


# ==============================================================================
# 4. AI Result Validation & Data Integrity Guarantee (No Overwriting AI Predictions)
# ==============================================================================
def test_inspector_review_validation_and_data_integrity():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_review")

    # Create inspection
    create_res = client.post(
        "/api/inspector/inspections/json",
        json={
            "product_name": "Premium Pacific Salmon Fillet",
            "category": "Fish",
            "storage_temperature": 1.5,
            "storage_humidity": 80.0,
        },
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert create_res.status_code == 201
    insp_id = create_res.json()["inspection_id"]

    orig_ai = create_res.json()["ai_result"]
    orig_classification = orig_ai["classification"]
    orig_score = orig_ai["quality_score"]
    orig_confidence = orig_ai["confidence"]
    orig_shelf_life = orig_ai["estimated_shelf_life_days"]

    # Inspector reviews and submits human validation decision
    review_res = client.patch(
        f"/api/inspector/inspections/{insp_id}/review",
        json={
            "decision": "Confirmed",
            "reason": "Texture and gill coloration conform to Class-1 sashimi grade.",
            "comments": "Approved for retail counter display.",
            "adjusted_shelf_life": 3.5,
        },
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert review_res.status_code == 200
    reviewed_insp = review_res.json()

    # CRITICAL DATA INTEGRITY CHECK:
    # 1. Original AI predictions MUST NOT BE OVERWRITTEN
    assert reviewed_insp["ai_result"]["classification"] == orig_classification
    assert reviewed_insp["ai_result"]["quality_score"] == orig_score
    assert reviewed_insp["ai_result"]["confidence"] == orig_confidence
    assert reviewed_insp["ai_result"]["estimated_shelf_life_days"] == orig_shelf_life

    # 2. Inspector review stored in separate subdocument
    rev = reviewed_insp["inspector_review"]
    assert rev["decision"] == "Confirmed"
    assert "sashimi grade" in rev["reason"]
    assert rev["inspector_adjusted_shelf_life"] == 3.5
    assert rev["inspector_id"] is not None
    assert reviewed_insp["status"] == "Confirmed"


# ==============================================================================
# 5. Product Flagging with Issue Categorization & Alert Generation
# ==============================================================================
def test_inspector_flag_product_and_alert_generation():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_flag")

    # Create inspection with high temperature exposure
    create_res = client.post(
        "/api/inspector/inspections/json",
        json={
            "product_name": "Artisan Pastry Cream Tart",
            "category": "Bakery",
            "storage_temperature": 28.5,
            "storage_humidity": 70.0,
            "notes": "Display counter cooling unit failed.",
        },
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert create_res.status_code == 201
    insp_id = create_res.json()["inspection_id"]

    # Flag product
    flag_res = client.patch(
        f"/api/inspector/inspections/{insp_id}/flag",
        json={
            "issue_type": "Storage Violation",
            "severity": "Critical",
            "reason": "Cooling unit breakdown; product was exposed to +28.5°C for 4 hours.",
            "comments": "Immediate disposal required due to microbial food poisoning risk.",
        },
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert flag_res.status_code == 200
    flagged = flag_res.json()
    assert flagged["status"] == "Flagged"
    assert flagged["inspector_review"]["decision"] == "Flagged"
    assert flagged["inspector_review"]["severity"] == "Critical"
    assert flagged["inspector_review"]["issue_type"] == "Storage Violation"

    # Verify that an active alert was generated
    alerts_res = client.get(
        "/api/inspector/alerts?status=active",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert alerts_res.status_code == 200
    active_alerts = alerts_res.json()
    matched_alert = next((a for a in active_alerts if a.get("inspection_id") == insp_id), None)
    assert matched_alert is not None
    assert matched_alert["severity"] == "critical"


# ==============================================================================
# 6. Quality Alert Resolution Workflow
# ==============================================================================
def test_resolve_quality_alert():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_al_res")

    # Query active alerts
    alerts_res = client.get(
        "/api/inspector/alerts?status=active",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) > 0, "Expected at least one active alert (seeded or created)."

    target_alert = alerts[0]
    alert_id = target_alert["id"]

    # Resolve alert
    resolve_res = client.patch(
        f"/api/inspector/alerts/{alert_id}/resolve",
        json={
            "action_taken": "Quarantined and disposed",
            "resolution_notes": "Stock removed from sales floor and logged in waste register.",
        },
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert resolve_res.status_code == 200
    res_data = resolve_res.json()
    assert res_data["status"] == "resolved"


# ==============================================================================
# 7. Storage Condition Reference Review Tool
# ==============================================================================
def test_storage_condition_review_tool():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_stor")

    # Test compliant conditions for Dairy (3.0°C)
    res_ok = client.get(
        "/api/inspector/storage-review?category=Dairy&temperature=3.0&humidity=60.0",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert res_ok.status_code == 200
    data_ok = res_ok.json()
    assert data_ok["status"] == "Normal"
    assert data_ok["recommended_temperature"] == 3.0

    # Test temperature violation for Dairy (+9.5°C)
    res_violation = client.get(
        "/api/inspector/storage-review?category=Dairy&temperature=9.5&humidity=60.0",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert res_violation.status_code == 200
    data_violation = res_violation.json()
    assert data_violation["status"] == "Temperature Violation"
    assert len(data_violation["violations"]) > 0


# ==============================================================================
# 8. Inspection History Filtering & CSV Export
# ==============================================================================
def test_inspection_history_and_csv_export():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_hist")

    # Filter by category
    hist_res = client.get(
        "/api/inspector/inspection-history?category=Fruits",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert hist_res.status_code == 200
    items = hist_res.json()
    assert isinstance(items, list)
    for it in items:
        assert it["category"] == "Fruits"

    # CSV Download stream
    csv_res = client.get(
        "/api/inspector/reports/export-csv",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "attachment; filename=" in csv_res.headers.get("content-disposition", "")
    csv_text = csv_res.text
    assert "Inspection ID" in csv_text
    assert "Quality Score" in csv_text
    assert "AI Classification" in csv_text


# ==============================================================================
# 9. Quality Analytics Aggregation
# ==============================================================================
def test_quality_analytics():
    inspector_token, inspector_user = get_user_token("Food Quality Inspector", "insp_analytics")

    res = client.get(
        "/api/inspector/quality-analytics",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert "freshness_distribution" in data
    assert "quality_trends" in data
    assert "spoilage_trends" in data
    assert "inspection_activity" in data
    assert "category_breakdown" in data


# ==============================================================================
# 10. Role-Based Access Control (RBAC) Security Enforcement
# ==============================================================================
def test_rbac_security_enforcement():
    # 1. Consumer trying to access Inspector APIs -> 403 Forbidden
    consumer_token, _ = get_user_token("Consumer", "sec_cons")
    res_cons = client.get(
        "/api/inspector/dashboard",
        headers={"Authorization": f"Bearer {consumer_token}"}
    )
    assert res_cons.status_code == 403

    # 2. Retailer trying to access Inspector APIs -> 403 Forbidden
    retailer_token, _ = get_user_token("Retailer", "sec_ret")
    res_ret = client.get(
        "/api/inspector/dashboard",
        headers={"Authorization": f"Bearer {retailer_token}"}
    )
    assert res_ret.status_code == 403

    # 3. Warehouse Manager trying to access Inspector APIs -> 403 Forbidden
    warehouse_token, _ = get_user_token("Warehouse Manager", "sec_wh")
    res_wh = client.get(
        "/api/inspector/dashboard",
        headers={"Authorization": f"Bearer {warehouse_token}"}
    )
    assert res_wh.status_code == 403

    # 4. Unauthenticated caller -> 401 Unauthorized
    res_anon = client.get("/api/inspector/dashboard")
    assert res_anon.status_code == 401

    # 5. Food Quality Inspector trying to access Administrator User Directory -> 403 Forbidden
    inspector_token, _ = get_user_token("Food Quality Inspector", "sec_insp")
    res_admin_area = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {inspector_token}"}
    )
    assert res_admin_area.status_code == 403

    # 6. Administrator accessing Inspector APIs -> 200 OK (Allowed by privilege)
    admin_token = get_admin_token()
    res_admin = client.get(
        "/api/inspector/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200
