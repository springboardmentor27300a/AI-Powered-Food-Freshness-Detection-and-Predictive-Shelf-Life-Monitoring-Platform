"""
Standalone evaluation of the trained food-freshness CNN.

Loads the BEST checkpoint (``backend/ml/models/food_freshness_model.pt``) and
measures its REAL performance on the held-out TEST split only.  Nothing is
hard-coded - every metric comes from predictions on real test images.

Run from the ``backend/`` directory::

    python ml/evaluate_model.py
    python ml/evaluate_model.py --batch_size 48 --workers 2

Artifacts written (next to the model checkpoint):
    evaluation_metrics.json  - accuracy, weighted/macro precision-recall-F1,
                              confusion matrix, test size, model metadata.
    classification_report.txt - per-class scikit-learn report (overwritten).
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from torchvision import transforms

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ml.config import CNN_CLASS_KEYS, IMAGE_SIZE  # noqa: E402
from app.ml.models.cnn_model import load_pytorch_model  # noqa: E402
from app.ml.preprocessing import IMAGENET_MEAN, IMAGENET_STD  # noqa: E402
from ml.config import (  # noqa: E402
    BATCH_SIZE,
    CLASSIFICATION_REPORT_TXT,
    EVALUATION_METRICS_JSON,
    NUM_WORKERS,
    TEST_DIR,
)

_EVAL_TRANSFORMS = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN.tolist(), std=IMAGENET_STD.tolist()),
])


class TestDataset:
    """Reads the pre-split TEST folders. Same convention as ml/train_model.py."""

    def __init__(self, root: Path, transform=_EVAL_TRANSFORMS,
                 class_names: list[str] | None = None):
        self.root = Path(root)
        self.transform = transform
        self.classes = class_names or CNN_CLASS_KEYS
        self.class_to_idx = {cls: i for i, cls in enumerate(self.classes)}
        self.samples: list[tuple[Path, int]] = []
        for cls in self.classes:
            folder = self.root / cls
            if not folder.exists():
                continue
            images = [p for p in sorted(folder.iterdir())
                      if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".bmp")]
            for img_path in images:
                self.samples.append((img_path, self.class_to_idx[cls]))
        self.samples.sort(key=lambda x: str(x[0]))
        print(f"  {self.root.parent.name}/{self.root.name} -> {len(self.samples)} images")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        import cv2

        path, label = self.samples[idx]
        img = cv2.imread(str(path))
        if img is None:
            img = np.full((IMAGE_SIZE, IMAGE_SIZE, 3), 127, dtype=np.uint8)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMAGE_SIZE, IMAGE_SIZE))
        if self.transform:
            img = self.transform(img)
        return img, label


def _checkpoint_metadata() -> dict:
    """Read the self-describing metadata stored in the checkpoint dict."""
    from ml.config import MODEL_PATH

    try:
        raw = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)
        if isinstance(raw, dict):
            return {k: raw[k] for k in ("model_version", "backbone", "best_val_acc", "epoch") if k in raw}
    except Exception:  # noqa: BLE001
        return {}


@torch.no_grad()
def predict(loader, model, device):
    model.eval()
    y_true, y_pred, logits_all = [], [], []
    for images, labels in loader:
        outputs = model(images.to(device))
        y_pred.extend(outputs.argmax(dim=1).cpu().tolist())
        y_true.extend(labels.tolist())
        logits_all.extend(outputs.cpu().tolist())
    return y_true, y_pred, logits_all


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the trained food freshness CNN on the TEST split.")
    parser.add_argument("--batch_size", type=int, default=BATCH_SIZE)
    parser.add_argument("--workers", type=int, default=NUM_WORKERS)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_pytorch_model()
    if model is None:
        print("[ERROR] No trained model found. Train first: python ml/train_model.py")
        sys.exit(1)

    print(f"Using device: {device}")
    model.to(device)
    print(f"Evaluating on the held-out TEST split | batch_size: {args.batch_size}")

    test_ds = TestDataset(TEST_DIR)
    if len(test_ds) == 0:
        print("[ERROR] Test split is empty. Run: python ml/prepare_dataset.py")
        sys.exit(1)

    loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
    print(f"Test set: {len(test_ds)} images")

    y_true, y_pred, logits_all = predict(loader, model, device)

    from sklearn.metrics import (  # noqa: E402
        accuracy_score,
        classification_report,
        confusion_matrix,
        precision_recall_fscore_support,
    )

    acc = accuracy_score(y_true, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted")
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(y_true, y_pred, average="macro")
    cm = confusion_matrix(y_true, y_pred).tolist()

    probs = np.exp(np.asarray(logits_all)) / np.exp(np.asarray(logits_all)).sum(axis=1, keepdims=True)
    mean_confidence = float(probs.max(axis=1).mean())

    print(f"\nTest Accuracy : {acc:.4f}")
    print(f"Precision     : weighted {p:.4f} | macro {p_macro:.4f}")
    print(f"Recall        : weighted {r:.4f} | macro {r_macro:.4f}")
    print(f"F1-score      : weighted {f1:.4f} | macro {f1_macro:.4f}")
    print(f"Mean top-1 confidence: {mean_confidence:.4f}")
    print("Confusion matrix (rows=true, cols=predicted):")
    print(np.array2string(np.asarray(cm), prefix="  "))

    CLASSIFICATION_REPORT_TXT.parent.mkdir(parents=True, exist_ok=True)
    report_text = (
        f"Classification Report - evaluation only\n"
        f"Classes: {CNN_CLASS_KEYS}\n"
        f"Test images: {len(test_ds)}\n\n"
        f"Overall accuracy : {acc:.4f}\n"
        f"Weighted precision: {p:.4f}\n"
        f"Weighted recall   : {r:.4f}\n"
        f"Weighted F1       : {f1:.4f}\n"
        f"Macro precision   : {p_macro:.4f}\n"
        f"Macro recall      : {r_macro:.4f}\n"
        f"Macro F1          : {f1_macro:.4f}\n\n"
        + str(classification_report(
            y_true, y_pred,
            labels=list(range(len(CNN_CLASS_KEYS))),
            target_names=CNN_CLASS_KEYS,
            digits=4,
        ))
    )
    CLASSIFICATION_REPORT_TXT.write_text(report_text, encoding="utf-8")
    print(f"[ok] Classification report -> {CLASSIFICATION_REPORT_TXT}")

    metrics = {
        "model_version": _checkpoint_metadata().get("model_version", ""),
        "evaluated_at": datetime.now().isoformat(),
        "device": str(device),
        "classes": CNN_CLASS_KEYS,
        "test_images": len(test_ds),
        "accuracy": round(float(acc), 4),
        "precision_weighted": round(float(p), 4),
        "recall_weighted": round(float(r), 4),
        "f1_weighted": round(float(f1), 4),
        "precision_macro": round(float(p_macro), 4),
        "recall_macro": round(float(r_macro), 4),
        "f1_macro": round(float(f1_macro), 4),
        "mean_top1_confidence": round(mean_confidence, 4),
        "confusion_matrix": cm,
    }
    EVALUATION_METRICS_JSON.parent.mkdir(parents=True, exist_ok=True)
    EVALUATION_METRICS_JSON.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"[ok] Metrics -> {EVALUATION_METRICS_JSON}")


if __name__ == "__main__":
    main()