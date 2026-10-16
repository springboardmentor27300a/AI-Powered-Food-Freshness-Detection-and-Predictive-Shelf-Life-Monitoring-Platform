from services.storage_monitoring import analyze_storage_conditions
from services.shelf_life_prediction import predict_shelf_life
from services.recommendation_engine import generate_recommendations


def test_storage_compliance_shape():
    result = analyze_storage_conditions("apple", 3, 88, "moderate", "low")
    assert result["storage_compliance_score"] == 100
    assert result["temperature"]["status"] == "Optimal"


def test_shelf_life_prediction_has_forecast():
    result = predict_shelf_life("apple", 80, 3, 88, 1, "sealed", "moderate", "low")
    assert result["remaining_shelf_life_days"] >= 0
    assert result["predicted_expiry_date"]
    assert 0 <= result["spoilage_probability"] <= 100


def test_recommendations_cover_required_categories():
    result = generate_recommendations("apple", 2, 40, "Optimal", "Optimal", "Suitable", "Suitable", "1 - 4 C", "80 - 95%", "tomorrow")
    for key in ["storage_recommendations", "consumption_recommendations", "waste_reduction_recommendations", "quality_improvement_recommendations", "overall_action"]:
        assert key in result
