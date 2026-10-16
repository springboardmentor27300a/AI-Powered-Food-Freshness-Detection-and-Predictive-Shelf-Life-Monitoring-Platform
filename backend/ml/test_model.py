import tensorflow as tf
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "freshness_transfer_model.keras"
TEST_DIR = BASE_DIR / "test_images"

IMG_SIZE = (224, 224)

model = tf.keras.models.load_model(MODEL_PATH)

correct = 0
total = 0

fresh_correct = 0
fresh_total = 0

spoiled_correct = 0
spoiled_total = 0


def predict_patch(patch):
    patch = tf.image.resize(patch, IMG_SIZE)
    patch = np.expand_dims(patch.numpy(), axis=0)

    score = float(
        model.predict(patch, verbose=0)[0][0]
    )

    return score


for image_path in sorted(TEST_DIR.iterdir()):

    if image_path.suffix.lower() not in [".jpg", ".jpeg", ".png", ".webp"]:
        continue

    # Load original image
    image = tf.keras.utils.load_img(image_path)
    image_array = tf.keras.utils.img_to_array(image)

    height, width, _ = image_array.shape

    # Divide image into 4 regions
    patches = [
        image_array[0:height//2, 0:width//2],
        image_array[0:height//2, width//2:width],
        image_array[height//2:height, 0:width//2],
        image_array[height//2:height, width//2:width]
    ]

    patch_scores = []

    for patch in patches:
        score = predict_patch(patch)
        patch_scores.append(score)

    # Full image prediction
    full_image = tf.image.resize(image_array, IMG_SIZE)
    full_image = np.expand_dims(full_image.numpy(), axis=0)

    full_score = float(
        model.predict(full_image, verbose=0)[0][0]
    )

    # Count strongly spoiled patches
    spoiled_patch_count = sum(
        1 for score in patch_scores
        if score >= 0.6
    )

    # Final decision
    if full_score >= 0.6:
        predicted_label = "spoiled"

    elif spoiled_patch_count >= 2:
        predicted_label = "spoiled"

    else:
        predicted_label = "fresh"

    # Actual label from filename
    filename = image_path.name.lower()

    if filename.startswith("fresh"):
        actual_label = "fresh"
        fresh_total += 1

    elif filename.startswith("spoiled"):
        actual_label = "spoiled"
        spoiled_total += 1

    else:
        actual_label = "unknown"

    is_correct = predicted_label == actual_label

    if actual_label != "unknown":
        total += 1

        if is_correct:
            correct += 1

            if actual_label == "fresh":
                fresh_correct += 1

            elif actual_label == "spoiled":
                spoiled_correct += 1

    print(
        f"{image_path.name} | "
        f"full={full_score:.4f} | "
        f"patches={[round(x, 4) for x in patch_scores]} | "
        f"spoiled_patches={spoiled_patch_count} | "
        f"actual={actual_label} | "
        f"predicted={predicted_label} | "
        f"{'CORRECT' if is_correct else 'WRONG'}"
    )


if total > 0:

    accuracy = (correct / total) * 100

    print("\n-----------------------------")
    print("PATCH-BASED TEST RESULT")
    print("-----------------------------")

    print("Correct predictions:", correct)
    print("Total tested:", total)
    print("Test accuracy:", round(accuracy, 2), "%")

    print("Fresh:", fresh_correct, "/", fresh_total)
    print("Spoiled:", spoiled_correct, "/", spoiled_total)