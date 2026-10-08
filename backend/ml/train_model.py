"""
CNN training pipeline for the AgriFreshNET food freshness dataset.

Trains a REAL MobileNetV2 transfer-learning model on the three genuine dataset
classes (FRESH / SEMI_FRESH / ROTTEN) using the pre-split folders produced by
``ml/prepare_dataset.py``:

    datasets/train/{FRESH,SEMI_FRESH,ROTTEN}   70%
    datasets/val/{FRESH,SEMI_FRESH,ROTTEN}     15%
    datasets/test/{FRESH,SEMI_FRESH,ROTTEN}    15%

Run from the ``backend/`` directory::

    python ml/train_model.py
    python ml/train_model.py --epochs 12 --batch_size 48 --workers 0

Pipeline:
    1. Load split folders (no resampling on the fly).
    2. Build MobileNetV2 (ImageNet pretrained, backbone frozen).
    3. Train with Adam + ReduceLROnPlateau + early stopping + best-checkpoint.
    4. Evaluate ONLY on the held-out test split.
    5. Save the best model, training history, metrics, classification report
       and confusion matrix.

All metrics are real and measured by this script - nothing is hard-coded.
"""
import argparse
import json
import random
import sys
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ml.config import CNN_CLASS_KEYS, CNN_CLASS_LABELS, DATASET_CLASS_NAMES  # noqa: E402
from app.ml.config import IMAGE_SIZE, FREEZE_BACKBONE  # noqa: E402
from app.ml.models.cnn_model import build_model, save_checkpoint  # noqa: E402
from app.ml.preprocessing import IMAGENET_MEAN, IMAGENET_STD  # noqa: E402
from ml.config import (  # noqa: E402
    AUGMENTATION_SUMMARY,
    BATCH_SIZE,
    CLASSIFICATION_REPORT_TXT,
    CONFUSION_MATRIX_PNG,
    EARLY_STOPPING_PATIENCE,
    EPOCHS,
    HISTORY_JSON,
    INITIAL_LR,
    LR_REDUCE_FACTOR,
    LR_REDUCE_PATIENCE,
    MAX_IMAGES_PER_CLASS,
    METRICS_JSON,
    MODEL_PATH,
    MODEL_VERSION,
    NUM_WORKERS,
    SEED,
    TEST_DIR,
    TRAIN_DIR,
    VAL_DIR,
    WEIGHT_DECAY,
)

_ = (CNN_CLASS_LABELS, DATASET_CLASS_NAMES, IMAGE_SIZE, FREEZE_BACKBONE, NUM_WORKERS)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


# ---------------------------------------------------------------------------
# Data pipeline
# ---------------------------------------------------------------------------
# NOTE: transforms must stay consistent with app.ml.preprocessing so that an
# uploaded image goes through the exact same pipeline training used.
_TRAIN_TRANSFORMS = transforms.Compose([
    transforms.ToPILImage(),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15),
    transforms.RandomAffine(degrees=0, translate=(0.06, 0.06), scale=(0.95, 1.05)),
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN.tolist(), std=IMAGENET_STD.tolist()),
])

_EVAL_TRANSFORMS = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN.tolist(), std=IMAGENET_STD.tolist()),
])


class FoodFreshnessDataset(Dataset):
    """Reads the pre-split class folders. No on-the-fly resampling or leakage."""

    def __init__(self, root: Path, transform=None, class_names: list[str] | None = None,
                 max_images_per_class: int | None = None):
        self.root = Path(root)
        self.transform = transform
        self.classes = class_names or DATASET_CLASS_NAMES
        self.class_to_idx = {cls: i for i, cls in enumerate(self.classes)}
        self.samples: list[tuple[Path, int]] = []

        for cls in self.classes:
            folder = self.root / cls
            if not folder.exists():
                continue
            images = [p for p in sorted(folder.iterdir())
                      if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".bmp")]
            if max_images_per_class is not None:
                images = images[:max_images_per_class]
            for img_path in images:
                self.samples.append((img_path, self.class_to_idx[cls]))
        self.samples.sort(key=lambda x: str(x[0]))

        print(f"  {self.root.parent.name}/{self.root.name} -> {len(self.samples)} images")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        path, label = self.samples[idx]
        img = cv2.imread(str(path))
        if img is None:
            img = np.full((IMAGE_SIZE, IMAGE_SIZE, 3), 127, dtype=np.uint8)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMAGE_SIZE, IMAGE_SIZE))
        if self.transform:
            img = self.transform(img)
        else:
            t = _EVAL_TRANSFORMS(transforms.ToPILImage()(img))
            img = t
        return img, label


