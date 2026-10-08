"""
Shelf-life prediction endpoints (Milestone 3).

- GET  /shelf-life             -> prediction + score for every visible batch
- GET  /shelf-life/{batch_id}  -> full prediction detail + history (persists today's snapshot)
- POST /shelf-life/predict     -> recompute + persist a prediction for a batch
- GET  /shelf-life/history/{batch_id} -> persisted prediction history (trend source)
"""
import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, ShelfLifePrediction, User
from app.routers.batches import _ensure_can_view, _get_batch_or_404, _visible_batches_query
from app.schemas import ShelfLifeHistoryPoint, ShelfLifePredictionOut
from app.services.batch_insight import prediction_for_batch, score_for_batch

router = APIRouter(prefix="/shelf-life", tags=["Shelf-Life Prediction"])


def _upsert_prediction_row(db: Session, batch: FoodBatch, user: User, today: date | None = None) -> ShelfLifePrediction:
    """Compute + persist today's prediction snapshot (one per batch per day)."""
    reference = today or date.today()
    prediction = prediction_for_batch(db, batch)

    row = db.scalar(
        select(ShelfLifePrediction).where(
            ShelfLifePrediction.batch_id_ref == batch.batch_id,
            ShelfLifePrediction.predicted_on == reference,
        )
    )
    if row is None:
        row = ShelfLifePrediction(
            batch_id_ref=batch.batch_id,
            user_id=user.id,
            food_name=batch.food_name,
            category=batch.category,
            freshness_score=prediction.freshness_score,
            estimated_remaining_days=prediction.estimated_remaining_days,
            expected_expiry_date=prediction.expected_expiry_date,
            calendar_remaining_days=prediction.calendar_remaining_days,
            shelf_life_score=prediction.shelf_life_score,
            storage_condition_score=prediction.storage_condition_score,
            spoilage_risk=prediction.spoilage_risk,
            risk_score=prediction.risk_score,
            factors=json.dumps(prediction.factors),
            predicted_on=reference,
        )
        db.add(row)
    else:
        row.freshness_score = prediction.freshness_score
        row.estimated_remaining_days = prediction.estimated_remaining_days
        row.expected_expiry_date = prediction.expected_expiry_date
        row.calendar_remaining_days = prediction.calendar_remaining_days
        row.shelf_life_score = prediction.shelf_life_score
        row.storage_condition_score = prediction.storage_condition_score
        row.spoilage_risk = prediction.spoilage_risk
        row.risk_score = prediction.risk_score
        row.factors = json.dumps(prediction.factors)
    db.commit()
    db.refresh(row)
    return row


def _prediction_out(prediction) -> dict:
    return ShelfLifePredictionOut(
        batch_id=prediction.batch_id,
        food_name=prediction.food_name,
        category=prediction.category,
        estimated_remaining_days=prediction.estimated_remaining_days,
        expected_expiry_date=prediction.expected_expiry_date,
        calendar_remaining_days=prediction.calendar_remaining_days,
        freshness_score=prediction.freshness_score,
        shelf_life_score=prediction.shelf_life_score,
        storage_condition_score=prediction.storage_condition_score,
        spoilage_risk=prediction.spoilage_risk,
        risk_score=prediction.risk_score,
        factors=prediction.factors,
        predicted_on=prediction.predicted_on,
        storage_delta_days=prediction.storage_delta_days,
        base_shelf_life_days=prediction.base_shelf_life_days,
    ).model_dump()


@router.get("")
def list_shelf_life(
    q: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None),
    risk: str | None = Query(default=None, description="Low | Moderate | High | Critical"),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Shelf-life prediction for every visible batch (with scores)."""
    query = _visible_batches_query(db, current_user)
    if q:
        needle = f"%{q.strip()}%"
        from sqlalchemy import or_
        query = query.where(or_(
            FoodBatch.food_name.ilike(needle), FoodBatch.batch_id.ilike(needle)
        ))
    if category:
        query = query.where(FoodBatch.category == category)
    batches = db.scalars(query.order_by(FoodBatch.expiry_date.asc()).limit(limit)).all()

    result = []
    for batch in batches:
        prediction = prediction_for_batch(db, batch)
        score = score_for_batch(batch, prediction)
        if risk and prediction.spoilage_risk != risk:
            continue
        result.append({
            "batch_id": batch.batch_id,
            "food_name": batch.food_name,
            "category": batch.category,
            **_prediction_out(prediction),
            "freshness_status": score.freshness_status,
            "overall_score": score.overall_score,
            "storage_location": batch.storage_location,
            "available_quantity": batch.available_quantity,
            "unit": batch.unit,
        })
    return result


@router.post("/predict")
def predict_batch(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recompute and persist today's prediction snapshot for a batch."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)
    _upsert_prediction_row(db, batch, current_user)
    return batch_prediction(db, batch_id, current_user, persist=False)


@router.get("/{batch_id}", response_model=dict)
def batch_prediction(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    persist: bool = True,
):
    """Full prediction detail for a batch, including persisted trend history."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)

    prediction = prediction_for_batch(db, batch)

    if persist:
        _upsert_prediction_row(db, batch, current_user)

    history = db.scalars(
        select(ShelfLifePrediction)
        .where(ShelfLifePrediction.batch_id_ref == batch.batch_id)
        .order_by(ShelfLifePrediction.predicted_on.asc())
    ).all()

    return {
        **_prediction_out(prediction),
        "history": [
            ShelfLifeHistoryPoint(
                predicted_on=h.predicted_on,
                estimated_remaining_days=h.estimated_remaining_days,
                expected_expiry_date=h.expected_expiry_date,
                freshness_score=h.freshness_score,
                spoilage_risk=h.spoilage_risk,
            ).model_dump()
            for h in history
        ],
    }


@router.get("/history/{batch_id}", response_model=list[ShelfLifeHistoryPoint])
def prediction_history(
    batch_id: str,
    limit: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persisted prediction history for a batch (drives the shelf-life trend chart)."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)

    rows = db.scalars(
        select(ShelfLifePrediction)
        .where(ShelfLifePrediction.batch_id_ref == batch.batch_id)
        .order_by(ShelfLifePrediction.predicted_on.asc())
        .limit(limit)
    ).all()

    return [
        ShelfLifeHistoryPoint(
            predicted_on=r.predicted_on,
            estimated_remaining_days=r.estimated_remaining_days,
            expected_expiry_date=r.expected_expiry_date,
            freshness_score=r.freshness_score,
            spoilage_risk=r.spoilage_risk,
        )
        for r in rows
    ]