"""Reusable, side-effect-free M2 classification evaluation utilities.

Training callers supply frozen predictions from a grouped holdout.  This module
does not manufacture metrics and does not write artifacts unless a caller
explicitly serializes its returned dictionary elsewhere.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class EvaluationExample:
    true_label: str
    predicted_label: str
    confidence: float


def evaluate_classification(examples: Iterable[EvaluationExample], bins: int = 10) -> dict:
    """Calculate accuracy, per-label support, and expected calibration error."""

    rows = list(examples)
    if not rows:
        raise ValueError("At least one evaluation example is required.")
    if bins < 1:
        raise ValueError("bins must be positive.")
    if any(not 0.0 <= row.confidence <= 1.0 for row in rows):
        raise ValueError("confidence values must be within [0, 1].")

    labels = sorted({row.true_label for row in rows} | {row.predicted_label for row in rows})
    correct = [row.true_label == row.predicted_label for row in rows]
    per_label = {}
    for label in labels:
        label_rows = [row for row in rows if row.true_label == label]
        per_label[label] = {
            "support": len(label_rows),
            "recall": (
                sum(row.predicted_label == label for row in label_rows) / len(label_rows)
                if label_rows else None
            ),
        }

    ece = 0.0
    calibration_bins = []
    for index in range(bins):
        lower, upper = index / bins, (index + 1) / bins
        bucket = [
            row for row in rows
            if lower <= row.confidence < upper or (index == bins - 1 and row.confidence == 1.0)
        ]
        if not bucket:
            continue
        observed = sum(row.true_label == row.predicted_label for row in bucket) / len(bucket)
        average_confidence = sum(row.confidence for row in bucket) / len(bucket)
        ece += (len(bucket) / len(rows)) * abs(observed - average_confidence)
        calibration_bins.append({
            "lower": lower,
            "upper": upper,
            "count": len(bucket),
            "accuracy": observed,
            "average_confidence": average_confidence,
        })

    return {
        "sample_count": len(rows),
        "accuracy": sum(correct) / len(rows),
        "labels": per_label,
        "expected_calibration_error": ece,
        "calibration_bins": calibration_bins,
    }


def select_confidence_threshold(examples: Iterable[EvaluationExample], minimum_precision: float) -> float | None:
    """Select the lowest observed threshold meeting target precision, if any."""

    rows = list(examples)
    if not 0.0 <= minimum_precision <= 1.0:
        raise ValueError("minimum_precision must be within [0, 1].")
    candidates = sorted({row.confidence for row in rows})
    for threshold in candidates:
        accepted = [row for row in rows if row.confidence >= threshold]
        precision = sum(row.true_label == row.predicted_label for row in accepted) / len(accepted)
        if precision >= minimum_precision:
            return threshold
    return None
