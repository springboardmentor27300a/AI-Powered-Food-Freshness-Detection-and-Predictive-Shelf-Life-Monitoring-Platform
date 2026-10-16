import tensorflow as tf
from tensorflow.keras.utils import image_dataset_from_directory
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATASET_PATH = BASE_DIR / "combined_dataset"
MODEL_PATH = BASE_DIR / "freshness_transfer_model.keras"
FINAL_MODEL_PATH = BASE_DIR / "freshness_finetuned_model.keras"

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 5


# Load training dataset
train_dataset = image_dataset_from_directory(
    DATASET_PATH,
    validation_split=0.20,
    subset="training",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

# Load validation dataset
validation_dataset = image_dataset_from_directory(
    DATASET_PATH,
    validation_split=0.20,
    subset="validation",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

AUTOTUNE = tf.data.AUTOTUNE

train_dataset = train_dataset.prefetch(AUTOTUNE)
validation_dataset = validation_dataset.prefetch(AUTOTUNE)


# Load transfer learning model
model = tf.keras.models.load_model(MODEL_PATH)


# Find MobileNetV2 inside the model
base_model = None

for layer in model.layers:
    if isinstance(layer, tf.keras.Model):
        base_model = layer
        break

if base_model is None:
    raise ValueError("MobileNetV2 base model not found")


print("Base model found:", base_model.name)


# Unfreeze MobileNetV2
base_model.trainable = True


# Freeze most layers
# Only last 30 layers will be fine-tuned
for layer in base_model.layers[:-30]:
    layer.trainable = False


# Fine-tuning requires a small learning rate
model.compile(
    optimizer=tf.keras.optimizers.Adam(
        learning_rate=0.00001
    ),
    loss="binary_crossentropy",
    metrics=["accuracy"]
)


# Stop if validation performance stops improving
early_stopping = tf.keras.callbacks.EarlyStopping(
    monitor="val_loss",
    patience=2,
    restore_best_weights=True
)


# Fine-tune model
model.fit(
    train_dataset,
    validation_data=validation_dataset,
    epochs=EPOCHS,
    callbacks=[early_stopping]
)


# Evaluate final model
validation_loss, validation_accuracy = model.evaluate(
    validation_dataset
)


print("\n-----------------------------")
print("FINE-TUNING RESULT")
print("-----------------------------")

print(
    "Final Validation Accuracy:",
    round(validation_accuracy * 100, 2),
    "%"
)

print(
    "Final Validation Loss:",
    round(validation_loss, 4)
)


# Save fine-tuned model
model.save(FINAL_MODEL_PATH)

print("\nFine-tuned model saved at:")
print(FINAL_MODEL_PATH)