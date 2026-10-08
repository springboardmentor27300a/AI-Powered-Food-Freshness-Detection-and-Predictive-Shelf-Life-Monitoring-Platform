"""
Dataset preparation for the AgriFreshNET Freshness and Shelf-Life Image Dataset.

Pipeline (run from the ``backend/`` directory):

    python ml/download_dataset.py      # ensure datasets/raw/Processed Data.zip exists
    python ml/prepare_dataset.py       # this script

Steps performed:
    1.  Use the extracted class-folder root ``datasets/raw/AgriFreshNET/`` when
        present (extract it from ``datasets/raw/Processed Data.zip`` otherwise).
    2.  Detect the real class folders and map them to the dataset's three
        genuine classes FRESH / SEMI_FRESH / ROTTEN.
    3.  Validate every image (decode + RGB) and drop unreadable/corrupt files.
    4.  Group near-duplicate images with a perceptual hash (dHash).  Every
        group is kept entirely inside a single split to avoid data leakage.
    5.  Stratified 70% / 15% / 15% train / validation / test split.
    6.  Normalise the directory structure under ``datasets/processed`` and
        write the split folders ``datasets/train|val|test``.
    7.  Write ``manifest.csv`` + ``split_summary.json`` and print a summary.

Artifacts under ``datasets/``::

    datasets/
      raw/AgriFreshNET/...                       (extracted class folders)
      processed/FRESH|SEMI_FRESH|ROTTEN/...      (validated full copy)
      processed/manifest.csv
      processed/split_summary.json
      train/FRESH|SEMI_FRESH|ROTTEN/...
      val/FRESH|SEMI_FRESH|ROTTEN/...
      test/FRESH|SEMI_FRESH|ROTTEN/...
"""
import argparse
import csv
import json
import random
import re
import shutil
import sys
import zipfile
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.config import (  # noqa: E402
    CLASS_FOLDER_MAP,
    DATASET_ZIP_PATTERN,
    DEDUP_HAMMING_THRESHOLD,
    DEDUP_HASH_SIZE,
    EXTRACTED_CLASS_ROOT,
    MAX_IMAGES_PER_CLASS,
    MANIFEST_CSV,
    PROCESSED_DIR,
    RAW_DIR,
    SPLIT_JSON,
    SPLIT_RATIOS,
    TEST_DIR,
    TRAIN_DIR,
    VAL_DIR,
)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# Temporary extraction target used only when the primary class-folder root is
# missing (users are encouraged to keep datasets/raw/AgriFreshNET/ instead).
_EXTRACT_TMP = RAW_DIR / "_extracted_tmp"

_FOLDER_SLUG_RE = re.compile(r"[^A-Za-z0-9_]+")


def _folder_slug(name: str) -> str:
    return _FOLDER_SLUG_RE.sub("_", name).strip("_").upper()


def map_folder_to_class(folder_name: str) -> str | None:
    """Map a raw folder name to FRESH / SEMI_FRESH / ROTTEN (case-insensitive)."""
    lowered = folder_name.lower()
    for prefix, cls in CLASS_FOLDER_MAP.items():
        if lowered.startswith(prefix):
            return cls
    return None


def map_folder_to_food(folder_name: str) -> str:
    """Extract the food type from a folder like 'Fresh Banana(1-4)'.

    Removes the leading class word(s) and any trailing '(day range)' part.
    """
    lowered = folder_name.lower()
    for prefix in CLASS_FOLDER_MAP:
        if lowered.startswith(prefix):
            rest = folder_name[len(prefix):].strip().strip("_- ")
            break
    else:
        rest = folder_name
    rest = re.sub(r"\([^)]*\)", "", rest)
    rest = rest.strip().strip("_- ")
    return rest or folder_name


# ---------------------------------------------------------------------------
# Perceptual hashing (dHash) for duplicate / near-duplicate detection
# ---------------------------------------------------------------------------
def dhash(img_bgr: np.ndarray, hash_size: int = DEDUP_HASH_SIZE) -> int:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (hash_size + 1, hash_size))
    diff = small[:, 1:] > small[:, :-1]
    bits = diff.flatten().astype(np.uint8)
    return (bits * (1 << np.arange(bits.size))).sum()


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


class ImageRecord:
    __slots__ = ("path", "class_label", "food_type", "hash")

    def __init__(self, path: Path, class_label: str, food_type: str, hash_: int):
        self.path = path
        self.class_label = class_label
        self.food_type = food_type
        self.hash = hash_


