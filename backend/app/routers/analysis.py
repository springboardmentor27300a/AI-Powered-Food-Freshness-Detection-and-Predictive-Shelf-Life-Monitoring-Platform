"""
Image analysis and freshness assessment API endpoints.

Endpoints:
- POST /analysis/analyze - Upload food image for freshness analysis
- POST /analysis/spoilage - Upload food image for spoilage detection
- GET  /analysis/history - Get user's analysis history
- GET  /analysis/{id} - Get specific analysis result
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, ImageAnalysis, User
from app.ml.freshness_scorer import FreshnessClassifier
from app.ml.spoilage_detector import SpoilageDetector
from app.schemas import (
    ImageAnalysisResponse,
    SpoilageDetectionResponse,
)

router = APIRouter(prefix="/analysis", tags=["Image Analysis"])

# Lazy-initialized ML engines
_classifier: Optional[FreshnessClassifier] = None
_detector: Optional[SpoilageDetector] = None


def _get_classifier() -> FreshnessClassifier:
    global _classifier
    if _classifier is None:
        _classifier = FreshnessClassifier()
    return _classifier


def _get_detector() -> SpoilageDetector:
    global _detector
    if _detector is None:
        _detector = SpoilageDetector()
    return _detector

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _load_details(analysis) -> dict | None:
    """Parse the stored analysis_details JSON, tolerating legacy/corrupt rows."""
    if not analysis.analysis_details:
        return None
    try:
        return json.loads(analysis.analysis_details)
    except (json.JSONDecodeError, TypeError):
        return None


def _risk_level_for(probability: float) -> str:
    """Map a 0..1 spoilage probability onto the shared risk levels."""
    if probability < 0.20:
        return "low"
    if probability < 0.50:
        return "moderate"
    if probability < 0.80:
        return "high"
    return "critical"


def _to_response(analysis) -> ImageAnalysisResponse:
    """
    Single place that maps a stored ImageAnalysis row to the API response.

    Kept in one function so the /analyze, /history, /batch/{id} and /{id}
    endpoints can never drift apart, and so the confidence / basis fields added
    by the new scoring engine are surfaced everywhere.
    """
    details = _load_details(analysis) or {}
    indicators = details.get("spoilage_indicators", {})
    detection = details.get("spoilage_detection", {})

    # Read the headline values from the persisted row, falling back to the
    # details payload written by /analyze. Reading stored columns is what keeps
    # /history and /{id} consistent with /analyze.
    spoilage_prob = analysis.spoilage_probability
    if spoilage_prob is None:
        spoilage_prob = detection.get("overall_probability", 0.0)
    spoilage_uncertainty = detection.get("uncertainty", 0.0)
    risk_level = analysis.risk_level or _risk_level_for(float(spoilage_prob))
    spoilage_detected = analysis.spoilage_detected

    return ImageAnalysisResponse(
        id=analysis.id,
        food_name=analysis.food_name,
        food_category=analysis.food_category,
        classification=analysis.classification,
        confidence_score=analysis.confidence_score,
        freshness_score=details.get("freshness_score", analysis.confidence_score * 100),
        image_quality_score=analysis.image_quality_score,
        color_score=analysis.color_score,
        texture_score=analysis.texture_score,
        mold_risk=analysis.mold_risk,
        bruise_risk=analysis.bruise_risk,
        damage_risk=analysis.damage_risk,
        color_status=details.get("color_analysis", {}).get("color_status", "Normal"),
        texture_status=details.get("texture_analysis", {}).get("texture_status", "Normal"),
        mold_indicator=indicators.get("mold_indicator", "Not Detected"),
        bruise_severity=indicators.get("bruise_severity", "None"),
        damage_severity=indicators.get("damage_severity", "None"),
        spoilage_detected=spoilage_detected,
        spoilage_probability=spoilage_prob,
        risk_level=risk_level,
        recommended_action=analysis.recommended_action,
        estimated_shelf_life_days=analysis.estimated_shelf_life_days,
        analysis_details=details or None,
        batch_id_ref=analysis.batch_id_ref,
        created_at=analysis.created_at,
        result_basis=details.get("result_basis", "heuristic_cv"),
        spoilage_uncertainty=spoilage_uncertainty,
        visual_confidence=details.get("visual_confidence", 0.0),
    )


@router.post("/analyze", response_model=ImageAnalysisResponse)
async def analyze_food_image(
    file: UploadFile = File(..., description="Food image (JPEG, PNG, WebP, BMP)"),
    food_name: str = Form("Unknown Food"),
    food_category: Optional[str] = Form(None),
    batch_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a food image and receive a complete freshness analysis."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}. Use JPEG, PNG, WebP, or BMP.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 10 MB limit.")
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Image file is too small or empty.")

    # Validate batch_id if provided
    if batch_id:
        batch = db.query(FoodBatch).filter(FoodBatch.batch_id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found.")
        if food_category is None:
            food_category = batch.category
        if food_name == "Unknown Food":
            food_name = batch.food_name

    # Run freshness analysis
    classifier = _get_classifier()
    try:
        assessment = classifier.assess(image_bytes, food_category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Run spoilage detection
    detector = _get_detector()
    try:
        spoilage = detector.detect(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spoilage detection failed: {str(e)}")

    # Build analysis details
    details = assessment.details.copy()
    details["freshness_score"] = assessment.freshness_score

    # The headline spoilage number comes from the scoring engine, which fuses
    # the trained CNN with the visual evidence.  The detector is CV-only, so
    # using it here would report a different (and much lower) probability than
    # the freshness score the same page displays.
    spoilage_prob = round(float(assessment.spoilage_probability) / 100.0, 4)
    spoilage_uncertainty = float(assessment.spoilage_uncertainty)
    risk_level = _risk_level_for(spoilage_prob)
    spoilage_detected = spoilage_prob > 0.35 and spoilage_uncertainty < 18.0

    details["spoilage_detection"] = {
        "overall_probability": spoilage_prob,
        "uncertainty": spoilage_uncertainty,
        "risk_level": risk_level,
        "spoilage_detected": spoilage_detected,
        "types": details.get("scoring", {}).get("spoilage_types", spoilage.spoilage_types),
        "summary": spoilage.summary,
        "source": "freshness scorer (trained CNN + calibrated visual evidence)",
        "visual_only_probability": spoilage.overall_spoilage_probability,
        "indicators": [
            {
                "name": ind.name,
                "detected": ind.detected,
                "probability": ind.probability,
                "severity": ind.severity,
                "description": ind.description,
                "affected_area_pct": ind.affected_area_pct,
                "confidence": ind.confidence,
                "evidence": ind.evidence,
            }
            for ind in spoilage.indicators
        ],
    }

    # Persist to database
    analysis = ImageAnalysis(
        user_id=user.id,
        batch_id_ref=batch_id,
        food_name=food_name,
        food_category=food_category,
        classification=assessment.classification,
        confidence_score=assessment.confidence_score,
        color_score=assessment.color_score,
        texture_score=assessment.texture_score,
        mold_risk=assessment.mold_risk,
        bruise_risk=assessment.bruise_risk,
        damage_risk=assessment.damage_risk,
        image_quality_score=assessment.image_quality_score,
        # Persist the SAME numbers the response reports, so a later read of
        # this row can never disagree with what the user just saw.
        spoilage_detected=spoilage_detected,
        spoilage_probability=spoilage_prob,
        risk_level=risk_level,
        recommended_action=assessment.recommended_action,
        estimated_shelf_life_days=assessment.estimated_shelf_life_days,
        analysis_details=json.dumps(details),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return _to_response(analysis)


@router.post("/spoilage", response_model=SpoilageDetectionResponse)
async def detect_spoilage(
    file: UploadFile = File(..., description="Food image for spoilage detection"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a food image specifically for spoilage detection."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 10 MB limit.")
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Image file is too small or empty.")

    detector = _get_detector()
    try:
        result = detector.detect(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spoilage detection failed: {str(e)}")

    return SpoilageDetectionResponse(
        spoilage_detected=result.spoilage_detected,
        overall_spoilage_probability=result.overall_spoilage_probability,
        risk_level=result.risk_level,
        spoilage_types=result.spoilage_types,
        indicators=[
            {
                "name": ind.name,
                "detected": ind.detected,
                "probability": ind.probability,
                "severity": ind.severity,
                "description": ind.description,
                "affected_area_pct": ind.affected_area_pct,
                "confidence": ind.confidence,
                "evidence": ind.evidence,
            }
            for ind in result.indicators
        ],
        summary=result.summary,
        uncertainty=result.uncertainty,
        result_basis=result.result_basis,
    )


@router.get("/history", response_model=list[ImageAnalysisResponse])
def get_analysis_history(
    skip: int = 0,
    limit: int = 20,
    classification: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current user's image analysis history."""
    query = db.query(ImageAnalysis).filter(ImageAnalysis.user_id == user.id)

    if classification:
        query = query.filter(ImageAnalysis.classification == classification)

    analyses = query.order_by(ImageAnalysis.created_at.desc()).offset(skip).limit(limit).all()

    return [_to_response(a) for a in analyses]


