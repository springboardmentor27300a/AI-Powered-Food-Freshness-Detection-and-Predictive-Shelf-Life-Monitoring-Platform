"""
Freshness scoring - combines the heuristic computer-vision measurements
from app/core/image_processing.py into:

  - a single 0-100 freshness score
  - one of 5 freshness categories (Fresh / Good / Acceptable /
    Near Spoilage / Spoiled)
  - a spoilage probability (0.0-1.0)
  - a short, human-readable quality assessment sentence

Like image_processing.py, this is a fixed, hand-written formula - not
a trained/learned model. The weights and thresholds below are simple
constants, tuned by inspection, and are easy to adjust in one place if
real-world testing shows they need calibration.
"""
from dataclasses import dataclass

from app.core.image_processing import ColorAnalysis, TextureAnalysis, SpoilageIndicators
from app.models.freshness_assessment import FreshnessCategory

# Weights for combining the three signal groups into one score.
COLOR_WEIGHT = 0.40
TEXTURE_WEIGHT = 0.30
SPOILAGE_WEIGHT = 0.30

# Score thresholds for mapping the 0-100 score to a category.
CATEGORY_THRESHOLDS = (
    (90, FreshnessCategory.FRESH),
    (75, FreshnessCategory.GOOD),
    (55, FreshnessCategory.ACCEPTABLE),
    (30, FreshnessCategory.NEAR_SPOILAGE),
    (0, FreshnessCategory.SPOILED),
)


@dataclass
class ScoringResult:
    freshness_score: int
    freshness_category: FreshnessCategory
    spoilage_probability: float
    quality_assessment: str


def _category_for_score(score: float) -> FreshnessCategory:
    for threshold, category in CATEGORY_THRESHOLDS:
        if score >= threshold:
            return category
    return FreshnessCategory.SPOILED


def _build_quality_assessment_text(
    color: ColorAnalysis,
    texture: TextureAnalysis,
    spoilage: SpoilageIndicators,
    category: FreshnessCategory,
) -> str:
    """Builds a short, human-readable summary sentence for the report."""
    notes = []

    if color.degradation_level != "none":
        notes.append(f"{color.degradation_level} color degradation")
    if texture.texture_change_level != "none":
        notes.append(f"{texture.texture_change_level} surface texture changes")
    if spoilage.mold_detected:
        notes.append("possible mold detected")
    if spoilage.bruising_detected:
        notes.append("possible bruising detected")
    if spoilage.physical_damage_detected:
        notes.append("possible physical damage detected")

    category_labels = {
        FreshnessCategory.FRESH: "Item appears fresh",
        FreshnessCategory.GOOD: "Item appears in good condition",
        FreshnessCategory.ACCEPTABLE: "Item appears acceptable but showing early signs of aging",
        FreshnessCategory.NEAR_SPOILAGE: "Item shows meaningful signs of nearing spoilage",
        FreshnessCategory.SPOILED: "Item shows strong signs of spoilage",
    }
    summary = category_labels[category]

    if notes:
        summary += ": " + ", ".join(notes) + "."
    else:
        summary += " with no notable visual concerns."

    return summary


def calculate_freshness(
    color: ColorAnalysis,
    texture: TextureAnalysis,
    spoilage: SpoilageIndicators,
) -> ScoringResult:
    """
    Combine color, texture, and spoilage-indicator results into a
    final freshness score, category, spoilage probability, and a
    short human-readable quality assessment.
    """
    spoilage_penalty = max(
        spoilage.mold_confidence,
        spoilage.bruising_confidence,
        spoilage.physical_damage_confidence,
    ) * 100.0

    raw_score = (
        COLOR_WEIGHT * color.color_score
        + TEXTURE_WEIGHT * texture.texture_score
        + SPOILAGE_WEIGHT * (100.0 - spoilage_penalty)
    )
    freshness_score = int(round(max(0.0, min(100.0, raw_score))))

    category = _category_for_score(freshness_score)
    spoilage_probability = round(spoilage_penalty / 100.0, 2)

    quality_assessment = _build_quality_assessment_text(color, texture, spoilage, category)

    return ScoringResult(
        freshness_score=freshness_score,
        freshness_category=category,
        spoilage_probability=spoilage_probability,
        quality_assessment=quality_assessment,
    )


def determine_trend_direction(scores_newest_first: list) -> str:
    """
    Freshness trend analysis, based ONLY on real stored scores for one
    inventory item (never fabricated/simulated data).

    Compares the two most recent assessments:
      - "insufficient_data" if fewer than 2 assessments exist
      - "declining" if the score dropped
      - "improving" if the score rose
      - "stable" if unchanged
    """
    if len(scores_newest_first) < 2:
        return "insufficient_data"

    latest, previous = scores_newest_first[0], scores_newest_first[1]
    if latest < previous:
        return "declining"
    if latest > previous:
        return "improving"
    return "stable"
