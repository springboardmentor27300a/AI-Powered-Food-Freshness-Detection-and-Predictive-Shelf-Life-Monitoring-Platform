"""Explicitly non-commercial development adapter for the legacy fruit model.

This module is isolated from M2 v2's production registry.  It is only available
for reproducible development inspection of the protected legacy checkpoint and
must not be treated as a food-safety or production assessment.
"""

from __future__ import annotations

from typing import Any


SUPPORTED_SUBTYPES = {"apple", "banana", "orange"}


def normalize_legacy_fruit_subtype(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower().rstrip("s")
    return normalized if normalized in SUPPORTED_SUBTYPES else None


def assess_research_fruit(image_bytes: bytes, subtype: str) -> dict[str, Any]:
    """Run the existing checkpoint only when its predicted fruit matches scope."""

    from .assessment import assess_freshness

    result = assess_freshness(image_bytes)
    predicted_food = result["model_prediction"]["food_item"].lower()
    if predicted_food != subtype:
        return {
            "assessment_status": "not_assessed",
            "reason": (
                "The legacy model predicted a different supported fruit subtype; "
                "the research result was withheld to prevent scope mismatch."
            ),
            "result": None,
        }
    return {
        "assessment_status": "research_assessed",
        "reason": (
            "Development-only result from the legacy checkpoint. Its dataset licence, provenance, "
            "and leakage-controlled evaluation are unresolved; it is not a production or food-safety assessment."
        ),
        "result": result,
    }
