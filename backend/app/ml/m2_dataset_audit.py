"""Read-only lineage and duplicate audit for M2 image datasets."""

from __future__ import annotations

from collections import defaultdict
from hashlib import sha256
from pathlib import Path
import re


_IMAGE_SUFFIXES = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}
_AUGMENTATION_PREFIX = re.compile(
    r"^(?:(?:rotated_by_\d+|vertical_flip|horizontal_flip|flip|rotated)_)+",
    flags=re.IGNORECASE,
)


def normalized_lineage_name(filename: str) -> str:
    """Strip common augmentation prefixes from a filename stem."""

    return _AUGMENTATION_PREFIX.sub("", Path(filename).stem).casefold()


def audit_image_dataset(root: str | Path, include_content_hashes: bool = False) -> dict:
    """Return split/class counts and potential lineage leakage without mutation.

    Expected layout is ``root/<split>/<label>/<image>``.  A normalized lineage
    name is a conservative warning signal, not a claim that two images are the
    same physical item.  Exact file hashes are reported separately when enabled.
    """

    root_path = Path(root)
    if not root_path.is_dir():
        raise ValueError(f"Dataset directory does not exist: {root_path}")

    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    lineages: dict[tuple[str, str], set[str]] = defaultdict(set)
    hashes: dict[str, set[str]] = defaultdict(set)
    image_count = 0
    transformed_count = 0

    for path in sorted(root_path.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in _IMAGE_SUFFIXES:
            continue
        relative = path.relative_to(root_path).parts
        if len(relative) < 3:
            continue
        split, label = relative[0], relative[1]
        image_count += 1
        counts[split][label] += 1
        lineage = normalized_lineage_name(path.name)
        if lineage != path.stem.casefold():
            transformed_count += 1
        lineages[(label, lineage)].add(split)
        if include_content_hashes:
            digest = sha256(path.read_bytes()).hexdigest()
            hashes[digest].add(split)

    cross_split_lineages = sum(1 for splits in lineages.values() if len(splits) > 1)
    exact_cross_split_duplicates = sum(1 for splits in hashes.values() if len(splits) > 1)
    return {
        "image_count": image_count,
        "split_class_counts": {split: dict(labels) for split, labels in sorted(counts.items())},
        "transformed_filename_count": transformed_count,
        "cross_split_normalized_lineage_count": cross_split_lineages,
        "exact_cross_split_duplicate_count": exact_cross_split_duplicates if include_content_hashes else None,
        "content_hashes_checked": include_content_hashes,
    }
