from pathlib import Path

from app.ml.m2_dataset_audit import audit_image_dataset, normalized_lineage_name


def _write_image_like_file(root: Path, split: str, label: str, name: str, content: bytes):
    path = root / split / label / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_normalized_lineage_name_strips_known_augmentation_prefixes():
    assert normalized_lineage_name("rotated_by_15_vertical_flip_Source Image.png") == "source image"
    assert normalized_lineage_name("Source Image.png") == "source image"


def test_audit_detects_transformed_lineage_and_exact_cross_split_duplicate(tmp_path):
    _write_image_like_file(tmp_path, "train", "freshapples", "Source Image.png", b"same")
    _write_image_like_file(tmp_path, "test", "freshapples", "rotated_by_15_Source Image.png", b"different")
    _write_image_like_file(tmp_path, "test", "freshbanana", "copy.png", b"same")

    audit = audit_image_dataset(tmp_path, include_content_hashes=True)

    assert audit["image_count"] == 3
    assert audit["split_class_counts"]["train"]["freshapples"] == 1
    assert audit["transformed_filename_count"] == 1
    assert audit["cross_split_normalized_lineage_count"] == 1
    assert audit["exact_cross_split_duplicate_count"] == 1
