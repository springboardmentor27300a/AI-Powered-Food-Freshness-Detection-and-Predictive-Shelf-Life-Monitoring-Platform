import os
import shutil
import random

SOURCE_DIR = r"C:\Users\arunk\Desktop\food-freshness-monitoring-platform\datasets\Dataset"

OUTPUT_DIR = "data"
SPLIT_RATIO = 0.8  # 80% train, 20% validation

CLASS_MAP = {
    "Fresh": "fresh",
    "Rotten": "spoiled",
}

random.seed(42)

def collect_images(folder):
    found = []
    for root, dirs, files in os.walk(folder):
        for f in files:
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                found.append(os.path.join(root, f))
    return found

for src_folder, target_class in CLASS_MAP.items():
    src_path = os.path.join(SOURCE_DIR, src_folder)
    if not os.path.isdir(src_path):
        print(f"Skipping '{src_folder}' — folder not found at {src_path}")
        continue

    images = collect_images(src_path)
    random.shuffle(images)
    split_point = int(len(images) * SPLIT_RATIO)
    train_imgs = images[:split_point]
    val_imgs = images[split_point:]

    for subset, img_list in [("train", train_imgs), ("val", val_imgs)]:
        dest_dir = os.path.join(OUTPUT_DIR, subset, target_class)
        os.makedirs(dest_dir, exist_ok=True)
        for img_path in img_list:
            parent_name = os.path.basename(os.path.dirname(img_path))
            new_name = f"{parent_name}_{os.path.basename(img_path)}"
            shutil.copy(img_path, os.path.join(dest_dir, new_name))

    print(f"{src_folder} -> {target_class}: {len(train_imgs)} train, {len(val_imgs)} val")

print("\nDone. Folder structure created under ./data/")