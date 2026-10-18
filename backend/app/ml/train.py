"""
train.py — FreshGuard M2 Training Pipeline
CLI training script for the freshness classification model.

Usage:
    python -m app.ml.train --data_dir dataset/ [options]

Options:
    --data_dir      Path to dataset root (required)
    --epochs        Total training epochs (default: 20)
    --epochs_head   Epochs to train head only before unfreezing (default: 5)
    --batch_size    Batch size (default: 32)
    --lr            Learning rate (default: 1e-3)
    --lr_fine       Learning rate after unfreezing (default: 1e-4)
    --num_workers   DataLoader workers (default: 0)
    --save_path     Output directory for model + metrics (default: app/ml/saved_models)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Allow running as: python -m app.ml.train from the backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))


def parse_args():
    p = argparse.ArgumentParser(description="FreshGuard M2 — Train freshness classifier")
    p.add_argument("--data_dir", required=True, help="Dataset root directory")
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--epochs_head", type=int, default=5,
                   help="Epochs to train head only before unfreezing backbone")
    p.add_argument("--batch_size", type=int, default=32)
    p.add_argument("--lr", type=float, default=1e-3, help="Initial head learning rate")
    p.add_argument("--lr_fine", type=float, default=1e-4, help="Fine-tune learning rate")
    p.add_argument("--num_workers", type=int, default=0)
    p.add_argument("--save_path", type=str, default=None)
    return p.parse_args()


def train_epoch(model, loader, criterion, optimizer, device):
    """Run one training epoch. Returns avg loss and accuracy."""
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += images.size(0)
    return total_loss / total, correct / total


def eval_epoch(model, loader, criterion, device):
    """Run evaluation pass. Returns avg loss and accuracy."""
    import torch
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            total_loss += loss.item() * images.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += images.size(0)
    return total_loss / total, correct / total


def compute_metrics(model, loader, class_to_idx, device):
    """
    Compute per-class Precision, Recall, F1 and overall Accuracy on a dataset.
    Returns a metrics dict with ACTUAL computed values (no hardcoding).
    """
    import torch
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        classification_report
    )

    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            preds = outputs.argmax(dim=1).cpu().tolist()
            all_preds.extend(preds)
            all_labels.extend(labels.tolist())

    idx_to_class = {v: k for k, v in class_to_idx.items()}
    target_names = [idx_to_class[i] for i in range(len(class_to_idx))]

    accuracy = accuracy_score(all_labels, all_preds)
    precision = precision_score(all_labels, all_preds, average="macro", zero_division=0)
    recall = recall_score(all_labels, all_preds, average="macro", zero_division=0)
    f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)

    report = classification_report(
        all_labels, all_preds,
        target_names=target_names,
        zero_division=0,
        output_dict=True
    )

    metrics = {
        "test_accuracy": round(accuracy, 4),
        "test_precision_macro": round(precision, 4),
        "test_recall_macro": round(recall, 4),
        "test_f1_macro": round(f1, 4),
        "per_class_report": {
            cls: {
                "precision": round(v["precision"], 4),
                "recall": round(v["recall"], 4),
                "f1_score": round(v["f1-score"], 4),
                "support": int(v["support"]),
            }
            for cls, v in report.items()
            if cls not in ("accuracy", "macro avg", "weighted avg")
        },
    }
    return metrics, report


def main():
    args = parse_args()

    try:
        import torch
        import torch.nn as nn
    except ImportError:
        print("ERROR: PyTorch not installed. Run: pip install torch torchvision")
        sys.exit(1)

    try:
        from sklearn.metrics import accuracy_score
    except ImportError:
        print("ERROR: scikit-learn not installed. Run: pip install scikit-learn")
        sys.exit(1)

    from app.ml.dataset_utils import discover_classes, summarize_dataset, create_splits, build_dataloaders
    from app.ml.model import build_model, unfreeze_backbone, save_model

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n  Device: {device}")
    if device == "cpu":
        print("  (Training on CPU — this will be slow for large datasets. Consider Google Colab for GPU.)")

    # ── Phase 1: Discover Dataset ─────────────────────────────────────────
    print(f"\n  Loading dataset from: {args.data_dir}")
    class_map = discover_classes(args.data_dir)
    summary = summarize_dataset(class_map)
    train_set, val_set, test_set, class_to_idx = create_splits(class_map)

    if len(test_set) == 0:
        print("  WARNING: Test set is empty. Metrics will be computed on validation set.")
        test_set = val_set

    train_loader, val_loader, test_loader = build_dataloaders(
        train_set, val_set, test_set,
        batch_size=args.batch_size,
        num_workers=args.num_workers
    )

    num_classes = len(class_to_idx)
    print(f"\n  Classes ({num_classes}): {list(class_to_idx.keys())}")

    # ── Phase 2: Build Model ──────────────────────────────────────────────
    print(f"\n  Building MobileNetV2 (num_classes={num_classes}, pretrained=True)...")
    model = build_model(num_classes=num_classes, pretrained=True)
    model.to(device)

    criterion = nn.CrossEntropyLoss()

    # ── Phase 3: Train Head Only ──────────────────────────────────────────
    print(f"\n  [Stage 1] Training classification head ({args.epochs_head} epochs)...")
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr, weight_decay=1e-4
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs_head
    )

    best_val_acc = 0.0
    history = []
    for epoch in range(1, args.epochs_head + 1):
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
        scheduler.step()
        elapsed = time.time() - t0

        history.append({
            "epoch": epoch, "phase": "head",
            "train_loss": round(train_loss, 4), "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4), "val_acc": round(val_acc, 4),
        })
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), Path(__file__).parent / "saved_models" / "_best_ckpt.pt")

        print(f"    Epoch {epoch:02d}/{args.epochs_head} | "
              f"train_loss={train_loss:.4f} acc={train_acc:.4f} | "
              f"val_loss={val_loss:.4f} acc={val_acc:.4f} | {elapsed:.1f}s")

    # ── Phase 4: Fine-tune Backbone ───────────────────────────────────────
    remaining = args.epochs - args.epochs_head
    if remaining > 0:
        print(f"\n  [Stage 2] Fine-tuning backbone ({remaining} epochs, lr={args.lr_fine})...")
        unfreeze_backbone(model, num_layers=4)

        # Load best head-only checkpoint before fine-tuning
        best_ckpt = Path(__file__).parent / "saved_models" / "_best_ckpt.pt"
        if best_ckpt.exists():
            model.load_state_dict(torch.load(best_ckpt, map_location=device, weights_only=True))

        optimizer_ft = torch.optim.AdamW(
            filter(lambda p: p.requires_grad, model.parameters()),
            lr=args.lr_fine, weight_decay=1e-4
        )
        scheduler_ft = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer_ft, T_max=remaining
        )

        for epoch in range(1, remaining + 1):
            t0 = time.time()
            train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer_ft, device)
            val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
            scheduler_ft.step()
            elapsed = time.time() - t0

            history.append({
                "epoch": args.epochs_head + epoch, "phase": "finetune",
                "train_loss": round(train_loss, 4), "train_acc": round(train_acc, 4),
                "val_loss": round(val_loss, 4), "val_acc": round(val_acc, 4),
            })
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                torch.save(model.state_dict(), Path(__file__).parent / "saved_models" / "_best_ckpt.pt")

            print(f"    Epoch {args.epochs_head + epoch:02d}/{args.epochs} | "
                  f"train_loss={train_loss:.4f} acc={train_acc:.4f} | "
                  f"val_loss={val_loss:.4f} acc={val_acc:.4f} | {elapsed:.1f}s")

    # ── Phase 5: Load Best Checkpoint & Evaluate on Test Set ─────────────
    best_ckpt = Path(__file__).parent / "saved_models" / "_best_ckpt.pt"
    if best_ckpt.exists():
        model.load_state_dict(torch.load(best_ckpt, map_location=device, weights_only=True))
        best_ckpt.unlink()  # clean up temporary checkpoint

    print("\n  Computing test-set metrics (actual values)...")
    metrics, report_dict = compute_metrics(model, test_loader, class_to_idx, device)

    print(f"\n  -- Test Set Metrics --------------------------------------")
    print(f"  Accuracy (Overall):   {metrics['test_accuracy']:.4f}")
    print(f"  Precision (Macro):    {metrics['test_precision_macro']:.4f}")
    print(f"  Recall (Macro):       {metrics['test_recall_macro']:.4f}")
    print(f"  F1-Score (Macro):     {metrics['test_f1_macro']:.4f}")
    print(f"  ----------------------------------------------------------")
    for cls, vals in metrics["per_class_report"].items():
        print(f"  {cls:<30} P={vals['precision']:.4f}  R={vals['recall']:.4f}  F1={vals['f1_score']:.4f}  n={vals['support']}")

    metrics["training_history"] = history
    metrics["dataset_summary"] = summary

    # ── Phase 6: Save Model ───────────────────────────────────────────────
    print("\n  Saving model...")
    from app.ml.model import save_model
    save_model(model, class_to_idx, metrics)

    # Also save standalone metrics.json for reporting
    metrics_path = Path(__file__).parent / "saved_models" / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  Metrics saved -> {metrics_path}")
    print("\n  Training complete.")


if __name__ == "__main__":
    main()
