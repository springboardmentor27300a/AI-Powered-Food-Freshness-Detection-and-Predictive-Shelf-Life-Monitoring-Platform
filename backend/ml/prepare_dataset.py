import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATASET1 = BASE_DIR / "dataset1" / "dataset"
DATASET2 = BASE_DIR / "dataset2" / "Fruits_Vegetables_Dataset(12000)"

OUTPUT = BASE_DIR / "combined_dataset"
FRESH_DIR = OUTPUT / "fresh"
SPOILED_DIR = OUTPUT / "spoiled"

FRESH_DIR.mkdir(parents=True, exist_ok=True)
SPOILED_DIR.mkdir(parents=True, exist_ok=True)


def copy_images(source_folder, destination_folder, prefix):
    count = 0

    for file in os.listdir(source_folder):
        source_path = source_folder / file

        if source_path.is_file():
            new_name = f"{prefix}_{count}_{file}"
            destination_path = destination_folder / new_name

            shutil.copy2(source_path, destination_path)
            count += 1

    return count


fresh_count = 0
spoiled_count = 0


# -------------------------
# DATASET 1
# -------------------------

for folder in DATASET1.iterdir():

    if not folder.is_dir():
        continue

    folder_name = folder.name.lower()

    if folder_name.startswith("fresh"):
        fresh_count += copy_images(
            folder,
            FRESH_DIR,
            f"dataset1_{folder.name}"
        )

    elif folder_name.startswith("spoiled"):
        spoiled_count += copy_images(
            folder,
            SPOILED_DIR,
            f"dataset1_{folder.name}"
        )


# -------------------------
# DATASET 2
# -------------------------

for category in ["Fruits", "Vegetables"]:

    category_path = DATASET2 / category

    for folder in category_path.iterdir():

        if not folder.is_dir():
            continue

        folder_name = folder.name.lower()

        if folder_name.startswith("fresh"):
            fresh_count += copy_images(
                folder,
                FRESH_DIR,
                f"dataset2_{folder.name}"
            )

        elif folder_name.startswith("rotten"):
            spoiled_count += copy_images(
                folder,
                SPOILED_DIR,
                f"dataset2_{folder.name}"
            )


print("Dataset preparation completed.")
print("Fresh images:", fresh_count)
print("Spoiled images:", spoiled_count)
print("Combined dataset:", OUTPUT)