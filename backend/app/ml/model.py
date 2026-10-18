"""
model.py — FreshGuard M2
MobileNetV2 transfer-learning classification model.
The number of output classes is discovered dynamically from the dataset.
"""

import os
import json
from pathlib import Path
from typing import Optional, List, Dict

# Deferred torch import so the rest of the backend can start even if torch
# is not installed (the model will raise a clear error only on first use).


SAVED_MODELS_DIR = Path(__file__).parent / "saved_models"
MODEL_PATH = SAVED_MODELS_DIR / "freshness_mobilenetv2.pt"
METADATA_PATH = SAVED_MODELS_DIR / "model_metadata.json"


# ---------------------------------------------------------------------------
# Model Factory
# ---------------------------------------------------------------------------

def build_model(num_classes: int, pretrained: bool = True):
    """
    Build MobileNetV2 with a custom classification head.
    Uses ImageNet pretrained weights when `pretrained=True` (requires internet
    on first call; weights are cached locally by torch after that).
    """
    import torch
    import torch.nn as nn
    from torchvision import models

    if pretrained:
        weights = models.MobileNet_V2_Weights.IMAGENET1K_V1
        model = models.mobilenet_v2(weights=weights)
    else:
        model = models.mobilenet_v2(weights=None)

    # Freeze backbone layers — only train the classifier head initially
    for param in model.features.parameters():
        param.requires_grad = False

    # Replace the default 1000-class head with our freshness classification head
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.2),
        nn.Linear(in_features, 256),
        nn.ReLU(),
        nn.Dropout(p=0.2),
        nn.Linear(256, num_classes),
    )

    return model


def unfreeze_backbone(model, num_layers: int = 4):
    """
    Unfreeze the last `num_layers` feature blocks for fine-tuning.
    Called after initial head-only training to improve accuracy.
    """
    feature_blocks = list(model.features.children())
    for block in feature_blocks[-num_layers:]:
        for param in block.parameters():
            param.requires_grad = True


# ---------------------------------------------------------------------------
# Checkpoint I/O
# ---------------------------------------------------------------------------

def save_model(model, class_to_idx: Dict[str, int], metrics: Optional[Dict] = None):
    """Save model weights and metadata (class mapping + evaluation metrics)."""
    import torch

    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)

    metadata = {
        "class_to_idx": class_to_idx,
        "idx_to_class": {str(v): k for k, v in class_to_idx.items()},
        "num_classes": len(class_to_idx),
        "architecture": "MobileNetV2",
        "input_size": 224,
        "metrics": metrics or {},
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  Model saved -> {MODEL_PATH}")
    print(f"  Metadata saved -> {METADATA_PATH}")


def load_model(device: Optional[str] = None):
    """
    Load a previously trained model from disk.
    Returns (model, metadata_dict) or raises FileNotFoundError.
    """
    import torch

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Trained model not found at {MODEL_PATH}.\n"
            f"Please train the model first:\n"
            f"  python -m app.ml.train --data_dir dataset/"
        )
    if not METADATA_PATH.exists():
        raise FileNotFoundError(
            f"Model metadata not found at {METADATA_PATH}."
        )

    with open(METADATA_PATH) as f:
        metadata = json.load(f)

    num_classes = metadata["num_classes"]
    model = build_model(num_classes=num_classes, pretrained=False)

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    try:
        state = torch.load(MODEL_PATH, map_location=device, weights_only=True)
    except Exception:
        state = torch.load(MODEL_PATH, map_location=device, weights_only=False)

    model.load_state_dict(state)
    model.to(device)
    model.eval()

    return model, metadata, device


def is_model_available() -> bool:
    """Check if a trained model checkpoint exists on disk."""
    return MODEL_PATH.exists() and METADATA_PATH.exists()
