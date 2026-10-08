"""
Freshness report generator.

Combines image analysis results, inventory data, and spoilage detection
into comprehensive freshness reports.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.ml.freshness_scorer import FreshnessAssessment
from app.ml.spoilage_detector import SpoilageDetectionResult


@dataclass
class FreshnessReport:
    report_id: str
    batch_id: Optional[str]
    food_name: str
    food_category: Optional[str]
    generated_at: str

    # Freshness assessment
    classification: str
    confidence_score: float
    freshness_score: float
    image_quality_score: float

    # Individual scores
    color_score: float
    texture_score: float
    mold_risk: float
    bruise_risk: float
    damage_risk: float

    # Status labels
    color_status: str
    texture_status: str
    mold_indicator: str
    bruise_severity: str
    damage_severity: str

    # Spoilage
    spoilage_detected: bool
    spoilage_probability: float
    risk_level: str
    spoilage_types: list[str]
    spoilage_indicators: list[dict]

    # Recommendations
    recommended_action: str
    estimated_shelf_life_days: Optional[int]

    # Detailed analysis
    analysis_details: dict

    # Inventory context
    days_to_expiry: Optional[int] = None
    inventory_freshness_status: Optional[str] = None


class FreshnessReportGenerator:
    """Generates structured freshness reports from analysis results."""

    def generate(
        self,
        assessment: FreshnessAssessment,
        spoilage: SpoilageDetectionResult,
        batch_id: Optional[str] = None,
        food_name: str = "Unknown Food",
        food_category: Optional[str] = None,
        days_to_expiry: Optional[int] = None,
        inventory_freshness_status: Optional[str] = None,
    ) -> FreshnessReport:
        report_id = f"FR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{abs(hash(food_name)) % 10000:04d}"

        # Merge spoilage indicators into details
        details = assessment.details.copy()
        details["spoilage_detection"] = {
            "overall_probability": spoilage.overall_spoilage_probability,
            "risk_level": spoilage.risk_level,
            "types": spoilage.spoilage_types,
            "summary": spoilage.summary,
        }

        return FreshnessReport(
            report_id=report_id,
            batch_id=batch_id,
            food_name=food_name,
            food_category=food_category,
            generated_at=datetime.utcnow().isoformat(),
            classification=assessment.classification,
            confidence_score=assessment.confidence_score,
            freshness_score=assessment.freshness_score,
            image_quality_score=assessment.image_quality_score,
            color_score=assessment.color_score,
            texture_score=assessment.texture_score,
            mold_risk=assessment.mold_risk,
            bruise_risk=assessment.bruise_risk,
            damage_risk=assessment.damage_risk,
            color_status=assessment.color_status,
            texture_status=assessment.texture_status,
            mold_indicator=assessment.mold_indicator,
            bruise_severity=assessment.bruise_severity,
            damage_severity=assessment.damage_severity,
            spoilage_detected=spoilage.spoilage_detected,
            spoilage_probability=spoilage.overall_spoilage_probability,
            risk_level=spoilage.risk_level,
            spoilage_types=spoilage.spoilage_types,
            spoilage_indicators=[
                {
                    "name": ind.name,
                    "detected": ind.detected,
                    "probability": ind.probability,
                    "severity": ind.severity,
                    "description": ind.description,
                    "affected_area_pct": ind.affected_area_pct,
                }
                for ind in spoilage.indicators
            ],
            recommended_action=assessment.recommended_action,
            estimated_shelf_life_days=assessment.estimated_shelf_life_days,
            analysis_details=details,
            days_to_expiry=days_to_expiry,
            inventory_freshness_status=inventory_freshness_status,
        )
