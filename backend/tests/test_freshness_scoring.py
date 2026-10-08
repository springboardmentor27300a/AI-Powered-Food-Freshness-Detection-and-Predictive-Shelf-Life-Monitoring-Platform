"""
Tests for the Milestone 2 freshness scoring engine.

Uses only pure functions (no model weights / no network), so these run fast:
    get_freshness_category  -> five-tier score mapping
    FreshnessClassifier._combine_scores / _classify
"""
import types

import pytest

from app.ml.config import CONFIDENCE_THRESHOLD
from app.ml.freshness_scorer import (
    CNN_WEIGHT_CONFIDENT,
    CNN_WEIGHT_UNCONFIDENT,
    FreshnessClassifier,
)
from app.utils.freshness import get_freshness_category

# The canonical CNN class->score weights (must match app.ml.config).
CNN_WEIGHTS = {"fresh": 1.00, "semi_fresh": 0.55, "rotten": 0.05}


def expected_blend(cnn_probs: dict, cv_score: float) -> float:
    """
    The documented fusion contract.

    The CNN weight is confidence-dependent: a confident prediction dominates,
    an unconfident one is mostly ignored in favour of the visual analysis.
    This is the change that stopped a weak visual signal from driving the
    final number.
    """
    cnn_score = sum(cnn_probs.get(k, 0.0) * CNN_WEIGHTS[k] for k in CNN_WEIGHTS)
    weight = (
        CNN_WEIGHT_CONFIDENT
        if max(cnn_probs.values()) >= CONFIDENCE_THRESHOLD
        else CNN_WEIGHT_UNCONFIDENT
    )
    return weight * cnn_score + (1.0 - weight) * cv_score


def scorer_without_models(cv_score: float = 0.5, cnn_pred=None) -> tuple[FreshnessClassifier, types.SimpleNamespace]:
    """Build a FreshnessClassifier skipping the heavy __init__ (no model load)."""
    classifier = FreshnessClassifier.__new__(FreshnessClassifier)
    cv_result = types.SimpleNamespace(overall_quality_score=cv_score)
    return classifier, cv_result


class TestGetFreshnessCategory:
    def test_top_boundary_is_fresh(self):
        assert get_freshness_category(100) == "Fresh"
        assert get_freshness_category(90) == "Fresh"

    def test_below_90_is_good(self):
        assert get_freshness_category(89.9) == "Good"
        assert get_freshness_category(75) == "Good"

    def test_acceptable_band(self):
        assert get_freshness_category(74.9) == "Acceptable"
        assert get_freshness_category(50) == "Acceptable"

    def test_near_spoilage_band(self):
        assert get_freshness_category(49.9) == "Near Spoilage"
        assert get_freshness_category(25) == "Near Spoilage"

    def test_spoiled_bottom(self):
        assert get_freshness_category(24.9) == "Spoiled"
        assert get_freshness_category(0) == "Spoiled"
        assert get_freshness_category(-5) == "Spoiled"

    def test_all_five_categories_covered(self):
        covered = {
            get_freshness_category(s) for s in (95, 80, 60, 35, 10)
        }
        assert covered == {"Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"}


