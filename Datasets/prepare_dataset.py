import shutil
import random
from pathlib import Path

# ============================================================
# SETTINGS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw"
PROCESSED_DIR = BASE_DIR / "processed"

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

random.seed(42)


# ============================================================
# CLEAN OLD PROCESSED DATA
# ============================================================

if PROCESSED_DIR.exists():
    print("Removing old processed dataset...")
    shutil.rmtree(PROCESSED_DIR)

classes = [
    "fresh",
    "half_fresh",
    "spoiled",
    "rotten",
]

for split in ["train", "val", "test"]:
    for class_name in classes:
        (PROCESSED_DIR / split / class_name).mkdir(
            parents=True,
            exist_ok=True
        )


# ============================================================
# SPLIT AND COPY IMAGES
# ============================================================

def add_images(image_files, class_name, source_name):

    if not image_files:
        print(f"{source_name} -> {class_name}: 0 images")
        return

    image_files = list(image_files)
    random.shuffle(image_files)

    total = len(image_files)

    train_end = int(total * TRAIN_RATIO)
    val_end = train_end + int(total * VAL_RATIO)

    split_files = {
        "train": image_files[:train_end],
        "val": image_files[train_end:val_end],
        "test": image_files[val_end:]
    }

    total_copied = 0

    for split, files in split_files.items():

        destination = PROCESSED_DIR / split / class_name

        for index, source in enumerate(files):

            new_name = (
                f"{source.stem}_{total_copied}{source.suffix}"
            )

            shutil.copy2(
                source,
                destination / new_name
            )

            total_copied += 1

    print(
        f"{source_name} -> {class_name}: "
        f"{len(split_files['train'])} train, "
        f"{len(split_files['val'])} val, "
        f"{len(split_files['test'])} test"
    )


# ============================================================
# 1. FRESHNESS44
# ============================================================

print("\n===================================")
print("Processing Freshness44")
print("===================================")

freshness44 = (
    RAW_DIR
    / "freshness44"
    / "Freshness44"
)

fresh_images = []
rotten_images = []

if freshness44.exists():

    for folder in freshness44.iterdir():

        if not folder.is_dir():
            continue

        folder_name = folder.name.lower()

        images = [
            file
            for file in folder.iterdir()
            if file.is_file()
            and file.suffix.lower() in IMAGE_EXTENSIONS
        ]

        if "_fresh" in folder_name:
            fresh_images.extend(images)

        elif "_rotten" in folder_name:
            rotten_images.extend(images)

else:
    print("Freshness44 folder not found.")


add_images(
    fresh_images,
    "fresh",
    "Freshness44"
)

add_images(
    rotten_images,
    "rotten",
    "Freshness44"
)


# ============================================================
# 2. FRESH & SPOILED FOOD
# ============================================================

print("\n===================================")
print("Processing Fresh & Spoiled Food")
print("===================================")

fresh_spoiled = (
    RAW_DIR
    / "fresh_spoiled_food"
    / "dataset"
)

fresh_food_images = []
spoiled_food_images = []

if fresh_spoiled.exists():

    for folder in fresh_spoiled.iterdir():

        if not folder.is_dir():
            continue

        folder_name = folder.name.lower()

        images = [
            file
            for file in folder.iterdir()
            if file.is_file()
            and file.suffix.lower() in IMAGE_EXTENSIONS
        ]

        if folder_name.startswith("fresh_"):
            fresh_food_images.extend(images)

        elif folder_name.startswith("spoiled_"):
            spoiled_food_images.extend(images)

else:
    print("Fresh & Spoiled dataset not found.")


add_images(
    fresh_food_images,
    "fresh",
    "Fresh/Spoiled Food"
)

add_images(
    spoiled_food_images,
    "spoiled",
    "Fresh/Spoiled Food"
)


# ============================================================
# 3. MEAT FRESHNESS
# ============================================================

print("\n===================================")
print("Processing Meat Freshness")
print("===================================")

meat_path = RAW_DIR / "meat_freshness"

meat_fresh = []
meat_half_fresh = []
meat_spoiled = []

if meat_path.exists():

    for file in meat_path.rglob("*"):

        if not file.is_file():
            continue

        if file.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        filename = file.name.upper()

        if filename.startswith("FRESH-"):
            meat_fresh.append(file)

        elif filename.startswith("HALF-FRESH-"):
            meat_half_fresh.append(file)

        elif filename.startswith("SPOILED-"):
            meat_spoiled.append(file)

else:
    print("Meat dataset not found.")


add_images(
    meat_fresh,
    "fresh",
    "Meat"
)

add_images(
    meat_half_fresh,
    "half_fresh",
    "Meat"
)

add_images(
    meat_spoiled,
    "spoiled",
    "Meat"
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n===================================")
print("FINAL DATASET SUMMARY")
print("===================================")

for split in ["train", "val", "test"]:

    print(f"\n{split.upper()}")

    for class_name in classes:

        folder = (
            PROCESSED_DIR
            / split
            / class_name
        )

        count = len([
            file
            for file in folder.iterdir()
            if file.is_file()
        ])

        print(
            f"{class_name}: {count}"
        )


print("\n===================================")
print("DATASET PREPARATION COMPLETED")
print("===================================")

print("\nOriginal raw datasets were NOT modified.")
print("Fish dataset was skipped for now.")