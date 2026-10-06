"""
ml/training/train_cnn.py

Real CNN training via transfer learning on MobileNetV2 (ImageNet weights),
fine-tuned to classify fresh vs. rotten produce.

Run from backend/, venv active, AFTER prepare_dataset.py:
    python ml/training/train_cnn.py

Outputs:
    ml/models/freshness_model.keras     <- the trained model file
    ml/models/training_history.png      <- accuracy/loss curves
    ml/models/class_indices.json        <- Keras' label->index mapping (sanity check
                                            against ml/config/class_names.json)

CPU guidance: MobileNetV2 at 224x224 with a frozen backbone trains in
roughly 1-3 minutes/epoch on a typical laptop CPU with ~12-15k images.
Default below is 10 epochs (head only) + 5 fine-tune epochs. If that's too
slow, drop EPOCHS_HEAD/EPOCHS_FINE_TUNE or BATCH_SIZE below, or set
FINE_TUNE=False to skip the slower fine-tuning stage.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # headless-safe (no GUI needed to save the PNG)
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

ML_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ML_ROOT / "data" / "processed"
MODELS_DIR = ML_ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS_HEAD = 10        # train the new classification head, backbone frozen
EPOCHS_FINE_TUNE = 5    # then unfreeze the last N backbone layers and fine-tune at a low LR
FINE_TUNE = True
FINE_TUNE_LAYERS = 30   # unfreeze this many layers from the end of MobileNetV2
RANDOM_SEED = 42


def build_datasets():
    train_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR / "train", image_size=IMG_SIZE, batch_size=BATCH_SIZE,
        label_mode="binary", seed=RANDOM_SEED, shuffle=True,
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR / "validation", image_size=IMG_SIZE, batch_size=BATCH_SIZE,
        label_mode="binary", seed=RANDOM_SEED, shuffle=False,
    )
    class_names = train_ds.class_names  # alphabetical: ['fresh', 'rotten']
    print(f"Class order (label 0 / label 1): {class_names}")

    with open(MODELS_DIR / "class_indices.json", "w") as f:
        json.dump({name: i for i, name in enumerate(class_names)}, f, indent=2)

    # Data augmentation — applied only to the training pipeline.
    augmentation = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.08),
        layers.RandomZoom(0.1),
        layers.RandomContrast(0.1),
    ])

    def prep_train(x, y):
        x = augmentation(x)
        x = preprocess_input(x)
        return x, y

    def prep_val(x, y):
        return preprocess_input(x), y

    train_ds = train_ds.map(prep_train, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    val_ds = val_ds.map(prep_val, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    return train_ds, val_ds, class_names


def build_model():
    base_model = MobileNetV2(input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet")
    base_model.trainable = False

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(1, activation="sigmoid")(x)  # binary: P(rotten)

    model = models.Model(inputs, outputs)
    return model, base_model


def plot_history(history_head, history_fine, out_path: Path):
    acc = history_head.history["accuracy"] + (history_fine.history["accuracy"] if history_fine else [])
    val_acc = history_head.history["val_accuracy"] + (history_fine.history["val_accuracy"] if history_fine else [])
    loss = history_head.history["loss"] + (history_fine.history["loss"] if history_fine else [])
    val_loss = history_head.history["val_loss"] + (history_fine.history["val_loss"] if history_fine else [])

    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].plot(acc, label="train")
    axes[0].plot(val_acc, label="validation")
    axes[0].axvline(x=len(history_head.history["accuracy"]) - 0.5, color="gray", linestyle="--", linewidth=1)
    axes[0].set_title("Accuracy")
    axes[0].set_xlabel("Epoch")
    axes[0].legend()

    axes[1].plot(loss, label="train")
    axes[1].plot(val_loss, label="validation")
    axes[1].axvline(x=len(history_head.history["loss"]) - 0.5, color="gray", linestyle="--", linewidth=1)
    axes[1].set_title("Loss")
    axes[1].set_xlabel("Epoch")
    axes[1].legend()

    fig.tight_layout()
    fig.savefig(out_path)
    print(f"Saved training curves to {out_path}")


def main():
    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"{DATA_DIR} not found. Run ml/training/prepare_dataset.py first."
        )

    train_ds, val_ds, class_names = build_datasets()
    model, base_model = build_model()

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    print(f"\n=== Stage 1: training classification head ({EPOCHS_HEAD} epochs, backbone frozen) ===")
    history_head = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD)

    history_fine = None
    if FINE_TUNE:
        print(f"\n=== Stage 2: fine-tuning last {FINE_TUNE_LAYERS} backbone layers ({EPOCHS_FINE_TUNE} epochs) ===")
        base_model.trainable = True
        for layer in base_model.layers[:-FINE_TUNE_LAYERS]:
            layer.trainable = False

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),  # much lower LR for fine-tuning
            loss="binary_crossentropy",
            metrics=["accuracy"],
        )
        history_fine = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FINE_TUNE)

    model_path = MODELS_DIR / "freshness_model.keras"
    model.save(model_path)
    print(f"\nSaved trained model to {model_path}")

    plot_history(history_head, history_fine, MODELS_DIR / "training_history.png")

    print("\nNext: python ml/training/evaluate_model.py")


if __name__ == "__main__":
    main()
