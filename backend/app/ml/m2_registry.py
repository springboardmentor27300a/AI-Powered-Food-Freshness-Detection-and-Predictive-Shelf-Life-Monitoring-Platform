"""Validated registry access for M2 v2 models.

The shipped registry intentionally contains no production-approved model.  A
model is usable only when its approval, data rights, scope, and evaluation
evidence are all explicitly recorded and valid.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .m2_types import (
    CANONICAL_CATEGORIES,
    CAPABILITY_NOT_YET_SUPPORTED,
    CAPABILITY_SUPPORTED,
    CategoryCapability,
)


DEFAULT_REGISTRY_PATH = Path(__file__).resolve().parent / "saved_models" / "m2" / "model_registry.json"
_VALID_CAPABILITY_STATUSES = {"supported", "not_yet_supported", "uncertain"}
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class M2RegistryError(ValueError):
    """Raised when M2's model registry cannot be safely used."""


def load_registry(path: str | Path | None = None) -> dict[str, Any]:
    """Load and validate the M2-only registry without loading any model file."""

    registry_path = Path(path) if path is not None else DEFAULT_REGISTRY_PATH
    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise M2RegistryError(f"Unable to read M2 registry: {registry_path}") from exc

    if not isinstance(data, dict):
        raise M2RegistryError("M2 registry root must be an object.")
    if not isinstance(data.get("registry_version"), str) or not data["registry_version"].strip():
        raise M2RegistryError("M2 registry requires a non-empty registry_version.")
    if not isinstance(data.get("categories"), dict):
        raise M2RegistryError("M2 registry requires a categories object.")
    if not isinstance(data.get("models"), list):
        raise M2RegistryError("M2 registry requires a models list.")

    categories = data["categories"]
    missing = set(CANONICAL_CATEGORIES) - set(categories)
    if missing:
        raise M2RegistryError(f"M2 registry is missing categories: {sorted(missing)}")

    for category in CANONICAL_CATEGORIES:
        entry = categories[category]
        if not isinstance(entry, dict):
            raise M2RegistryError(f"M2 category entry must be an object: {category}")
        if entry.get("capability_status") not in _VALID_CAPABILITY_STATUSES:
            raise M2RegistryError(f"M2 category has an invalid capability status: {category}")
        if not isinstance(entry.get("reason"), str) or not entry["reason"].strip():
            raise M2RegistryError(f"M2 category requires an explanation: {category}")
        model_id = entry.get("model_id")
        if model_id is not None and not isinstance(model_id, str):
            raise M2RegistryError(f"M2 category model_id must be a string or null: {category}")
    return data


def category_capability(
    category: str,
    registry: dict[str, Any],
    food_subtype: str | None = None,
) -> CategoryCapability:
    """Return declared category capability; this never performs a model fallback."""

    entry = registry["categories"][category]
    status = entry["capability_status"]
    model_id = entry.get("model_id")

    # A category may only advertise support when a fully approved matching model
    # exists. Any invalid or incomplete entry is safely downgraded to abstention.
    if status == CAPABILITY_SUPPORTED and get_approved_model_for_category(
        category, registry, food_subtype
    ) is None:
        return CategoryCapability(
            category=category,
            status=CAPABILITY_NOT_YET_SUPPORTED,
            reason="No production-approved M2 model is available for this category.",
            model_id=None,
        )
    return CategoryCapability(
        category=category,
        status=status,
        reason=entry["reason"],
        model_id=model_id if status == CAPABILITY_SUPPORTED else None,
    )


def _is_sha256(value: object) -> bool:
    return isinstance(value, str) and bool(_SHA256_RE.fullmatch(value.lower()))


def has_complete_approval_evidence(model: dict[str, Any], category: str, food_subtype: str | None = None) -> bool:
    """Validate the non-negotiable evidence required for M2 v2 activation.

    The checks are intentionally structural.  They prevent a registry edit from
    turning an arbitrary local checkpoint into a production M2 v2 model.
    """

    categories = model.get("categories")
    subtypes = model.get("supported_subtypes")
    rights = model.get("data_rights")
    provenance = model.get("data_provenance")
    artifact = model.get("artifact")
    evaluation = model.get("evaluation")
    if not (
        model.get("approval_status") == "approved"
        and isinstance(categories, list)
        and category in categories
        and isinstance(subtypes, list)
        and isinstance(rights, dict)
        and rights.get("status") == "verified"
        and rights.get("commercial_training") is True
        and rights.get("commercial_deployment") is True
        and isinstance(provenance, dict)
        and isinstance(provenance.get("dataset_id"), str)
        and isinstance(provenance.get("dataset_version"), str)
        and isinstance(provenance.get("license"), str)
        and _is_sha256(provenance.get("manifest_sha256"))
        and _is_sha256(provenance.get("group_split_manifest_sha256"))
        and isinstance(artifact, dict)
        and isinstance(artifact.get("relative_path"), str)
        and _is_sha256(artifact.get("sha256"))
        and isinstance(evaluation, dict)
        and evaluation.get("status") == "accepted"
        and isinstance(evaluation.get("evaluation_id"), str)
        and _is_sha256(evaluation.get("report_sha256"))
        and isinstance(evaluation.get("independent_test"), dict)
        and evaluation["independent_test"].get("status") == "passed"
        and isinstance(evaluation.get("calibration"), dict)
        and isinstance(evaluation["calibration"].get("confidence_threshold"), (int, float))
        and 0.0 <= float(evaluation["calibration"]["confidence_threshold"]) <= 1.0
    ):
        return False
    normalized_subtypes = {value.strip().lower() for value in subtypes if isinstance(value, str)}
    if food_subtype is None or not food_subtype.strip():
        return "*" in normalized_subtypes
    return "*" in normalized_subtypes or food_subtype.strip().lower() in normalized_subtypes


def get_approved_model_for_category(
    category: str,
    registry: dict[str, Any],
    food_subtype: str | None = None,
) -> dict[str, Any] | None:
    """Return a model only if rights, provenance, artifact, and evaluation gates pass."""

    entry = registry["categories"][category]
    model_id = entry.get("model_id")
    if entry.get("capability_status") != CAPABILITY_SUPPORTED or not model_id:
        return None

    for model in registry["models"]:
        if not isinstance(model, dict) or model.get("model_id") != model_id:
            continue
        if has_complete_approval_evidence(model, category, food_subtype):
            return model
    return None

