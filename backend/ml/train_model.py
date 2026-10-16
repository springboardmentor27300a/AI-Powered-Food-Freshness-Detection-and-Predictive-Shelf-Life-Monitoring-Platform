import tensorflow as tf
from tensorflow.keras.utils import image_dataset_from_directory
from pathlib import Path

# ---------------------------------
# PATHS AND SETTINGS
# ---------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "combined_dataset"

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 15


# ---------------------------------
# LOAD DATASET
# ---------------------------------

train_dataset = image_dataset_from_directory(
    DATASET_PATH,
    validation_split=0.20,
    subset="training",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

validation_dataset = image_dataset_from_directory(
    DATASET_PATH,
    validation_split=0.20,
    subset="validation",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

print("Classes:", train_dataset.class_names)


# ---------------------------------
# PERFORMANCE OPTIMIZATION
# ---------------------------------

AUTOTUNE = tf.data.AUTOTUNE

train_dataset = train_dataset.prefetch(
    buffer_size=AUTOTUNE
)

validation_dataset = validation_dataset.prefetch(
    buffer_size=AUTOTUNE
)

print("Data preprocessing completed.")


# ---------------------------------
# DATA AUGMENTATION
# ---------------------------------

data_augmentation = tf.keras.Sequential([
    tf.keras.layers.RandomFlip("horizontal"),
    tf.keras.layers.RandomRotation(0.10),
    tf.keras.layers.RandomZoom(0.10)
])


# ---------------------------------
# IMPROVED CNN MODEL
# ---------------------------------

model = tf.keras.Sequential([

    tf.keras.layers.Input(shape=(224, 224, 3)),

    data_augmentation,

    tf.keras.layers.Rescaling(1.0 / 255),

    tf.keras.layers.Conv2D(32, (3, 3), activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2, 2),

    tf.keras.layers.Conv2D(64, (3, 3), activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2, 2),

    tf.keras.layers.Conv2D(128, (3, 3), activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2, 2),

    tf.keras.layers.Conv2D(256, (3, 3), activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D(2, 2),

    tf.keras.layers.GlobalAveragePooling2D(),

    tf.keras.layers.Dense(128, activation="relu"),
    tf.keras.layers.Dropout(0.5),

    tf.keras.layers.Dense(1, activation="sigmoid")
])


# ---------------------------------
# COMPILE MODEL
# ---------------------------------

model.compile(
    optimizer="adam",
    loss="binary_crossentropy",
    metrics=["accuracy"]
)

model.summary()


# ---------------------------------
# EARLY STOPPING
# ---------------------------------

early_stopping = tf.keras.callbacks.EarlyStopping(
    monitor="val_loss",
    patience=3,
    restore_best_weights=True
)


# ---------------------------------
# TRAIN MODEL
# ---------------------------------

history = model.fit(
    train_dataset,
    validation_data=validation_dataset,
    epochs=EPOCHS,
    callbacks=[early_stopping]
)


# ---------------------------------
# FINAL EVALUATION
# ---------------------------------

validation_loss, validation_accuracy = model.evaluate(
    validation_dataset
)

print("\nFinal Validation Accuracy:",
      round(validation_accuracy * 100, 2), "%")

print("Final Validation Loss:",
      round(validation_loss, 4))


# ---------------------------------
# SAVE MODEL
# ---------------------------------

MODEL_PATH = BASE_DIR / "freshness_model.keras"

model.save(MODEL_PATH)

print("\nModel saved successfully at:")
print(MODEL_PATH)