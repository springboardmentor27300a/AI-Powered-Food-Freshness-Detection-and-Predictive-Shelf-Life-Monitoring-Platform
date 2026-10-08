"""
Batch insight orchestration (Milestone 3).

Bundles the Milestone 2 image-analysis evidence with the new Milestone 3
services into one convenient, role-consistent picture for a food batch,
shared by the shelf-life / storage / recommendations / analytics routers.
"""
import json
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FoodBatch, ImageAnalysis
from app.services.alert_service import AlertService
from app.services.recommendation_service import RecommendationEngine
from app.services.scoring_service import FreshnessScoreService
from app.services.shelf_life_service import ShelfLifePrediction, ShelfLifeService, predictions_from_batch
from app.services.storage_service import StorageAnalyzer


def latest_analysis(db: Session, batch: FoodBatch) -> ImageAnalysis | None:
    """Most recent image analysis linked to this batch (used as visual evidence)."""
    return db.scalars(
        select(ImageAnalysis)
        .where(ImageAnalysis.batch_id_ref == batch.batch_id)
        .order_by(ImageAnalysis.created_at.desc())
        .limit(1)
    ).first()


def unpack_analysis(analysis: ImageAnalysis | None) -> tuple[float | None, date | None, bool]:
    """Extract (freshness_score, created_at date, spoilage_detected) from an analysis row."""
    if analysis is None:
        return None, None, False
    created_at = analysis.created_at.date() if analysis.created_at else None
    score = None
    if analysis.analysis_details:
        try:
            details = json.loads(analysis.analysis_details)
            score = details.get("freshness_score")
        except (json.JSONDecodeError, TypeError):
            score = None
    if score is None:
        score = analysis.confidence_score * 100
    return score, created_at, bool(analysis.spoilage_detected)


def prediction_for_batch(db: Session, batch: FoodBatch) -> ShelfLifePrediction:
    """Compute the shelf-life prediction for a batch using available evidence."""
    freshness_score, created_at, spoilage = unpack_analysis(latest_analysis(db, batch))
    return predictions_from_batch(
        batch,
        freshness_score=freshness_score,
        analysis_created_at=created_at,
        spoilage_detected=spoilage,
    )


def storage_for_batch(batch: FoodBatch):
    """Current storage analysis from the batch's live condition fields."""
    analyzer = StorageAnalyzer()
    return analyzer.analyze(
        batch_id=batch.batch_id,
        food_name=batch.food_name,
        category=batch.category,
        received_date=batch.received_date,
        temperature_c=getattr(batch, "temperature_c", None),
        humidity_pct=getattr(batch, "humidity_pct", None),
        air_circulation=getattr(batch, "air_circulation", None),
        light_exposure=getattr(batch, "light_exposure", None),
        packaging_type=getattr(batch, "packaging_type", None),
        storage_location=getattr(batch, "storage_location", None),
    )


def score_for_batch(batch: FoodBatch, prediction: ShelfLifePrediction | None = None, storage=None):
    service = FreshnessScoreService()
    if storage is None:
        storage = storage_for_batch(batch)
    freshness_score = prediction.freshness_score if prediction else None
    return service.score(
        batch_id=batch.batch_id,
        food_name=batch.food_name,
        category=batch.category,
        received_date=batch.received_date,
        expiry_date=batch.expiry_date,
        visual_score=freshness_score,
        storage_compliance=storage.compliance_score if storage.has_storage_data else None,
        shelf_life_score=prediction.shelf_life_score if prediction else None,
    )


def build_batch_insight(db: Session, batch: FoodBatch, sibling_batches: list | None = None) -> dict:
    """Assemble prediction + storage + score + recommendations + alerts for one batch."""
    prediction = prediction_for_batch(db, batch)
    storage = storage_for_batch(batch)
    score = score_for_batch(batch, prediction, storage)

    engine = RecommendationEngine()
    recommendations = engine.generate_for_batch(batch, prediction, storage, score, sibling_batches)
    alerts = AlertService().generate_for_batch(batch, prediction, storage, score)

    return {
        "batch_id": batch.batch_id,
        "food_name": batch.food_name,
        "category": batch.category,
        "prediction": prediction,
        "storage": storage,
        "score": score,
        "recommendations": recommendations,
        "alerts": alerts,
    }


def same_product_batches(db: Session, batch: FoodBatch) -> list[FoodBatch]:
    """Other batches of the same product (used for FEFO rotation suggestions)."""
    return list(db.scalars(
        select(FoodBatch)
        .where(FoodBatch.food_name == batch.food_name)
        .order_by(FoodBatch.expiry_date.asc())
    ))