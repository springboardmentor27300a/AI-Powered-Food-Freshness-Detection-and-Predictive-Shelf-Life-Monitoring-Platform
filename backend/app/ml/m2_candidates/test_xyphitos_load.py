"""Manual diagnostic for an optional MobileNetV3 candidate checkpoint.

Run directly when the separately supplied candidate weights are available.
Avoid loading unapproved candidate weights during pytest collection.
"""

from pathlib import Path


def main():
    import torch
    from torch import nn
    from torchvision import models

    checkpoint = (
        Path(__file__).resolve().parents[1]
        / "saved_models"
        / "m2"
        / "candidates"
        / "xyphitos_fridgeai"
        / "spoilage_mobilenetv3.pth"
    )
    if not checkpoint.is_file():
        raise FileNotFoundError(f"Optional candidate checkpoint not found: {checkpoint}")

    state = torch.load(str(checkpoint), map_location="cpu", weights_only=True)
    model = models.mobilenet_v3_small(weights=None)
    model.classifier = nn.Sequential(
        nn.Linear(576, 256),
        nn.Hardswish(),
        nn.Dropout(0.2),
        nn.Linear(256, 1),
    )
    model.load_state_dict(state, strict=True)
    model.eval()
    with torch.no_grad():
        output = model(torch.zeros((1, 3, 224, 224)))
    print("Optional checkpoint loaded; output shape:", tuple(output.shape))


if __name__ == "__main__":
    main()
