"""Read-only compatibility inspection for the protected legacy fruit checkpoint."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


_SAVED_MODELS = Path(__file__).resolve().parent / "saved_models"
_MODEL_PATH = _SAVED_MODELS / "freshness_mobilenetv2.pt"
_METADATA_PATH = _SAVED_MODELS / "model_metadata.json"
_EXPECTED_LABELS = {
    "freshapples", "freshbanana", "freshoranges",
    "rottenapples", "rottenbanana", "rottenoranges",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_legacy_fruit_candidate() -> dict:
    """Describe the checkpoint without loading it or making it an M2 v2 model."""

    if not _MODEL_PATH.is_file() or not _METADATA_PATH.is_file():
        return {
            "status": "unavailable",
            "reason": "Legacy fruit checkpoint or metadata is unavailable.",
        }
    try:
        metadata = json.loads(_METADATA_PATH.read_text(encoding="utf-8"))
        labels = set(metadata.get("class_to_idx", {}))
        compatible = (
            metadata.get("architecture") == "MobileNetV2"
            and metadata.get("input_size") == 224
            and labels == _EXPECTED_LABELS
        )
    except (OSError, json.JSONDecodeError):
        return {"status": "unavailable", "reason": "Legacy fruit metadata cannot be read."}

    return {
        "status": "blocked" if compatible else "incompatible",
        "model_id": "legacy-fruit-mobilenetv2",
        "architecture": metadata.get("architecture"),
        "input_size": metadata.get("input_size"),
        "labels": sorted(labels),
        "checkpoint_sha256": _sha256(_MODEL_PATH),
        "preprocessing": {
            "color_mode": "RGB",
            "resize": [224, 224],
            "normalization_mean": [0.485, 0.456, 0.406],
            "normalization_std": [0.229, 0.224, 0.225],
        },
        "reason": (
            "Technically compatible with the legacy MobileNetV2 contract, but blocked from M2 v2 approval: "
            "the source licence/provenance is unverified and the supplied split has unresolved transformed-image leakage."
            if compatible else "Legacy metadata does not match the known six-class MobileNetV2 contract."
        ),
    }
