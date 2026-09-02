# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# ML MODEL TRAINING
# ============================================================

from pathlib import Path
import json

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


# ============================================================
# CONFIGURATION
# ============================================================

# backend/
BACKEND_DIR = Path(__file__).resolve().parent

# Project root/
PROJECT_DIR = BACKEND_DIR.parent

# dataset/
DATASET_DIR = PROJECT_DIR / "dataset"

# Model output directory
MODEL_DIR = BACKEND_DIR / "models"

MODEL_PATH = MODEL_DIR / "food_freshness_model.keras"

CLASS_NAMES_PATH = MODEL_DIR / "class_names.json"


# ============================================================
# TRAINING SETTINGS
# ============================================================

IMAGE_SIZE = (224, 224)

BATCH_SIZE = 32

EPOCHS = 10

SEED = 42


# ============================================================
# PRINT ENVIRONMENT
# ============================================================

print("=" * 60)
print("FOOD FRESHNESS MODEL TRAINING")
print("=" * 60)

print()

print("TensorFlow version:")
print(tf.__version__)

print()

print("Dataset:")
print(DATASET_DIR)

print()

print("Model output:")
print(MODEL_PATH)

print()


# ============================================================
# CHECK DATASET
# ============================================================

TRAIN_DIR = DATASET_DIR / "train"

VALIDATION_DIR = DATASET_DIR / "validation"

TEST_DIR = DATASET_DIR / "test"


if not TRAIN_DIR.exists():

    print("❌ ERROR: Training dataset not found.")

    print()
    print("Expected:")
    print(TRAIN_DIR)

    raise SystemExit(1)


if not VALIDATION_DIR.exists():

    print("❌ ERROR: Validation dataset not found.")

    print()
    print("Expected:")
    print(VALIDATION_DIR)

    raise SystemExit(1)


if not TEST_DIR.exists():

    print("❌ ERROR: Test dataset not found.")

    print()
    print("Expected:")
    print(TEST_DIR)

    raise SystemExit(1)


# ============================================================
# LOAD TRAINING DATA
# ============================================================

print("Loading training dataset...")

train_dataset = keras.utils.image_dataset_from_directory(

    TRAIN_DIR,

    labels="inferred",

    label_mode="categorical",

    image_size=IMAGE_SIZE,

    batch_size=BATCH_SIZE,

    shuffle=True,

    seed=SEED,
)


# ============================================================
# LOAD VALIDATION DATA
# ============================================================

print("Loading validation dataset...")

validation_dataset = keras.utils.image_dataset_from_directory(

    VALIDATION_DIR,

    labels="inferred",

    label_mode="categorical",

    image_size=IMAGE_SIZE,

    batch_size=BATCH_SIZE,

    shuffle=False,
)


# ============================================================
# LOAD TEST DATA
# ============================================================

print("Loading test dataset...")

test_dataset = keras.utils.image_dataset_from_directory(

    TEST_DIR,

    labels="inferred",

    label_mode="categorical",

    image_size=IMAGE_SIZE,

    batch_size=BATCH_SIZE,

    shuffle=False,
)


# ============================================================
# CLASS NAMES
# ============================================================

class_names = train_dataset.class_names

print()

print("Detected classes:")

for index, class_name in enumerate(class_names):

    print(
        f"{index}: {class_name}"
    )

print()


# ============================================================
# SAVE CLASS NAMES
# ============================================================

MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


with open(
    CLASS_NAMES_PATH,
    "w",
    encoding="utf-8",
) as file:

    json.dump(
        class_names,
        file,
        indent=4,
    )


print(
    "Class names saved:"
)

print(
    CLASS_NAMES_PATH
)

print()


# ============================================================
# PERFORMANCE OPTIMIZATION
# ============================================================

AUTOTUNE = tf.data.AUTOTUNE


train_dataset = train_dataset.prefetch(
    buffer_size=AUTOTUNE
)


validation_dataset = validation_dataset.prefetch(
    buffer_size=AUTOTUNE
)


test_dataset = test_dataset.prefetch(
    buffer_size=AUTOTUNE
)


# ============================================================
# DATA AUGMENTATION
# ============================================================

