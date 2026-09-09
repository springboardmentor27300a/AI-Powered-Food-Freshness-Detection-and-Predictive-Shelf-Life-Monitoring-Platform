import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras import layers, models
from sklearn.utils.class_weight import compute_class_weight
import numpy as np
import os
import random
import shutil

IMG_SIZE = (160, 160)
BATCH_SIZE = 32
EPOCHS = 8

# ---- Step 1: build a smaller subset from the full data/ folders ----
SUBSET_DIR = "data_subset"
TRAIN_PER_CLASS = 4000
VAL_PER_CLASS = 1000

def build_subset():
    if os.path.exists(SUBSET_DIR):
        print("Subset already exists, skipping rebuild.")
        return

    random.seed(42)
    for split, limit in [("train", TRAIN_PER_CLASS), ("val", VAL_PER_CLASS)]:
        for cls in ["fresh", "spoiled"]:
            src_dir = os.path.join("data", split, cls)
            dst_dir = os.path.join(SUBSET_DIR, split, cls)
            os.makedirs(dst_dir, exist_ok=True)

            files = os.listdir(src_dir)
            random.shuffle(files)
            chosen = files[:limit]

            for f in chosen:
                shutil.copy(os.path.join(src_dir, f), os.path.join(dst_dir, f))

            print(f"{split}/{cls}: copied {len(chosen)} images")

build_subset()

# ---- Step 2: load datasets from the subset ----
train_ds = tf.keras.utils.image_dataset_from_directory(
    f"{SUBSET_DIR}/train",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    f"{SUBSET_DIR}/val",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
)

class_names = train_ds.class_names
print("Class order (0/1):", class_names)

# ---- Step 3: class weights ----
all_labels = np.concatenate([y.numpy() for _, y in train_ds])
class_weights_array = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(all_labels),
    y=all_labels.flatten(),
)
class_weights = {i: w for i, w in enumerate(class_weights_array)}
print("Class weights:", class_weights)

# ---- Step 4: preprocess ----
def preprocess(image, label):
    return preprocess_input(image), label

train_ds = train_ds.map(preprocess).cache().prefetch(tf.data.AUTOTUNE)
val_ds = val_ds.map(preprocess).cache().prefetch(tf.data.AUTOTUNE)

# ---- Step 5: build model ----
base_model = MobileNetV2(
    input_shape=IMG_SIZE + (3,),
    include_top=False,
    weights="imagenet",
)
base_model.trainable = False

inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
x = base_model(inputs, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.2)(x)
outputs = layers.Dense(1, activation="sigmoid")(x)

model = models.Model(inputs, outputs)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005),
    loss="binary_crossentropy",
    metrics=["accuracy"],
)

model.summary()

# ---- Step 6: train ----
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    class_weight=class_weights,
)

# ---- Step 7: save ----
model.save("freshness_model.keras")
print("\nModel saved as freshness_model.keras")
print("Final training accuracy:", history.history["accuracy"][-1])
print("Final validation accuracy:", history.history["val_accuracy"][-1])