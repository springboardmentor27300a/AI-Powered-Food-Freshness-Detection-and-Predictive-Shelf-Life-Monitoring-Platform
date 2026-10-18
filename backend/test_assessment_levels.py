import pytest

from app.ml.assessment import _map_to_freshness_category


@pytest.mark.parametrize(
    ("is_fresh", "confidence", "discoloration", "uniformity", "expected"),
    [
        (True, 0.95, 0.05, 0.88, "Fresh"),
        (True, 0.70, 0.10, 0.70, "Good"),
        (True, 0.55, 0.10, 0.60, "Acceptable"),
        (True, 0.40, 0.25, 0.50, "Near Spoilage"),
        (False, 0.90, 0.50, 0.30, "Spoiled"),
    ],
)
def test_freshness_mapping_reaches_all_five_levels(
    is_fresh, confidence, discoloration, uniformity, expected
):
    assert _map_to_freshness_category(
        is_fresh_class=is_fresh,
        model_confidence=confidence,
        discoloration_index=discoloration,
        texture_uniformity=uniformity,
    ) == expected
