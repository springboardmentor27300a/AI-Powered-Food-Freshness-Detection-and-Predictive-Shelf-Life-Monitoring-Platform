"""
app/services/scoring_service.py

Implements the project-approved weighted scoring model:
    Freshness Score = Visual Condition Analysis 40%
                     + Storage Conditions       25%
                     + Shelf-Life Prediction    20%
                     + Product Age              15%

Each component is normalized to 0-100 before weighting. Full method is
documented inline below and in docs/ARCHITECTURE.md.
"""
from dataclasses import dataclass

WEIGHTS = {"visual": 0.40, "storage": 0.25, "shelf_life": 0.20, "product_age": 0.15}

CATEGORY_THRESHOLDS = [
    (90, "fresh"),
    (75, "good"),
    (55, "acceptable"),
    (30, "near_spoilage"),
    (0, "spoiled"),
]


@dataclass
class FreshnessScoreResult:
    visual_component_score: float
    storage_component_score: float
    shelf_life_component_score: float
    product_age_component_score: float
    freshness_score: float
    freshness_category: str
    spoilage_probability_pct: float


def _category_for_score(score: float) -> str:
    for threshold, label in CATEGORY_THRESHOLDS:
        if score >= threshold:
            return label
    return "spoiled"


def visual_component(overall_visual_score: float, cnn_predicted_class: str | None,
                      cnn_confidence: float | None) -> float:
    """
    Visual component blends the real OpenCV visual score with the real CNN
    prediction when the CNN is available (50/50); falls back to OpenCV
    alone if the CNN is unavailable, so this component is NEVER faked.
    """
    if cnn_predicted_class is not None and cnn_confidence is not None:
        # CNN outputs P(class). Convert "rotten"-leaning confidence into a
        # 0-100 freshness-direction score: predicted 'fresh' with high
        # confidence -> high score; predicted 'rotten' with high confidence -> low score.
        if cnn_predicted_class == "rotten":
            cnn_score = (1 - cnn_confidence) * 100
        else:
            cnn_score = cnn_confidence * 100
        return round((overall_visual_score * 0.5) + (cnn_score * 0.5), 2)
    return round(overall_visual_score, 2)


def storage_component(temperature_factor: float | None, humidity_factor: float | None,
                       is_compliant: bool | None) -> float:
    """
    Derived from how close actual storage conditions are to ideal (the same
    temperature/humidity factors computed by shelf_life_service), plus a
    flat penalty if the latest reading was flagged non-compliant.
    """
    if temperature_factor is None or humidity_factor is None:
        return 65.0  # neutral default when no storage reading exists yet
    # factors are typically in a ~0.3-2.0 range around 1.0 = ideal
    closeness = 1 - min(abs(temperature_factor - 1.0), 1.0)
    closeness2 = 1 - min(abs(humidity_factor - 1.0), 1.0)
    score = ((closeness + closeness2) / 2) * 100
    if is_compliant is False:
        score = max(0.0, score - 25)
    return round(max(0.0, min(100.0, score)), 2)


def shelf_life_component(estimated_days_remaining: float, category_baseline_days: float) -> float:
    if category_baseline_days <= 0:
        return 50.0
    ratio = max(0.0, min(1.5, estimated_days_remaining / category_baseline_days))
    return round(min(100.0, ratio * 100), 2)


def product_age_component(product_age_days: float, category_baseline_days: float) -> float:
    if category_baseline_days <= 0:
        return 50.0
    ratio = max(0.0, 1 - (product_age_days / category_baseline_days))
    return round(max(0.0, min(100.0, ratio * 100)), 2)


def compute_freshness_score(
    overall_visual_score: float,
    cnn_predicted_class: str | None,
    cnn_confidence: float | None,
    temperature_factor: float | None,
    humidity_factor: float | None,
    is_storage_compliant: bool | None,
    estimated_days_remaining: float,
    category_baseline_days: float,
    product_age_days: float,
) -> FreshnessScoreResult:
    visual = visual_component(overall_visual_score, cnn_predicted_class, cnn_confidence)
    storage = storage_component(temperature_factor, humidity_factor, is_storage_compliant)
    shelf_life = shelf_life_component(estimated_days_remaining, category_baseline_days)
    age = product_age_component(product_age_days, category_baseline_days)

    total = (
        visual * WEIGHTS["visual"]
        + storage * WEIGHTS["storage"]
        + shelf_life * WEIGHTS["shelf_life"]
        + age * WEIGHTS["product_age"]
    )
    total = round(total, 2)
    category = _category_for_score(total)

    # Spoilage probability: blend CNN's rotten-probability (if available)
    # with the inverse of the overall score, so it's grounded in real
    # signals rather than a separate invented number.
    inverse_score_spoilage = 100 - total
    if cnn_predicted_class == "rotten" and cnn_confidence is not None:
        spoilage = (cnn_confidence * 100 * 0.6) + (inverse_score_spoilage * 0.4)
    elif cnn_predicted_class == "fresh" and cnn_confidence is not None:
        spoilage = ((1 - cnn_confidence) * 100 * 0.6) + (inverse_score_spoilage * 0.4)
    else:
        spoilage = inverse_score_spoilage
    spoilage = round(max(0.0, min(100.0, spoilage)), 2)

    return FreshnessScoreResult(
        visual_component_score=visual,
        storage_component_score=storage,
        shelf_life_component_score=shelf_life,
        product_age_component_score=age,
        freshness_score=total,
        freshness_category=category,
        spoilage_probability_pct=spoilage,
    )
