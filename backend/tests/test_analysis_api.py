"""
API tests for GET /api/inventory/{id}/analysis on a throwaway SQLite DB
(see conftest.py). Assessments and storage readings are inserted
directly, so no image files are written and no PostgreSQL is needed.
Run from the backend folder:  python -m pytest tests -v
"""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models.freshness_assessment import FreshnessAssessment, FreshnessCategory
from app.models.storage_condition import ComplianceStatus, StorageCondition

client = TestClient(app)
TODAY = datetime.now(timezone.utc).date()


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def make_user(email="a@example.com"):
    pw = "Passw0rdTest1"
    r = client.post("/api/auth/register", json={
        "full_name": "Test User", "email": email, "phone": "+911234567890",
        "password": pw, "confirm_password": pw, "role": "consumer",
    })
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    t = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert t.status_code == 200, t.text
    return uid, {"Authorization": f"Bearer {t.json()['access_token']}"}


def add_item(headers, name, category, days_bought_ago=2, days_to_expiry=30, location=None):
    r = client.post("/api/inventory", headers=headers, json={
        "food_name": name, "category": category, "batch_number": f"B-{uuid.uuid4().hex[:6]}",
        "quantity": 2,
        "purchase_date": str(TODAY - timedelta(days=days_bought_ago)),
        "expiry_date": str(TODAY + timedelta(days=days_to_expiry)),
        "storage_location": location,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def add_assessment(user_id, item_id, category, score, days_ago=0):
    db = SessionLocal()
    try:
        db.add(FreshnessAssessment(
            inventory_item_id=uuid.UUID(item_id), user_id=uuid.UUID(user_id),
            image_path="test/none.jpg", freshness_score=score, freshness_category=category,
            spoilage_probability=0.1, color_analysis={}, texture_analysis={},
            mold_detected=False, bruising_detected=False, physical_damage_detected=False,
            quality_assessment="test", created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        ))
        db.commit()
    finally:
        db.close()


def add_reading(user_id, item_id, temp, hum, status):
    db = SessionLocal()
    try:
        db.add(StorageCondition(
            inventory_item_id=uuid.UUID(item_id), user_id=uuid.UUID(user_id),
            temperature_celsius=temp, humidity_percent=hum, compliance_status=status,
            compliance_notes="test", recorded_at=datetime.now(timezone.utc) - timedelta(days=10),
        ))
        db.commit()
    finally:
        db.close()


def analysis(headers, item_id):
    r = client.get(f"/api/inventory/{item_id}/analysis", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_different_items_get_different_results_and_switching_ids_is_consistent():
    uid, h = make_user()
    milk = add_item(h, "Whole Milk", "Dairy Products", location="Fridge")
    apple = add_item(h, "Red Apple", "Fruits", location="Fridge")
    bread = add_item(h, "Wheat Bread", "Bakery Products", location="Pantry")
    results = {n: analysis(h, i)["shelf_life"]["current"] for n, i in
               [("milk", milk), ("apple", apple), ("bread", bread)]}
    days = {n: r["remaining_shelf_life_days"] for n, r in results.items()}
    assert days == {"milk": 5, "apple": 26, "bread": 3}          # 7-2, 28-2, 5-2
    assert len(set(days.values())) == 3
    assert {r["matched_food_rule"] for r in results.values()} == {"Milk", "Apples", "Bread"}
    # Switching back and forth returns the same, item-specific answer each time.
    assert analysis(h, milk)["shelf_life"]["current"]["remaining_shelf_life_days"] == 5
    assert analysis(h, apple)["shelf_life"]["current"]["remaining_shelf_life_days"] == 26


def test_storage_recommendation_present_with_no_readings():
    uid, h = make_user()
    item = add_item(h, "Chicken breast", "Meat & Poultry")
    data = analysis(h, item)
    g = data["storage_guidance"]
    assert data["latest_storage_condition"] is None
    assert g["has_readings"] is False and g["recommended_method"] == "refrigerated"
    assert g["temperature_range_c"] == [0.0, 4.0] and g["humidity_range_percent"] is None
    assert g["packaging"] and g["handling"]
    assert any("No storage readings" in n for n in g["comparison_notes"])
    assert any(r["type"] == "storage" for r in data["recommendations"])


def test_no_assessment_and_no_trend_points():
    uid, h = make_user()
    item = add_item(h, "Banana", "Fruits", location="Counter")
    d = analysis(h, item)["shelf_life"]
    assert d["points"] == [] and d["has_sufficient_history"] is False
    assert d["current"]["remaining_shelf_life_days"] == 3          # 5 - 2 days old


def test_one_assessment_is_a_single_point_without_a_trend():
    uid, h = make_user()
    item = add_item(h, "Red Apple", "Fruits", location="Fridge")
    add_assessment(uid, item, FreshnessCategory.GOOD, 80)
    d = analysis(h, item)["shelf_life"]
    assert len(d["points"]) == 1 and d["has_sufficient_history"] is False
    assert d["points"][0]["freshness_score"] == 80


def test_two_assessments_give_real_history_and_declining_trend_raises_risk():
    uid, h = make_user()
    item = add_item(h, "Red Apple", "Fruits", location="Fridge")
    add_assessment(uid, item, FreshnessCategory.GOOD, 85, days_ago=1)
    add_assessment(uid, item, FreshnessCategory.GOOD, 70, days_ago=0)
    d = analysis(h, item)["shelf_life"]
    assert len(d["points"]) == 2 and d["has_sufficient_history"] is True
    assert d["current"]["risk_level"] == "Medium"
    assert any("declined" in r for r in d["current"]["risk_reasons"])


def test_expired_item_keeps_original_expiry_and_shows_zero_days():
    uid, h = make_user()
    item = add_item(h, "Whole Milk", "Dairy Products", days_bought_ago=12, days_to_expiry=-3, location="Fridge")
    cur = analysis(h, item)["shelf_life"]["current"]
    assert cur["is_expired"] is True and cur["remaining_shelf_life_days"] == 0
    assert cur["original_expiry_date"] == str(TODAY - timedelta(days=3))
    assert cur["forecasted_expiry_date"] == cur["original_expiry_date"]
    assert cur["analysis_date"] == str(TODAY)
    assert cur["risk_level"] == "High"


def test_unknown_food_falls_back_and_says_so():
    uid, h = make_user()
    item = add_item(h, "Mystery sauce", "Condiments", days_to_expiry=40, location="Pantry")
    data = analysis(h, item)
    cur = data["shelf_life"]["current"]
    assert cur["method"] == "date_based_fallback_unknown_food_or_storage"
    assert cur["remaining_shelf_life_days"] == 40
    assert data["storage_guidance"]["basis"] == "generic"


def test_real_reading_drives_storage_method_and_comparison():
    uid, h = make_user()
    item = add_item(h, "Red Apple", "Fruits", location="Fridge")
    add_reading(uid, item, 20.0, 50.0, ComplianceStatus.CRITICAL)
    data = analysis(h, item)
    cur = data["shelf_life"]["current"]
    assert cur["storage_method_used"] == "room_temperature"          # recorded 20C beats "Fridge"
    assert cur["remaining_shelf_life_days"] == 3                      # min(28-2 -> room 7-2=5)*0.6
    assert data["storage_guidance"]["has_readings"] is True
    assert any("above the recommended" in n for n in data["storage_guidance"]["comparison_notes"])


def test_unknown_item_returns_404():
    uid, h = make_user()
    r = client.get(f"/api/inventory/{uuid.uuid4()}/analysis", headers=h)
    assert r.status_code == 404


def test_missing_auth_is_rejected():
    r = client.get(f"/api/inventory/{uuid.uuid4()}/analysis")
    assert r.status_code in (401, 403)


def test_other_users_item_is_404():
    uid_a, ha = make_user("a@example.com")
    uid_b, hb = make_user("b@example.com")
    item = add_item(ha, "Red Apple", "Fruits")
    assert client.get(f"/api/inventory/{item}/analysis", headers=hb).status_code == 404


def test_alerts_endpoint_still_works_with_new_signature():
    uid, h = make_user()
    add_item(h, "Whole Milk", "Dairy Products", days_bought_ago=12, days_to_expiry=-3, location="Fridge")
    r = client.get("/api/alerts", headers=h)
    assert r.status_code == 200, r.text
