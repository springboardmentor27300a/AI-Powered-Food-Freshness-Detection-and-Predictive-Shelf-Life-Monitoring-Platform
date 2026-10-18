import json

import pytest

from app.ml.m2_registry import (
    M2RegistryError,
    category_capability,
    get_approved_model_for_category,
    load_registry,
)
from app.ml.m2_types import CANONICAL_CATEGORIES, normalize_category


def test_all_official_categories_are_recognized():
    for category in CANONICAL_CATEGORIES:
        assert normalize_category(category) == category
    assert normalize_category("Meat/Poultry") == "Meat & Poultry"
    assert normalize_category("unknown category") is None


def test_shipped_registry_explicitly_abstains_for_every_category():
    registry = load_registry()
    assert registry["models"] == []
    for category in CANONICAL_CATEGORIES:
        capability = category_capability(category, registry)
        assert capability.status == "not_yet_supported"
        assert capability.model_id is None
        assert get_approved_model_for_category(category, registry) is None


def test_registry_rejects_missing_category_entries(tmp_path):
    path = tmp_path / "bad-registry.json"
    path.write_text(
        json.dumps({"registry_version": "1", "categories": {}, "models": []}),
        encoding="utf-8",
    )
    with pytest.raises(M2RegistryError, match="missing categories"):
        load_registry(path)


def test_incomplete_model_approval_can_never_mark_category_supported():
    registry = load_registry()
    registry["categories"]["Vegetables"] = {
        "capability_status": "supported",
        "reason": "Test model entry",
        "model_id": "unapproved-test-model",
    }
    registry["models"] = [{
        "model_id": "unapproved-test-model",
        "approval_status": "draft",
        "categories": ["Vegetables"],
        "data_rights": {"status": "unverified"},
        "evaluation": {"status": "pending"},
    }]

    assert get_approved_model_for_category("Vegetables", registry) is None
    capability = category_capability("Vegetables", registry)
    assert capability.status == "not_yet_supported"
    assert capability.model_id is None

