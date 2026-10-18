import io

import pytest
from PIL import Image

from app.ml.m2_scoring import FRESHNESS_CLASSES, score_freshness_probabilities


def _image_bytes():
    stream = io.BytesIO()
    Image.new("RGB", (24, 18), color=(132, 94, 62)).save(stream, format="JPEG")
    return stream.getvalue()


def _predict(client, headers, category="Fruits", extra_data=None):
    data = {"declared_category": category, **(extra_data or {})}
    return client.post(
        "/analysis/v2/predict",
        headers=headers,
        data=data,
        files={"file": ("food.jpg", _image_bytes(), "image/jpeg")},
    )


def test_v2_persists_abstention_and_returns_visual_metrics_history_and_trends(client, consumer_headers):
    response = _predict(client, consumer_headers, extra_data={"item_name": "Test produce"})
    assert response.status_code == 200
    result = response.json()
    assert result["id"] > 0
    assert result["assessment_status"] == "not_assessed"
    assert result["freshness"]["classification"] is None
    assert result["freshness"]["quality_score"] is None
    assert result["freshness"]["spoilage_probability"] is None
    assert result["visual_analysis"]["color"]["dominant_color_rgb"]
    assert 0.0 <= result["visual_analysis"]["color"]["discoloration_index"] <= 1.0
    assert 0.0 <= result["visual_analysis"]["texture"]["texture_uniformity"] <= 1.0

    history = client.get("/analysis/v2/history", headers=consumer_headers)
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["id"] == result["id"]
    assert history.json()[0]["item_name"] == "Test produce"
    assert history.json()[0]["assessment_status"] == "not_assessed"

    trends = client.get("/analysis/v2/trends?days=30", headers=consumer_headers)
    assert trends.status_code == 200
    trend = trends.json()
    assert trend["assessment_count"] == 1
    assert trend["assessed_count"] == 0
    assert trend["points"][0]["assessment_count"] == 1
    assert trend["points"][0]["average_quality_score"] is None
    assert trend["points"][0]["average_spoilage_probability"] is None

    report = client.get(f"/analysis/v2/{result['id']}/report", headers=consumer_headers)
    assert report.status_code == 200
    assert report.headers["content-type"] == "application/pdf"
    assert report.content.startswith(b"%PDF")


def test_v2_history_and_reports_are_isolated_by_user(client, consumer_headers, retail_manager_headers):
    response = _predict(client, consumer_headers)
    assert response.status_code == 200
    analysis_id = response.json()["id"]

    assert client.get("/analysis/v2/history", headers=retail_manager_headers).json() == []
    assert client.get(
        f"/analysis/v2/{analysis_id}/report",
        headers=retail_manager_headers,
    ).status_code == 404
    assert client.get("/analysis/v2/history").status_code == 401
    assert client.get("/analysis/v2/trends", headers=retail_manager_headers).status_code == 200


@pytest.mark.parametrize("defect_type", ["mold", "bruising"])
def test_dedicated_defect_workflows_validate_capture_and_abstain(client, consumer_headers, defect_type):
    response = client.post(
        f"/analysis/v2/defects/{defect_type}/predict",
        headers=consumer_headers,
        data={"declared_category": "Fruits"},
        files={"file": ("food.jpg", _image_bytes(), "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["defect_type"] == defect_type
    assert response.json()["status"] == "not_assessed"
    assert response.json()["capture_guidance"]


def test_physical_damage_requires_surface_and_keeps_package_separate(client, consumer_headers):
    path = "/analysis/v2/defects/physical_damage/predict"
    payload = {"file": ("food.jpg", _image_bytes(), "image/jpeg")}
    missing_surface = client.post(
        path,
        headers=consumer_headers,
        data={"declared_category": "Packaged Foods"},
        files=payload,
    )
    assert missing_surface.status_code == 422

    package_result = client.post(
        path,
        headers=consumer_headers,
        data={"declared_category": "Packaged Foods", "target_surface": "package"},
        files=payload,
    )
    assert package_result.status_code == 200
    assert package_result.json()["status"] == "not_assessed"
    assert package_result.json()["target_surface"] == "package"
    assert "separate" in package_result.json()["capture_guidance"]

    food_result = client.post(
        path,
        headers=consumer_headers,
        data={"declared_category": "Fruits", "target_surface": "food_surface"},
        files=payload,
    )
    assert food_result.status_code == 200
    assert food_result.json()["target_surface"] == "food_surface"
    assert "packaging damage" in food_result.json()["capture_guidance"]


def test_freshness_scoring_requires_five_normalized_class_probabilities():
    scores = {
        "Fresh": 0.5,
        "Good": 0.2,
        "Acceptable": 0.1,
        "Near Spoilage": 0.1,
        "Spoiled": 0.1,
    }
    quality_score, spoilage_probability = score_freshness_probabilities(scores)
    assert 0 <= quality_score <= 100
    assert spoilage_probability == pytest.approx(0.2)
    assert set(scores) == set(FRESHNESS_CLASSES)
    with pytest.raises(ValueError, match="All five"):
        score_freshness_probabilities({"Fresh": 1.0})
    with pytest.raises(ValueError, match="sum to 1"):
        score_freshness_probabilities({**scores, "Spoiled": 0.5})