class EarlyStopping:
    """Patience-based early stopping on validation accuracy."""

    def __init__(self, patience: int, min_delta: float = 1e-4):
        self.patience = patience
        self.min_delta = min_delta
        self.best = -1.0
        self.counter = 0

    def step(self, val_acc: float) -> bool:
        if val_acc > self.best + self.min_delta:
            self.best = val_acc
            self.counter = 0
            return False
        self.counter += 1
        return self.counter >= self.patience


# ---------------------------------------------------------------------------
# Evaluation (test split only)
# ---------------------------------------------------------------------------
def evaluate(model: nn.Module, loader: DataLoader, device: str) -> tuple[list[int], list[int]]:
    model.eval()
    y_true: list[int] = []
    y_pred: list[int] = []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            logits = model(images)
            preds = logits.argmax(dim=1).cpu().tolist()
            y_pred.extend(preds)
            y_true.extend(labels.tolist())
    return y_true, y_pred


def _classification_report_text(y_true, y_pred) -> str:
    from sklearn.metrics import accuracy_score, classification_report, precision_recall_fscore_support

    report = classification_report(
        y_true, y_pred,
        labels=list(range(len(CNN_CLASS_KEYS))),
        target_names=CNN_CLASS_KEYS,
        digits=4,
        output_dict=False,
    )
    acc = accuracy_score(y_true, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted")
    header = (
        f"Classification Report - {MODEL_VERSION}\n"
        f"Evaluated on the held-out TEST split only.\n"
        f"Classes: {CNN_CLASS_KEYS}\n\n"
        f"Overall accuracy : {acc:.4f}\n"
        f"Weighted precision: {p:.4f}\n"
        f"Weighted recall   : {r:.4f}\n"
        f"Weighted F1       : {f1:.4f}\n\n"
    )
    return header + str(report)


def save_confusion_matrix(y_true, y_pred) -> None:
    from sklearn.metrics import ConfusionMatrixDisplay, confusion_matrix

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(CNN_CLASS_KEYS))))
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=CNN_CLASS_KEYS)
    disp.plot(ax=ax, cmap="Blues", colorbar=True, text_kw={"fontsize": 9})
    ax.set_title(f"Food Freshness CNN - Confusion Matrix ({MODEL_VERSION})")
    fig.tight_layout()
    CONFUSION_MATRIX_PNG.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(CONFUSION_MATRIX_PNG, dpi=140)
    plt.close(fig)
    print(f"[ok] Confusion matrix -> {CONFUSION_MATRIX_PNG}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the food freshness CNN.")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--batch_size", type=int, default=BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=INITIAL_LR)
    parser.add_argument("--workers", type=int, default=NUM_WORKERS)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--max_images_per_class", type=int, default=MAX_IMAGES_PER_CLASS,
                        help="Cap images per class (useful for smoke runs).")
    args = parser.parse_args()

    set_seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    print(f"Epochs: {args.epochs} | Batch size: {args.batch_size} | LR: {args.lr} | Workers: {args.workers}")
    print(f"Augmentation: {AUGMENTATION_SUMMARY}")

    train_ds = FoodFreshnessDataset(TRAIN_DIR, transform=_TRAIN_TRANSFORMS,
                                    max_images_per_class=args.max_images_per_class)
    val_ds = FoodFreshnessDataset(VAL_DIR, transform=_EVAL_TRANSFORMS,
                                  max_images_per_class=args.max_images_per_class)
    test_ds = FoodFreshnessDataset(TEST_DIR, transform=_EVAL_TRANSFORMS,
                                   max_images_per_class=args.max_images_per_class)

    if len(train_ds) == 0 or len(val_ds) == 0 or len(test_ds) == 0:
        print("[ERROR] One of the split folders is empty. Run: python ml/prepare_dataset.py")
        sys.exit(1)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.workers, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)

    print(f"\nTraining set: {len(train_ds)} | Validation set: {len(val_ds)} | Test set: {len(test_ds)}")

    model = build_model(num_classes=len(CNN_CLASS_KEYS)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=LR_REDUCE_FACTOR,
                                                     patience=LR_REDUCE_PATIENCE)
    early = EarlyStopping(patience=EARLY_STOPPING_PATIENCE)

    history: dict[str, list[float]] = {
        "epoch": [], "train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [],
    }
    best_val_acc = 0.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            correct += (outputs.argmax(dim=1) == labels).sum().item()
            total += labels.size(0)

        train_loss = running_loss / max(total, 1)
        train_acc = correct / max(total, 1)

        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                val_correct += (outputs.argmax(dim=1) == labels).sum().item()
                val_total += labels.size(0)

        val_loss = val_loss / max(val_total, 1)
        val_acc = val_correct / max(val_total, 1)
        scheduler.step(val_loss)
        current_lr = optimizer.param_groups[0]["lr"]

        history["epoch"].append(epoch)
        history["train_loss"].append(round(train_loss, 4))
        history["train_acc"].append(round(train_acc, 4))
        history["val_loss"].append(round(val_loss, 4))
        history["val_acc"].append(round(val_acc, 4))

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            save_checkpoint(model, extra={"best_val_acc": round(val_acc, 4), "epoch": epoch})
            marker = " <-- best model saved"
        else:
            marker = ""
        print(f"Epoch {epoch:2}/{args.epochs} | train_loss {train_loss:.4f} | train_acc {train_acc:.4f} "
              f"| val_loss {val_loss:.4f} | val_acc {val_acc:.4f} | lr {current_lr:.5f}{marker}")

        if early.step(val_acc):
            print(f"Early stopping triggered after epoch {epoch}.")
            break

    print("\n=== Test evaluation (held-out test split only) ===")
    # Reload the best checkpoint for a fair final evaluation.
    from app.ml.models.cnn_model import load_pytorch_model

    best_model = load_pytorch_model(MODEL_PATH)
    if best_model is None:
        print("[ERROR] Best checkpoint could not be reloaded. Using last model.")
        best_model = model
    best_model = best_model.to(device)

    y_true, y_pred = evaluate(best_model, test_loader, device)

    from sklearn.metrics import (  # noqa: E402
        accuracy_score,
        precision_recall_fscore_support,
        classification_report,
        confusion_matrix,
    )

    acc = accuracy_score(y_true, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted")
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(y_true, y_pred, average="macro")
    cm = confusion_matrix(y_true, y_pred).tolist()

    print(f"Test Accuracy : {acc:.4f}")
    print(f"Precision     : weighted {p:.4f} | macro {p_macro:.4f}")
    print(f"Recall        : weighted {r:.4f} | macro {r_macro:.4f}")
    print(f"F1-score      : weighted {f1:.4f} | macro {f1_macro:.4f}")
    print("Confusion matrix (rows=true, cols=predicted):")
    print(np.array2string(np.asarray(cm), prefix="  "))

    # Artifacts
    CLASSIFICATION_REPORT_TXT.parent.mkdir(parents=True, exist_ok=True)
    report_txt = _classification_report_text(y_true, y_pred)
    CLASSIFICATION_REPORT_TXT.write_text(report_txt, encoding="utf-8")
    print(f"[ok] Classification report -> {CLASSIFICATION_REPORT_TXT}")

    train_accuracy_history = history["train_acc"]
    val_accuracy_history = history["val_acc"]
    train_loss_history = history["train_loss"]
    val_loss_history = history["val_loss"]
    epochs_run = history["epoch"]
    final_epoch = epochs_run[-1] if epochs_run else 0

    metrics = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now().isoformat(),
        "device": str(device),
        "num_classes": len(CNN_CLASS_KEYS),
        "classes": CNN_CLASS_KEYS,
        "dataset": {
            "train": len(train_ds), "val": len(val_ds), "test": len(test_ds),
        },
        "training": {
            "epochs_planned": args.epochs,
            "epochs_run": final_epoch,
            "final_lr": scheduler.optimizer.param_groups[0]["lr"],
            "best_val_accuracy": best_val_acc,
            "final_train_accuracy": train_accuracy_history[-1] if train_accuracy_history else None,
            "final_val_accuracy": val_accuracy_history[-1] if val_accuracy_history else None,
            "early_stopping_patience": EARLY_STOPPING_PATIENCE,
        },
        "test_evaluation": {
            "accuracy": round(float(acc), 4),
            "precision_weighted": round(float(p), 4),
            "recall_weighted": round(float(r), 4),
            "f1_weighted": round(float(f1), 4),
            "precision_macro": round(float(p_macro), 4),
            "recall_macro": round(float(r_macro), 4),
            "f1_macro": round(float(f1_macro), 4),
            "confusion_matrix": cm,
            "test_samples": len(test_ds),
        },
        "model_path": str(MODEL_PATH),
    }
    METRICS_JSON.parent.mkdir(parents=True, exist_ok=True)
    METRICS_JSON.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"[ok] Metrics -> {METRICS_JSON}")

    HISTORY_JSON.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_JSON.write_text(json.dumps({"model_version": MODEL_VERSION, "history": history}, indent=2),
                            encoding="utf-8")
    print(f"[ok] Training history -> {HISTORY_JSON}")

    save_confusion_matrix(y_true, y_pred)
    print(f"[ok] Trained model -> {MODEL_PATH}")


if __name__ == "__main__":
    main()