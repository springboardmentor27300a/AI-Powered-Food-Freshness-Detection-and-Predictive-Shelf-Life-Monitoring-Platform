import tensorflow as tf
from tensorflow.keras import layers, models
from pathlib import Path

# =========================================================
# SETTINGS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

DATASET_DIR = BASE_DIR / "dataset"
MODEL_PATH = BASE_DIR / "freshness_model.keras"

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 16
EPOCHS = 15
SEED = 123

# =========================================================
# CHECK DATASET
# =========================================================

fresh_dir = DATASET_DIR / "fresh"
spoiled_dir = DATASET_DIR / "spoiled"

if not fresh_dir.exists() or not spoiled_dir.exists():
    raise FileNotFoundError(
        "Dataset folders not found. Make sure dataset/fresh and "
        "dataset/spoiled exist."
    )

fresh_count = len([
    f for f in fresh_dir.iterdir()
    if f.is_file()
])

spoiled_count = len([
    f for f in spoiled_dir.iterdir()
    if f.is_file()
])

print("----------------------------------------")
print("FreshSense AI - Model Training")
print("----------------------------------------")
print("Fresh images:", fresh_count)
print("Spoiled images:", spoiled_count)
print("Total images:", fresh_count + spoiled_count)

if fresh_count == 0 or spoiled_count == 0:
    raise ValueError(
        "Both fresh and spoiled folders must contain images."
    )

# =========================================================
# LOAD DATASET
# =========================================================

train_dataset = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.2,
    subset="training",
    seed=SEED,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
    class_names=["fresh", "spoiled"]
)

validation_dataset = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.2,
    subset="validation",
    seed=SEED,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
    class_names=["fresh", "spoiled"]
)

print("Class names:", train_dataset.class_names)

# =========================================================
# PERFORMANCE
# =========================================================

AUTOTUNE = tf.data.AUTOTUNE

train_dataset = train_dataset.prefetch(
    AUTOTUNE
)

validation_dataset = validation_dataset.prefetch(
    AUTOTUNE
)

# =========================================================
# DATA AUGMENTATION
# =========================================================

data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.15),
    layers.RandomContrast(0.15),
])

# =========================================================
# BASE MODEL
# =========================================================

base_model = tf.keras.applications.MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights="imagenet"
)

# Freeze pretrained layers
base_model.trainable = False

# =========================================================
# BUILD MODEL
# =========================================================

inputs = layers.Input(
    shape=(224, 224, 3)
)

x = data_augmentation(inputs)

x = tf.keras.applications.mobilenet_v2.preprocess_input(x)

x = base_model(
    x,
    training=False
)

x = layers.GlobalAveragePooling2D()(x)

x = layers.Dropout(0.35)(x)

x = layers.Dense(
    64,
    activation="relu"
)(x)

x = layers.Dropout(0.25)(x)

outputs = layers.Dense(
    1,
    activation="sigmoid"
)(x)

model = models.Model(
    inputs,
    outputs
)

# =========================================================
# COMPILE
# =========================================================

model.compile(
    optimizer=tf.keras.optimizers.Adam(
        learning_rate=0.0001
    ),
    loss="binary_crossentropy",
    metrics=["accuracy"]
)

model.summary()

# =========================================================
# TRAIN
# =========================================================

print("----------------------------------------")
print("Starting training...")
print("----------------------------------------")

history = model.fit(
    train_dataset,
    validation_data=validation_dataset,
    epochs=EPOCHS
)

# =========================================================
# SAVE MODEL
# =========================================================

model.save(MODEL_PATH)

print("----------------------------------------")
print("Training completed!")
print("----------------------------------------")

print(
    "Final training accuracy:",
    round(
        history.history["accuracy"][-1] * 100,
        2
    ),
    "%"
)

print(
    "Final validation accuracy:",
    round(
        history.history["val_accuracy"][-1] * 100,
        2
    ),
    "%"
)

print(
    "Model saved to:",
    MODEL_PATH
)

print("----------------------------------------")