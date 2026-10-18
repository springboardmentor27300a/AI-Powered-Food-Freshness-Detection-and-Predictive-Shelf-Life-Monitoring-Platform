from __future__ import annotations

import json
from pathlib import Path

import torch
from torchvision import models

OUT_DIR = Path(__file__).resolve().parent / "saved_models" / "m2" / "candidates" / "public_torchvision_mobilenetv2"
STATE_PATH = OUT_DIR / "mobilenet_v2_imagenet.pth"
PROVENANCE_PATH = OUT_DIR / "provenance.json"
README_PATH = OUT_DIR / "README.md"


def main() -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    weights = models.MobileNet_V2_Weights.DEFAULT
    model = models.mobilenet_v2(weights=weights)
    model.eval()
    torch.save(model.state_dict(), STATE_PATH)

    metadata = {
        "model_name": "MobileNetV2",
        "architecture": "mobilenet_v2",
        "source": "torchvision",
        "source_url": "https://pytorch.org/vision/stable/models.html",
        "license": "BSD-3-Clause",
        "provenance": "Official torchvision ImageNet pre-trained weights",
        "labels_count": len(weights.meta["categories"]),
        "labels_preview": weights.meta["categories"][:10],
        "input_size": [224, 224],
        "mode": "generic_image_classifier",
        "freshness_validated": False,
        "approval_status": "not_approved_for_food_freshness",
        "note": "This is a public generic ImageNet model only. It is kept here for benchmarking and real inference demonstration, not as a validated food-freshness detector.",
    }
    PROVENANCE_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    README_PATH.write_text(
        "# Public MobileNetV2 staging artifact\n\n"
        "This directory contains a real public ImageNet-trained MobileNetV2 checkpoint downloaded from the official torchvision weights.\n\n"
        "- Source: torchvision official pre-trained MobileNetV2\n"
        "- License: BSD-3-Clause\n"
        "- Architecture: MobileNetV2\n"
        "- Input size: 224x224 RGB\n"
        "- Food freshness status: not validated; not approved for FreshGuard M2\n\n"
        "The checkpoint is stored for inspection and demonstration only. It must not be treated as a production freshness model without a separate evaluation and approval gate.\n",
        encoding="utf-8",
    )

    return {
        "state_path": str(STATE_PATH),
        "labels_count": len(weights.meta["categories"]),
        "first_labels": weights.meta["categories"][:5],
        "approval_status": metadata["approval_status"],
    }


if __name__ == "__main__":
    print(json.dumps(main(), indent=2))
