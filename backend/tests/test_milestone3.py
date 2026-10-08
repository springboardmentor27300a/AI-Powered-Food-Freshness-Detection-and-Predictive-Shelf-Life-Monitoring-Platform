"""
Milestone 3 tests - shelf-life prediction, storage analysis, weighted freshness
scoring, recommendations and alert generation.

Pure-function tests (no DB, no model weights) so they run fast and match the
existing test style in test_freshness_scoring.py.
"""
from datetime import date, timedelta

import pytest

from app.services.alert_service import AlertService
from app.services.recommendation_service import RecommendationEngine
from app.services.scoring_service import FreshnessScoreService
from app.services.shelf_life_service import ShelfLifeService, compute_spoilage_risk
from app.services.storage_rules import get_storage_rule
from app.services.storage_service import StorageAnalyzer
from app.utils.freshness import get_freshness_status
from app.ml.config import SCORING_PILLARS


def make_batch(**overrides):
    today = date.today()
    defaults = {
        "batch_id": "B-0001",
        "food_name": "Milk",
        "category": "Dairy Products",
        "quantity": 5,
        "available_quantity": 5,
        "unit": "liter",
        "received_date": today - timedelta(days=1),
        "expiry_date": today + timedelta(days=7),
        "storage_location": "Fridge",
        "packaging_type": "Sealed",
        "temperature_c": None,
        "humidity_pct": None,
        "air_circulation": None,
        "light_exposure": None,
    }
    defaults.update(overrides)
    return type("Batch", (), defaults)()


def today_plus(days: int) -> date:
    return date.today() + timedelta(days=days)


class TestStorageAnalyzer:
    def test_unknown_data_neutral_compliance(self):
        batch = make_batch()
        result = StorageAnalyzer().analyze(
            batch_id=batch.batch_id, food_name=batch.food_name, category=batch.category,
            received_date=batch.received_date,
        )
        assert result.has_storage_data is False
        assert result.temperature.status == "unknown"
        # No data -> neutral default score (not a punishing 0).
        from app.constants import DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN
        assert result.compliance_score == DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN

    def test_dairy_temperature_within_range_is_good(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Milk", category="Dairy Products",
            received_date=today_plus(-1), temperature_c=4.0,
        )
        assert result.temperature.status == "good"
        assert result.compliance_score > 90

    def test_dairy_temperature_too_high_is_critical(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Milk", category="Dairy Products",
            received_date=today_plus(-1), temperature_c=20.0,
        )
        assert result.temperature.status == "critical"
        assert result.shelf_life_delta_days < 0
        assert any("Reduce storage temperature" in r for r in result.optimization_recommendations)

    def test_humidity_outside_range_warns(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Milk", category="Dairy Products",
            received_date=today_plus(-1), humidity_pct=95.0,
        )
        assert result.humidity.status == "critical"

    def test_apple_good_conditions_use_food_specific_rule(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Apple", category="Fruits",
            received_date=today_plus(-1), temperature_c=2.0, humidity_pct=92.0,
            air_circulation="moderate", packaging_type="Crates",
            storage_location="Cold Storage A",
        )
        assert result.rule.rule_scope == "food"
        assert result.condition_status == "GOOD"
        assert result.rule.temp_max_c == 4.0

    def test_banana_high_temperature_is_actionable_and_reduces_shelf_life(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Banana", category="Fruits",
            received_date=today_plus(-3), temperature_c=32.0, humidity_pct=90.0,
            air_circulation="moderate", light_exposure="controlled",
            packaging_type="Carton", storage_location="Dry Storage Room",
        )
        assert result.temperature.assessment == "TOO HIGH"
        assert result.condition_status in {"UNSUITABLE", "CRITICAL"}
        assert result.shelf_life_delta_days < 0
        assert result.optimization_recommendations

    def test_banana_high_humidity_recommends_reduction(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Banana", category="Fruits",
            received_date=today_plus(-1), humidity_pct=98.0,
        )
        assert result.humidity.assessment == "TOO HIGH"
        assert "Reduce humidity" in result.humidity.recommendation

    def test_banana_poor_air_recommends_ventilation(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Banana", category="Fruits",
            received_date=today_plus(-1), air_circulation="poor",
        )
        assert result.air_circulation.assessment == "INSUFFICIENT"
        assert "Improve ventilation" in result.air_circulation.recommendation

    def test_banana_excessive_light_is_warning(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Banana", category="Fruits",
            received_date=today_plus(-1), light_exposure="high",
        )
        assert result.light_exposure.status == "warning"
        assert "direct light" in result.light_exposure.recommendation

    def test_milk_in_dry_storage_requires_refrigeration_review(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Milk", category="Dairy Products",
            received_date=today_plus(-1), storage_location="Dry Storage Room",
        )
        assert result.storage_environment.status == "warning"
        assert result.storage_environment.assessment == "REFRIGERATION_NOT_CONFIRMED"

    def test_banana_in_cold_storage_detects_environment_mismatch(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Banana", category="Fruits",
            received_date=today_plus(-1), storage_location="Cold Storage Room",
        )
        assert result.storage_environment.status == "warning"
        assert result.storage_environment.assessment == "ENVIRONMENT_MISMATCH"

    def test_broken_packaging_is_critical(self):
        result = StorageAnalyzer().analyze(
            batch_id="B", food_name="Banana", category="Fruits",
            received_date=today_plus(-1), packaging_type="Unsealed torn bag",
        )
        assert result.packaging.status == "critical"
        assert "Replace it immediately" in result.packaging.recommendation

    def test_unrelated_product_name_does_not_trigger_milk_rule(self):
        rule = get_storage_rule("Beverages", "Almond Milk")
        assert rule.rule_scope == "category"