def resolve_source_root(zip_path: Path | None) -> Path:
    """Return the extracted class-folder root (primary), extracting when needed."""
    if EXTRACTED_CLASS_ROOT.exists() and any(EXTRACTED_CLASS_ROOT.iterdir()):
        print(f"[ok] Using extracted class-folder root: {EXTRACTED_CLASS_ROOT}")
        return EXTRACTED_CLASS_ROOT

    if zip_path is None or not zip_path.exists():
        raise FileNotFoundError(
            f"Dataset not found. Expected extracted folders at {EXTRACTED_CLASS_ROOT} "
            f"or a zip under {RAW_DIR}. Run: python ml/download_dataset.py"
        )

    if _EXTRACT_TMP.exists():
        shutil.rmtree(_EXTRACT_TMP)
    _EXTRACT_TMP.mkdir(parents=True, exist_ok=True)
    print(f"Extracting {zip_path.name} ...")
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            ext = Path(member.filename).suffix.lower()
            if ext not in IMAGE_EXTS:
                continue
            parts = Path(member.filename).parts
            # zip layout: <root>/<class folder>/<image file>
            if len(parts) < 2:
                continue
            class_folder = parts[0] if len(parts) == 2 else parts[1]
            target_dir = _EXTRACT_TMP / class_folder
            target_dir.mkdir(parents=True, exist_ok=True)
            target = target_dir / parts[-1]
            with zf.open(member) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
    count = sum(len(list(d.glob("*"))) for d in _EXTRACT_TMP.iterdir() if d.is_dir())
    print(f"[ok] Extracted {count} image files to {_EXTRACT_TMP}")
    return _EXTRACT_TMP


def load_and_validate(path: Path) -> np.ndarray | None:
    """Return the decoded BGR image or None when the file is corrupt/unreadable."""
    try:
        data = np.fromfile(path, dtype=np.uint8)
        if data.size == 0:
            return None
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is None or img.size == 0:
            return None
        if img.shape[2] != 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        return img
    except Exception:  # noqa: BLE001
        return None


def collect_records(extract_root: Path) -> list[ImageRecord]:
    records: list[ImageRecord] = []
    skipped = 0

    for folder in sorted(extract_root.iterdir()):
        if not folder.is_dir():
            continue
        class_label = map_folder_to_class(folder.name)
        if class_label is None:
            print(f"  [skip] Unknown folder (not a class): {folder.name}")
            continue
        food_type = map_folder_to_food(folder.name)
        slug = _folder_slug(folder.name)
        seen = 0
        for img_path in sorted(folder.iterdir()):
            if img_path.suffix.lower() not in IMAGE_EXTS:
                continue
            if MAX_IMAGES_PER_CLASS and seen >= MAX_IMAGES_PER_CLASS:
                break
            img = load_and_validate(img_path)
            if img is None:
                skipped += 1
                continue
            records.append(ImageRecord(img_path, class_label, food_type, dhash(img)))
            seen += 1

    print(f"Validated: {len(records)} images, skipped {skipped} unreadable/corrupt files.")
    return records


def group_duplicates(records: list[ImageRecord]) -> list[list[ImageRecord]]:
    """Group records whose perceptual hash is very close (Hamming distance)."""
    if not records:
        return []
    ordered = sorted(records, key=lambda r: (r.hash, str(r.path)))
    groups: list[list[ImageRecord]] = []
    assigned = [False] * len(ordered)

    for i, rec in enumerate(ordered):
        if assigned[i]:
            continue
        group = [rec]
        assigned[i] = True
        # probe neighbours in a window for near-duplicates
        for j in range(i + 1, min(i + 200, len(ordered))):
            if assigned[j]:
                continue
            if abs(ordered[j].hash - rec.hash) > 2**10 and hamming(ordered[j].hash, rec.hash) > DEDUP_HAMMING_THRESHOLD:
                continue
            if hamming(ordered[j].hash, rec.hash) <= DEDUP_HAMMING_THRESHOLD:
                group.append(ordered[j])
                assigned[j] = True
        groups.append(group)

    dup_saved = sum(len(g) - 1 for g in groups if len(g) > 1)
    print(f"Near-duplicate groups: {sum(1 for g in groups if len(g) > 1)} (redundant copies: {dup_saved})")
    return groups


