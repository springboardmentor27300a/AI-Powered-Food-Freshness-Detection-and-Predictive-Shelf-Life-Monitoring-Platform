"""Ordinal freshness scoring for calibrated, five-class M2 models only."""

from __future__ import annotations

import math
from collections.abc import Mapping


FRESHNESS_CLASSES = ("Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled")
QUALITY_POINTS = {
    "Fresh": 100,
    "Good": 80,
    "Acceptable": 60,
    "Near Spoilage": 30,
    "Spoiled": 0,
}


def score_freshness_probabilities(probabilities: Mapping[str, float]) -> tuple[int, float]:
    """Return expected ordinal quality and severe-spoilage class probability.

    This calculation is valid only for a model whose output probabilities have
    been evaluated and calibrated for all five freshness classes. It is not a
    food-safety or microbiological-risk estimate.
    """

    if set(probabilities) != set(FRESHNESS_CLASSES):
        raise ValueError("All five calibrated freshness classes are required.")
    values = [float(probabilities[label]) for label in FRESHNESS_CLASSES]
    if any(not math.isfinite(value) or value < 0.0 or value > 1.0 for value in values):
        raise ValueError("Freshness probabilities must be finite values within [0, 1].")
    total = sum(values)
    if not math.isclose(total, 1.0, rel_tol=1e-4, abs_tol=1e-4):
        raise ValueError("Freshness probabilities must sum to 1.")

    quality_score = round(sum(probabilities[label] * QUALITY_POINTS[label] for label in FRESHNESS_CLASSES))
    spoilage_probability = probabilities["Near Spoilage"] + probabilities["Spoiled"]
    return max(0, min(100, quality_score)), max(0.0, min(1.0, spoilage_probability))
