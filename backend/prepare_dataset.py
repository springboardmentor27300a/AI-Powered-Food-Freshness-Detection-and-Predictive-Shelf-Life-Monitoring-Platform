# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# DATASET PREPARATION SCRIPT
# ============================================================

from pathlib import Path
import shutil
import random


# ============================================================
# CONFIGURATION
# ============================================================

# This file is inside:
# Food-Freshness-Monitoring-Platform/backend/prepare_dataset.py

BACKEND_DIR = Path(__file__).resolve().parent

# Project root:
# Food-Freshness-Monitoring-Platform/
PROJECT_DIR = BACKEND_DIR.parent


# ============================================================
# SOURCE DATASET
# ============================================================

SOURCE_DIR = (
    Path.home()
    / "Downloads"
    / "Processed Data"
    / "Processed Data"
)


# ============================================================
# TARGET DATASET
# ============================================================

# IMPORTANT:
# Dataset will be created here:
#
# Food-Freshness-Monitoring-Platform/
# └── dataset/
#
# NOT inside backend/
#
TARGET_DIR = PROJECT_DIR / "dataset"


# ============================================================
# DATASET SETTINGS
# ============================================================

TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15
TEST_RATIO = 0.15


# Fixed seed makes the split reproducible
RANDOM_SEED = 42

random.seed(RANDOM_SEED)


# ============================================================
# SUPPORTED IMAGE EXTENSIONS
# ============================================================

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
}


# ============================================================
# CLASS NAMES
# ============================================================

CLASSES = {
    "fresh",
    "less_fresh",
    "rotten",
}


# ============================================================
# PRINT HEADER
# ============================================================

print("=" * 60)
print("FOOD FRESHNESS DATASET PREPARATION")
print("=" * 60)

print()

print("SOURCE:")
print(SOURCE_DIR)

print()

print("TARGET:")
print(TARGET_DIR)

print()


# ============================================================
# CHECK SOURCE DIRECTORY
# ============================================================

if not SOURCE_DIR.exists():

    print("❌ ERROR: Source dataset folder not found.")

    print()
    print("Expected location:")
    print(SOURCE_DIR)

    print()

    print(
        "Please make sure the extracted dataset is inside:"
    )

    print(
        r"C:\Users\Mayank\Downloads\Processed Data\Processed Data"
    )

    raise SystemExit(1)


# ============================================================
# CLASS DETECTION
# ============================================================

def get_class_from_folder(folder_name):
    """
    Detect freshness class from original folder name.

    Examples:

    Fresh Banana(1-4)
        -> fresh

    Fresh Tomato(1-10)
        -> fresh

    Semi fresh banana(4-7)
        -> less_fresh

    Semi Fresh Bittermelon ( 3-5)
        -> less_fresh

    Semi_Fresh eggplant(4-8)
        -> less_fresh

    Rotten Tomato(24-35)
        -> rotten
    """

    name = folder_name.lower().strip()

    # Convert underscore to space
    # so "Semi_Fresh" becomes "semi fresh"
    normalized = name.replace("_", " ")

    # Remove extra spaces
    normalized = " ".join(
        normalized.split()
    )


    # ========================================================
    # FRESH
    # ========================================================

    if normalized.startswith("fresh "):
        return "fresh"


    # ========================================================
    # SEMI FRESH
    # ========================================================

    if normalized.startswith("semi fresh"):
        return "less_fresh"


    # ========================================================
    # ROTTEN
    # ========================================================

    if normalized.startswith("rotten "):
        return "rotten"


    # ========================================================
    # UNKNOWN
    # ========================================================

    return None


# ============================================================
# CREATE TARGET DIRECTORIES
# ============================================================

print("Preparing target folders...")
print()


# If target already exists, remove previous generated dataset
if TARGET_DIR.exists():

    print(
        "⚠️ Existing dataset found."
    )

    print(
        "Removing old generated dataset..."
    )

    shutil.rmtree(TARGET_DIR)

    print(
        "Old dataset removed."
    )

    print()


# Create directory structure

