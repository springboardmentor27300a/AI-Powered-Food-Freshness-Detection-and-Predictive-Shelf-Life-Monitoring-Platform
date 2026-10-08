"""
CNN model definitions for food freshness classification.

This module is the *only* place that knows how to build and load the CNN.

The CNN is always trained on the three REAL classes provided by the
AgriFreshNET dataset:

    FRESH / SEMI_FRESH / ROTTEN   (keys: fresh, semi_fresh, rotten)

The five application-level categories
(Fresh / Good / Acceptable / Near Spoilage / Spoiled) are produced later by the
scoring engine (``app.ml.scoring_engine``), never by the CNN.

Transfer learning:  ImageNet-pretrained MobileNetV2 backbone (frozen), Global
Average Pooling, Dropout, Dense classification head.

Input convention:  a tensor of shape (1, 3, 224, 224), RGB, normalized with
ImageNet statistics - identical preprocessing is used for training and
inference (see ``app.ml.preprocessing`` / ``ml.train_model``).
"""
from pathlib import Path
from typing import Optional

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torchvision import models as tv_models
    TORCH_AVAILABLE = True
except ImportError:  # pragma: no cover - environment without torch
    TORCH_AVAILABLE = False

from app.ml.config import (
    BACKBONE_NAME,
    CNN_CLASS_KEYS,
    DROPOUT_RATE,
    FREEZE_BACKBONE,
    MODEL_PATH,
    MODEL_VERSION,
)


class MobileNetFreshnessClassifier(nn.Module):
    """
    Transfer-learning classifier: frozen ImageNet MobileNetV2 backbone
    -> Global Average Pooling -> Dropout -> Dense softmax head.
    """

    def __init__(self, num_classes: int = len(CNN_CLASS_KEYS),
                 dropout: float = DROPOUT_RATE, freeze_backbone: bool = FREEZE_BACKBONE):
        super().__init__()
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch/torchvision is not installed.")

        weights = tv_models.MobileNet_V2_Weights.IMAGENET1K_V1
        backbone = tv_models.mobilenet_v2(weights=weights)
        self.backbone = backbone.features  # NOT pre-configured classifier
        self.freeze_backbone = freeze_backbone

        for param in self.backbone.parameters():
            param.requires_grad = not freeze_backbone

        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Dropout(dropout),
            nn.Linear(backbone.last_channel, num_classes),
        )

    def forward(self, x):
        x = self.backbone(x)
        x = self.classifier(x)
        return x


def build_model(num_classes: int = len(CNN_CLASS_KEYS)) -> nn.Module:
    """Build the MobileNetV2 transfer-learning model (GPU/CPU agnostic)."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("PyTorch/torchvision is not installed. Run: pip install -r requirements.txt")
    return MobileNetFreshnessClassifier(num_classes=num_classes)


def _default_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_pytorch_model(model_path: Optional[Path] = None):
    """
    Load the trained CNN weights (full checkpoint dict) if the file exists.

    Returns the model in eval() mode, or ``None`` when the model file is
    absent/unreadable.  The caller decides how to report that to the user -
    we never fabricate predictions here.
    """
    if not TORCH_AVAILABLE:
        return None

    path = Path(model_path) if model_path else MODEL_PATH
    if not path.exists():
        return None

    try:
        checkpoint = torch.load(path, map_location="cpu")
        weights = checkpoint.get("state_dict", checkpoint)
        num_classes = len(checkpoint.get("class_keys", CNN_CLASS_KEYS))
        model = build_model(num_classes=num_classes)
        model.load_state_dict(weights)
        model.eval()
        return model
    except Exception:  # noqa: BLE001 - model loading must never crash the API
        return None


def model_checkpoint_path() -> Path:
    """Location where train_model.py saves the best checkpoint."""
    return MODEL_PATH


def save_checkpoint(model: nn.Module, path: Optional[Path] = None, extra: Optional[dict] = None) -> Path:
    """Save a self-describing checkpoint (state dict + metadata)."""
    target = Path(path) if path else MODEL_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "state_dict": model.state_dict(),
        "class_keys": CNN_CLASS_KEYS,
        "model_version": MODEL_VERSION,
        "backbone": BACKBONE_NAME,
    }
    if extra:
        payload.update(extra)
    torch.save(payload, target)
    return target


def predict_pytorch(model, image_array: np.ndarray) -> list[dict]:
    """
    Run inference on a preprocessed array of shape (1, 3, 224, 224).

    ``image_array`` is expected to come from
    ``app.ml.preprocessing.preprocess_for_pytorch`` (same pipeline as training).
    Returns a list of {class, probability} sorted as CNN_CLASS_KEYS.
    """
    if not TORCH_AVAILABLE or model is None:
        return []

    model = model.eval()
    tensor = torch.from_numpy(image_array).float()
    with torch.no_grad():
        logits = model(tensor)
        probs = F.softmax(logits, dim=1).squeeze(0)

    return [
        {"class": cls, "probability": round(float(p), 4)}
        for cls, p in zip(CNN_CLASS_KEYS, probs.tolist())
    ]