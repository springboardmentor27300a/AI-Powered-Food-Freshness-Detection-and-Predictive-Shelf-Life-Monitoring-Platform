import io

import pytest
from PIL import Image

from app.ml.m2_types import CANONICAL_CATEGORIES


def _image_bytes(image_format="JPEG", size=(16, 12), color=(120, 80, 40), mode="RGB"):
    if mode == "L":
        color = 128
    elif mode == "P":
        color = 1
    stream = io.BytesIO()
    Image.new(mode, size, color=color).save(stream, format=image_format)
    return stream.getvalue()


def _request(client, headers, category, payload=None, content_type="image/jpeg", filename="sample.jpg"):
    if payload is None:
        payload = _image_bytes()
    return client.post(
        "/analysis/v2/predict",
        headers=headers,
        data={"declared_category": category},
        files={"file": (filename, payload, content_type)},
    )


@pytest.mark.parametrize(
    "mode,color,image_format",
    [("RGB", (120, 80, 40), "PNG"), ("RGBA", (35, 60, 80, 255), "PNG")],
)
def test_v2_accepts_valid_rgb_and_rejects_unsupported_modes(client, consumer_headers, mode, color, image_format):
    if mode == "RGB":
        payload = _image_bytes(mode=mode, color=color, image_format=image_format)
        response = _request(client, consumer_headers, "Fruits", payload=payload, filename="sample.png", content_type="image/png")
        assert response.status_code == 200
        assert response.json()["assessment_status"] == "not_assessed"
        return

    payload = _image_bytes(mode=mode, color=color, image_format=image_format)
    response = _request(client, consumer_headers, "Fruits", payload=payload, filename="sample.png", content_type="image/png")
    assert response.status_code == 422
    assert "decoded safely" in response.json()["detail"]


@pytest.mark.parametrize(
    "payload, filename, content_type",
    [
        (_image_bytes(image_format="JPEG"), "sample.png", "image/jpeg"),
        (_image_bytes(image_format="PNG"), "sample.jpg", "image/png"),
        (_image_bytes(image_format="JPEG"), "sample.jpg", "image/png"),
        (_image_bytes(image_format="PNG"), "sample.png", "image/jpeg"),
    ],
)
def test_v2_rejects_mime_and_filename_mismatches(client, consumer_headers, payload, filename, content_type):
    response = _request(client, consumer_headers, "Fruits", payload=payload, filename=filename, content_type=content_type)
    assert response.status_code == 415


@pytest.mark.parametrize(
    "payload, content_type, filename",
    [
        (b"", "image/jpeg", "empty.jpg"),
        (b"not an image", "image/jpeg", "broken.jpg"),
        (b"\xff\xd8\xff\x00bad", "image/jpeg", "truncated.jpg"),
        (b"\x89PNG\r\n\x1a\n\x00\x00\x00\x00", "image/png", "invalid.png"),
    ],
)
def test_v2_rejects_empty_malformed_and_truncated_uploads(client, consumer_headers, payload, content_type, filename):
    response = _request(client, consumer_headers, "Fruits", payload=payload, filename=filename, content_type=content_type)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "mode, filename, content_type, payload",
    [
        ("L", "gray.png", "image/png", _image_bytes(mode="L", image_format="PNG")),
        ("P", "palette.png", "image/png", _image_bytes(mode="P", image_format="PNG", color=1)),
        ("CMYK", "cmyk.jpg", "image/jpeg", _image_bytes(mode="CMYK", image_format="JPEG", color=(0, 0, 0, 0))),
        ("RGBA", "alpha.png", "image/png", _image_bytes(mode="RGBA", image_format="PNG", color=(10, 20, 30, 40))),
    ],
)
def test_v2_rejects_unsupported_image_channels(client, consumer_headers, mode, filename, content_type, payload):
    response = _request(client, consumer_headers, "Fruits", payload=payload, filename=filename, content_type=content_type)
    assert response.status_code == 422


def test_v2_rejects_oversized_images_dimensions_and_pixel_limits(client, consumer_headers):
    oversized = b"x" * (10 * 1024 * 1024 + 1)
    response = _request(client, consumer_headers, "Fruits", payload=oversized, filename="oversized.jpg", content_type="image/jpeg")
    assert response.status_code == 413

    big_image = _image_bytes(image_format="PNG", size=(9000, 9000), color=(255, 255, 255), mode="RGB")
    response = _request(client, consumer_headers, "Fruits", payload=big_image, filename="large.png", content_type="image/png")
    assert response.status_code == 422

    dense_image = _image_bytes(image_format="PNG", size=(5001, 5001), color=(100, 100, 100), mode="RGB")
    response = _request(client, consumer_headers, "Fruits", payload=dense_image, filename="dense.png", content_type="image/png")
    assert response.status_code == 422


def test_v2_rejects_decompression_bomb_warnings_and_errors(client, consumer_headers, monkeypatch):
    from app import m2_v2

    def _raise_bomb(*args, **kwargs):
        raise Image.DecompressionBombWarning("bomb")

    monkeypatch.setattr(m2_v2.Image, "open", _raise_bomb)
    response = _request(client, consumer_headers, "Fruits")
    assert response.status_code == 422


