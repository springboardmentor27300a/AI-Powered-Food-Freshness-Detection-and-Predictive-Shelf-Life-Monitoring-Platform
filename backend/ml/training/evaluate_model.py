"""
ml/training/evaluate_model.py

Evaluates the trained model on the TEST split (never seen during training
or validation) and reports real accuracy/precision/recall/F1/confusion
matrix. Run after train_cnn.py:

    python ml/training/evaluate_model.py

Writes ml/models/evaluation_report.json and ml/models/confusion_matrix.png.
These are the actual numbers to quote in your project report/demo — do not
substitute made-up figures.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                              precision_score, recall_score)
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

ML_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ML_ROOT / "data" / "processed"
MODELS_DIR = ML_ROOT / "models"
IMG_SIZE = (224, 224)
BATCH_SIZE = 32


def main():
    model_path = MODELS_DIR / "freshness_model.keras"
    if not model_path.exists():
        raise FileNotFoundError(f"{model_path} not found. Run train_cnn.py first.")

    with open(MODELS_DIR / "class_indices.json") as f:
        class_indices = json.load(f)  # e.g. {"fresh": 0, "rotten": 1}
    idx_to_class = {v: k for k, v in class_indices.items()}

    test_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR / "test", image_size=IMG_SIZE, batch_size=BATCH_SIZE,
        label_mode="binary", shuffle=False,
    )
    test_ds_prepped = test_ds.map(lambda x, y: (preprocess_input(x), y))

    model = tf.keras.models.load_model(model_path)

    y_true = np.concatenate([y.numpy() for _, y in test_ds], axis=0).flatten().astype(int)
    y_prob = model.predict(test_ds_prepped).flatten()
    y_pred = (y_prob >= 0.5).astype(int)

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)

    print(f"Test set size: {len(y_true)}")
    print(f"Accuracy:  {acc:.4f}")
    print(f"Precision: {prec:.4f}  (positive class = '{idx_to_class[1]}')")
    print(f"Recall:    {rec:.4f}")
    print(f"F1-score:  {f1:.4f}")
    print(f"Confusion matrix (rows=true, cols=pred), order {idx_to_class}:\n{cm}")

    report = {
        "test_set_size": int(len(y_true)),
        "accuracy": float(acc),
        "precision": float(prec),
        "recall": float(rec),
        "f1_score": float(f1),
        "confusion_matrix": cm.tolist(),
        "class_order": [idx_to_class[0], idx_to_class[1]],
    }
    with open(MODELS_DIR / "evaluation_report.json", "w") as f:
        json.dump(report, f, indent=2)

    fig, ax = plt.subplots(figsize=(4.5, 4))
    im = ax.imshow(cm, cmap="Greens")
    ax.set_xticks([0, 1]); ax.set_xticklabels([idx_to_class[0], idx_to_class[1]])
    ax.set_yticks([0, 1]); ax.set_yticklabels([idx_to_class[0], idx_to_class[1]])
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center")
    fig.colorbar(im)
    fig.tight_layout()
    fig.savefig(MODELS_DIR / "confusion_matrix.png")

    print(f"\nWrote {MODELS_DIR / 'evaluation_report.json'} and confusion_matrix.png")


if __name__ == "__main__":
    main()