class TestShelfLifeService:
    def test_predicts_within_registered_expiry(self):
        service = ShelfLifeService()
        today = date.today()
        pred = service.predict(
            batch_id="B-1", food_name="Milk", category="Dairy Products",
            received_date=today, expiry_date=today + timedelta(days=7),
        )
        # Good conditions must never predict PAST a non-expired registered expiry.
        assert pred.estimated_remaining_days <= 7
        assert pred.expected_expiry_date <= today + timedelta(days=7)
        assert pred.spoilage_risk in ("Low", "Moderate", "High", "Critical")

    def test_expired_batch_has_non_positive_shelf_life(self):
        service = ShelfLifeService()
        today = date.today()
        pred = service.predict(
            batch_id="B-2", food_name="Milk", category="Dairy Products",
            received_date=today - timedelta(days=30), expiry_date=today - timedelta(days=2),
        )
        assert pred.estimated_remaining_days <= 0
        assert pred.expected_expiry_date == today - timedelta(days=2)
        assert pred.expired is True

    def test_poor_storage_reduces_remaining_days(self):
        service = ShelfLifeService()
        today = date.today()
        base = service.predict(
            batch_id="B-3", food_name="Milk", category="Dairy Products",
            received_date=today, expiry_date=today + timedelta(days=7),
        )
        degraded = service.predict(
            batch_id="B-3", food_name="Milk", category="Dairy Products",
            received_date=today, expiry_date=today + timedelta(days=7),
            temperature_c=25.0,
        )
        assert degraded.estimated_remaining_days <= base.estimated_remaining_days

    def test_freshness_score_improves_estimate(self):
        service = ShelfLifeService()
        today = date.today()
        pred = service.predict(
            batch_id="B-4", food_name="Apple", category="Fruits",
            received_date=today, expiry_date=today + timedelta(days=10),
            freshness_score=95.0, analysis_created_at=today,
        )
        assert pred.freshness_score == pytest.approx(95.0)


class TestComputeSpoilageRisk:
    def test_zero_penalty_is_low_risk(self):
        score, label = compute_spoilage_risk(
            effective_freshness=100, estimated_remaining_days=10,
            base_shelf_life_days=10, storage_compliance=100,
            age_days=1, spoilage_detected=False,
        )
        assert label == "Low"
        assert score == pytest.approx(0.0)

    def test_bad_state_is_high_critical(self):
        score, label = compute_spoilage_risk(
            effective_freshness=5, estimated_remaining_days=0,
            base_shelf_life_days=10, storage_compliance=15,
            age_days=15, spoilage_detected=True,
        )
        assert label in ("High", "Critical")
        assert score > 60


class TestFreshnessScoreService:
    def test_overall_score_is_weighted_sum(self):
        service = FreshnessScoreService()
        today = date.today()
        score = service.score(
            batch_id="B-1", food_name="Milk", category="Dairy Products",
            received_date=today, expiry_date=today + timedelta(days=10),
            visual_score=100.0, storage_compliance=100.0, shelf_life_score=100.0,
        )
        expected = 100.0 * (SCORING_PILLARS["visual_condition"]
                            + SCORING_PILLARS["storage_conditions"]
                            + SCORING_PILLARS["shelf_life_prediction"]
                            + SCORING_PILLARS["product_age"])
        assert score.overall_score == pytest.approx(round(expected, 1))

    def test_weights_match_spec(self):
        assert SCORING_PILLARS["visual_condition"] == 0.40
        assert SCORING_PILLARS["storage_conditions"] == 0.25
        assert SCORING_PILLARS["shelf_life_prediction"] == 0.20
        assert SCORING_PILLARS["product_age"] == 0.15
        assert sum(SCORING_PILLARS.values()) == pytest.approx(1.0)

    def test_good_state_is_fresh(self):
        service = FreshnessScoreService()
        today = date.today()
        score = service.score(
            batch_id="B", food_name="Apple", category="Fruits",
            received_date=today, expiry_date=today + timedelta(days=30),
            visual_score=95.0, storage_compliance=95.0, shelf_life_score=95.0,
        )
        assert score.freshness_status == "Fresh"

    def test_bad_state_needs_attention_or_spoiled(self):
        service = FreshnessScoreService()
        today = date.today()
        score = service.score(
            batch_id="B", food_name="Apple", category="Fruits",
            received_date=today - timedelta(days=60), expiry_date=today - timedelta(days=1),
            visual_score=5.0, storage_compliance=20.0, shelf_life_score=0.0,
        )
        assert score.freshness_status in ("Needs Attention", "Spoiled")


