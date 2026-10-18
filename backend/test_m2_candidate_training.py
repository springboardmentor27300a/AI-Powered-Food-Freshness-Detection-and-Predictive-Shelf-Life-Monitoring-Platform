import hashlib
import json

import pytest

from app.ml.train_m2_candidate import _load_manifest


def test_candidate_training_requires_archived_authoritative_license_evidence(tmp_path):
    evidence = tmp_path / "license-evidence.txt"
    evidence.write_text("Archived authoritative license evidence.", encoding="utf-8")
    manifest = {
        "dataset_id": "test-dataset",
        "dataset_version": "1",
        "source": {
            "source_url": "https://example.invalid/dataset",
            "license": "Test license",
            "attribution": "Test attribution",
            "allowed_use": "Commercial training and deployment",
            "authoritative_license_url": "https://example.invalid/license",
            "license_evidence_path": evidence.name,
            "license_evidence_sha256": hashlib.sha256(evidence.read_bytes()).hexdigest(),
        },
        "records": [],
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ValueError, match="all five official freshness labels"):
        _load_manifest(manifest_path, "Fruits", "apple")

    manifest["source"]["license_evidence_sha256"] = "0" * 64
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="SHA-256 does not match"):
        _load_manifest(manifest_path, "Fruits", "apple")
