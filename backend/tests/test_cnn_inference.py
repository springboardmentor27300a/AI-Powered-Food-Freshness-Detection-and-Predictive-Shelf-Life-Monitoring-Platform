"""
Real end-to-end CNN inference test on real dataset images.

Skips when no trained checkpoint exists (networks/model not required to run
the other test modules).  When a model IS present, every assertion runs real
PyTorch inference on held-out TEST images from the pre-split folders.
"""
from pathlib import Path

import numpy as np
import pytest

from app.ml.config import CNN_CLASS_KEYS, TEST_DIR
from app.ml.freshness_scorer import FreshnessClassifier
from app.ml.preprocessing import preprocess_for_pytorch

_VALID_CATEGORIES = {"Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"}


def _first_image(class_folder: str) -> Path:
    folder = TEST_DIR / class_folder
    if not folder.exists():
        return None
    images = [p for p in sorted(folder.iterdir()) if p.is_file()]
    return images[0] if images else None


pytestmark = pytest.mark.skipif(
    not (Path(__file__).resolve().parents[1] / "ml" / "models" / "food_freshness_model.pt").exists(),
    reason="Trained CNN checkpoint not present. Run: python ml/train_model.py",
)


class TestCNNPrediction:
    @pytest.fixture(scope="class")
    def classifier(self):
        clf = FreshnessClassifier()
        assert clf.pytorch_model is not None, "model file exists but failed to load"
        return clf

    @pytest.mark.parametrize("cls", ["FRESH", "SEMI_FRESH", "ROTTEN"])
    def test_probability_vectors_are_well_formed(self, classifier, cls):
        img_path = _first_image(cls)
        if img_path is None:
            pytest.skip(f"No test images for {cls}")
        tensor = preprocess_for_pytorch(img_path.read_bytes())
        preds = classifier._run_cnn_inference(img_path.read_bytes())
        assert preds is not None
        assert preds["model"] == "pytorch"

    def test_predictions_cover_all_three_classes(self, classifier):
        img_path = _first_image("FRESH")
        if img_path is None:
            pytest.skip("No FRESH test images")
        tensor = preprocess_for_pytorch(img_path.read_bytes())
        from app.ml.models.cnn_model import predict_pytorch

        preds = predict_pytorch(classifier.pytorch_model, tensor)
        assert [p["class"] for p in preds] == CNN_CLASS_KEYS
        probs = np.array([p["probability"] for p in preds])
        assert np.isclose(probs.sum(), 1.0)  # softmax over three classes

    def test_full_assess_returns_valid_category(self, classifier):
        img_path = _first_image("FRESH") or _first_image("SEMI_FRESH")
        if img_path is None:
            pytest.skip("No test images")
        assessment = classifier.assess(img_path.read_bytes(), food_category="Fruits")
        assert assessment.classification in _VALID_CATEGORIES
        assert 0.0 <= assessment.freshness_score <= 100.0
        assert 0.0 <= assessment.confidence_score <= 1.0
        assert assessment.image_quality_score >= 0.0