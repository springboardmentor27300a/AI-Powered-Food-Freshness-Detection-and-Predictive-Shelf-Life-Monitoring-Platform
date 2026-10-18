"""Manual diagnostic for an optional legacy candidate checkpoint.

This file was named ``test_*`` but executed model-loading side effects during
pytest collection and referenced a checkpoint not included in the repository.
Run it directly when that optional checkpoint and its validation dependencies
are available.
"""

import json
from pathlib import Path


def main():
    import h5py

    checkpoint = (
        Path(__file__).resolve().parents[1]
        / "saved_models"
        / "m2"
        / "candidates"
        / "captraj_fruitveg"
        / "rottenvsfresh98pval.h5"
    )
    if not checkpoint.is_file():
        raise FileNotFoundError(f"Optional candidate checkpoint not found: {checkpoint}")

    with h5py.File(checkpoint, "r") as model_file:
        config = model_file.attrs.get("model_config")
    if config is None:
        print("No model_config in checkpoint")
        return

    serialized = config.decode() if isinstance(config, bytes) else config
    import numpy as np
    from tensorflow.keras.models import model_from_json
    from tensorflow.keras.utils import get_custom_objects

    from .keras_compat import CompatDepthwiseConv2D

    get_custom_objects()["DepthwiseConv2D"] = CompatDepthwiseConv2D
    parsed = json.loads(serialized)
    model_json = (
        json.dumps(parsed["config"])
        if isinstance(parsed, dict) and "config" in parsed and "class_name" in parsed
        else serialized
    )
    model = model_from_json(model_json)
    model.load_weights(str(checkpoint))
    model.predict(np.zeros((1, 100, 100, 3), dtype=np.float32), verbose=0)
    print("Optional checkpoint loaded and produced an inference output")


if __name__ == "__main__":
    main()
