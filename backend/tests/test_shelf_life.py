"""
Deterministic unit tests for food-specific shelf-life, storage guidance
and risk. A fixed reference date is used so nothing depends on today.
Run from the backend folder:  python -m pytest tests -v
"""
from datetime import date

from app.core.food_rules import (
    FROZEN, REFRIGERATED, ROOM_TEMPERATURE,
    build_storage_guidance, get_food_profile, infer_storage_method,
)
from app.core.recommendations import generate_recommendations
from app.core.shelf_life import (
    METHOD_FALLBACK_UNKNOWN, METHOD_FALLBACK_UNSUPPORTED, METHOD_SPECIFIC,
    estimate_shelf_life,
)
from app.models.freshness_assessment import FreshnessCategory
from app.models.storage_condition import ComplianceStatus

REF = date(2026, 6, 15)
BOUGHT = date(2026, 6, 10)       # 5 days old on REF
LONG_EXPIRY = date(2026, 8, 15)  # printed expiry far away


def est(food, category, expiry=LONG_EXPIRY, **kw):
    return estimate_shelf_life(food, category, BOUGHT, expiry, REF, **kw)


def test_different_foods_get_different_estimates_same_dates_same_storage():
    apple = est("Red Apples", "Fruits", storage_temperature_celsius=3)
    milk = est("Whole Milk", "Dairy Products", storage_temperature_celsius=3)
    fish = est("Salmon fillet", "Seafood", storage_temperature_celsius=3)
    assert apple.method == milk.method == fish.method == METHOD_SPECIFIC
    assert apple.remaining_shelf_life_days == 23   # 28 - 5
    assert milk.remaining_shelf_life_days == 2     # 7 - 5
    assert fish.remaining_shelf_life_days == 0     # 2 - 5 -> 0
    assert len({apple.risk_level, milk.risk_level}) == 2


def test_specific_food_rule_beats_category_rule():
    profile, specific = get_food_profile("Banana", "Fruits")
    assert specific and profile.key == "banana"
    cat_profile, cat_specific = get_food_profile("Mango", "Fruits")
    assert not cat_specific and cat_profile.key == "cat_fruits"


def test_all_required_foods_have_specific_rules():
    for name in ["apple", "banana", "tomato", "spinach", "milk", "bread", "chicken", "salmon"]:
        _, specific = get_food_profile(name, None)
        assert specific, name


def test_storage_method_changes_the_estimate():
    fridge = est("Bread", "Bakery Products", storage_temperature_celsius=4)
    room = est("Bread", "Bakery Products", storage_temperature_celsius=21)
    frozen = est("Bread", "Bakery Products", storage_temperature_celsius=-18)
    assert fridge.storage_method_used == REFRIGERATED
    assert room.storage_method_used == ROOM_TEMPERATURE
    assert frozen.storage_method_used == FROZEN
    # room: 5-5=0, fridge: 7-5=2, frozen: 90-5=85 but capped by the recorded expiry (61 days away)
    assert (room.remaining_shelf_life_days, fridge.remaining_shelf_life_days,
            frozen.remaining_shelf_life_days) == (0, 2, 61)


def test_never_extends_recorded_expiry():
    r = est("Apple", "Fruits", expiry=date(2026, 6, 18), storage_temperature_celsius=3)
    assert r.remaining_shelf_life_days == 3          # recorded expiry is the earlier limit
    assert r.forecasted_expiry_date <= r.original_expiry_date


def test_unknown_food_falls_back_to_recorded_dates():
    r = est("Mystery item", "Other", expiry=date(2026, 6, 25), storage_temperature_celsius=3)
    assert r.method == METHOD_FALLBACK_UNKNOWN
    assert r.remaining_shelf_life_days == 10
    assert r.matched_food_rule is None
    assert any("No food-specific" in f for f in r.factors)


def test_unknown_storage_falls_back_to_recorded_dates():
    r = est("Apple", "Fruits", expiry=date(2026, 6, 25))
    assert r.method == METHOD_FALLBACK_UNKNOWN
    assert r.remaining_shelf_life_days == 10
    assert r.storage_method_used is None
    assert any("storage method is unknown" in f for f in r.factors)


def test_storage_location_text_is_used_when_no_temperature():
    r = est("Apple", "Fruits", storage_location_text="Kitchen fridge")
    assert r.storage_method_used == REFRIGERATED and r.method == METHOD_SPECIFIC
    assert infer_storage_method(None, "Deep freezer") == FROZEN
    assert infer_storage_method(None, "Pantry shelf") == ROOM_TEMPERATURE
    assert infer_storage_method(None, "Warehouse A") is None
    assert infer_storage_method(None, None) is None


def test_recorded_temperature_wins_over_location_text():
    assert infer_storage_method(2.0, "Pantry") == REFRIGERATED


def test_packaged_food_has_no_figures_so_it_uses_dates():
    r = est("Instant noodles", "Packaged Foods", expiry=date(2026, 6, 30), storage_temperature_celsius=22)
    assert r.method == METHOD_FALLBACK_UNSUPPORTED
    assert r.remaining_shelf_life_days == 15


