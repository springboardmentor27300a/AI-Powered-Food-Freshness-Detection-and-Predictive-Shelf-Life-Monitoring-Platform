"""
ml/training/prepare_dataset.py

Turns the raw Kaggle download of "Fruits Fresh and Rotten for Classification"
(sriramr/fruits-fresh-and-rotten-for-classification) into a clean
train/validation/test split under ml/data/, with no leakage between splits.

WHY THIS EXISTS: the Kaggle dataset already ships a train/ and test/ folder,
but (a) it has no validation split, and (b) folder names vary slightly
between re-uploads/mirrors of this dataset. This script normalizes both.

--------------------------------------------------------------------------
STEP 1 — Download the dataset yourself (this machine has no internet access
for Claude, so this part is manual):

  1. Go to https://www.kaggle.com/datasets/sriramr/fruits-fresh-and-rotten-for-classification
  2. Click "Download" (requires a free Kaggle account), or use the Kaggle CLI:
       pip install kaggle
       kaggle datasets download -d sriramr/fruits-fresh-and-rotten-for-classification
  3. Unzip it. You should see folders roughly like:
       dataset/train/freshapples, dataset/train/freshbanana, dataset/train/freshoranges,
       dataset/train/rottenapples, dataset/train/rottenbanana, dataset/train/rottenoranges,
       dataset/test/freshapples, ... (same 6 classes under test/)
  4. Copy that unzipped folder to: backend/ml/data/raw/
     So you end up with: backend/ml/data/raw/dataset/train/... and .../test/...
     (If your extraction already produced train/ and test/ directly under
     ml/data/raw/, that's fine too — this script searches for them.)

STEP 2 — Run this script from backend/, with the venv active:
    python ml/training/prepare_dataset.py

It will create:
    ml/data/processed/train/fresh/...
    ml/data/processed/train/rotten/...
    ml/data/processed/validation/fresh/...
    ml/data/processed/validation/rotten/...
    ml/data/processed/test/fresh/...
    ml/data/processed/test/rotten/...

Then run train_cnn.py.
--------------------------------------------------------------------------
"""
import random
import shutil
from pathlib import Path

RANDOM_SEED = 42
VALIDATION_FRACTION = 0.15  # carved out of the original "train" split only

ML_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ML_ROOT / "data" / "raw"
PROCESSED_DIR = ML_ROOT / "data" / "processed"

# Kaggle folder name -> our 2-class label
FRESH_FOLDER_NAMES = {"freshapples", "freshbanana", "freshoranges", "fresh"}
ROTTEN_FOLDER_NAMES = {"rottenapples", "rottenbanana", "rottenoranges", "rotten"}
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def find_split_dirs():
    """Locate the raw train/ and test/ directories, wherever they landed
    under ml/data/raw/ (handles the extra 'dataset/' nesting Kaggle zips
    sometimes add)."""
    candidates = list(RAW_DIR.rglob("train"))
    train_dirs = [c for c in candidates if c.is_dir() and any(c.iterdir())]
    if not train_dirs:
        raise FileNotFoundError(
            f"Could not find a 'train' folder anywhere under {RAW_DIR}.\n"
            "Did you download+unzip the Kaggle dataset into backend/ml/data/raw/? "
            "See the instructions at the top of this file."
        )
    train_dir = train_dirs[0]
    test_dir = train_dir.parent / "test"
    if not test_dir.exists():
        # some mirrors call it 'val' or 'test'
        alt = list(train_dir.parent.glob("test*")) + list(train_dir.parent.glob("val*"))
        if not alt:
            raise FileNotFoundError(f"Found train dir at {train_dir} but no matching test dir next to it.")
        test_dir = alt[0]
    return train_dir, test_dir


def label_for_folder(folder_name: str) -> str | None:
    name = folder_name.lower()
    if name in FRESH_FOLDER_NAMES:
        return "fresh"
    if name in ROTTEN_FOLDER_NAMES:
        return "rotten"
    return None


def collect_images(split_dir: Path) -> dict:
    """Returns {"fresh": [Path, ...], "rotten": [Path, ...]}"""
    buckets = {"fresh": [], "rotten": []}
    for class_dir in split_dir.iterdir():
        if not class_dir.is_dir():
            continue
        label = label_for_folder(class_dir.name)
        if label is None:
            print(f"  (skipping unrecognized folder: {class_dir.name})")
            continue
        for f in class_dir.rglob("*"):
            if f.suffix.lower() in VALID_EXTENSIONS:
                buckets[label].append(f)
    return buckets


def copy_split(buckets: dict, dest_split_name: str):
    for label, files in buckets.items():
        dest_dir = PROCESSED_DIR / dest_split_name / label
        dest_dir.mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.copy2(f, dest_dir / f"{f.parent.name}_{f.name}")
    counts = {label: len(files) for label, files in buckets.items()}
    print(f"  {dest_split_name}: {counts}")


def main():
    random.seed(RANDOM_SEED)
    print(f"Looking for raw dataset under {RAW_DIR} ...")
    train_dir, test_dir = find_split_dirs()
    print(f"Found train dir: {train_dir}")
    print(f"Found test dir:  {test_dir}")

    if PROCESSED_DIR.exists():
        shutil.rmtree(PROCESSED_DIR)

    print("\nCollecting train images...")
    train_buckets = collect_images(train_dir)

    # Carve out validation from train ONLY (never from test), so test stays
    # completely unseen until evaluate_model.py runs.
    val_buckets = {"fresh": [], "rotten": []}
    for label, files in train_buckets.items():
        files = files[:]  # copy
        random.shuffle(files)
        n_val = int(len(files) * VALIDATION_FRACTION)
        val_buckets[label] = files[:n_val]
        train_buckets[label] = files[n_val:]

    print("\nCollecting test images...")
    test_buckets = collect_images(test_dir)

    print("\nWriting processed splits:")
    copy_split(train_buckets, "train")
    copy_split(val_buckets, "validation")
    copy_split(test_buckets, "test")

    total = sum(len(v) for v in train_buckets.values()) + \
        sum(len(v) for v in val_buckets.values()) + \
        sum(len(v) for v in test_buckets.values())
    print(f"\nDone. {total} images copied into {PROCESSED_DIR}")
    print("Next: python ml/training/train_cnn.py")


if __name__ == "__main__":
    main()
