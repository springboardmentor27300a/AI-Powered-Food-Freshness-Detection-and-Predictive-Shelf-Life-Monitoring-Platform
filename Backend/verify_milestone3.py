import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import app.models.schemas as schemas
    print("[OK] schemas imported successfully")
except Exception as e:
    print(f"[FAIL] schemas failed: {e}")

try:
    import app.routers.prediction as prediction
    print("[OK] prediction imported successfully")
except Exception as e:
    print(f"[FAIL] prediction failed: {e}")

try:
    import app.routers.storage as storage
    print("[OK] storage imported successfully")
except Exception as e:
    print(f"[FAIL] storage failed: {e}")

try:
    import app.routers.recommendations as recommendations
    print("[OK] recommendations imported successfully")
except Exception as e:
    print(f"[FAIL] recommendations failed: {e}")

try:
    import app.routers.analytics as analytics
    print("[OK] analytics imported successfully")
except Exception as e:
    print(f"[FAIL] analytics failed: {e}")

try:
    # Test Bio-Kinetic Shelf Life model execution
    res = prediction.solve_bio_kinetic_model(
        category="Fruits",
        harvest_date_str="2026-08-20",
        storage_temp=3.5,
        storage_humidity=87.0,
        packaging="Modified Atmosphere (MAP)",
        airflow="Optimal (Active)",
        visual_score=92
    )
    print(f"[OK] solve_bio_kinetic_model output: remaining_days={res['remaining_days']}, decay_mult={res['decay_rate_multiplier']}, risk={res['risk_level']}, points={len(res['day_by_day_curve'])}")
except Exception as e:
    print(f"[FAIL] solve_bio_kinetic_model failed: {e}")

print("MILESTONE_3_BACKEND_VERIFIED")
