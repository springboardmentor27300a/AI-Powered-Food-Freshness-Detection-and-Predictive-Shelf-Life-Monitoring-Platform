"""Validate Keras H5 candidate models by loading with TensorFlow (compile=False)
and performing a dummy inference.

This script is conservative: it uses `compile=False`, avoids running custom
training code, and prints errors for manual review.
"""
from __future__ import annotations

import json
import traceback
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent / "saved_models" / "m2" / "candidates"
REPORT = BASE / "keras_validation_report.json"


def find_h5_candidates() -> list[Path]:
    if not BASE.exists():
        return []
    out = []
    for d in BASE.iterdir():
        if not d.is_dir():
            continue
        for f in d.iterdir():
            if f.suffix.lower() in (".h5", ".keras"):
                out.append(f)
    return out


def validate_h5(path: Path) -> dict:
    result = {"path": str(path), "loaded": False, "error": None, "output_shape": None}
    try:
        import tensorflow as tf
        from tensorflow.keras.models import load_model
        # Ensure repository root (backend/) is on sys.path so `app` package imports work
        import sys
        from pathlib import Path

        repo_root = Path(__file__).resolve().parents[3]
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))

        from app.ml.m2_candidates.keras_compat import CompatDepthwiseConv2D

        # Load conservatively with a small compatibility shim for DepthwiseConv2D
        custom_objects = {"DepthwiseConv2D": CompatDepthwiseConv2D}

        # Load model using conservative settings; pass custom_objects to handle
        # models exported with a `groups` keyword in depthwise conv configs.
        model = load_model(str(path), compile=False, custom_objects=custom_objects)
        result["loaded"] = True
        # Prepare dummy input based on model input shape
        input_shape = model.input_shape
        # input_shape is often (None, H, W, C) or (None, C, H, W)
        if isinstance(input_shape, tuple):
            shape = list(input_shape)
        elif isinstance(input_shape, list):
            shape = list(input_shape[0])
        else:
            shape = None
        if shape is None or len(shape) != 4:
            # fallback to 224x224x3
            shape = [None, 224, 224, 3]
        import numpy as np

        dummy = np.zeros([1, shape[1], shape[2], shape[3]], dtype=np.float32)
        out = model.predict(dummy)
        result["output_shape"] = getattr(out, "shape", None)
    except Exception as e:
            # If load_model fails, attempt a conservative fallback:
            result["error"] = str(e)
            result["traceback"] = traceback.format_exc()
            try:
                # Try to reconstruct model from the saved `model_config` JSON
                import h5py
                from tensorflow.keras.models import model_from_json

                with h5py.File(str(path), "r") as f:
                    cfg = f.attrs.get("model_config")
                    if cfg is not None:
                        s = cfg.decode() if isinstance(cfg, bytes) else cfg
                        # model_from_json expects the JSON string describing the model
                        model = model_from_json(s)
                        # load weights into the newly created model
                        model.load_weights(str(path))
                        result["loaded_fallback"] = True
                        # run a dummy inference if we could construct the model
                        import numpy as np

                        input_shape = model.input_shape
                        if isinstance(input_shape, tuple):
                            ish = input_shape
                        elif isinstance(input_shape, list):
                            ish = input_shape[0]
                        else:
                            ish = (None, 100, 100, 3)
                        dummy = np.zeros([1, ish[1], ish[2], ish[3]], dtype=np.float32)
                        out = model.predict(dummy)
                        result["output_shape"] = getattr(out, "shape", None)
            except Exception:
                # preserve original traceback; keep the fallback failure silent here
                pass
    return result


def main():
    candidates = find_h5_candidates()
    results = []
    for c in candidates:
        results.append(validate_h5(c))
    summary = {"count": len(results), "results": results}
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