def assign_splits(groups_by_class: dict[str, list[list[ImageRecord]]]) -> dict[Path, str]:
    """Stratified group-level split. Each duplicate group goes to one split only."""
    split_of: dict[Path, str] = {}
    for class_label, groups in groups_by_class.items():
        random.shuffle(groups)
        total_imgs = sum(len(g) for g in groups)
        goals = {name: int(round(total_imgs * ratio)) for name, ratio in SPLIT_RATIOS.items()}
        counts = {"train": 0, "val": 0, "test": 0}
        order = ["train", "val", "test"]
        for group in groups:
            # pick the split that is the most "in deficit" proportional to its goal
            best = min(order, key=lambda s: (counts[s] / goals[s]) if goals[s] else 1.0)
            counts[best] += len(group)
            for rec in group:
                split_of[rec.path] = best
    return split_of


def write_outputs(records: list[ImageRecord], split_of: dict[Path, str]) -> None:
    class_dirs = {}
    for cls in ("FRESH", "SEMI_FRESH", "ROTTEN"):
        class_dirs[cls] = {
            "processed": PROCESSED_DIR / cls,
            "train": TRAIN_DIR / cls,
            "val": VAL_DIR / cls,
            "test": TEST_DIR / cls,
        }

    for d in class_dirs.values():
        for p in d.values():
            p.mkdir(parents=True, exist_ok=True)

    processed_count = 0
    split_counts = {"train": 0, "val": 0, "test": 0}
    class_counts = {"FRESH": 0, "SEMI_FRESH": 0, "ROTTEN": 0}

    with open(MANIFEST_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source_file", "food_type", "class_label", "split", "output_file"])
        for rec in records:
            split = split_of[rec.path]
            slug = _folder_slug(rec.path.parent.name)
            output_name = f"__{slug}__{rec.path.stem}{rec.path.suffix}"
            # keep processed copy
            dst_proc = class_dirs[rec.class_label]["processed"] / output_name
            dst_split = class_dirs[rec.class_label][split] / output_name
            shutil.copyfile(rec.path, dst_proc)
            shutil.copyfile(rec.path, dst_split)
            processed_count += 1
            split_counts[split] += 1
            class_counts[rec.class_label] += 1
            writer.writerow([str(rec.path), rec.food_type, rec.class_label, split, str(dst_split)])

    summary = {
        "dataset": "AgriFreshNET Freshness and Shelf-Life Image Dataset",
        "classes": {"FRESH": "Fresh", "SEMI_FRESH": "Semi-Fresh", "ROTTEN": "Rotten"},
        "split_ratios": SPLIT_RATIOS,
        "total_images": processed_count,
        "per_split": split_counts,
        "per_class": class_counts,
        "dedup_hamming_threshold": DEDUP_HAMMING_THRESHOLD,
    }
    SPLIT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(SPLIT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("=" * 48)
    print("Dataset Summary")
    print("=" * 48)
    print(f"Total images     : {processed_count}")
    print(f"  Training       : {split_counts['train']}  ({SPLIT_RATIOS['train']*100:.0f}%)")
    print(f"  Validation     : {split_counts['val']}  ({SPLIT_RATIOS['val']*100:.0f}%)")
    print(f"  Testing        : {split_counts['test']}  ({SPLIT_RATIOS['test']*100:.0f}%)")
    print()
    print("Class distribution:")
    for cls in ("FRESH", "SEMI_FRESH", "ROTTEN"):
        print(f"  {cls:12s}: {class_counts[cls]}")
    print(f"Manifest: {MANIFEST_CSV}")
    print(f"Summary : {SPLIT_JSON}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare the AgriFreshNET food freshness dataset.")
    parser.add_argument("--zip", type=str, default=None, help="Optional explicit path to the dataset zip.")
    args = parser.parse_args()

    seed = 42
    random.seed(seed)
    np.random.seed(seed)

    zip_path = None
    if args.zip:
        zip_path = Path(args.zip)
    else:
        if RAW_DIR.exists():
            matches = sorted(RAW_DIR.rglob(DATASET_ZIP_PATTERN))
            if matches:
                zip_path = matches[0]

    try:
        extract_root = resolve_source_root(zip_path)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)

    records = collect_records(extract_root)
    if not records:
        print("[ERROR] No valid images found. Check the dataset zip contents.")
        sys.exit(1)

    groups_by_class: dict[str, list[list[ImageRecord]]] = {
        "FRESH": [], "SEMI_FRESH": [], "ROTTEN": [],
    }
    for group in group_duplicates(records):
        class_label = group[0].class_label
        if class_label in groups_by_class:
            groups_by_class[class_label].append(group)

    split_of = assign_splits(groups_by_class)
    write_outputs(records, split_of)


if __name__ == "__main__":
    main()