def test_v2_rejects_unsupported_formats_and_malformed_multipart(client, consumer_headers):
    response = _request(client, consumer_headers, "Fruits", payload=_image_bytes(image_format="TIFF"), filename="sample.tiff", content_type="image/tiff")
    assert response.status_code == 415

    malformed = client.post(
        "/analysis/v2/predict",
        headers=consumer_headers,
        data={"declared_category": "Fruits"},
    )
    assert malformed.status_code == 422


def test_v2_requires_authentication(client):
    response = _request(client, {}, "Fruits")
    assert response.status_code == 401


def test_v2_capabilities_reports_all_categories_and_blocked_legacy_candidate(client, consumer_headers):
    response = client.get("/analysis/v2/capabilities", headers=consumer_headers)
    assert response.status_code == 200
    body = response.json()
    assert {entry["canonical_category"] for entry in body["categories"]} == set(CANONICAL_CATEGORIES)
    assert {entry["capability_status"] for entry in body["categories"]} == {"not_yet_supported"}
    assert body["legacy_fruit_candidate"]["status"] == "blocked"
    assert body["legacy_fruit_candidate"]["checkpoint_sha256"] == (
        "bb079152c40d298a27fa82744f5ca4603e9d6126e8207031b13689fc74a17add"
    )
    assert {entry["defect_type"] for entry in body["defect_capabilities"]} == {
        "mold", "bruising", "physical_damage"
    }
    assert {entry["capability_status"] for entry in body["defect_capabilities"]} == {"not_yet_supported"}


def test_research_route_is_auth_protected_and_isolated_from_production_v2(client, consumer_headers, monkeypatch):
    from app import m2_v2

    mocked = {
        "assessment_status": "research_assessed",
        "reason": "Development-only result.",
        "result": {"classification": "Fresh", "confidence": 0.91, "quality_score": 90},
    }
    monkeypatch.setattr(m2_v2, "assess_research_fruit", lambda *_: mocked)
    image = _image_bytes()

    unauthenticated = client.post(
        "/analysis/v2/research/fruit/predict",
        data={"food_subtype": "apple"},
        files={"file": ("apple.jpg", image, "image/jpeg")},
    )
    assert unauthenticated.status_code == 401

    response = client.post(
        "/analysis/v2/research/fruit/predict",
        headers=consumer_headers,
        data={"food_subtype": "apple"},
        files={"file": ("apple.jpg", image, "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["assessment_status"] == "research_assessed"
    assert response.json()["declared_food_subtype"] == "apple"

    unsupported = client.post(
        "/analysis/v2/research/fruit/predict",
        headers=consumer_headers,
        data={"food_subtype": "tomato"},
        files={"file": ("tomato.jpg", _image_bytes(), "image/jpeg")},
    )
    assert unsupported.status_code == 422


def test_v2_abstains_for_every_official_category(client, consumer_headers):
    for category in CANONICAL_CATEGORIES:
        response = _request(client, consumer_headers, category)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["assessment_status"] == "not_assessed"
        assert body["category"]["canonical_category"] == category
        assert body["category"]["capability_status"] == "not_yet_supported"
        assert body["freshness"]["status"] == "not_assessed"
        assert body["freshness"]["quality_score"] is None
        assert body["freshness"]["spoilage_probability"] is None
        assert {entry["defect_type"] for entry in body["defects"]} == {
            "mold", "bruising", "physical_damage"
        }
        assert {entry["status"] for entry in body["defects"]} == {"not_assessed"}


def test_unrelated_category_never_falls_back_to_legacy_fruit_model(client, consumer_headers):
    response = _request(client, consumer_headers, "Seafood")
    assert response.status_code == 200
    body = response.json()
    assert body["category"]["canonical_category"] == "Seafood"
    assert body["category"]["model_id"] is None
    assert body["assessment_status"] == "not_assessed"
    assert body["freshness"]["classification"] is None


def test_v2_rejects_unknown_category_and_invalid_uploads(client, consumer_headers):
    unknown = _request(client, consumer_headers, "Prepared Meals")
    assert unknown.status_code == 422

    malformed = _request(client, consumer_headers, "Fruits", b"not an image")
    assert malformed.status_code == 422

    wrong_content_type = _request(
        client, consumer_headers, "Fruits", b"not a PDF", content_type="application/pdf"
    )
    assert wrong_content_type.status_code == 415

    oversized = _request(client, consumer_headers, "Fruits", b"x" * (10 * 1024 * 1024 + 1))
    assert oversized.status_code == 413


def test_v2_returns_uncertain_abstention_for_unreadable_registry(client, consumer_headers, monkeypatch):
    from app import m2_v2
    from app.ml.m2_registry import M2RegistryError

    def bad_registry():
        raise M2RegistryError("test registry failure")

    monkeypatch.setattr(m2_v2, "load_registry", bad_registry)
    response = _request(client, consumer_headers, "Fruits")
    assert response.status_code == 200
    body = response.json()
    assert body["assessment_status"] == "not_assessed"
    assert body["category"]["capability_status"] == "uncertain"
    assert body["freshness"]["quality_score"] is None


def test_legacy_predict_endpoint_remains_registered_and_unchanged(client, consumer_headers):
    response = client.post(
        "/analysis/predict",
        headers=consumer_headers,
        files={"file": ("not-image.pdf", b"data", "application/pdf")},
    )
    assert response.status_code == 415
    assert "JPEG" in response.json()["detail"]

