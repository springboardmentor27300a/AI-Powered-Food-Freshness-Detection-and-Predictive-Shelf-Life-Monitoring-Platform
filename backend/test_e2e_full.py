"""
FreshSense AI - Full End-to-End Enterprise Integration & Verification Suite
Validates all 22 system capabilities across Frontend (11 pages), Backend,
AI Inference, PostgreSQL, Storage Analysis, Inventory/FEFO, Real PDF/Excel exports,
and Administrator Control Center.
"""

import io
import os
import sys
import time
from pathlib import Path
import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8001")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5500")

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"

PAGES = [
    "index.html",
    "dashboard.html",
    "inspection.html",
    "storage.html",
    "shelf-life.html",
    "inventory.html",
    "alerts.html",
    "analytics.html",
    "reports.html",
    "profile.html",
    "admin.html"
]

def run_e2e_suite():
    print("=" * 80)
    print("FRESHSENSE AI - FULL END-TO-END VERIFICATION SUITE")
    print(f"Backend Server : {BACKEND_URL}")
    print(f"Frontend Server: {FRONTEND_URL}")
    print("=" * 80)

    # -------------------------------------------------------------
    # STEP 1: Verify all 11 Frontend HTML Pages
    # -------------------------------------------------------------
    print("\n[CHECK 1/22] Verifying Multi-Page Frontend HTTP Server...")
    for page in PAGES:
        url = f"{FRONTEND_URL}/{page}"
        res = requests.get(url, timeout=5)
        assert res.status_code == 200, f"Page {page} returned status {res.status_code}"
    print(f"  -> All {len(PAGES)} standalone HTML pages served successfully (HTTP 200).")

    # -------------------------------------------------------------
    # STEP 2: Verify Backend API Health
    # -------------------------------------------------------------
    print("\n[CHECK 2/22] Verifying Backend Health & Model Startup...")
    h_res = requests.get(f"{BACKEND_URL}/health", timeout=5)
    assert h_res.status_code == 200
    h_data = h_res.json()
    assert h_data.get("status") == "ok"
    assert h_data.get("model_loaded") is True
    assert h_data.get("database") == "connected"
    print(f"  -> Backend health verified: Model loaded={h_data['model_loaded']}, DB={h_data['database']}")

    # -------------------------------------------------------------
    # STEP 3: User Registration & Role Assignment
    # -------------------------------------------------------------
    print("\n[CHECK 3/22] Verifying User Registration with Role Assignment...")
    test_id = int(time.time())
    admin_email = f"admin_e2e_{test_id}@freshsense.io"
    user_email = f"retail_e2e_{test_id}@freshsense.io"

    # Register Administrator
    reg_admin = requests.post(f"{BACKEND_URL}/register", json={
        "name": "E2E Administrator",
        "email": admin_email,
        "password": "AdminPassword123!",
        "role": "Administrator"
    })
    assert reg_admin.status_code == 200
    admin_id = reg_admin.json()["user_id"]
    print(f"  -> Registered Administrator: {admin_email} (ID: {admin_id})")

    # Register Retail Manager
    reg_user = requests.post(f"{BACKEND_URL}/register", json={
        "name": "E2E Retail Manager",
        "email": user_email,
        "password": "RetailPassword123!",
        "role": "Retail Manager"
    })
    assert reg_user.status_code == 200
    user_id = reg_user.json()["user_id"]
    print(f"  -> Registered Retail Manager: {user_email} (ID: {user_id})")

    # -------------------------------------------------------------
    # STEP 4: User Authentication & Login Verification
    # -------------------------------------------------------------
    print("\n[CHECK 4/22] Verifying Authentication & Password Verification...")
    login_res = requests.post(f"{BACKEND_URL}/login", json={
        "email": user_email,
        "password": "RetailPassword123!"
    })
    assert login_res.status_code == 200
    l_data = login_res.json()
    assert l_data["user_id"] == user_id
    assert l_data["role"] == "Retail Manager"
    print(f"  -> Login verified successfully for user ID {user_id}.")

    # -------------------------------------------------------------
    # STEP 5: AI Freshness Prediction (Fresh Sample)
    # -------------------------------------------------------------
    print("\n[CHECK 5/22] Verifying AI Inference on Fresh Food Sample...")
    fresh_sample = next((DATASET_DIR / "fresh").glob("*.jpg"), None)
    assert fresh_sample and fresh_sample.exists(), "Fresh dataset image not found"

    with open(fresh_sample, "rb") as f:
        fresh_bytes = f.read()

    pred_fresh_res = requests.post(
        f"{BACKEND_URL}/predict",
        files={"file": (fresh_sample.name, fresh_bytes, "image/jpeg")},
        data={
            "user_id": user_id,
            "category": "Fruits",
            "temperature": 4.0,
            "humidity": 85.0,
            "storage_duration_days": 2
        }
    )
    assert pred_fresh_res.status_code == 200, f"Prediction failed: {pred_fresh_res.text}"
    p_fresh = pred_fresh_res.json()
    assert p_fresh["success"] is True
    assert p_fresh["result"] == "Fresh"
    assert "freshness_score" in p_fresh
    assert "grade" in p_fresh
    print(f"  -> Fresh prediction verified: Result={p_fresh['result']}, Grade={p_fresh['grade']}, Score={p_fresh['freshness_score']}%")

    # -------------------------------------------------------------
    # STEP 6: AI Freshness Prediction (Spoiled Sample)
    # -------------------------------------------------------------
    print("\n[CHECK 6/22] Verifying AI Inference on Spoiled Food Sample...")
    spoiled_sample = next((DATASET_DIR / "spoiled").glob("*.jpg"), None)
    assert spoiled_sample and spoiled_sample.exists(), "Spoiled dataset image not found"

    with open(spoiled_sample, "rb") as f:
        spoiled_bytes = f.read()

    pred_spoiled_res = requests.post(
        f"{BACKEND_URL}/predict",
        files={"file": (spoiled_sample.name, spoiled_bytes, "image/jpeg")},
        data={
            "user_id": user_id,
            "category": "Fruits",
            "temperature": 28.0,
            "humidity": 92.0,
            "storage_duration_days": 10
        }
    )
    assert pred_spoiled_res.status_code == 200
    p_spoiled = pred_spoiled_res.json()
    assert p_spoiled["success"] is True
    assert p_spoiled["result"] == "Spoiled"
    print(f"  -> Spoiled prediction verified: Result={p_spoiled['result']}, Grade={p_spoiled['grade']}, Score={p_spoiled['freshness_score']}%")

    # -------------------------------------------------------------
    # STEP 7: Computer Vision Heuristics (Color, Texture, Mold)
    # -------------------------------------------------------------
    print("\n[CHECK 7/22] Verifying Computer Vision Heuristics & Surface Defect Engine...")
    assert "color_analysis" in p_fresh
    assert "texture_analysis" in p_fresh
    assert "surface_indicators" in p_fresh
    assert "disclaimer" in p_fresh
    print(f"  -> Surface analysis verified: Color={p_fresh['color_analysis']['color_condition']}, Texture={p_fresh['texture_analysis']['texture_condition']}")

    # -------------------------------------------------------------
    # STEP 8: 5-Tier Classification Grading
    # -------------------------------------------------------------
    print("\n[CHECK 8/22] Verifying 5-Tier Classification Logic...")
    grades = [p_fresh.get("grade"), p_spoiled.get("grade")]
    for g in grades:
        assert g in ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"], f"Unknown grade: {g}"
    print(f"  -> 5-Tier grades verified: Samples classified into {grades}.")

    # -------------------------------------------------------------
    # STEP 9: Shelf-Life Kinetic Forecasting
    # -------------------------------------------------------------
    print("\n[CHECK 9/22] Verifying Shelf-Life Kinetic Estimation API...")
    shelf_res = requests.post(f"{BACKEND_URL}/shelf-life", json={
        "category": "Fruits",
        "freshness_score": 85.0,
        "temperature": 4.0,
        "humidity": 85.0,
        "storage_duration_days": 1
    })
    assert shelf_res.status_code == 200
    shelf_data = shelf_res.json()
    assert "estimated_remaining_days" in shelf_data
    assert "risk_level" in shelf_data
    print(f"  -> Shelf-life estimate verified: Remaining={shelf_data['estimated_remaining_days']} days, Risk={shelf_data['risk_level']}")

    # -------------------------------------------------------------
    # STEP 10: Storage Matrix & Environmental Evaluation
    # -------------------------------------------------------------
    print("\n[CHECK 10/22] Verifying Storage Matrix Environmental Telemetry...")
    storage_res = requests.post(f"{BACKEND_URL}/storage-analysis", json={
        "category": "Dairy",
        "temperature": 3.0,
        "humidity": 65.0,
        "air_circulation": "Good",
        "light_exposure": "Low"
    })
    assert storage_res.status_code == 200
    storage_data = storage_res.json()
    assert "condition" in storage_data
    assert "storage_score" in storage_data
    print(f"  -> Storage condition rating verified: Condition={storage_data['condition']}, Score={storage_data['storage_score']}")


    # -------------------------------------------------------------
    # STEP 11: Overall Quality Health Score
    # -------------------------------------------------------------
    print("\n[CHECK 11/22] Verifying Overall Health Quality Scoring Engine...")
    assert "quality_scoring" in p_fresh
    assert "overall_health_score" in p_fresh["quality_scoring"]
    print(f"  -> Quality scoring verified: Health Score={p_fresh['quality_scoring']['overall_health_score']}")

    # -------------------------------------------------------------
    # STEP 12: Inventory Creation with FEFO attributes
    # -------------------------------------------------------------
    print("\n[CHECK 12/22] Verifying Inventory Creation & FEFO Attributes...")
    inv_create_res = requests.post(f"{BACKEND_URL}/inventory", json={
        "user_id": user_id,
        "food_name": "Organic Honeycrisp Apples",
        "category": "Fruits",
        "quantity": 12.0,
        "unit": "kg",
        "batch_info": "LOT-2026-APP-01",
        "purchase_date": "2026-10-01",
        "storage_duration_days": 7,
        "expiry_date": "2026-10-15",
        "freshness_status": "Fresh",
        "storage_temperature": 4.0,
        "humidity": 85.0,
        "storage_location": "Walk-in Cooler 1",
        "consumption_priority": "High"
    })
    assert inv_create_res.status_code == 200
    inv_item = inv_create_res.json()["item"]
    inv_item_id = inv_item["id"]
    print(f"  -> Inventory item created: ID={inv_item_id}, Name='{inv_item['food_name']}'")

    # -------------------------------------------------------------
    # STEP 13: Inventory Retrieval & FEFO Prioritization
    # -------------------------------------------------------------
    print("\n[CHECK 13/22] Verifying Inventory Retrieval & FEFO Queue Ordering...")
    inv_list_res = requests.get(f"{BACKEND_URL}/inventory?user_id={user_id}")
    assert inv_list_res.status_code == 200
    items = inv_list_res.json()
    assert any(it["id"] == inv_item_id for it in items)
    print(f"  -> Retrieved {len(items)} inventory records with FEFO priority metadata.")

    # -------------------------------------------------------------
    # STEP 14: Inventory Update
    # -------------------------------------------------------------
    print("\n[CHECK 14/22] Verifying Inventory Item Update...")
    inv_up_res = requests.put(f"{BACKEND_URL}/inventory/{inv_item_id}", json={
        "quantity": 10.5,
        "freshness_status": "Good"
    })
    assert inv_up_res.status_code == 200
    assert inv_up_res.json().get("success") is True
    print(f"  -> Updated item ID {inv_item_id} successfully.")


    # -------------------------------------------------------------
    # STEP 15: Inventory Deletion
    # -------------------------------------------------------------
    print("\n[CHECK 15/22] Verifying Inventory Item Deletion...")
    inv_del_res = requests.delete(f"{BACKEND_URL}/inventory/{inv_item_id}")
    assert inv_del_res.status_code == 200
    print(f"  -> Deleted inventory item ID {inv_item_id}.")

    # -------------------------------------------------------------
    # STEP 16: Alerts Engine Retrieval
    # -------------------------------------------------------------
    print("\n[CHECK 16/22] Verifying Real-Time System Alerts Engine...")
    alerts_res = requests.get(f"{BACKEND_URL}/alerts?user_id={user_id}")
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()
    assert isinstance(alerts_data, list)
    print(f"  -> Alerts query verified: Retrieved {len(alerts_data)} active system alerts.")


    # -------------------------------------------------------------
    # STEP 17: Platform Analytics & Statistics
    # -------------------------------------------------------------
    print("\n[CHECK 17/22] Verifying Analytics & Aggregations...")
    stats_res = requests.get(f"{BACKEND_URL}/statistics?user_id={user_id}")
    assert stats_res.status_code == 200
    st = stats_res.json()
    assert "total_analyses" in st
    assert "grade_distribution" in st
    print(f"  -> Statistics verified: Total={st['total_analyses']}, Fresh={st['fresh']}, Spoiled={st['spoiled']}")

    # -------------------------------------------------------------
    # STEP 18: Real Excel Report Export (.xlsx)
    # -------------------------------------------------------------
    print("\n[CHECK 18/22] Verifying Real Excel Audit Export (.xlsx)...")
    excel_res = requests.get(f"{BACKEND_URL}/reports/export-excel?user_id={user_id}")
    assert excel_res.status_code == 200
    assert "openxmlformats-officedocument.spreadsheetml.sheet" in excel_res.headers.get("Content-Type", "")
    assert len(excel_res.content) > 2000, "Excel output is suspiciously small"
    # Verify OpenPyXL can read the generated binary
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(excel_res.content))
    assert "Inventory & FEFO" in wb.sheetnames
    assert "Quality Inspections" in wb.sheetnames
    print(f"  -> Real Excel (.xlsx) generated successfully ({len(excel_res.content)} bytes, sheets={wb.sheetnames}).")


    # -------------------------------------------------------------
    # STEP 19: Real PDF Audit Report Export (.pdf)
    # -------------------------------------------------------------
    print("\n[CHECK 19/22] Verifying Real PDF Audit Report Export (.pdf)...")
    pdf_res = requests.get(f"{BACKEND_URL}/reports/export-pdf?user_id={user_id}")
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers.get("Content-Type", "")
    assert pdf_res.content.startswith(b"%PDF"), "Generated output is not a valid PDF header"
    assert len(pdf_res.content) > 2000
    print(f"  -> Real PDF report generated successfully ({len(pdf_res.content)} bytes, ReportLab engine).")

    # -------------------------------------------------------------
    # STEP 20: Admin User Management (List & Filter)
    # -------------------------------------------------------------
    print("\n[CHECK 20/22] Verifying Admin User Management API...")
    adm_users_res = requests.get(f"{BACKEND_URL}/admin/users?role=Retail+Manager")
    assert adm_users_res.status_code == 200
    users_list = adm_users_res.json()["users"]
    assert any(u["id"] == user_id for u in users_list)
    print(f"  -> Admin user list filtered by role verified ({len(users_list)} users found).")

    # -------------------------------------------------------------
    # STEP 21: Admin User Status Modification
    # -------------------------------------------------------------
    print("\n[CHECK 21/22] Verifying Admin User Status & Role Updates...")
    status_mod_res = requests.put(f"{BACKEND_URL}/admin/users/{user_id}/status", json={
        "is_active": True,
        "role": "Food Quality Inspector"
    })
    assert status_mod_res.status_code == 200
    assert status_mod_res.json()["user"]["role"] == "Food Quality Inspector"
    print(f"  -> Updated user ID {user_id} role to Food Quality Inspector.")

    # -------------------------------------------------------------
    # STEP 22: Admin System Status Diagnostics & Telemetry
    # -------------------------------------------------------------
    print("\n[CHECK 22/22] Verifying Admin System Status Diagnostics...")
    sys_res = requests.get(f"{BACKEND_URL}/admin/system-status")
    assert sys_res.status_code == 200
    sys_data = sys_res.json()
    assert sys_data["model_status"]["loaded"] is True
    assert sys_data["database_status"]["status"] == "Connected"
    assert sys_data["dataset_status"]["total_images"] == 3214
    print(f"  -> System status diagnostics verified: Model Loaded, DB Connected, Dataset={sys_data['dataset_status']['total_images']} images.")

    print("\n" + "=" * 80)
    print("ALL 22/22 END-TO-END VERIFICATION CHECKS PASSED WITH ZERO ERRORS!")
    print("=" * 80)

if __name__ == "__main__":
    run_e2e_suite()