def test_expired_item_shows_zero_days_and_keeps_original_date():
    r = est("Milk", "Dairy Products", expiry=date(2026, 6, 10), storage_temperature_celsius=3)
    assert r.is_expired and r.remaining_shelf_life_days == 0
    assert r.original_expiry_date == date(2026, 6, 10)
    assert r.forecasted_expiry_date == date(2026, 6, 10)   # NOT replaced by today
    assert r.analysis_date == REF
    assert r.risk_level == "High"


def test_item_expiring_today_is_not_expired():
    r = est("Apple", "Fruits", expiry=REF, storage_temperature_celsius=3)
    assert not r.is_expired and r.remaining_shelf_life_days == 0


def test_spoiled_assessment_forces_high_risk():
    r = est("Apple", "Fruits", storage_temperature_celsius=3, freshness_category=FreshnessCategory.SPOILED)
    assert r.risk_level == "High"
    assert any("spoilage" in x for x in r.risk_reasons)


def test_fresh_vs_near_spoilage_changes_estimate():
    fresh = est("Apple", "Fruits", storage_temperature_celsius=3, freshness_category=FreshnessCategory.FRESH)
    near = est("Apple", "Fruits", storage_temperature_celsius=3, freshness_category=FreshnessCategory.NEAR_SPOILAGE)
    assert fresh.remaining_shelf_life_days == 23
    assert near.remaining_shelf_life_days == 11
    assert fresh.risk_level == "Low" and near.risk_level == "Medium"


def test_suitable_vs_critical_storage_changes_estimate():
    ok = est("Apple", "Fruits", storage_temperature_celsius=3, storage_status=ComplianceStatus.SUITABLE)
    bad = est("Apple", "Fruits", storage_temperature_celsius=3, storage_status=ComplianceStatus.CRITICAL)
    assert bad.remaining_shelf_life_days < ok.remaining_shelf_life_days
    assert bad.risk_level == "Medium" and ok.risk_level == "Low"


def test_declining_trend_raises_risk_but_not_estimate():
    steady = est("Apple", "Fruits", storage_temperature_celsius=3)
    declining = est("Apple", "Fruits", storage_temperature_celsius=3, trend_direction="declining")
    assert declining.remaining_shelf_life_days == steady.remaining_shelf_life_days
    assert steady.risk_level == "Low" and declining.risk_level == "Medium"


def test_milk_at_room_temperature_is_flagged():
    r = est("Milk", "Dairy Products", storage_temperature_celsius=22)
    assert r.remaining_shelf_life_days == 0 and r.risk_level == "High"
    assert any("not suitable" in x for x in r.risk_reasons)


def test_risk_never_claims_safety():
    r = est("Apple", "Fruits", storage_temperature_celsius=3)
    assert any("does not prove" in x for x in r.risk_reasons)


# ------------------------------------------------------------------ guidance
def test_guidance_without_readings_is_still_food_specific():
    g = build_storage_guidance("Spinach", "Vegetables")
    assert not g.has_readings
    assert g.recommended_method == REFRIGERATED
    assert g.temperature_range_c == (0.0, 4.0)
    assert g.humidity_range_percent == (95.0, 100.0)
    assert g.packaging and g.handling
    assert any("No storage readings" in n for n in g.comparison_notes)


def test_guidance_differs_by_food():
    banana = build_storage_guidance("Banana", "Fruits")
    milk = build_storage_guidance("Milk", "Dairy Products")
    assert banana.recommended_method == ROOM_TEMPERATURE
    assert milk.recommended_method == REFRIGERATED
    assert banana.humidity_range_percent is None   # no humidity guidance supported
    assert banana.temperature_range_c != milk.temperature_range_c


def test_guidance_for_unknown_food_is_generic_not_invented():
    g = build_storage_guidance("Mystery", "Other")
    assert g.basis == "generic" and g.recommended_method == "unknown"
    assert g.temperature_range_c is None and g.humidity_range_percent is None


def test_guidance_compares_real_readings_only():
    g = build_storage_guidance("Apple", "Fruits", temperature_celsius=12.0, humidity_percent=70.0)
    assert g.has_readings
    assert any("above the recommended" in n for n in g.comparison_notes)
    assert any("humidity" in n.lower() and "below" in n for n in g.comparison_notes)
    nohum = build_storage_guidance("Milk", "Dairy Products", temperature_celsius=3.0, humidity_percent=60.0)
    assert any("No humidity guidance" in n for n in nohum.comparison_notes)


def test_storage_recommendation_always_present_without_readings():
    g = build_storage_guidance("Chicken breast", "Meat & Poultry")
    recs = generate_recommendations(
        freshness_category=None, spoilage_probability=None, remaining_shelf_life_days=2,
        risk_level="High", storage_status=None, quantity=1, has_storage_data=False,
        storage_guidance=g,
    )
    storage = [r for r in recs if r.type == "storage"]
    assert storage and "refrigerated" in storage[0].message.lower()
