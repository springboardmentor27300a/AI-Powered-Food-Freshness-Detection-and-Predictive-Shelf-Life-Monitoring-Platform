"""
ml/inference/freshness_predictor.py

Loaded by app/services/cnn_service.py. Encapsulates:
  - lazily loading ml/models/freshness_model.keras (once, cached)
  - preprocessing an image the same way it was trained (MobileNetV2 preprocess_input)
  - returning a real softmax-derived confidence, or a clear "unavailable" result
    if the model file doesn't exist yet or fails to load — NEVER a fabricated score.
"""
import json
import time
from pathlib import Path
from typing import Optional

ML_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ML_ROOT / "models" / "freshness_model.keras"
CLASS_NAMES_PATH = ML_ROOT / "config" / "class_names.json"
IMG_SIZE = (224, 224)


class PredictionResult:
    def __init__(self, status: str, predicted_class: Optional[str] = None,
                 confidence: Optional[float] = None, class_probabilities: Optional[dict] = None,
                 error_message: Optional[str] = None, inference_time_ms: Optional[float] = None,
                 model_version: Optional[str] = None):
        self.status = status
        self.predicted_class = predicted_class
        self.confidence = confidence
        self.class_probabilities = class_probabilities
        self.error_message = error_message
        self.inference_time_ms = inference_time_ms
        self.model_version = model_version


class FreshnessPredictor:
    """Singleton-style wrapper — instantiate once (app/services/cnn_service.py does this at import time)."""

    def __init__(self):
        self._model = None
        self._load_error: Optional[str] = None
        self._model_version = None
        self._class_order = None  # e.g. ["fresh", "rotten"], index 0/1
        self._load_config()

    def _load_config(self):
        try:
            with open(CLASS_NAMES_PATH) as f:
                cfg = json.load(f)
            self._model_version = cfg.get("model_version", "unknown")
        except FileNotFoundError:
            self._model_version = "unknown"

    def _lazy_load(self):
        if self._model is not None or self._load_error is not None:
            return
        if not MODEL_PATH.exists():
            self._load_error = (
                f"Model file not found at {MODEL_PATH}. Train it first: "
                "python ml/training/prepare_dataset.py && python ml/training/train_cnn.py"
            )
            return
        try:
            import tensorflow as tf  # imported lazily so the whole API doesn't require
                                       # TensorFlow to be installed just to boot up
            self._model = tf.keras.models.load_model(MODEL_PATH)

            class_indices_path = MODEL_PATH.parent / "class_indices.json"
            if class_indices_path.exists():
                with open(class_indices_path) as f:
                    idx_map = json.load(f)  # {"fresh": 0, "rotten": 1}
                self._class_order = [None, None]
                for name, idx in idx_map.items():
                    self._class_order[idx] = name
            else:
                self._class_order = ["fresh", "rotten"]  # fallback; matches training script's alphabetical default
        except Exception as exc:  # noqa: BLE001 - we deliberately surface any load failure as "unavailable"
            self._load_error = f"Failed to load model: {exc}"

    def is_available(self) -> bool:
        self._lazy_load()
        return self._model is not None

    def status(self) -> dict:
        self._lazy_load()
        if self._model is not None:
            return {"status": "available", "model_version": self._model_version, "classes": self._class_order}
        return {"status": "unavailable", "reason": self._load_error, "model_version": self._model_version}

    def predict(self, image_path: Path) -> PredictionResult:
        self._lazy_load()
        if self._model is None:
            return PredictionResult(status="model_unavailable", error_message=self._load_error,
                                     model_version=self._model_version)

        try:
            import numpy as np
            import tensorflow as tf
            from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

            start = time.perf_counter()
            img = tf.keras.utils.load_img(image_path, target_size=IMG_SIZE)
            arr = tf.keras.utils.img_to_array(img)
            arr = np.expand_dims(arr, axis=0)
            arr = preprocess_input(arr)

            prob_rotten = float(self._model.predict(arr, verbose=0)[0][0])
            elapsed_ms = (time.perf_counter() - start) * 1000

            prob_fresh = 1.0 - prob_rotten
            probs = {self._class_order[0]: prob_fresh, self._class_order[1]: prob_rotten}
            predicted_class = self._class_order[1] if prob_rotten >= 0.5 else self._class_order[0]
            confidence = prob_rotten if predicted_class == self._class_order[1] else prob_fresh

            return PredictionResult(
                status="success",
                predicted_class=predicted_class,
                confidence=round(confidence, 4),
                class_probabilities={k: round(v, 4) for k, v in probs.items()},
                inference_time_ms=round(elapsed_ms, 2),
                model_version=self._model_version,
            )
        except Exception as exc:  # noqa: BLE001
            return PredictionResult(status="inference_error", error_message=str(exc),
                                     model_version=self._model_version)


predictor = FreshnessPredictor()