class TestGetFreshnessStatus:
    def test_band_boundaries(self):
        assert get_freshness_status(80) == "Fresh"
        assert get_freshness_status(70) == "Acceptable"
        assert get_freshness_status(45) == "Needs Attention"
        assert get_freshness_status(10) == "Spoiled"


class TestRecommendationEngine:
    def test_expired_batch_generates_high_priority_consumption(self):
        batch = make_batch(expiry_date=today_plus(-2))
        engine = RecommendationEngine()

        class P:
            estimated_remaining_days = -1
            expired = True
            spoilage_risk = "High"

        recs = engine.generate_for_batch(batch, P(), None, None)
        assert any(r.category == "consumption" and r.priority == "high" for r in recs)

    def test_expiring_soon_generates_waste_reduction(self):
        batch = make_batch(expiry_date=today_plus(1))
        engine = RecommendationEngine()

        class P:
            estimated_remaining_days = 1
            expired = False
            spoilage_risk = "Moderate"

        recs = engine.generate_for_batch(batch, P(), None, None)
        assert any(r.category == "waste_reduction" for r in recs)

    def test_one_day_remaining_requires_priority_consumption(self):
        batch = make_batch(food_name="Banana", expiry_date=today_plus(1))
        engine = RecommendationEngine()

        class P:
            estimated_remaining_days = 1
            expired = False
            spoilage_risk = "High"

        recs = engine.generate_for_batch(batch, P(), None, None)
        assert any(r.category == "consumption" and r.priority == "high" for r in recs)
        assert any("Prioritize safe sale or consumption" in r.message for r in recs)

    def test_large_quantity_near_expiry_uses_actual_inventory(self):
        batch = make_batch(food_name="Banana", available_quantity=100, unit="kg", expiry_date=today_plus(1))
        engine = RecommendationEngine()

        class P:
            estimated_remaining_days = 1
            expired = False
            spoilage_risk = "High"

        recs = engine.generate_for_batch(batch, P(), None, None)
        waste = next(r for r in recs if r.category == "waste_reduction")
        assert "100 kg" in waste.message
        assert "reduce potential waste" in waste.message

    def test_fefo_prioritizes_earlier_expiring_batch(self):
        current = make_batch(batch_id="B-LATER", food_name="Banana", expiry_date=today_plus(5))
        earlier = make_batch(batch_id="B-EARLIER", food_name="Banana", expiry_date=today_plus(1))
        engine = RecommendationEngine()

        class P:
            estimated_remaining_days = 5
            expired = False
            spoilage_risk = "Low"

        recs = engine.generate_for_batch(current, P(), None, None, [earlier])
        assert any(r.category == "rotation" and "B-EARLIER" in r.message for r in recs)

    def test_good_storage_yields_maintenance_advice(self):
        batch = make_batch()
        engine = RecommendationEngine()

        class P:
            estimated_remaining_days = 7
            expired = False
            spoilage_risk = "Low"
            expected_expiry_date = today_plus(7)

        class S:
            optimization_recommendations = []
            compliance_score = 95
            temperature = type("S", (), {"status": "good"})()
            humidity = type("S", (), {"status": "good"})()
            air_circulation = type("S", (), {"status": "good"})()
            light_exposure = type("S", (), {"status": "good"})()

        recs = engine.generate_for_batch(batch, P(), S(), None)
        assert any(r.category == "storage" and r.priority == "low" for r in recs)


class TestAlertService:
    def test_passed_expiry_raises_critical_alert(self):
        batch = make_batch(expiry_date=today_plus(-3))

        class P:
            estimated_remaining_days = -1
            expected_expiry_date = today_plus(-3)
            expired = True
            spoilage_risk = "High"

        alerts = AlertService().generate_for_batch(batch, P(), None, None)
        assert any(a.alert_type == "shelf_life" and a.severity == "critical" for a in alerts)
        assert any(a.alert_type == "spoilage" for a in alerts)

    def test_storage_violations_create_alerts(self):
        batch = make_batch()

        class P:
            estimated_remaining_days = 7
            expected_expiry_date = today_plus(7)
            expired = False
            spoilage_risk = "Low"

        class S:
            temperature = type("S", (), {"status": "critical"})()
            humidity = type("S", (), {"status": "good"})()
            duration = type("S", (), {"status": "good"})()

        alerts = AlertService().generate_for_batch(batch, P(), S(), None)
        assert any(a.alert_type == "storage" for a in alerts)