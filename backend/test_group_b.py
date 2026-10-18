"""
Group B tests — B1: GET /inventory/expiring-soon  and  B2: GET /m3/rotation-suggestions

Test matrix
-----------
B1 — /inventory/expiring-soon
  b1_01  unauthenticated request → 401
  b1_02  empty inventory → []
  b1_03  item expiring within default window (7 days) is returned
  b1_04  item expiring outside window is excluded
  b1_05  already-expired item is always included (days_until_expiry < 0, is_expired=True)
  b1_06  item on exactly the cutoff day is included (boundary)
  b1_07  custom ?days=N parameter respected
  b1_08  items without a shelf-life prediction still appear (risk_level/score are null)
  b1_09  items enriched with latest prediction data when one exists
  b1_10  user A cannot see user B's items (ownership isolation)
  b1_11  multiple items returned in expiry-date-ascending order
  b1_12  ?days below minimum (0) is rejected → 422
  b1_13  ?days above maximum (366) is rejected → 422

B2 — /m3/rotation-suggestions
  b2_01  unauthenticated request → 401
  b2_02  empty inventory → empty suggestions list, total_items=0
  b2_03  single item without prediction — returned with FEFO reason
  b2_04  expired item ranks before non-expired item regardless of expiry date gap
  b2_05  two non-expired items sorted by expiry_date ascending
  b2_06  same expiry date: item with lower freshness score ranks first (FEFO tie-break)
  b2_07  same expiry date: item with prediction ranks before item without prediction
  b2_08  priority_rank values are sequential starting at 1
  b2_09  expired_count field is accurate
  b2_10  no new StorageCondition or ShelfLifePrediction records created by the endpoint
  b2_11  user A cannot see user B's items (ownership isolation)
  b2_12  suggestion_basis field is present and non-empty
  b2_13  storage_compliance surfaced from prediction when available

Uses shared conftest.py fixtures: client, db, setup_db, consumer_user, consumer_headers, etc.
"""

from datetime import date, timedelta

from sqlalchemy import func, select