class TestCombineScores:
    def _preds(self, fresh=0.0, semi=0.0, rotten=0.0) -> dict:
        return {
            "model": "pytorch",
            "predictions": [
                {"class": "fresh", "probability": fresh},
                {"class": "semi_fresh", "probability": semi},
                {"class": "rotten", "probability": rotten},
            ],
        }

    def test_cnn_uses_real_class_keys(self):
        """Regression: predictions keyed fresh/semi_fresh/rotten must be used."""
        classifier, cv = scorer_without_models(cv_score=0.5)
        cnn = self._preds(fresh=0.9, semi=0.1)
        combined = classifier._combine_scores(cv, cnn)
        assert combined == pytest.approx(
            expected_blend({"fresh": 0.9, "semi_fresh": 0.1, "rotten": 0.0}, 0.5)
        )

    def test_fully_fresh_cnn_high(self):
        classifier, cv = scorer_without_models(cv_score=1.0)
        combined = classifier._combine_scores(cv, self._preds(fresh=1.0))
        assert combined == pytest.approx(1.0)

    def test_fully_rotten_cnn_low(self):
        classifier, cv = scorer_without_models(cv_score=0.0)
        combined = classifier._combine_scores(cv, self._preds(rotten=1.0))
        assert combined == pytest.approx(CNN_WEIGHT_CONFIDENT * 0.05)
        assert combined < 0.2

    def test_semi_fresh_mid(self):
        classifier, cv = scorer_without_models(cv_score=0.5)
        combined = classifier._combine_scores(cv, self._preds(semi=1.0))
        assert combined == pytest.approx(
            expected_blend({"fresh": 0.0, "semi_fresh": 1.0, "rotten": 0.0}, 0.5)
        )

    def test_no_cnn_uses_cv_only(self):
        classifier, cv = scorer_without_models(cv_score=0.42)
        assert classifier._combine_scores(cv, None) == 0.42

    def test_output_clamped(self):
        classifier, cv = scorer_without_models(cv_score=-1.0)
        assert classifier._combine_scores(cv, None) == 0.0
        classifier2, cv2 = scorer_without_models(cv_score=2.0)
        assert classifier2._combine_scores(cv2, None) == 1.0

    def test_unconfident_cnn_defers_to_visual_analysis(self):
        """
        A flat, unconfident prediction must not move the score much.

        This is the regression guard for the original bug: a weak visual
        signal combined with a mushy model output used to produce a confident,
        badly wrong number.
        """
        classifier, cv = scorer_without_models(cv_score=0.90)
        mushy = self._preds(fresh=0.34, semi=0.33, rotten=0.33)
        combined = classifier._combine_scores(cv, mushy)
        assert combined == pytest.approx(
            expected_blend({"fresh": 0.34, "semi_fresh": 0.33, "rotten": 0.33}, 0.90)
        )
        # The mushy CNN is pulled towards neutral (~0.54), and it only carries
        # CNN_WEIGHT_UNCONFIDENT, so the visual analysis clearly dominates and
        # the result stays a healthy "Good" rather than collapsing.
        assert CNN_WEIGHT_UNCONFIDENT < CNN_WEIGHT_CONFIDENT
        assert combined > 0.75
        assert combined < 0.90

    def test_confident_cnn_outweighs_weak_visual_signal(self):
        """A confident CNN prediction is not overruled by the visual score."""
        classifier, cv = scorer_without_models(cv_score=0.20)
        combined = classifier._combine_scores(
            cv, self._preds(fresh=0.97, semi=0.02, rotten=0.01)
        )
        # 0.65 * ~0.98 + 0.35 * 0.20: the confident model leads. A weak visual
        # score can pull the result down, but it cannot push a clearly-fresh
        # prediction into Near Spoilage / Spoiled.
        assert combined > 0.70
        assert combined == pytest.approx(
            expected_blend({"fresh": 0.97, "semi_fresh": 0.02, "rotten": 0.01}, 0.20)
        )
        assert get_freshness_category(combined * 100) not in ("Near Spoilage", "Spoiled")


class TestClassify:
    def test_delegates_to_shared_category(self):
        classifier, _ = scorer_without_models()
        assert classifier._classify(0.95) == "Fresh"
        assert classifier._classify(0.60) == "Acceptable"
        assert classifier._classify(0.10) == "Spoiled"

    def test_classify_threshold_alignment(self):
        """_classify and get_freshness_category must agree for every score."""
        classifier, _ = scorer_without_models()
        for score100 in (100, 90, 89, 75, 74, 50, 49, 25, 24, 0):
            assert classifier._classify(score100 / 100) == get_freshness_category(score100)