from pathlib import Path


# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# Dataset Verification
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "dataset"

SPLITS = ["train", "validation", "test"]
CLASSES = ["fresh", "less_fresh", "rotten"]

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def count_images(folder):
    if not folder.exists():
        return 0

    return sum(
        1
        for file in folder.iterdir()
        if file.is_file()
        and file.suffix.lower() in IMAGE_EXTENSIONS
    )


def main():
    print("=" * 60)
    print("FOOD FRESHNESS DATASET VERIFICATION")
    print("=" * 60)

    print(f"\nDataset path:")
    print(DATASET_DIR)

    if not DATASET_DIR.exists():
        print("\n❌ ERROR: dataset folder not found.")
        return

    total_images = 0

    print("\n" + "-" * 60)

    for split in SPLITS:

        split_dir = DATASET_DIR / split

        print(f"\n📁 {split.upper()}")

        if not split_dir.exists():
            print("   ❌ Folder missing")
            continue

        split_total = 0

        for class_name in CLASSES:

            class_dir = split_dir / class_name

            count = count_images(class_dir)

            split_total += count
            total_images += count

            if class_dir.exists():
                print(
                    f"   {class_name:<12} : {count} images"
                )
            else:
                print(
                    f"   {class_name:<12} : ❌ folder missing"
                )

        print(
            f"   {'TOTAL':<12} : {split_total} images"
        )

    print("\n" + "-" * 60)

    print(
        f"\n📊 TOTAL DATASET IMAGES: {total_images}"
    )

    print("\n" + "=" * 60)

    if total_images == 0:
        print(
            "⚠️ Dataset folders exist, "
            "but no images were found."
        )
    else:
        print(
            "✅ Dataset verification completed."
        )

    print("=" * 60)


if __name__ == "__main__":
    main()