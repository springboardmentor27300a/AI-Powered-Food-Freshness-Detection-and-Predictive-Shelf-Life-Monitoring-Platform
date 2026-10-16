"""
Milestone 3 engine verification: shelf-life prediction, storage monitoring,
and recommendation engines. Run from the backend directory:
    venv\\Scripts\\python.exe test_milestone3.py
"""
import datetime as dt
import json

from ml.shelf_life import predict_shelf_life, batch_predict
from ml.storage_conditions import validate_storage_conditions
from ml.recommendations import generate_recommendations
from ml.storage_standards import CATEGORY_STORAGE_PROFILES

PASS, FAIL = "PASS", "FAIL"
results = []


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    print(f"{PASS if condition else FAIL}  {name}" + (f"  -> {detail}" if detail else ""))


def approx(a, b, tol=0.01):
    return abs(a - b) <= tol


print("=" * 60)
print("1. SHELF-LIFE PREDICTION ENGINE")
print("=" * 60)

r = predict_shelf_life({
    "category": "Fruits", "quality_score": 100.0,
    "temperature_c": 4.0, "humidity_pct": 90.0,
    "packaging_type": "Ventilated", "expiry_date": "2099-01-01T00:00:00",
})
check("Optimal conditions preserve base shelf life",
      approx(r["predicted_remaining_days"], 21.0),
      f"{r['predicted_remaining_days']} d (expect 21)")
check("Risk is Low for optimal storage", r["risk_level"] == "Low", r["risk_level"])
check("Confidence is high with full inputs", r["prediction_confidence"] >= 80, r["prediction_confidence"])

r_warm = predict_shelf_life({
    "category": "Dairy Products", "quality_score": 100.0,
    "temperature_c": 24.0, "humidity_pct": 85.0, "packaging_type": "Sealed Container",
})
check("Warm storage shortens shelf life (Q10 rule)",
      r_warm["predicted_remaining_days"] < 4.0,
      f"{r_warm['predicted_remaining_days']} d (temp factor {r_warm['temperature_factor']})")
check("Warm storage raises risk level", r_warm["risk_level"] in ("High", "Critical"), r_warm["risk_level"])

r_vac = predict_shelf_life({"category": "Seafood", "packaging_type": "Vacuum Sealed"})
r_open = predict_shelf_life({"category": "Seafood", "packaging_type": "Open"})
check("Vacuum packaging outlasts open packaging",
      r_vac["predicted_remaining_days"] > r_open["predicted_remaining_days"],
      f"{r_vac['predicted_remaining_days']} vs {r_open['predicted_remaining_days']} d")

r_rotten = predict_shelf_life({"category": "Fruits", "ml_status": "Rotten", "quality_score": 95.0})
check("Rotten classification caps remaining life",
      r_rotten["freshness_factor"] == 0.15 and r_rotten["risk_level"] in ("High", "Critical"),
      f"factor={r_rotten['freshness_factor']}, risk={r_rotten['risk_level']}")

r_label = predict_shelf_life({
    "category": "Packaged Foods", "quality_score": 100.0,
    "packaging_type": "None",
    "expiry_date": "2020-01-01T00:00:00",
})
check("Label expiry caps effective remaining days",
      r_label["effective_remaining_days"] == 0.0 and r_label["risk_level"] == "Critical",
      f"effective={r_label['effective_remaining_days']} d, risk={r_label['risk_level']}")

r_sparse = predict_shelf_life({"category": "Bakery Products"})
check("Sparse payload still predicts", r_sparse["predicted_remaining_days"] > 0,
      f"{r_sparse['predicted_remaining_days']} d, confidence {r_sparse['prediction_confidence']}%")
check("Confidence penalized for missing inputs", r_sparse["prediction_confidence"] < r["prediction_confidence"],
      f"{r_sparse['prediction_confidence']} vs {r['prediction_confidence']}")

now = dt.datetime.now(dt.timezone.utc)
base = predict_shelf_life({"category": "Fruits", "quality_score": 90.0, "temperature_c": 4.0,
                           "humidity_pct": 90.0, "packaging_type": "Ventilated"})
