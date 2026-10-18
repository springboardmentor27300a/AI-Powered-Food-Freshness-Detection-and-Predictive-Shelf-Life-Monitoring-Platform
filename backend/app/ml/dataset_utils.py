"""
dataset_utils.py — FreshGuard M2
Dynamically discovers all class folders from the dataset root,
creates train/validation/test splits, and defines image transforms.
"""

import os
import json
import random
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
IMG_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ---------------------------------------------------------------------------
# Class Discovery
# ---------------------------------------------------------------------------

def discover_classes(dataset_root: str) -> Dict[str, List[str]]:
    """
    Automatically scan dataset_root for subdirectories.
    Each subdirectory is treated as a class label.
    Returns dict: {class_name: [list of absolute image paths]}

    The dataset_root may already be split (train/ test/ folders) or flat.
    This function handles both cases.
    """
    root = Path(dataset_root)
    if not root.exists():
        raise FileNotFoundError(
            f"Dataset root not found: {dataset_root}\n"
            f"Please place the extracted Kaggle dataset at this path."
        )

    class_map: Dict[str, List[str]] = {}

    # Check if root has a recognized split structure (train/ test/ valid/ etc.)
    split_folders = {"train", "test", "valid", "validation", "val"}
    top_children = [d for d in root.iterdir() if d.is_dir()]
    top_names = {d.name.lower() for d in top_children}

    if top_names & split_folders:
        # Dataset already has split subdirectories; gather from all of them
        for split_dir in top_children:
            for class_dir in split_dir.iterdir():
                if not class_dir.is_dir():
                    continue
                cls = class_dir.name
                imgs = _collect_images(class_dir)
                if imgs:
                    class_map.setdefault(cls, []).extend(imgs)
    else:
        # Flat structure: each top-level subfolder is a class
        for class_dir in top_children:
            if not class_dir.is_dir():
                continue
            imgs = _collect_images(class_dir)
            if imgs:
                class_map[class_dir.name] = imgs

    if not class_map:
        raise ValueError(
            f"No image classes found in: {dataset_root}\n"
            f"Expected subdirectories containing image files."
        )

    return class_map


def _collect_images(directory: Path) -> List[str]:
    """Recursively collect image file paths from a directory."""
    images = []
    for f in directory.rglob("*"):
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
            images.append(str(f))
    return images


# ---------------------------------------------------------------------------
# Dataset Summary
# ---------------------------------------------------------------------------

def summarize_dataset(class_map: Dict[str, List[str]]) -> Dict:
    """Print and return a structured summary of the discovered dataset."""
    summary = {
        "total_classes": len(class_map),
        "total_images": sum(len(v) for v in class_map.values()),
        "classes": {}
    }
    print("=" * 60)
    print("  FRESHGUARD — DATASET STRUCTURE INSPECTION")
    print("=" * 60)
    print(f"  Classes detected: {summary['total_classes']}")
    print(f"  Total images:     {summary['total_images']}")
    print("-" * 60)
    for cls, paths in sorted(class_map.items()):
        count = len(paths)
        summary["classes"][cls] = count
        print(f"  {cls:<30} {count:>6} images")
    print("=" * 60)
    return summary


# ---------------------------------------------------------------------------
# Train / Validation / Test Splits
# ---------------------------------------------------------------------------

def create_splits(
    class_map: Dict[str, List[str]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    seed: int = 42,
) -> Tuple[
    List[Tuple[str, int]],
    List[Tuple[str, int]],
    List[Tuple[str, int]],
    Dict[str, int],
]:
    """
    Stratified split across all classes.
    Returns train, validation, test samples, and the class-to-index mapping.
    Class indices are sorted alphabetically for reproducibility.
    """
    classes = sorted(class_map.keys())
    class_to_idx = {cls: idx for idx, cls in enumerate(classes)}

    train_set, val_set, test_set = [], [], []

    rng = random.Random(seed)
    for cls, paths in class_map.items():
        paths = paths.copy()
        rng.shuffle(paths)
        idx = class_to_idx[cls]

        n = len(paths)
        n_train = max(1, int(n * train_ratio))
        n_val = max(1, int(n * val_ratio))

        train_set.extend((p, idx) for p in paths[:n_train])
        val_set.extend((p, idx) for p in paths[n_train:n_train + n_val])
        test_set.extend((p, idx) for p in paths[n_train + n_val:])

    print(f"\n  Split summary:")
    print(f"    Train : {len(train_set):>6} samples")
    print(f"    Val   : {len(val_set):>6} samples")
    print(f"    Test  : {len(test_set):>6} samples")

    return train_set, val_set, test_set, class_to_idx


# ---------------------------------------------------------------------------
# PyTorch Dataset & DataLoaders (only if torch is available)
# ---------------------------------------------------------------------------

def build_dataloaders(
    train_set, val_set, test_set, batch_size: int = 32, num_workers: int = 0
):
    """
    Build PyTorch DataLoaders. Import is deferred so that the utility
    functions above can be used without torch installed (e.g. in unit tests).
    """
    try:
        import torch
        from torch.utils.data import Dataset, DataLoader
        from torchvision import transforms
        from PIL import Image
    except ImportError as e:
        raise ImportError(
            "PyTorch and torchvision are required for training. "
            "Run: pip install torch torchvision pillow"
        ) from e

    train_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
        transforms.RandomGrayscale(p=0.05),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    class FreshnessDataset(Dataset):
        def __init__(self, samples, transform):
            self.samples = samples
            self.transform = transform

        def __len__(self):
            return len(self.samples)

        def __getitem__(self, i):
            path, label = self.samples[i]
            img = Image.open(path).convert("RGB")
            return self.transform(img), label

    train_loader = DataLoader(
        FreshnessDataset(train_set, train_transform),
        batch_size=batch_size, shuffle=True, num_workers=num_workers, pin_memory=False
    )
    val_loader = DataLoader(
        FreshnessDataset(val_set, val_transform),
        batch_size=batch_size, shuffle=False, num_workers=num_workers
    )
    test_loader = DataLoader(
        FreshnessDataset(test_set, val_transform),
        batch_size=batch_size, shuffle=False, num_workers=num_workers
    )

    return train_loader, val_loader, test_loader


# ---------------------------------------------------------------------------
# Entry point: run directly to inspect a dataset
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "dataset"
    class_map = discover_classes(dataset_path)
    summary = summarize_dataset(class_map)
    _, _, _, class_to_idx = create_splits(class_map)
    print(f"\n  Class → Index mapping:")
    for cls, idx in class_to_idx.items():
        print(f"    [{idx}] {cls}")
