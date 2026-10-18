"""Validate downloaded M2 candidate artifacts by attempting to load PyTorch models.

This script performs non-destructive checks only:
- identifies downloaded candidate artifacts
- for PyTorch-based files, attempts to construct a matching torchvision model
  (limited set) and load the state dict into it
- runs a dummy forward pass to confirm the model executes on CPU
- reports results to a JSON `validation_report.json` file next to candidates

It does NOT modify existing production registry entries or mark anything as
approved. Any heavy or unsafe operations (e.g. running untrusted TF code) are avoided.
"""
from __future__ import annotations

import json
import traceback
from pathlib import Path
from typing import Dict, Any


BASE = Path(__file__).resolve().parent.parent / "saved_models" / "m2" / "candidates"
REPORT_PATH = BASE / "validation_report.json"


def discover_candidates() -> list[Path]:
    if not BASE.exists():
        return []
    return [p for p in BASE.iterdir() if p.is_dir()]


def try_load_pytorch_model(candidate_path: Path) -> Dict[str, Any]:
    report: Dict[str, Any] = {"candidate": candidate_path.name, "loaded": False, "error": None}
    model_file = candidate_path / "model_weights.pth"
    config_file = candidate_path / "config.json"
    if not model_file.exists():
        report["skipped"] = "no_pytorch_weights"
        return report

    try:
        import torch
        from torchvision import models

        # Load config if present
        config = None
        if config_file.exists():
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)

        arch = (config.get("arch") if config else None) or "resnet18"
        img_size = int(config.get("img_size", 224) if config else 224)

        if arch.lower().startswith("resnet"):
            model = models.resnet18(weights=None)
            # replace final fully-connected layer
            n_classes = int(config.get("n_classes", 3) if config else 3)
            import torch.nn as nn

            model.fc = nn.Linear(model.fc.in_features, n_classes)
        elif arch.lower().startswith("mobilenet_v3") or arch.lower().startswith("mobilenetv3"):
            # mobilenet_v3_small
            model = models.mobilenet_v3_small(weights=None)
            n_classes = int(config.get("n_classes", 2) if config else 2)
            import torch.nn as nn

            # torchvision has classifier as a Sequential with last Linear at [-1]
            if hasattr(model, "classifier"):
                last = list(model.classifier.children())
                if isinstance(last[-1], nn.Linear):
                    in_features = last[-1].in_features
                    model.classifier = nn.Sequential(*list(model.classifier.children())[:-1], nn.Linear(in_features, n_classes))
        else:
            # Unknown arch – attempt resnet18 fallback
            model = models.resnet18(weights=None)
            n_classes = int(config.get("n_classes", 3) if config else 3)
            import torch.nn as nn
            model.fc = nn.Linear(model.fc.in_features, n_classes)

        state = torch.load(str(model_file), map_location="cpu")
        # If the file contains a state_dict under 'model' or similar, try to find it
        if isinstance(state, dict) and not any(k.startswith("conv1") for k in state.keys()):
            # may be a wrapped checkpoint (fastai/pytorch-lightning)
            for key in ("model_state_dict", "state_dict", "model"):
                if key in state and isinstance(state[key], dict):
                    state = state[key]
                    break

        model.load_state_dict(state)
        model.eval()
        # Dummy forward
        import torch

        dummy = torch.zeros(1, 3, img_size, img_size)
        with torch.no_grad():
            out = model(dummy)
        report["loaded"] = True
        report["output_shape"] = list(out.shape)
    except Exception as e:
        report["error"] = str(e)
        report["traceback"] = traceback.format_exc()
    return report


def validate_all():
    candidates = discover_candidates()
    results = []
    for cand in candidates:
        # simple heuristics: common PyTorch filenames and known Keras H5
        if (cand / "model_weights.pth").exists():
            res = try_load_pytorch_model(cand)
            results.append(res)
        elif (cand / "spoilage_mobilenetv3.pth").exists():
            # try loading as a mobilenet_v3_small checkpoint
            # create a symlink-like expectation: copy to model_weights.pth path for loader
            try:
                target = cand / "model_weights.pth"
                if not target.exists():
                    (cand / "model_weights.pth").write_bytes((cand / "spoilage_mobilenetv3.pth").read_bytes())
                res = try_load_pytorch_model(cand)
            except Exception as e:
                res = {"candidate": cand.name, "loaded": False, "error": str(e)}
            results.append(res)
        elif (cand / "rottenvsfresh98pval.h5").exists():
            results.append({"candidate": cand.name, "loaded": False, "note": "keras_h5_requires_tensorflow"})
        else:
            results.append({"candidate": cand.name, "loaded": False, "note": "no_known_artifact"})

    summary = {"candidate_count": len(candidates), "results": results}
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    validate_all()
