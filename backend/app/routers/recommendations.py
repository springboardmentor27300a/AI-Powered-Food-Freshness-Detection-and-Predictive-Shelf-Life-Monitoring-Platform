"""
Recommendation endpoints (Milestone 3).

- GET  /recommendations/{batch_id}  -> current recommendations for a batch (computed + persisted)
- GET  /recommendations             -> persisted recommendations for the visible inventory
- POST /recommendations/regenerate  -> recompute + persist recommendations for all visible batches
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, Recommendation, User
from app.routers.batches import _ensure_can_view, _get_batch_or_404, _visible_batches_query
from app.schemas import RecommendationOut
from app.services.batch_insight import (
    build_batch_insight,
    prediction_for_batch,
    same_product_batches,
    score_for_batch,
    storage_for_batch,
)
from app.services.recommendation_service import RecommendationEngine

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def _persist_recommendations(db: Session, batch: FoodBatch, user: User) -> list[Recommendation]:
    insight = build_batch_insight(db, batch, same_product_batches(db, batch))
    engine = RecommendationEngine()
    generated = engine.generate_for_batch(
        batch, insight["prediction"], insight["storage"], insight["score"],
        same_product_batches(db, batch),
    )
    # Replace the active recommendations for this batch with the fresh set.
    for old in db.scalars(
        select(Recommendation).where(
            Recommendation.batch_id_ref == batch.batch_id, Recommendation.status == "active"
        )
    ).all():
        old.status = "superseded"

    rows = []
    for rec in generated:
        row = Recommendation(
            batch_id_ref=batch.batch_id,
            user_id=batch.user_id,
            category=rec.category,
            message=rec.message,
            priority=rec.priority,
            source=rec.source,
            status="active",
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def _recompute_all(db: Session, user: User, persist: bool) -> list[dict]:
    batches = db.scalars(_visible_batches_query(db, user)).all()
    engine = RecommendationEngine()
    results = []
    for batch in batches:
        prediction = prediction_for_batch(db, batch)
        storage = storage_for_batch(batch)
        score = score_for_batch(batch, prediction, storage)
        if persist:
            _persist_recommendations(db, batch, user)
            recs = db.scalars(
                select(Recommendation)
                .where(Recommendation.batch_id_ref == batch.batch_id, Recommendation.status == "active")
                .order_by(Recommendation.id.desc())
            ).all()
        else:
            recs = engine.generate_for_batch(batch, prediction, storage, score, same_product_batches(db, batch))
        for rec in recs:
            results.append({
                "batch_id": batch.batch_id,
                "food_name": batch.food_name,
                "category": rec.category if not hasattr(rec, "message") else rec.category,
                "message": rec.message,
                "priority": rec.priority,
                "source": getattr(rec, "source", "rule_engine"),
            })
    return results


@router.get("/{batch_id}", response_model=list[RecommendationOut])
def batch_recommendations(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Current (live) recommendations for one batch, persisted for history."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)
    return _persist_recommendations(db, batch, current_user)


@router.get("", response_model=list[RecommendationOut])
def list_recommendations(
    category: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persisted active recommendations across the visible inventory."""
    query = (
        select(Recommendation)
        .where(Recommendation.status == "active")
        .order_by(Recommendation.created_at.desc())
    )
    if category:
        query = query.where(Recommendation.category == category)
    if priority:
        query = query.where(Recommendation.priority == priority)

    rows = db.scalars(query.limit(limit)).all()
    if current_user.role == "consumer":
        rows = [r for r in rows if r.user_id == current_user.id]
    return rows


@router.post("/regenerate")
def regenerate_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recompute and persist recommendations for every visible batch."""
    results = _recompute_all(db, current_user, persist=True)
    return {"generated": len(results), "recommendations": results}