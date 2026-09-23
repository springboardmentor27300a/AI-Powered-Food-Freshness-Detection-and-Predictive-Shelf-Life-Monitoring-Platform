import os
import shutil
import random

BASE_DATASETS_DIR = r"C:\Users\arunk\Desktop\food-freshness-monitoring-platform\datasets"
OUTPUT_DATA_DIR = "data"
SPLIT_RATIO = 0.8

# Only scan these dataset folders — Food-101 (images/) is excluded as it has no freshness labels
FRESHNESS_DATASET_DIRS = [
    r"C:\Users\arunk\Desktop\food-freshness-monitoring-platform\datasets\Kaggle Food Freshness Dataset",
    r"C:\Users\arunk\Desktop\food-freshness-monitoring-platform\datasets\Fruit Freshness Dataset",
]

def collect_and_organize_all():
    """Collects images ONLY from known freshness datasets (Kaggle + Fruit Freshness).
    Excludes Food-101 which has no Fresh/Rotten labels."""
    random.seed(42)
    all_fresh = []
    all_spoiled = []

    for dataset_dir in FRESHNESS_DATASET_DIRS:
        if not os.path.isdir(dataset_dir):
            print(f"Skipping (not found): {dataset_dir}")
            continue
        print(f"Scanning: {dataset_dir}")
        for root, dirs, files in os.walk(dataset_dir):
            for f in files:
                if f.lower().endswith((".jpg", ".jpeg", ".png")):
                    full_path = os.path.join(root, f)
                    lower_path = full_path.lower()
                    if "rotten" in lower_path or "spoiled" in lower_path:
                        all_spoiled.append(full_path)
                    elif "fresh" in lower_path:
                        all_fresh.append(full_path)

    print(f"\nCollected authentic dataset images: {len(all_fresh)} Fresh, {len(all_spoiled)} Spoiled.")

    for class_name, img_list in [("fresh", all_fresh), ("spoiled", all_spoiled)]:
        random.shuffle(img_list)
        split_idx = int(len(img_list) * SPLIT_RATIO)
        train_set = img_list[:split_idx]
        val_set = img_list[split_idx:]

        for subset, files_list in [("train", train_set), ("val", val_set)]:
            dest_dir = os.path.join(OUTPUT_DATA_DIR, subset, class_name)
            os.makedirs(dest_dir, exist_ok=True)
            for idx, src in enumerate(files_list):
                parent_folder = os.path.basename(os.path.dirname(src))
                base = os.path.basename(src)
                if len(base) > 50:
                    base = base[-50:]
                new_fname = f"{parent_folder}_{idx}_{base}"
                src_fixed = "\\\\?\\" + os.path.abspath(src)
                dest_fixed = "\\\\?\\" + os.path.abspath(os.path.join(dest_dir, new_fname))
                shutil.copy(src_fixed, dest_fixed)

    print("Dataset successfully organized under ./data/")
    print(f"Train -> Fresh: {len([f for f in os.listdir(os.path.join(OUTPUT_DATA_DIR,'train','fresh'))])}, Spoiled: {len([f for f in os.listdir(os.path.join(OUTPUT_DATA_DIR,'train','spoiled'))])}")
    print(f"Val   -> Fresh: {len([f for f in os.listdir(os.path.join(OUTPUT_DATA_DIR,'val','fresh'))])}, Spoiled: {len([f for f in os.listdir(os.path.join(OUTPUT_DATA_DIR,'val','spoiled'))])}")

if __name__ == "__main__":
    collect_and_organize_all()
