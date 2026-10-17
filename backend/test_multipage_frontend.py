import sys
import os
import requests
import json
from pathlib import Path

BACKEND_URL = "http://127.0.0.1:8001"
FRONTEND_URL = "http://127.0.0.1:5500"

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


NAV_LINKS = [
    "dashboard.html",
    "inspection.html",
    "storage.html",
    "shelf-life.html",
    "inventory.html",
    "alerts.html",
    "analytics.html",
    "reports.html",
    "profile.html"
]

FORBIDDEN_ANCHORS = [
    'href="#inspection"',
    'href="#storage"',
    'href="#inventory"',
    'href="#alerts"',
    'href="#analytics"',
    'href="#reports"',
    'href="#history"'
]

def main():
    print("=" * 70)
    print("FRESHSENSE AI - MULTI-PAGE FRONTEND VERIFICATION SUITE")
    print("Backend URL :", BACKEND_URL)
    print("Frontend URL:", FRONTEND_URL)
    print("=" * 70)

    # 1. Verify all 10 HTML pages on Frontend HTTP Server
    print("\n--- 1. TESTING FRONTEND HTTP PAGES ---")
    for page in PAGES:
        url = f"{FRONTEND_URL}/{page}"
        try:
            res = requests.get(url, timeout=5)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}"
            content = res.text

            # Check for forbidden anchor scroll links on dashboard pages
            if page != "index.html":
                for bad_anchor in FORBIDDEN_ANCHORS:
                    assert bad_anchor not in content, f"Found forbidden scroll anchor {bad_anchor} in {page}"

                # Check that all real navigation links are present in sidebar
                for nav_link in NAV_LINKS:
                    assert f'href="{nav_link}"' in content, f"Missing sidebar link to {nav_link} in {page}"

            print(f"[PASS] {page:16} -> HTTP 200 OK | Sidebar Links Verified")
        except Exception as e:
            print(f"[FAIL] {page:16} -> {e}")
            sys.exit(1)

    # 2. Verify Backend API Health
    print("\n--- 2. TESTING BACKEND API CONNECTIVITY ---")
    try:
        res = requests.get(f"{BACKEND_URL}/health", timeout=5)
        assert res.status_code == 200
        health = res.json()
        assert health.get("status") == "ok"
        assert health.get("model_loaded") is True
        assert health.get("database") == "connected"
        print(f"[PASS] Backend Health: status={health.get('status')}, model_loaded={health.get('model_loaded')}, database={health.get('database')}")
    except Exception as e:
        print(f"[FAIL] Backend Health Check: {e}")
        sys.exit(1)

    # 3. User Registration & Login (API connections used by index.html & script.js)
    print("\n--- 3. TESTING AUTHENTICATION FLOW ---")
    test_email = f"multipage_test_{os.getpid()}@example.com"
    test_user_id = None
    try:
        # Register
        reg_res = requests.post(f"{BACKEND_URL}/register", json={
            "name": "MultiPage Tester",
            "email": test_email,
            "password": "securepassword123",
            "role": "Retail Manager"
        })
        assert reg_res.status_code in [200, 201], f"Register failed: {reg_res.text}"
        print(f"[PASS] User Registration ({test_email}, Role=Retail Manager): OK")

        # Login
        log_res = requests.post(f"{BACKEND_URL}/login", json={
            "email": test_email,
            "password": "securepassword123"
        })
        assert log_res.status_code == 200, f"Login failed: {log_res.text}"
        user_data = log_res.json()
        test_user_id = user_data.get("user_id")
        assert test_user_id is not None
        assert user_data.get("role") == "Retail Manager"
        print(f"[PASS] User Login: user_id={test_user_id}, role={user_data.get('role')}")
    except Exception as e:
        print(f"[FAIL] Authentication: {e}")
        sys.exit(1)

    # 4. Food Inspection (Used by inspection.html)
    print("\n--- 4. TESTING FOOD INSPECTION ENDPOINT ---")
    fresh_sample = Path(r"C:\Users\jahna\OneDrive\Desktop\infosys\backend\dataset\fresh\FreshApple (1).jpg")
    spoiled_sample = Path(r"C:\Users\jahna\OneDrive\Desktop\infosys\backend\dataset\spoiled\RottenApple (1).jpg")

    try:
        with open(fresh_sample, "rb") as f:
            pred_res = requests.post(
                f"{BACKEND_URL}/predict",
                data={
                    "user_id": test_user_id,
                    "category": "Fruits",
                    "temperature": 4.0,
                    "humidity": 85.0,
                    "storage_duration_days": 1
                },
                files={"file": ("fresh_apple_1.jpg", f, "image/jpeg")}
            )
        assert pred_res.status_code == 200, f"Predict failed: {pred_res.text}"
        data = pred_res.json()
        assert data.get("result") == "Fresh"
        assert data.get("grade") in ["Fresh", "Good"]
        assert "color_analysis" in data
        assert "texture_analysis" in data
        assert "surface_indicators" in data
        assert "consumption_recommendation" in data or "recommendation" in data
        print(f"[PASS] Fresh Sample Inspection: Result={data.get('result')}, Grade={data.get('grade')}, Freshness Score={data.get('freshness_score')}%")

        # Spoiled sample
        with open(spoiled_sample, "rb") as f:
            sp_res = requests.post(
                f"{BACKEND_URL}/predict",
                data={"user_id": test_user_id, "category": "Fruits"},
                files={"file": ("spoiled_apple_1.jpg", f, "image/jpeg")}
            )
        assert sp_res.status_code == 200
        sp_data = sp_res.json()
        assert sp_data.get("result") == "Spoiled"
        print(f"[PASS] Spoiled Sample Inspection: Result={sp_data.get('result')}, Grade={sp_data.get('grade')}, Freshness Score={sp_data.get('freshness_score')}%")
    except Exception as e:
        print(f"[FAIL] Inspection API: {e}")
        sys.exit(1)

    # 5. Storage Analysis (Used by storage.html)
    print("\n--- 5. TESTING STORAGE ANALYSIS ENDPOINT ---")
    try:
        stor_res = requests.post(f"{BACKEND_URL}/storage-analysis", json={
            "category": "Dairy Products",
            "temperature": 2.5,
            "humidity": 60.0,
            "air_circulation": "Good",
            "light_exposure": "Low",
            "packaging_type": "Sealed airtight"
        })
        assert stor_res.status_code == 200, f"Storage analysis failed: {stor_res.text}"
        stor_data = stor_res.json()
        assert stor_data.get("condition") in ["Good", "Warning", "Critical"]
        assert "recommendations" in stor_data
        print(f"[PASS] Storage Analysis: Status={stor_data.get('condition')}, Score={stor_data.get('storage_score')}%")
    except Exception as e:
        print(f"[FAIL] Storage API: {e}")
        sys.exit(1)

    # 6. Shelf-Life Estimation (Used by shelf-life.html)
    print("\n--- 6. TESTING SHELF-LIFE ENDPOINT ---")
    try:
        sl_res = requests.post(f"{BACKEND_URL}/shelf-life", json={
            "category": "Fruits",
            "freshness_score": 90.0,
            "temperature": 4.0,
            "storage_duration_days": 1
        })
        assert sl_res.status_code == 200, f"Shelf-life failed: {sl_res.text}"
        sl_data = sl_res.json()
        assert sl_data.get("estimated_remaining_days") is not None
        assert sl_data.get("risk_level") in ["Low", "Moderate", "High"]
        print(f"[PASS] Shelf-Life: Estimated Days={sl_data.get('estimated_remaining_days')}, Risk={sl_data.get('risk_level')}")
    except Exception as e:
        print(f"[FAIL] Shelf-Life API: {e}")
        sys.exit(1)

    # 7. Inventory CRUD (Used by inventory.html)
    print("\n--- 7. TESTING INVENTORY CRUD ENDPOINTS ---")
    try:
        # Create
        inv_post = requests.post(f"{BACKEND_URL}/inventory", json={
            "user_id": test_user_id,
            "food_name": "Organic Honeycrisp Apples",
            "category": "Fruits",
            "quantity": 5.0,
            "unit": "kg",
            "expiry_date": "2026-10-05",
            "purchase_date": "2026-09-28",
            "batch_info": "LOT-9981",
            "storage_location": "Refrigerator",
            "freshness_status": "Fresh",
            "storage_temperature": 4.0,
            "humidity": 85.0
        })
        assert inv_post.status_code in [200, 201], f"Add inventory failed: {inv_post.text}"
        item_id = inv_post.json().get("id")
        print(f"[PASS] Create Inventory Item (ID={item_id}): OK")

        # Read
        inv_get = requests.get(f"{BACKEND_URL}/inventory?user_id={test_user_id}")
        assert inv_get.status_code == 200
        items = inv_get.json()
        assert any(it.get("id") == item_id for it in items)
        print(f"[PASS] Read Inventory Items ({len(items)} found): OK")

        # Update (PUT)
        inv_put = requests.put(f"{BACKEND_URL}/inventory/{item_id}", json={
            "quantity": 4.5,
            "freshness_status": "Good"
        })
        assert inv_put.status_code == 200
        print(f"[PASS] Update Inventory Item (PUT /inventory/{item_id}): OK")

        # Delete (DELETE)
        inv_del = requests.delete(f"{BACKEND_URL}/inventory/{item_id}")
        assert inv_del.status_code == 200
        print(f"[PASS] Delete Inventory Item (DELETE /inventory/{item_id}): OK")
    except Exception as e:
        print(f"[FAIL] Inventory API: {e}")
        sys.exit(1)

    # 8. Alerts & Reports
    print("\n--- 8. TESTING ALERTS & REPORTS ---")
    try:
        # Alerts
        al_res = requests.get(f"{BACKEND_URL}/alerts?user_id={test_user_id}")
        assert al_res.status_code == 200
        alerts = al_res.json()
        print(f"[PASS] Get Alerts: Retrieved {len(alerts)} alerts")

        # Reports
        rep_res = requests.get(f"{BACKEND_URL}/reports?user_id={test_user_id}")
        assert rep_res.status_code == 200
        reps = rep_res.json()
        assert "freshness_report" in reps
        assert "inventory_report" in reps
        print(f"[PASS] Get Summary Reports: OK")

        # CSV Export
        exp_res = requests.get(f"{BACKEND_URL}/reports/export?report_type=inventory&user_id={test_user_id}")
        assert exp_res.status_code == 200
        assert "text/csv" in exp_res.headers.get("Content-Type", "")
        print(f"[PASS] CSV Export: OK (Content-Type: {exp_res.headers.get('Content-Type')})")
    except Exception as e:
        print(f"[FAIL] Alerts / Reports API: {e}")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("ALL MULTI-PAGE FRONTEND VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
