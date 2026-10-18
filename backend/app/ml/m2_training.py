"""M2-only data admission and group-aware split helpers.

This module intentionally has no training command and no default output path.
It prevents accidental use of legacy fruit data or protected M3 assets until a
caller supplies a governed image manifest and an explicit new output location.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from random import Random
from typing import Iterable


@dataclass(frozen=True)
class M2ImageRecord:
    image_id: str
    sha256: str
    group_id: str
    label: str
    category: str
    subtype: str
    rights_status: str
    license: str


def validate_training_records(records: Iterable[M2ImageRecord]) -> list[M2ImageRecord]:
    """Require traceability and verified commercial training rights per image."""

    accepted = list(records)
    if not accepted:
        raise ValueError("No M2 image records were supplied.")
    seen_images: set[str] = set()
    for record in accepted:
        if not all((record.image_id, record.sha256, record.group_id, record.label, record.category, record.subtype, record.license)):
            raise ValueError("Each M2 image record requires identity, group, label, scope, and license fields.")
        if record.rights_status != "verified_commercial_training":
            raise ValueError(f"Image {record.image_id} lacks verified commercial training rights.")
        if len(record.sha256) != 64 or any(char not in "0123456789abcdef" for char in record.sha256.lower()):
            raise ValueError(f"Image {record.image_id} has an invalid SHA-256.")
        if record.image_id in seen_images:
            raise ValueError(f"Duplicate image_id: {record.image_id}")
        seen_images.add(record.image_id)
    return accepted


def grouped_split(
    records: Iterable[M2ImageRecord],
    train_fraction: float = 0.70,
    validation_fraction: float = 0.15,
    seed: int = 42,
) -> dict[str, list[M2ImageRecord]]:
    """Assign whole physical-item/capture groups to train/validation/test sets."""

    rows = validate_training_records(records)
    if not 0 < train_fraction < 1 or not 0 < validation_fraction < 1 or train_fraction + validation_fraction >= 1:
        raise ValueError("Split fractions must be positive and leave a test fraction.")
    groups: dict[str, list[M2ImageRecord]] = {}
    for row in rows:
        groups.setdefault(row.group_id, []).append(row)
    group_ids = list(groups)
    Random(seed).shuffle(group_ids)
    train_cutoff = round(len(group_ids) * train_fraction)
    validation_cutoff = train_cutoff + round(len(group_ids) * validation_fraction)
    assignments = {"train": group_ids[:train_cutoff], "validation": group_ids[train_cutoff:validation_cutoff], "test": group_ids[validation_cutoff:]}
    return {name: [row for group_id in ids for row in groups[group_id]] for name, ids in assignments.items()}


def split_manifest_sha256(splits: dict[str, list[M2ImageRecord]]) -> str:
    """Return a stable fingerprint of the supplied split assignment."""

    parts = []
    for split in sorted(splits):
        parts.extend(f"{split}:{row.image_id}:{row.group_id}:{row.sha256}" for row in sorted(splits[split], key=lambda item: item.image_id))
    return sha256("\n".join(parts).encode("utf-8")).hexdigest()