for split in [
    "train",
    "validation",
    "test",
]:

    for class_name in [
        "fresh",
        "less_fresh",
        "rotten",
    ]:

        folder = (
            TARGET_DIR
            / split
            / class_name
        )

        folder.mkdir(
            parents=True,
            exist_ok=True
        )


print("Target folders created.")

print()


# ============================================================
# COLLECT SOURCE IMAGES BY CLASS
# ============================================================

images_by_class = {
    "fresh": [],
    "less_fresh": [],
    "rotten": [],
}


# ============================================================
# FIND SOURCE FOLDERS
# ============================================================

source_folders = [
    folder
    for folder in SOURCE_DIR.iterdir()
    if folder.is_dir()
]


# Sort for predictable processing
source_folders.sort(
    key=lambda path: path.name.lower()
)


# ============================================================
# PROCESS EACH SOURCE FOLDER
# ============================================================

total_source_images = 0

skipped_folders = []


for source_folder in source_folders:

    folder_name = source_folder.name

    class_name = get_class_from_folder(
        folder_name
    )


    # ========================================================
    # UNKNOWN FOLDER
    # ========================================================

    if class_name is None:

        skipped_folders.append(
            folder_name
        )

        continue


    # ========================================================
    # FIND IMAGES
    # ========================================================

    image_files = [
        file
        for file in source_folder.iterdir()
        if (
            file.is_file()
            and file.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    ]


    # Sort before adding
    image_files.sort(
        key=lambda path: path.name.lower()
    )


    # ========================================================
    # ADD IMAGES
    # ========================================================

    images_by_class[class_name].extend(
        image_files
    )


    total_source_images += len(
        image_files
    )


    print(
        f"{folder_name:<35} -> "
        f"{class_name:<12} "
        f"{len(image_files)} images"
    )


# ============================================================
# SHOW SKIPPED FOLDERS
# ============================================================

if skipped_folders:

    print()

    print("-" * 60)

    print(
        "⚠️ SKIPPED / UNKNOWN FOLDERS"
    )

    print("-" * 60)

    for folder_name in skipped_folders:

        print(
            f"SKIPPED: {folder_name}"
        )


# ============================================================
# SOURCE SUMMARY
# ============================================================

print()

print("-" * 60)

print(
    "SOURCE DATASET SUMMARY"
)

print("-" * 60)

print()

for class_name in [
    "fresh",
    "less_fresh",
    "rotten",
]:

    count = len(
        images_by_class[class_name]
    )

    print(
        f"{class_name:<15}: {count} images"
    )


print()

print(
    f"TOTAL SOURCE IMAGES: "
    f"{total_source_images}"
)

print()


# ============================================================
# CHECK DATASET
# ============================================================

if total_source_images == 0:

    print("=" * 60)

    print(
        "❌ ERROR: No images found."
    )

    print("=" * 60)

    raise SystemExit(1)


# ============================================================
# SPLIT FUNCTION
# ============================================================

def split_images(images):

    """
    Split images into:

    70% train
    15% validation
    15% test
    """

    images = list(images)

    random.shuffle(images)


    total = len(images)


    train_count = int(
        total * TRAIN_RATIO
    )

    validation_count = int(
        total * VALIDATION_RATIO
    )


    train_images = images[
        :train_count
    ]


    validation_images = images[
        train_count:
        train_count + validation_count
    ]


    test_images = images[
        train_count + validation_count:
    ]


    return (
        train_images,
        validation_images,
        test_images,
    )


# ============================================================
# COPY IMAGES
# ============================================================

print("=" * 60)

print(
    "CREATING TRAIN / VALIDATION / TEST SPLIT"
)

print("=" * 60)

print()


dataset_counts = {
    "train": {
        "fresh": 0,
        "less_fresh": 0,
        "rotten": 0,
    },

    "validation": {
        "fresh": 0,
        "less_fresh": 0,
        "rotten": 0,
    },

    "test": {
        "fresh": 0,
        "less_fresh": 0,
        "rotten": 0,
    },
}


# ============================================================
# PROCESS EACH CLASS
# ============================================================

for class_name in [
    "fresh",
    "less_fresh",
    "rotten",
]:

    images = images_by_class[
        class_name
    ]


    (
        train_images,
        validation_images,
        test_images,
    ) = split_images(images)


    # ========================================================
    # COPY TRAIN
    # ========================================================

    for index, image_path in enumerate(
        train_images
    ):

        destination = (
            TARGET_DIR
            / "train"
            / class_name
            / (
                f"{class_name}"
                f"_train_"
                f"{index:05d}"
                f"{image_path.suffix.lower()}"
            )
        )


        shutil.copy2(
            image_path,
            destination
        )


    dataset_counts[
        "train"
    ][class_name] = len(
        train_images
    )


    # ========================================================
    # COPY VALIDATION
    # ========================================================

    for index, image_path in enumerate(
        validation_images
    ):

        destination = (
            TARGET_DIR
            / "validation"
            / class_name
            / (
                f"{class_name}"
                f"_validation_"
                f"{index:05d}"
                f"{image_path.suffix.lower()}"
            )
        )


        shutil.copy2(
            image_path,
            destination
        )


    dataset_counts[
        "validation"
    ][class_name] = len(
        validation_images
    )


    # ========================================================
    # COPY TEST
    # ========================================================

    for index, image_path in enumerate(
        test_images
    ):

        destination = (
            TARGET_DIR
            / "test"
            / class_name
            / (
                f"{class_name}"
                f"_test_"
                f"{index:05d}"
                f"{image_path.suffix.lower()}"
            )
        )


        shutil.copy2(
            image_path,
            destination
        )


    dataset_counts[
        "test"
    ][class_name] = len(
        test_images
    )


# ============================================================
# FINAL SUMMARY
# ============================================================

print()

print("=" * 60)

print(
    "DATASET PREPARATION COMPLETE"
)

print("=" * 60)

print()


print(
    "Created structure:"
)

print()


# ============================================================
# TRAIN
# ============================================================

print("train/")

print(
    f"    fresh       : "
    f"{dataset_counts['train']['fresh']} images"
)

print(
    f"    less_fresh  : "
    f"{dataset_counts['train']['less_fresh']} images"
)

print(
    f"    rotten      : "
    f"{dataset_counts['train']['rotten']} images"
)

print()


# ============================================================
# VALIDATION
# ============================================================

print("validation/")

print(
    f"    fresh       : "
    f"{dataset_counts['validation']['fresh']} images"
)

print(
    f"    less_fresh  : "
    f"{dataset_counts['validation']['less_fresh']} images"
)

print(
    f"    rotten      : "
    f"{dataset_counts['validation']['rotten']} images"
)

print()


# ============================================================
# TEST
# ============================================================

print("test/")

print(
    f"    fresh       : "
    f"{dataset_counts['test']['fresh']} images"
)

print(
    f"    less_fresh  : "
    f"{dataset_counts['test']['less_fresh']} images"
)

print(
    f"    rotten      : "
    f"{dataset_counts['test']['rotten']} images"
)

print()


# ============================================================
# TOTALS
# ============================================================

train_total = sum(
    dataset_counts["train"].values()
)

validation_total = sum(
    dataset_counts["validation"].values()
)

test_total = sum(
    dataset_counts["test"].values()
)


final_total = (
    train_total
    + validation_total
    + test_total
)


print("-" * 60)

print(
    f"TRAIN TOTAL       : "
    f"{train_total}"
)

print(
    f"VALIDATION TOTAL  : "
    f"{validation_total}"
)

print(
    f"TEST TOTAL        : "
    f"{test_total}"
)

print(
    f"FINAL TOTAL       : "
    f"{final_total}"
)

print(
    f"SOURCE TOTAL      : "
    f"{total_source_images}"
)

print("-" * 60)

print()


# ============================================================
# VALIDATE FINAL COUNT
# ============================================================

if final_total == total_source_images:

    print(
        "✅ All source images were successfully "
        "distributed."
    )

else:

    difference = (
        total_source_images
        - final_total
    )

    print(
        f"⚠️ WARNING: {difference} "
        f"images were not copied."
    )


# ============================================================
# FINAL LOCATION
# ============================================================

print()

print(
    "Dataset location:"
)

print(
    TARGET_DIR
)

print()

print(
    "Next step:"
)

print(
    "python dataset_check.py"
)

print()

print("=" * 60)