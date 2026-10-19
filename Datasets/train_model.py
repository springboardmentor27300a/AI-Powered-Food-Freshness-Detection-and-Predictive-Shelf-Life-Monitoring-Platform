import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from pathlib import Path

# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATASET_DIR = BASE_DIR / "processed"

TRAIN_DIR = DATASET_DIR / "train"
VAL_DIR = DATASET_DIR / "val"

MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODEL_DIR / "food_freshness_model.keras"


# ============================================================
# SETTINGS
# ============================================================

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 10


# ============================================================
# LOAD TRAINING DATA
# ============================================================

print("\nLoading training dataset...")

train_dataset = tf.keras.utils.image_dataset_from_directory(
    TRAIN_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="categorical",
    shuffle=True,
    seed=42
)


# ============================================================
# LOAD VALIDATION DATA
# ============================================================

print("\nLoading validation dataset...")

val_dataset = tf.keras.utils.image_dataset_from_directory(
    VAL_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="categorical",
    shuffle=False
)


# ============================================================
# CLASS NAMES
# ============================================================

class_names = train_dataset.class_names

print("\nClasses detected:")

for index, name in enumerate(class_names):
    print(f"{index}: {name}")


# ============================================================
# PERFORMANCE OPTIMIZATION
# ============================================================

AUTOTUNE = tf.data.AUTOTUNE

train_dataset = train_dataset.prefetch(
    buffer_size=AUTOTUNE
)

val_dataset = val_dataset.prefetch(
    buffer_size=AUTOTUNE
)


# ============================================================
# DATA AUGMENTATION
# ============================================================

data_augmentation = keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.1),
    layers.RandomZoom(0.1),
])


# ============================================================
# BASE MODEL
# ============================================================

print("\nLoading MobileNetV2...")

base_model = keras.applications.MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights="imagenet"
)

# Freeze pretrained layers
base_model.trainable = False


# ============================================================
# BUILD MODEL
# ============================================================

inputs = keras.Input(
    shape=(224, 224, 3)
)

x = data_augmentation(inputs)

x = keras.applications.mobilenet_v2.preprocess_input(x)

x = base_model(
    x,
    training=False
)

x = layers.GlobalAveragePooling2D()(x)

x = layers.Dropout(0.3)(x)

outputs = layers.Dense(
    len(class_names),
    activation="softmax"
)(x)

model = keras.Model(
    inputs,
    outputs
)


# ============================================================
# COMPILE MODEL
# ============================================================

model.compile(
    optimizer=keras.optimizers.Adam(
        learning_rate=0.0001
    ),
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)


print("\nModel created successfully.")

model.summary()


# ============================================================
# TRAIN MODEL
# ============================================================

print("\n===================================")
print("STARTING MODEL TRAINING")
print("===================================\n")

# ============================================================
# CHECKPOINT
# ============================================================

checkpoint_path = MODEL_DIR / "checkpoint_epoch_{epoch:02d}.keras"

checkpoint = keras.callbacks.ModelCheckpoint(
    filepath=checkpoint_path,
    save_weights_only=False,
    save_freq="epoch",
    verbose=1
)


# ============================================================
# TRAIN MODEL
# ============================================================

print("\n===================================")
print("STARTING MODEL TRAINING")
print("===================================\n")

history = model.fit(
    train_dataset,
    validation_data=val_dataset,
    epochs=EPOCHS,
    callbacks=[checkpoint]
)


# ============================================================
# SAVE MODEL
# ============================================================

print("\nSaving model...")

model.save(MODEL_PATH)


# ============================================================
# SAVE CLASS NAMES
# ============================================================

class_names_path = MODEL_DIR / "class_names.txt"

with open(class_names_path, "w") as file:

    for name in class_names:
        file.write(name + "\n")


# ============================================================
# COMPLETION
# ============================================================

print("\n===================================")
print("MODEL TRAINING COMPLETED")
print("===================================")

print("\nModel saved to:")
print(MODEL_PATH)

print("\nClass names saved to:")
print(class_names_path)

print("\nClasses:")
print(class_names)