from app.models import ShelfLifePrediction, StorageCondition


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register_and_login(client, email: str, name: str = "Test User") -> str:
    """Register a fresh user and return the JWT token."""
    r = client.post("/auth/register", json={
        "full_name": name,
        "email": email,
        "password": "testpass123",
        "role": "consumer",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _add_item(client, token: str, name: str, expiry_days_from_today: int, quantity: int = 5, category: str = "Fruits") -> dict:
    """Add a food item with expiry = today + expiry_days_from_today."""
    expiry = (date.today() + timedelta(days=expiry_days_from_today)).isoformat()
    r = client.post("/inventory", headers=_auth(token), json={
        "name": name,
        "category": category,
        "batch_number": f"BATCH-{name[:6].upper()}-01",
        "quantity": quantity,
        "expiry_date": expiry,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _predict(client, token: str, food_item_id: int, food_type: str = "tomato",
             freshness_score: int = 80, risk: str | None = None) -> dict:
    """Create a shelf-life prediction for a food item.

    Phase 5: the endpoint now serves ML models for approved categories only
    (Tomato / Paneer / Seafood), so the default seed payload uses the validated
    Tomato domain (20-25 degC, 65-75% RH, 0-35 days, uncoated/beeswax_coated).
    """
    r = client.post("/m3/shelf-life/predict", headers=_auth(token), json={
        "food_item_id": food_item_id,
        "food_type": food_type,
        "visual_quality_score": freshness_score,
        "spoilage_probability": 0.1,
        "temperature_c": 22.5,
        "humidity_pct": 70,
        "air_circulation": "good",
        "light_exposure": "low",
        "packaging_type": "uncoated",
        "storage_duration_days": 2,
        "product_age_days": 1,
    })
    assert r.status_code == 201, r.text
    return r.json()


# ===========================================================================
# B1 — /inventory/expiring-soon
# ===========================================================================

def test_b1_01_unauthenticated(client):
    r = client.get("/inventory/expiring-soon")
    assert r.status_code == 401


def test_b1_02_empty_inventory(client):
    token = _register_and_login(client, "b1_empty@example.com")
    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    assert r.json() == []


def test_b1_03_item_within_default_window(client):
    token = _register_and_login(client, "b1_within@example.com")
    _add_item(client, token, "Soon Apple", expiry_days_from_today=5)
    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Soon Apple"


def test_b1_04_item_outside_window_excluded(client):
    token = _register_and_login(client, "b1_outside@example.com")
    _add_item(client, token, "Far Apple", expiry_days_from_today=30)
    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    assert r.json() == []


def test_b1_05_expired_item_always_included(client):
    token = _register_and_login(client, "b1_expired@example.com")
    _add_item(client, token, "Old Banana", expiry_days_from_today=-3)
    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    item = items[0]
    assert item["is_expired"] is True
    assert item["days_until_expiry"] == -3


def test_b1_06_boundary_day_included(client):
    """Item expiring exactly on today + days must be included (≤ cutoff)."""
    token = _register_and_login(client, "b1_boundary@example.com")
    _add_item(client, token, "Edge Orange", expiry_days_from_today=7)  # exactly the default cutoff
    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    names = [i["name"] for i in r.json()]
    assert "Edge Orange" in names


def test_b1_07_custom_days_parameter(client):
    token = _register_and_login(client, "b1_custom@example.com")
    _add_item(client, token, "Near Item", expiry_days_from_today=3)
    _add_item(client, token, "Mid Item", expiry_days_from_today=10)
    _add_item(client, token, "Far Item", expiry_days_from_today=20)

    # ?days=5 → only Near Item
    r = client.get("/inventory/expiring-soon?days=5", headers=_auth(token))
    assert r.status_code == 200
    names = [i["name"] for i in r.json()]
    assert "Near Item" in names
    assert "Mid Item" not in names
    assert "Far Item" not in names

    # ?days=15 → Near + Mid
    r2 = client.get("/inventory/expiring-soon?days=15", headers=_auth(token))
    names2 = [i["name"] for i in r2.json()]
    assert "Near Item" in names2
    assert "Mid Item" in names2
    assert "Far Item" not in names2


def test_b1_08_item_without_prediction_has_null_risk(client):
    token = _register_and_login(client, "b1_nopred@example.com")
    _add_item(client, token, "Unpredicted Pear", expiry_days_from_today=4)
    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    item = r.json()[0]
    assert item["risk_level"] is None
    assert item["official_freshness_score"] is None
    assert item["remaining_shelf_life_days"] is None


def test_b1_09_item_enriched_with_prediction(client):
    token = _register_and_login(client, "b1_withpred@example.com")
    food = _add_item(client, token, "Predicted Mango", expiry_days_from_today=6)
    pred = _predict(client, token, food["id"], food_type="tomato", freshness_score=90)

    r = client.get("/inventory/expiring-soon", headers=_auth(token))
    assert r.status_code == 200
    item = r.json()[0]
    assert item["name"] == "Predicted Mango"
    assert item["risk_level"] == pred["risk_level"]
    assert item["official_freshness_score"] == pred["official_freshness_score"]
    assert item["remaining_shelf_life_days"] == pred["remaining_shelf_life_days"]


def test_b1_10_ownership_isolation(client):
    token_a = _register_and_login(client, "b1_owner_a@example.com", "User A")
    token_b = _register_and_login(client, "b1_owner_b@example.com", "User B")
    _add_item(client, token_a, "A's Apple", expiry_days_from_today=3)

    # User B should not see User A's item
    r = client.get("/inventory/expiring-soon", headers=_auth(token_b))
    assert r.status_code == 200
    assert r.json() == []


def test_b1_11_results_ordered_by_expiry_ascending(client):
    token = _register_and_login(client, "b1_order@example.com")
    _add_item(client, token, "Later Item", expiry_days_from_today=6)
    _add_item(client, token, "Earlier Item", expiry_days_from_today=2)
    _add_item(client, token, "Expired Item", expiry_days_from_today=-1)

    r = client.get("/inventory/expiring-soon?days=30", headers=_auth(token))
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 3
    # Verify ascending order
    days = [i["days_until_expiry"] for i in items]
    assert days == sorted(days), f"Expected ascending order, got {days}"
    assert items[0]["name"] == "Expired Item"
    assert items[-1]["name"] == "Later Item"


def test_b1_12_days_below_minimum_rejected(client):
    token = _register_and_login(client, "b1_minval@example.com")
    r = client.get("/inventory/expiring-soon?days=0", headers=_auth(token))
    assert r.status_code == 422


def test_b1_13_days_above_maximum_rejected(client):
    token = _register_and_login(client, "b1_maxval@example.com")
    r = client.get("/inventory/expiring-soon?days=366", headers=_auth(token))
    assert r.status_code == 422


# ===========================================================================
# B2 — /m3/rotation-suggestions
# ===========================================================================

def test_b2_01_unauthenticated(client):
    r = client.get("/m3/rotation-suggestions")
    assert r.status_code == 401


def test_b2_02_empty_inventory(client):
    token = _register_and_login(client, "b2_empty@example.com")
    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total_items"] == 0
    assert data["expired_count"] == 0
    assert data["suggestions"] == []


def test_b2_03_single_item_without_prediction(client):
    token = _register_and_login(client, "b2_single@example.com")
    _add_item(client, token, "Solo Kiwi", expiry_days_from_today=10)
    r = client.get("/m3/rotation-suggestions?days=10", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total_items"] == 1
    sug = data["suggestions"][0]
    assert sug["name"] == "Solo Kiwi"
    assert sug["priority_rank"] == 1
    assert sug["risk_level"] is None
    assert sug["official_freshness_score"] is None
    assert "FEFO" in sug["reason"]


def test_b2_04_expired_ranks_before_non_expired(client):
    token = _register_and_login(client, "b2_expfirst@example.com")
    _add_item(client, token, "Valid Item", expiry_days_from_today=5)
    _add_item(client, token, "Expired Item", expiry_days_from_today=-2)

    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert len(suggestions) == 2
    assert suggestions[0]["name"] == "Expired Item"
    assert suggestions[0]["is_expired"] is True
    assert suggestions[0]["priority_rank"] == 1
    assert suggestions[1]["name"] == "Valid Item"
    assert suggestions[1]["is_expired"] is False


def test_b2_05_fefo_sort_by_expiry_date(client):
    token = _register_and_login(client, "b2_fefo@example.com")
    _add_item(client, token, "Expires in 10", expiry_days_from_today=10)
    _add_item(client, token, "Expires in 3",  expiry_days_from_today=3)
    _add_item(client, token, "Expires in 7",  expiry_days_from_today=7)

    r = client.get("/m3/rotation-suggestions?days=10", headers=_auth(token))
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    names = [s["name"] for s in suggestions]
    assert names == ["Expires in 3", "Expires in 7", "Expires in 10"]


def test_b2_06_same_expiry_lower_freshness_ranks_first(client):
    """When two items share the same expiry date, the one with the lower
    official_freshness_score (worse condition) should be consumed first."""
    token = _register_and_login(client, "b2_tiebreak@example.com")
    # Both items expire on the same day
    item_good = _add_item(client, token, "Good Condition", expiry_days_from_today=5)
    item_poor = _add_item(client, token, "Poor Condition", expiry_days_from_today=5)

    # Predict: good item scores higher, poor item scores lower
    _predict(client, token, item_good["id"], freshness_score=90)
    _predict(client, token, item_poor["id"], freshness_score=40)

    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    names = [s["name"] for s in suggestions]
    # Poor condition (score 40) must come before Good condition (score 90)
    assert names.index("Poor Condition") < names.index("Good Condition")


def test_b2_07_same_expiry_predicted_ranks_before_unpredicted(client):
    """Items with a prediction rank before items without one on the same expiry date."""
    token = _register_and_login(client, "b2_predorder@example.com")
    item_unpred = _add_item(client, token, "No Prediction", expiry_days_from_today=5)
    item_pred   = _add_item(client, token, "Has Prediction", expiry_days_from_today=5)
    _predict(client, token, item_pred["id"], freshness_score=70)

    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    names = [s["name"] for s in suggestions]
    assert names.index("Has Prediction") < names.index("No Prediction")


def test_b2_08_priority_ranks_sequential(client):
    token = _register_and_login(client, "b2_ranks@example.com")
    for i in range(1, 5):
        _add_item(client, token, f"Item {i}", expiry_days_from_today=i * 2)

    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200
    ranks = [s["priority_rank"] for s in r.json()["suggestions"]]
    assert ranks == list(range(1, len(ranks) + 1))


def test_b2_09_expired_count_accurate(client):
    token = _register_and_login(client, "b2_expcount@example.com")
    _add_item(client, token, "Expired A", expiry_days_from_today=-5)
    _add_item(client, token, "Expired B", expiry_days_from_today=-1)
    _add_item(client, token, "Valid C",   expiry_days_from_today=10)

    r = client.get("/m3/rotation-suggestions?days=10", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["expired_count"] == 2
    assert data["total_items"] == 3


def test_b2_10_no_new_records_created(client, db):
    """The endpoint must be read-only — it must not create any StorageCondition
    or ShelfLifePrediction records."""
    token = _register_and_login(client, "b2_readonly@example.com")
    _add_item(client, token, "Read Only Item", expiry_days_from_today=4)

    pred_count_before = db.scalar(select(func.count()).select_from(ShelfLifePrediction))
    storage_count_before = db.scalar(select(func.count()).select_from(StorageCondition))

    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200

    pred_count_after = db.scalar(select(func.count()).select_from(ShelfLifePrediction))
    storage_count_after = db.scalar(select(func.count()).select_from(StorageCondition))

    assert pred_count_after == pred_count_before, "rotation-suggestions must not create predictions"
    assert storage_count_after == storage_count_before, "rotation-suggestions must not create storage records"


def test_b2_11_ownership_isolation(client):
    token_a = _register_and_login(client, "b2_owner_a@example.com", "B2 User A")
    token_b = _register_and_login(client, "b2_owner_b@example.com", "B2 User B")
    _add_item(client, token_a, "A's Carrot", expiry_days_from_today=3)

    r = client.get("/m3/rotation-suggestions", headers=_auth(token_b))
    assert r.status_code == 200
    assert r.json()["total_items"] == 0
    assert r.json()["suggestions"] == []


def test_b2_12_suggestion_basis_present(client):
    token = _register_and_login(client, "b2_basis@example.com")
    r = client.get("/m3/rotation-suggestions", headers=_auth(token))
    assert r.status_code == 200
    basis = r.json()["suggestion_basis"]
    assert isinstance(basis, str) and len(basis) > 0


def test_b2_13_storage_compliance_in_suggestion(client):
    token = _register_and_login(client, "b2_compliance@example.com")
    item = _add_item(client, token, "Compliance Test", expiry_days_from_today=8)
    pred = _predict(client, token, item["id"], food_type="tomato", freshness_score=85)

    r = client.get("/m3/rotation-suggestions?days=10", headers=_auth(token))
    assert r.status_code == 200
    sug = r.json()["suggestions"][0]
    # storage_compliance comes from the prediction; must be "compliant" or "needs_attention"
    assert sug["storage_compliance"] in ("compliant", "needs_attention", None)
    # For a healthy item it should match what was stored on the prediction
    assert sug["storage_compliance"] == pred.get("storage_compliance")


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