mid = predict_shelf_life({"category": "Fruits", "quality_score": 90.0, "temperature_c": 4.0,
                          "humidity_pct": 90.0, "packaging_type": "Ventilated",
                          "stored_at": (now - dt.timedelta(days=5)).isoformat()})
old = predict_shelf_life({"category": "Fruits", "quality_score": 90.0, "temperature_c": 4.0,
                          "humidity_pct": 90.0, "packaging_type": "Ventilated",
                          "stored_at": (now - dt.timedelta(days=10)).isoformat()})
check("Longer storage reduces remaining shelf life",
      base["predicted_remaining_days"] > mid["predicted_remaining_days"] > old["predicted_remaining_days"],
      f"0d={base['predicted_remaining_days']} 5d={mid['predicted_remaining_days']} 10d={old['predicted_remaining_days']}")
check("Duration arithmetic: remaining = total - elapsed",
      approx(mid["estimated_total_life_days"] - 5.0, mid["predicted_remaining_days"], tol=0.2),
      f"total={mid['estimated_total_life_days']} - 5 = {mid['predicted_remaining_days']}")
check("Duration applied flag set", base["duration_applied"] is False and mid["duration_applied"] is True)

r_over = predict_shelf_life({"category": "Seafood", "quality_score": 90.0, "temperature_c": 0.0,
                             "stored_at": (now - dt.timedelta(days=30)).isoformat()})
check("Over-stored item clamps to zero, never negative",
      r_over["predicted_remaining_days"] == 0.0 and r_over["risk_level"] == "Critical",
      f"{r_over['predicted_remaining_days']} d, risk={r_over['risk_level']}")

r_cap = predict_shelf_life({"category": "Packaged Foods", "temperature_c": -18.0,
                            "packaging_type": "Modified Atmosphere", "quality_score": 100.0,
                            "stored_at": now.isoformat()})
check("Estimates capped at 365 days",
      r_cap["predicted_remaining_days"] <= 365.0 and r_cap["output_capped"] is True,
      f"{r_cap['predicted_remaining_days']} d (capped={r_cap['output_capped']})")
check("Provenance and estimate labeling present",
      r["source_type"] == "parametric_estimate"
      and r["estimate_label"] == "Estimated Remaining Shelf Life"
      and "not a guaranteed" in r["estimate_disclaimer"]
      and r["metrics_note"]["mae"] is None
      and "Not measured" in r["metrics_note"]["note"],
      f"source={r['source_type']}, label={r['estimate_label']}")

r_frozen = predict_shelf_life({"category": "Fruits", "temperature_c": -20.0, "quality_score": 90.0})
check("Frozen regime detected with honesty note",
      r_frozen["storage_regime"] == "frozen" and len(r_frozen["regime_notes"]) > 0,
      f"regime={r_frozen['storage_regime']}")

batch = batch_predict([
    {"category": "Fruits", "quality_score": 90.0},
    {"category": "Seafood", "quality_score": 40.0, "temperature_c": 10.0},
])
check("Batch prediction returns per-item results",
      len(batch) == 2 and batch[1]["predicted_remaining_days"] < batch[0]["predicted_remaining_days"])

print()
print("=" * 60)
print("2. STORAGE CONDITION MONITORING ENGINE")
print("=" * 60)

good = validate_storage_conditions(
    "Dairy Products", temperature_c=3.0, humidity_pct=85.0,
    air_circulation="Low", light_exposure="Dark",
)
check("Compliant storage scores 100", good["storage_score"] == 100.0, good["storage_score"])
check("Compliance status Compliant", good["compliance_status"] == "Compliant", good["compliance_status"])
check("No recommendations when compliant", len(good["recommendations"]) == 0)

hot = validate_storage_conditions("Meat & Poultry", temperature_c=15.0, humidity_pct=80.0)
check("Hot storage is Non-Compliant", hot["compliance_status"] == "Non-Compliant", hot["compliance_status"])
check("Temperature breach recommendation generated",
      any(rec["parameter"] == "temperature" for rec in hot["recommendations"]))
