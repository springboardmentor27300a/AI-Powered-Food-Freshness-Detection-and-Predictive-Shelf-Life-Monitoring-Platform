from app.ml.m2_evaluation import EvaluationExample, evaluate_classification, select_confidence_threshold
from app.ml.m2_inference import confidence_is_sufficient
from app.ml.m2_registry import has_complete_approval_evidence
from app.ml.m2_training import M2ImageRecord, grouped_split, split_manifest_sha256, validate_training_records


def _record(image_id: str, group_id: str, label: str = "fresh") -> M2ImageRecord:
    return M2ImageRecord(
        image_id=image_id,
        sha256=("a" if image_id.endswith("1") else "b") * 64,
        group_id=group_id,
        label=label,
        category="Fruits",
        subtype="apple",
        rights_status="verified_commercial_training",
        license="Owned image agreement v1",
    )


def test_grouped_splits_keep_related_images_together_and_are_reproducible():
    records = [_record("image-1", "apple-a"), _record("image-2", "apple-a"), _record("image-3", "apple-b"), _record("image-4", "apple-c")]
    first = grouped_split(records, seed=7)
    second = grouped_split(records, seed=7)
    memberships = {
        record.group_id: split
        for split, values in first.items()
        for record in values
    }
    assert memberships["apple-a"] in {"train", "validation", "test"}
    assert [split for split, values in first.items() if any(item.group_id == "apple-a" for item in values)] == [memberships["apple-a"]]
    assert split_manifest_sha256(first) == split_manifest_sha256(second)


def test_training_records_reject_unverified_rights():
    record = _record("image-1", "apple-a")
    invalid = M2ImageRecord(**{**record.__dict__, "rights_status": "unverified"})
    try:
        validate_training_records([invalid])
    except ValueError as exc:
        assert "verified commercial" in str(exc)
    else:
        raise AssertionError("Unverified image rights must block M2 training admission")


def test_evaluation_metrics_and_confidence_gate_use_observed_predictions():
    examples = [
        EvaluationExample("fresh", "fresh", 0.95),
        EvaluationExample("fresh", "rotten", 0.80),
        EvaluationExample("rotten", "rotten", 0.90),
    ]
    report = evaluate_classification(examples, bins=2)
    assert report["sample_count"] == 3
    assert report["accuracy"] == 2 / 3
    assert report["labels"]["fresh"]["support"] == 2
    assert select_confidence_threshold(examples, minimum_precision=1.0) == 0.9
    assert confidence_is_sufficient(0.9, 0.9)
    assert not confidence_is_sufficient(0.89, 0.9)


def test_model_approval_requires_complete_provenance_checksum_and_evaluation_evidence():
    model = {
        "approval_status": "approved",
        "categories": ["Fruits"],
        "supported_subtypes": ["apple"],
        "data_rights": {"status": "verified", "commercial_training": True, "commercial_deployment": True},
        "data_provenance": {
            "dataset_id": "owned-apples", "dataset_version": "1", "license": "owned",
            "manifest_sha256": "a" * 64, "group_split_manifest_sha256": "b" * 64,
        },
        "artifact": {"relative_path": "apple.pt", "sha256": "c" * 64},
        "evaluation": {
            "status": "accepted", "evaluation_id": "apple-v1", "report_sha256": "d" * 64,
            "independent_test": {"status": "passed"},
            "calibration": {"confidence_threshold": 0.85},
        },
    }
    assert has_complete_approval_evidence(model, "Fruits", "apple")
    assert not has_complete_approval_evidence(model, "Fruits", "banana")
    model["artifact"]["sha256"] = "not-a-checksum"
    assert not has_complete_approval_evidence(model, "Fruits", "apple")
