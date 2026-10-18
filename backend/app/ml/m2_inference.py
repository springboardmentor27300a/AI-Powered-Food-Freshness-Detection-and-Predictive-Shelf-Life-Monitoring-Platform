"""Approved-model inference for M2 v2.

Only a registry entry that passes all governance checks can reach the runtime.
The current shipped registry contains no such entry, so this module performs no
production inference in the present release.
"""

from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .m2_registry import get_approved_model_for_category


@dataclass(frozen=True)
class M2InferenceResult:
    status: str
    reason: str
    model_id: str | None = None
    classification: str | None = None
    confidence: float | None = None


def confidence_is_sufficient(confidence: float, threshold: float) -> bool:
    return 0.0 <= confidence <= 1.0 and 0.0 <= threshold <= 1.0 and confidence >= threshold


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assess_approved_freshness(
    image_bytes: bytes,
    category: str,
    food_subtype: str | None,
    registry: dict[str, Any],
) -> M2InferenceResult:
    """Run a checked TorchScript classifier or abstain with an explicit reason."""

    model = get_approved_model_for_category(category, registry, food_subtype)
    if model is None:
        return M2InferenceResult("not_assessed", "No approved M2 model matches this category and subtype.")

    artifact = model["artifact"]
    artifact_path = Path(__file__).resolve().parent / "saved_models" / "m2" / artifact["relative_path"]
    if not artifact_path.is_file() or _sha256(artifact_path) != artifact["sha256"].lower():
        return M2InferenceResult("not_assessed", "Approved model artifact is unavailable or failed integrity verification.")
    if model.get("runtime") != "torchscript_classifier":
        return M2InferenceResult("not_assessed", "Approved model runtime is not supported by this service.")

    try:
        import torch
        import torch.nn.functional as functional
        from PIL import Image
        from torchvision import transforms

        runtime_model = torch.jit.load(str(artifact_path), map_location="cpu")
        runtime_model.eval()
        input_spec = model["input"]
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = transforms.Compose([
            transforms.Resize(tuple(input_spec["size"])),
            transforms.ToTensor(),
            transforms.Normalize(input_spec["mean"], input_spec["std"]),
        ])(image).unsqueeze(0)
        with torch.no_grad():
            probabilities = functional.softmax(runtime_model(tensor), dim=1)[0]
        labels = model["labels"]
        if len(labels) != len(probabilities):
            return M2InferenceResult("not_assessed", "Approved model label specification does not match model output.")
        index = int(probabilities.argmax().item())
        confidence = float(probabilities[index].item())
    except Exception:
        return M2InferenceResult("not_assessed", "Approved model could not evaluate this image.")

    threshold = float(model["evaluation"]["calibration"]["confidence_threshold"])
    if not confidence_is_sufficient(confidence, threshold):
        return M2InferenceResult("not_assessed", "Model confidence is below its approved abstention threshold.", model_id=model["model_id"])
    semantics = model.get("label_semantics", {})
    classification = semantics.get(labels[index])
    if not isinstance(classification, str) or not classification:
        return M2InferenceResult("not_assessed", "Approved model has no validated semantic label mapping.", model_id=model["model_id"])
    return M2InferenceResult("assessed", "Assessment produced by an approved M2 model.", model["model_id"], classification, confidence)