check("Storage score penalized for temperature", hot["storage_score"] < 100, hot["storage_score"])

dry = validate_storage_conditions("Vegetables", temperature_c=4.0, humidity_pct=40.0)
check("Dry air flagged for vegetables",
      any(rec["parameter"] == "humidity" for rec in dry["recommendations"]),
      f"humidity penalty recs: {len(dry['recommendations'])}")

partial = validate_storage_conditions("Fruits", temperature_c=5.0)
check("Missing humidity marked not_recorded",
      any(c.get("not_recorded") for c in partial["checks"]))
check("Partial compliance status", partial["compliance_status"] == "Partially Compliant", partial["compliance_status"])

print()
print("=" * 60)
print("3. RECOMMENDATION ENGINE")
print("=" * 60)

rec_rotten = generate_recommendations({"category": "Fruits", "ml_status": "Rotten", "quantity": 50})
top = rec_rotten["recommendations"][0]
check("Rotten item gets critical discard recommendation",
      top["priority"] == "critical" and "discard" in top["message"].lower(), top["title"])

rec_soon = generate_recommendations({
    "category": "Dairy Products", "quality_score": 100.0, "quantity": 100,
    "temperature_c": 25.0, "humidity_pct": 85.0,
    "expiry_date": "2099-01-01T00:00:00",
})
waste_rec = next((r for r in rec_soon["recommendations"] if r["type"] == "waste_reduction"), None)
check("Large batch with short life gets discount/donate advice",
      waste_rec is not None and ("discount" in waste_rec["title"].lower() or "markdown" in waste_rec["title"].lower()),
      waste_rec["title"] if waste_rec else "missing")

rec_all = generate_recommendations({
    "category": "Fruits", "quality_score": 95.0, "quantity": 20,
    "temperature_c": 4.0, "humidity_pct": 90.0,
})
types = {r["type"] for r in rec_all["recommendations"]}
check("Recommendations cover consumption + waste + rotation",
      {"consumption", "waste_reduction", "rotation"}.issubset(types), str(types))
check("Recommendations sorted by priority",
      rec_all["recommendations"] == sorted(rec_all["recommendations"], key=lambda r: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}.get(r["priority"], 4)))

rec_fefo = generate_recommendations({
    "category": "Seafood", "quality_score": 60.0, "quantity": 5,
    "temperature_c": 0.0, "humidity_pct": 78.0,
})
fefo = next((r for r in rec_fefo["recommendations"] if r["type"] == "rotation"), None)
check("Near-expiry batch flagged for FEFO rotation",
      fefo is not None and "FEFO" in fefo["title"], fefo["title"] if fefo else "missing")

rec_hot = generate_recommendations({
    "category": "Meat & Poultry", "temperature_c": 20.0, "humidity_pct": 50.0,
    "quality_score": 80.0,
})
check("Storage fix recommended when environment is out of range",
      any(r["type"] == "storage_fix" or r.get("parameter") == "temperature"
          for r in rec_hot["recommendations"]),
      str([r.get("parameter") for r in rec_hot["recommendations"]]))

print()
print("=" * 60)
print("4. STORAGE STANDARDS COMPLETENESS")
print("=" * 60)
expected_categories = {
    "Fruits", "Vegetables", "Dairy Products", "Meat & Poultry",
    "Seafood", "Bakery Products", "Packaged Foods", "Beverages",
}
check("All 8 platform categories have storage profiles",
      set(CATEGORY_STORAGE_PROFILES.keys()) == expected_categories,
      f"{len(CATEGORY_STORAGE_PROFILES)} categories")

print()
print("=" * 60)
failed = [(n, d) for n, ok, d in results if not ok]
print(f"RESULT: {len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("FAILED:")
    for name, detail in failed:
        print(f"  - {name}: {detail}")
    raise SystemExit(1)
print("ALL MILESTONE 3 ENGINE CHECKS PASSED")