@router.get("/stats")
def get_analysis_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated analysis statistics for the current user."""
    base_query = db.query(ImageAnalysis).filter(ImageAnalysis.user_id == user.id)

    total = base_query.count()
    if total == 0:
        return {
            "total_analyses": 0,
            "classification_counts": {},
            "risk_level_counts": {},
            "avg_confidence": 0.0,
            "spoilage_detected_count": 0,
            "avg_shelf_life_days": 0,
        }

    classifications = dict(
        base_query.with_entities(ImageAnalysis.classification, func.count(ImageAnalysis.id))
        .group_by(ImageAnalysis.classification).all()
    )
    risk_levels = dict(
        base_query.with_entities(ImageAnalysis.risk_level, func.count(ImageAnalysis.id))
        .group_by(ImageAnalysis.risk_level).all()
    )
    avg_conf = base_query.with_entities(func.avg(ImageAnalysis.confidence_score)).scalar() or 0.0
    spoilage_count = base_query.filter(ImageAnalysis.spoilage_detected == True).count()
    avg_shelf = base_query.with_entities(func.avg(ImageAnalysis.estimated_shelf_life_days)).scalar() or 0

    return {
        "total_analyses": total,
        "classification_counts": classifications,
        "risk_level_counts": risk_levels,
        "avg_confidence": round(float(avg_conf), 3),
        "spoilage_detected_count": spoilage_count,
        "avg_shelf_life_days": round(float(avg_shelf), 1),
    }


@router.get("/batch/{batch_id}", response_model=list[ImageAnalysisResponse])
def get_batch_analysis_history(
    batch_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get freshness analysis history for a specific food batch (trend data)."""
    analyses = (
        db.query(ImageAnalysis)
        .filter(
            ImageAnalysis.batch_id_ref == batch_id,
            ImageAnalysis.user_id == user.id,
        )
        .order_by(ImageAnalysis.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [_to_response(a) for a in analyses]


@router.get("/{analysis_id}", response_model=ImageAnalysisResponse)
def get_analysis_by_id(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific analysis result by ID."""
    analysis = db.query(ImageAnalysis).filter(
        ImageAnalysis.id == analysis_id,
        ImageAnalysis.user_id == user.id,
    ).first()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    return _to_response(analysis)
