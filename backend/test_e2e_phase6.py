import os
import sys
import time
from pathlib import Path

# Force in-memory SQLite database before importing app
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import ShelfLifePrediction, User, StorageCondition

client = TestClient(app)

def setup_db():
    Base.metadata.create_all(bind=engine)

def get_auth_headers(email="phase6_e2e@example.com", role="consumer"):
    reg = client.post("/auth/register", json={
        "full_name": "Phase 6 E2E Tester",
        "email": email,
        "password": "testpassword123",
        "role": role,
    })
    if reg.status_code == 201:
        token = reg.json()["access_token"]
    else:
        login = client.post("/auth/login", json={"email": email, "password": "testpassword123"})
        token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def run_phase6_e2e_tests():
    print("=" * 70)
    print("  FRESHGUARD M3 — PHASE 6 END-TO-END VALIDATION SUITE")
    print("=" * 70)

    setup_db()
    headers = get_auth_headers()
    print("[1] Authentication & Database Initialized Successfully")

    # -------------------------------------------------------------
    # 2. Approved ML Model End-to-End Tests
    # -------------------------------------------------------------
    print("\n[2] Testing Approved ML Predictions...")
    
    # 2a. Tomato E2E
    t0 = time.perf_counter()
    res_tomato = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Tomato",
        "temperature_c": 22.5,
        "humidity_pct": 70.0,
        "storage_duration_days": 2.0,
        "packaging_type": "uncoated",
        "nled_level": 0,
        "bwc_level": 0
    })
    lat_tomato = (time.perf_counter() - t0) * 1000
    assert res_tomato.status_code == 201, f"Tomato failed: {res_tomato.text}"
    data_tomato = res_tomato.json()
    assert data_tomato["food_type"] == "tomato"
    assert data_tomato["model_type"] == "ML_RandomForestRegressor"
    assert data_tomato["remaining_shelf_life_days"] >= 0
    assert data_tomato["confidence"] is None
    print(f"    [OK] Tomato ML Prediction: RSL={data_tomato['remaining_shelf_life_days']} days, Model={data_tomato['model_type']}, Confidence={data_tomato['confidence']} ({lat_tomato:.2f}ms)")

    # 2b. Paneer E2E
    t0 = time.perf_counter()
    res_paneer = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Paneer",
        "temperature_c": 7.0,
        "humidity_pct": 37.0,
        "storage_duration_days": 2.0,
        "packaging_type": "sealed"
    })
    lat_paneer = (time.perf_counter() - t0) * 1000
    assert res_paneer.status_code == 201, f"Paneer failed: {res_paneer.text}"
    data_paneer = res_paneer.json()
    assert data_paneer["food_type"] == "paneer"
    assert data_paneer["model_type"] == "ML_LinearRegression"
    assert data_paneer["remaining_shelf_life_days"] >= 0
    assert data_paneer["confidence"] is None
    print(f"    [OK] Paneer ML Prediction: RSL={data_paneer['remaining_shelf_life_days']} days, Model={data_paneer['model_type']}, Confidence={data_paneer['confidence']} ({lat_paneer:.2f}ms)")

    # 2c. Seafood E2E
    t0 = time.perf_counter()
    res_seafood = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Seafood",
        "species": "mackerel",
        "temperature_c": 1.0,
        "humidity_pct": 85.0,
        "storage_duration_days": 1.0,
        "packaging_type": "open"
    })
    lat_seafood = (time.perf_counter() - t0) * 1000
    assert res_seafood.status_code == 201, f"Seafood failed: {res_seafood.text}"
    data_seafood = res_seafood.json()
    assert data_seafood["food_type"] == "seafood"
    assert data_seafood["model_type"] == "ML_RandomForestRegressor"
    assert data_seafood["remaining_shelf_life_days"] >= 0
    assert data_seafood["confidence"] is None
    print(f"    [OK] Seafood ML Prediction: RSL={data_seafood['remaining_shelf_life_days']} days, Model={data_seafood['model_type']}, Confidence={data_seafood['confidence']} ({lat_seafood:.2f}ms)")

    # -------------------------------------------------------------
    # 3. Unsupported Category Rejections (HTTP 422)
    # -------------------------------------------------------------
    print("\n[3] Testing Unsupported Categories (HTTP 422 Verification)...")
    unsupported_categories = [
        ("Chicken", "chicken"),
        ("Avocado", "avocado"),
        ("Bakery", "bakery"),
        ("Packaged Foods", "packaged foods"),
        ("Beverages", "beverages"),
        ("Apple", "apple"),
        ("Banana", "banana"),
    ]
    for cat_name, cat_val in unsupported_categories:
        res = client.post("/m3/shelf-life/predict", headers=headers, json={
            "food_type": cat_val,
            "temperature_c": 22.0,
            "humidity_pct": 70.0,
            "storage_duration_days": 1.0,
            "packaging_type": "sealed"
        })
        assert res.status_code == 422, f"Expected 422 for unsupported category '{cat_name}', got {res.status_code}"
        detail = res.json()["detail"]
        assert "ML shelf-life prediction is currently unsupported for this food category" in detail, f"Unexpected msg: {detail}"
        print(f"    [OK] Unsupported category '{cat_name}' correctly rejected with HTTP 422: '{detail}'")

    # -------------------------------------------------------------
    # 4. Out-of-Domain Input Rejections (HTTP 422)
    # -------------------------------------------------------------
    print("\n[4] Testing Out-of-Domain Inputs (HTTP 422 Verification)...")
    domain_test_cases = [
        ("Tomato Out-of-Bound Temp Low (<20°C)", {"food_type": "tomato", "temperature_c": 15.0, "humidity_pct": 70.0, "storage_duration_days": 2.0, "packaging_type": "uncoated"}),
        ("Tomato Out-of-Bound Temp High (>25°C)", {"food_type": "tomato", "temperature_c": 30.0, "humidity_pct": 70.0, "storage_duration_days": 2.0, "packaging_type": "uncoated"}),
        ("Tomato Out-of-Bound Humidity Low (<65%)", {"food_type": "tomato", "temperature_c": 22.0, "humidity_pct": 50.0, "storage_duration_days": 2.0, "packaging_type": "uncoated"}),
        ("Tomato Out-of-Bound Humidity High (>75%)", {"food_type": "tomato", "temperature_c": 22.0, "humidity_pct": 85.0, "storage_duration_days": 2.0, "packaging_type": "uncoated"}),
        ("Tomato Out-of-Bound Duration (>35 days)", {"food_type": "tomato", "temperature_c": 22.0, "humidity_pct": 70.0, "storage_duration_days": 40.0, "packaging_type": "uncoated"}),
        ("Tomato Invalid Packaging", {"food_type": "tomato", "temperature_c": 22.0, "humidity_pct": 70.0, "storage_duration_days": 2.0, "packaging_type": "sealed"}),
        ("Paneer Out-of-Bound Temp Low (<4°C)", {"food_type": "paneer", "temperature_c": 2.0, "humidity_pct": 37.0, "storage_duration_days": 2.0, "packaging_type": "sealed"}),
        ("Paneer Out-of-Bound Temp High (>8°C)", {"food_type": "paneer", "temperature_c": 12.0, "humidity_pct": 37.0, "storage_duration_days": 2.0, "packaging_type": "sealed"}),
        ("Paneer Out-of-Bound Humidity (<30%)", {"food_type": "paneer", "temperature_c": 6.0, "humidity_pct": 20.0, "storage_duration_days": 2.0, "packaging_type": "sealed"}),
        ("Paneer Out-of-Bound Humidity (>50%)", {"food_type": "paneer", "temperature_c": 6.0, "humidity_pct": 60.0, "storage_duration_days": 2.0, "packaging_type": "sealed"}),
        ("Seafood Out-of-Bound Temp High (>2°C)", {"food_type": "seafood", "species": "mackerel", "temperature_c": 10.0, "humidity_pct": 85.0, "storage_duration_days": 1.0, "packaging_type": "open"}),
        ("Seafood Invalid Species", {"food_type": "seafood", "species": "salmon", "temperature_c": 1.0, "humidity_pct": 85.0, "storage_duration_days": 1.0, "packaging_type": "open"}),
        ("Seafood Invalid Packaging", {"food_type": "seafood", "species": "mackerel", "temperature_c": 1.0, "humidity_pct": 85.0, "storage_duration_days": 1.0, "packaging_type": "vacuum_sealed"}),
    ]
    for label, payload in domain_test_cases:
        res = client.post("/m3/shelf-life/predict", headers=headers, json=payload)
        assert res.status_code == 422, f"Expected 422 for '{label}', got {res.status_code}"
        detail = res.json()["detail"]
        print(f"    [OK] Domain check '{label}' correctly rejected with HTTP 422: '{detail}'")

    # -------------------------------------------------------------
    # 5. Negative RSL Clipping Test
    # -------------------------------------------------------------
    print("\n[5] Testing Non-Negative RSL Clipping...")
    res_max_dur = client.post("/m3/shelf-life/predict", headers=headers, json={
        "food_type": "Tomato",
        "temperature_c": 25.0,
        "humidity_pct": 70.0,
        "storage_duration_days": 35.0,
        "packaging_type": "uncoated"
    })
    assert res_max_dur.status_code == 201
    rsl_clipped = res_max_dur.json()["remaining_shelf_life_days"]
    assert rsl_clipped >= 0, f"RSL was negative: {rsl_clipped}"
    print(f"    [OK] RSL correctly clipped to non-negative: RSL={rsl_clipped} days")

    # -------------------------------------------------------------
    # 6. Direct Database Persistence Check
    # -------------------------------------------------------------
    print("\n[6] Testing Direct Database Persistence...")
    db = SessionLocal()
    try:
        preds = db.query(ShelfLifePrediction).all()
        assert len(preds) >= 4, f"Expected at least 4 saved predictions, found {len(preds)}"
        for p in preds:
            assert p.confidence is None, f"Expected null confidence in DB, got {p.confidence}"
            assert p.predicted_shelf_life_days >= 0
            assert p.food_type in ["tomato", "paneer", "seafood"]
        print(f"    [OK] Database contains {len(preds)} persisted records with transparent confidence=null")
    finally:
        db.close()

    # -------------------------------------------------------------
    # 7. M3 Auxiliary Endpoints (History, Recommendations, Analytics, Expiring, Rotation)
    # -------------------------------------------------------------
    print("\n[7] Testing M3 Auxiliary Endpoints...")
    
    # History
    res_hist = client.get("/m3/shelf-life/history", headers=headers)
    assert res_hist.status_code == 200
    hist_data = res_hist.json()
    assert len(hist_data) >= 4
    print(f"    [OK] GET /m3/shelf-life/history returned {len(hist_data)} items")

    # Recommendation
    pred_id = hist_data[0]["id"]
    res_rec = client.get(f"/m3/recommendations/{pred_id}", headers=headers)
    assert res_rec.status_code == 200
    rec_data = res_rec.json()
    assert "recommendations" in rec_data
    print(f"    [OK] GET /m3/recommendations/{pred_id} returned {len(rec_data['recommendations'])} recommendations")

    # Analytics
    res_analytics = client.get("/m3/analytics", headers=headers)
    assert res_analytics.status_code == 200
    an_data = res_analytics.json()
    assert an_data["total_predictions"] >= 4
    print(f"    [OK] GET /m3/analytics returned total_predictions={an_data['total_predictions']}")

    # Expiring Soon Inventory
    res_exp = client.get("/inventory/expiring-soon?days=7", headers=headers)
    assert res_exp.status_code == 200
    print(f"    [OK] GET /inventory/expiring-soon?days=7 functional")

    # Rotation Suggestions
    res_rot = client.get("/m3/rotation-suggestions", headers=headers)
    assert res_rot.status_code == 200
    print(f"    [OK] GET /m3/rotation-suggestions functional")

    # -------------------------------------------------------------
    # 8. Security Checks
    # -------------------------------------------------------------
    print("\n[8] Testing Security Controls...")
    res_unauth = client.post("/m3/shelf-life/predict", json={"food_type": "tomato"})
    assert res_unauth.status_code == 401, f"Expected 401 Unauthenticated, got {res_unauth.status_code}"
    print("    [OK] Unauthenticated prediction request rejected with HTTP 401")

    res_bad_jwt = client.post("/m3/shelf-life/predict", headers={"Authorization": "Bearer invalid_token"}, json={"food_type": "tomato"})
    assert res_bad_jwt.status_code == 401, f"Expected 401 for bad JWT, got {res_bad_jwt.status_code}"
    print("    [OK] Invalid JWT token rejected with HTTP 401")

    print("\n" + "=" * 70)
    print("  ALL PHASE 6 END-TO-END VALIDATION TESTS PASSED [OK]")
    print("=" * 70)

if __name__ == "__main__":
    run_phase6_e2e_tests()