data_augmentation = keras.Sequential(

    [

        layers.RandomFlip(
            "horizontal"
        ),

        layers.RandomRotation(
            0.08
        ),

        layers.RandomZoom(
            0.10
        ),

    ],

    name="data_augmentation",
)


# ============================================================
# LOAD PRETRAINED MOBILENETV2
# ============================================================

print(
    "Loading MobileNetV2..."
)

base_model = keras.applications.MobileNetV2(

    input_shape=(
        IMAGE_SIZE[0],
        IMAGE_SIZE[1],
        3,
    ),

    include_top=False,

    weights="imagenet",
)


# ============================================================
# FREEZE PRETRAINED MODEL
# ============================================================

base_model.trainable = False


# ============================================================
# BUILD MODEL
# ============================================================

inputs = keras.Input(

    shape=(
        IMAGE_SIZE[0],
        IMAGE_SIZE[1],
        3,
    )
)


# Data augmentation
x = data_augmentation(inputs)


# MobileNetV2 preprocessing
x = keras.applications.mobilenet_v2.preprocess_input(
    x
)


# Feature extraction
x = base_model(
    x,
    training=False,
)


# Global pooling
x = layers.GlobalAveragePooling2D()(x)


# Dropout
x = layers.Dropout(
    0.30
)(x)


# Classification layer
outputs = layers.Dense(

    len(class_names),

    activation="softmax",

    name="freshness_prediction",
)(x)


model = keras.Model(
    inputs,
    outputs,
)


# ============================================================
# COMPILE MODEL
# ============================================================

model.compile(

    optimizer=keras.optimizers.Adam(
        learning_rate=0.0001
    ),

    loss="categorical_crossentropy",

    metrics=[
        "accuracy"
    ],
)


# ============================================================
# MODEL SUMMARY
# ============================================================

print()

print("=" * 60)

print("MODEL SUMMARY")

print("=" * 60)

print()

model.summary()

print()


# ============================================================
# CALLBACKS
# ============================================================

checkpoint_callback = keras.callbacks.ModelCheckpoint(

    filepath=MODEL_PATH,

    monitor="val_accuracy",

    save_best_only=True,

    mode="max",

    verbose=1,
)


early_stopping_callback = keras.callbacks.EarlyStopping(

    monitor="val_loss",

    patience=3,

    restore_best_weights=True,

    verbose=1,
)


reduce_lr_callback = keras.callbacks.ReduceLROnPlateau(

    monitor="val_loss",

    factor=0.5,

    patience=2,

    min_lr=0.000001,

    verbose=1,
)


# ============================================================
# TRAIN MODEL
# ============================================================

print("=" * 60)

print("STARTING TRAINING")

print("=" * 60)

print()

print(
    f"Epochs: {EPOCHS}"
)

print(
    f"Batch size: {BATCH_SIZE}"
)

print(
    f"Image size: {IMAGE_SIZE}"
)

print()

print(
    "Training on available device..."
)

print()


history = model.fit(

    train_dataset,

    validation_data=validation_dataset,

    epochs=EPOCHS,

    callbacks=[

        checkpoint_callback,

        early_stopping_callback,

        reduce_lr_callback,

    ],
)


# ============================================================
# EVALUATE ON TEST DATA
# ============================================================

print()

print("=" * 60)

print("EVALUATING MODEL ON TEST DATA")

print("=" * 60)

print()


test_loss, test_accuracy = model.evaluate(

    test_dataset,

    verbose=1,
)


print()

print(
    f"Test Loss     : {test_loss:.4f}"
)

print(
    f"Test Accuracy  : {test_accuracy * 100:.2f}%"
)

print()


# ============================================================
# SAVE FINAL MODEL
# ============================================================

model.save(
    MODEL_PATH
)


# ============================================================
# TRAINING COMPLETE
# ============================================================

print("=" * 60)

print("MODEL TRAINING COMPLETE")

print("=" * 60)

print()

print(
    "Model saved at:"
)

print(
    MODEL_PATH
)

print()

print(
    "Class names saved at:"
)

print(
    CLASS_NAMES_PATH
)

print()

print(
    f"Final test accuracy: "
    f"{test_accuracy * 100:.2f}%"
)

print()

print("=" * 60)