import json
from collections import defaultdict
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .ml.shelf_life import _profile, _condition_score, _score_temperature, _score_humidity, _recommendations, normalize_food_type
from .ml.rsl_predictor import rsl_predictor_instance, RSLPredictionError
from .models import FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, User
from .schemas import (
    M3AnalyticsResponse,
    Recommendation,
    RotationSuggestion,
    RotationSuggestionsResponse,
    ShelfLifePredictionRequest,
    ShelfLifePredictionResponse,
    StorageConditionCreate,
    StorageConditionResponse,
)

router = APIRouter(prefix="/m3", tags=["m3"])


def _owned_record(db: Session, model: Any, record_id: int | None, user_id: int):
    if record_id is None:
        return None
    owner_column = model.created_by if model is FoodItem else model.user_id
    record = db.scalar(select(model).where(model.id == record_id, owner_column == user_id))
    if record is None:
        raise HTTPException(status_code=404, detail=f"{model.__tablename__} record not found")
    return record


def _prediction_components(prediction: ShelfLifePrediction):
    from .schemas import ScoreComponents

    return ScoreComponents(
        visual_condition_score=prediction.visual_condition_score,
        storage_condition_score=prediction.storage_condition_score,
        shelf_life_score=prediction.shelf_life_score,
        product_age_score=prediction.product_age_score,
    )


# Keep old name as an alias so existing callers (tests) are not broken.
prediction_components = _prediction_components


def _response(prediction: ShelfLifePrediction) -> ShelfLifePredictionResponse:
    snapshot = json.loads(prediction.input_snapshot)
    result = json.loads(prediction.recommendations)
    data_type = "SYNTHETIC" if "SYNTHETIC" in (prediction.model_type or "") else "REAL/TRACEABLE"
    return ShelfLifePredictionResponse(
        id=prediction.id,
        food_type=prediction.food_type,
        data_type=data_type,
        remaining_shelf_life_days=prediction.remaining_shelf_life_days,
        predicted_expiry_date=prediction.predicted_expiry_date,
        confidence=prediction.confidence,
        risk_level=prediction.risk_level,
        official_freshness_score=prediction.official_freshness_score,
        score_components=_prediction_components(prediction),
        storage_impact=result["storage_impact"],
        storage_compliance=prediction.storage_compliance,
        recommendations=[Recommendation(**item) for item in result["recommendations"]],
        model_type=prediction.model_type,
        created_at=prediction.created_at,
    )


@router.post("/storage-conditions", response_model=StorageConditionResponse, status_code=status.HTTP_201_CREATED)
def create_storage_condition(
    payload: StorageConditionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_record(db, FoodItem, payload.food_item_id, current_user.id)
    _owned_record(db, FreshnessAnalysis, payload.analysis_id, current_user.id)
    record = StorageCondition(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/storage-conditions", response_model=list[StorageConditionResponse])
def list_storage_conditions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list(
        db.scalars(
            select(StorageCondition)
            .where(StorageCondition.user_id == current_user.id)
            .order_by(StorageCondition.observed_at.desc())
        )
    )


@router.post("/shelf-life/predict", response_model=ShelfLifePredictionResponse, status_code=status.HTTP_201_CREATED)
def create_shelf_life_prediction(
    payload: ShelfLifePredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    food_item = _owned_record(db, FoodItem, payload.food_item_id, current_user.id)
    analysis = _owned_record(db, FreshnessAnalysis, payload.analysis_id, current_user.id)

    data = payload.model_dump()

    # Determine food type
    if food_item is not None and not payload.food_type.strip():
        data["food_type"] = food_item.category
    else:
        data["food_type"] = payload.food_type

    # Override visual scores from a linked M2 analysis when available.
    if analysis is not None:
        data["visual_quality_score"] = analysis.quality_score
        data["spoilage_probability"] = analysis.spoilage_probability
        data["freshness_classification"] = analysis.classification

    # Reuse an existing StorageCondition or create a new record
    existing_storage = _owned_record(db, StorageCondition, payload.storage_condition_id, current_user.id)
    if existing_storage is not None:
        storage = existing_storage
    else:
        storage = StorageCondition(
            user_id=current_user.id,
            food_item_id=payload.food_item_id,
            analysis_id=payload.analysis_id,
            temperature_c=payload.temperature_c,
            humidity_pct=payload.humidity_pct,
            air_circulation=payload.air_circulation,
            light_exposure=payload.light_exposure,
            packaging_type=payload.packaging_type,
            storage_duration_days=payload.storage_duration_days,
        )
        db.add(storage)
        db.flush()

    data["analysis_id"] = payload.analysis_id

    # 1. Execute ML Prediction (Real or Synthetic Demonstration)
    try:
        ml_result = rsl_predictor_instance.predict(data)
    except RSLPredictionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # 2. Contextual Storage & Recommendation Engine Processing
    profile = _profile(ml_result["food_type"])
    storage_score = _condition_score(data, profile)
    visual_score = int(data.get("visual_quality_score", 70))
    spoilage_prob = float(data.get("spoilage_probability", 0.3))
    remaining_days = ml_result["remaining_shelf_life_days"]
    risk = ml_result["risk_level"]
    base_days = profile.get("base_days", 14)

    shelf_life_score = max(0, min(100, round((remaining_days / base_days) * 100)))
    age_score = max(0, min(100, round(100 - (data.get("product_age_days", 0) / max(base_days * 2, 1)) * 100)))

    recs = _recommendations(data, profile, storage_score, risk, remaining_days)
    overall_score = round(
        visual_score * 0.40
        + storage_score * 0.25
        + shelf_life_score * 0.20
        + age_score * 0.15
    )
    storage_compliance = "compliant" if storage_score >= 70 else "needs_attention"

    storage_impact = {
        "temperature_score": float(round(_score_temperature(data["temperature_c"], profile["temperature"]))),
        "humidity_score": float(round(_score_humidity(data["humidity_pct"], profile["humidity"]))),
        "condition_score": float(storage_score),
    }

    prediction = ShelfLifePrediction(
        user_id=current_user.id,
        food_item_id=payload.food_item_id,
        analysis_id=payload.analysis_id,
        storage_condition_id=storage.id,
        food_type=ml_result["food_type"],
        remaining_shelf_life_days=remaining_days,
        predicted_expiry_date=ml_result["predicted_expiry_date"],
        confidence=ml_result["confidence"],  # Transparent null
        risk_level=risk,
        official_freshness_score=overall_score,
        visual_condition_score=visual_score,
        storage_condition_score=storage_score,
        shelf_life_score=shelf_life_score,
        product_age_score=age_score,
        input_snapshot=json.dumps(data),
        recommendations=json.dumps({
            "storage_impact": storage_impact,
            "recommendations": recs,
        }),
        model_type=ml_result["model_type"],
        storage_compliance=storage_compliance,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return _response(prediction)


@router.get("/shelf-life/history", response_model=list[ShelfLifePredictionResponse])
def shelf_life_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    predictions = db.scalars(
        select(ShelfLifePrediction)
        .where(ShelfLifePrediction.user_id == current_user.id)
        .order_by(ShelfLifePrediction.created_at.desc())
    )
    return [_response(item) for item in predictions]


@router.get("/recommendations/{prediction_id}", response_model=list[Recommendation])
def recommendations(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prediction = _owned_record(db, ShelfLifePrediction, prediction_id, current_user.id)
    return [Recommendation(**item) for item in json.loads(prediction.recommendations)["recommendations"]]


@router.get("/analytics", response_model=M3AnalyticsResponse)
def analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = 7,
):
    """Inventory quality summary with optional filtering by expiry window.

    Optional:
    - ``days`` parameter (default 7): only consider predictions with
      ``remaining_shelf_life_days`` in the range ``[-abs(days), days]``.
    """
    # Build a filter for remaining_shelf_life_days window
    rsl_low = -abs(days)
    rsl_high = days

    query = select(ShelfLifePrediction).where(ShelfLifePrediction.user_id == current_user.id)

    # Apply RSL window filter if different from default
    if days != 7:
        query = query.where(
            (ShelfLifePrediction.remaining_shelf_life_days >= rsl_low)
            & (ShelfLifePrediction.remaining_shelf_life_days <= rsl_high)
        )

    predictions = db.scalars(query.order_by(ShelfLifePrediction.created_at.asc())).all()

    # A3: Return null aggregates instead of misleading zeros when there is no data.
    if not predictions:
        return M3AnalyticsResponse(
            total_predictions=0,
            average_freshness_score=None,
            average_remaining_shelf_life_days=None,
            risk_counts={},
            freshness_trend=[],
            shelf_life_trend=[],
            storage_condition_impact=None,
            expiring_soon_count=0,
            expired_count=0,
            high_risk_count=0,
        )

    # Compute quality overview metrics
    total = len(predictions)
    expiring_soon_count = sum(
        1 for p in predictions
        if rsl_low <= p.remaining_shelf_life_days <= days and p.remaining_shelf_life_days > 0
    )
    expired_count = sum(1 for p in predictions if p.remaining_shelf_life_days <= 0)
    high_risk_count = sum(
        1 for p in predictions if p.risk_level in ("critical", "high")
    )

    grouped = defaultdict(list)
    risk_counts = defaultdict(int)
    temperatures = []
    humidities = []
    for prediction in predictions:
        day = prediction.created_at.date().isoformat()
        grouped[day].append(prediction)
        risk_counts[prediction.risk_level] += 1
        snapshot = json.loads(prediction.input_snapshot)
        temperatures.append(float(snapshot["temperature_c"]))
        humidities.append(float(snapshot["humidity_pct"]))

    freshness_trend = [
        {"date": day, "average_score": round(sum(item.official_freshness_score for item in items) / len(items), 1)}
        for day, items in grouped.items()
    ]
    shelf_life_trend = [
        {"date": day, "average_remaining_days": round(sum(item.remaining_shelf_life_days for item in items) / len(items), 1)}
        for day, items in grouped.items()
    ]
    return M3AnalyticsResponse(
        total_predictions=total,
        average_freshness_score=round(sum(item.official_freshness_score for item in predictions) / len(predictions), 1),
        average_remaining_shelf_life_days=round(sum(item.remaining_shelf_life_days for item in predictions) / len(predictions), 1),
        risk_counts=dict(risk_counts),
        freshness_trend=freshness_trend,
        shelf_life_trend=shelf_life_trend,
        storage_condition_impact={
            "average_condition_score": round(sum(item.storage_condition_score for item in predictions) / len(predictions), 1),
            "average_temperature_c": round(sum(temperatures) / len(temperatures), 1),
            "average_humidity_pct": round(sum(humidities) / len(humidities), 1),
        },
        expiring_soon_count=expiring_soon_count,
        expired_count=expired_count,
        high_risk_count=high_risk_count,
    )


# ============================================================
# B2 — FEFO/FIFO rotation suggestions
# ============================================================

@router.get("/rotation-suggestions", response_model=RotationSuggestionsResponse)
def rotation_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = 7,
):
    """Return a prioritised FEFO consumption/rotation order for the user's inventory.

    Sorting rules (applied in order):
    1. Expired items (expiry_date < today) always rank first — consume or discard immediately.
    2. Among non-expired items, sort by expiry_date ascending (FEFO — First Expired, First Out).
    3. When two items share the same expiry_date and a shelf-life prediction exists for both,
       the item with the lower official_freshness_score ranks first (worse condition first).
    4. Items with no prediction rank after items with predictions on the same expiry date.

    Optional:
    - Filter by ``days`` parameter (default 7): only include items with
      ``days_until_expiry`` in ``[-(abs(days)), days]`` range.

    No new storage or prediction records are created by this endpoint.
    """
    today = date.today()
    days_high = days
    days_low = -abs(days)

    items = list(db.scalars(
        select(FoodItem)
        .where(FoodItem.created_by == current_user.id)
        .order_by(FoodItem.expiry_date.asc())
    ))

    # Filter by days window: keep items where days_until_expiry is in [days_low, days_high]
    # Calculate days_until_expiry for each item relative to today
    filtered_items = []
    for item in items:
        days_until = (item.expiry_date - today).days
        if days_low <= days_until <= days_high:
            filtered_items.append(item)
    items = filtered_items

    if not items:
        return RotationSuggestionsResponse(
            total_items=0,
            expired_count=0,
            suggestion_basis="FEFO (expiry date + freshness score)",
            suggestions=[],
        )

    # Fetch the most recent ShelfLifePrediction per food_item_id in one query.
    item_ids = [i.id for i in items]
    predictions_raw = list(db.scalars(
        select(ShelfLifePrediction)
        .where(
            ShelfLifePrediction.user_id == current_user.id,
            ShelfLifePrediction.food_item_id.in_(item_ids),
        )
        .order_by(ShelfLifePrediction.created_at.desc())
    ))
    latest_pred: dict[int, ShelfLifePrediction] = {}
    for pred in predictions_raw:
        if pred.food_item_id not in latest_pred:
            latest_pred[pred.food_item_id] = pred

    def _sort_key(item: FoodItem):
        is_expired = item.expiry_date < today
        pred = latest_pred.get(item.id)
        if pred is not None:
            freshness_key = (0, pred.official_freshness_score)
        else:
            freshness_key = (1, 0)
        return (0 if is_expired else 1, item.expiry_date, freshness_key)

    sorted_items = sorted(items, key=_sort_key)

    expired_count = sum(1 for i in sorted_items if i.expiry_date < today)

    suggestions: list[RotationSuggestion] = []
    for rank, item in enumerate(sorted_items, start=1):
        days_until = (item.expiry_date - today).days
        is_expired = days_until < 0
        pred = latest_pred.get(item.id)

        # Build a transparent, human-readable reason string.
        if is_expired:
            reason = (
                f"Expired {abs(days_until)} day{'s' if abs(days_until) != 1 else ''} ago. "
                "Consume or discard immediately."
            )
        elif days_until == 0:
            reason = "Expires today. Consume immediately."
        elif days_until <= 3:
            reason = (
                f"Expires in {days_until} day{'s' if days_until != 1 else ''}. "
                "High urgency — consume before other items."
            )
        elif pred is not None and pred.risk_level in ("critical", "high"):
            reason = (
                f"Expires in {days_until} days but M3 risk level is '{pred.risk_level}' "
                f"(freshness score {pred.official_freshness_score}/100). "
                "Prioritise over items with later expiry dates."
            )
        elif pred is not None and pred.official_freshness_score is not None:
            reason = (
                f"Expires in {days_until} days. "
                f"Freshness score {pred.official_freshness_score}/100 — "
                "ranked by FEFO order within its expiry group."
            )
        else:
            reason = (
                f"Expires in {days_until} days. "
                "No M3 prediction available — ranked by expiry date (FEFO)."
            )

        suggestions.append(RotationSuggestion(
            priority_rank=rank,
            food_item_id=item.id,
            name=item.name,
            category=item.category,
            batch_number=item.batch_number,
            quantity=item.quantity,
            expiry_date=item.expiry_date,
            days_until_expiry=days_until,
            is_expired=is_expired,
            reason=reason,
            risk_level=pred.risk_level if pred else None,
            official_freshness_score=pred.official_freshness_score if pred else None,
            storage_compliance=pred.storage_compliance if pred else None,
        ))

    return RotationSuggestionsResponse(
        total_items=len(suggestions),
        expired_count=expired_count,
        suggestion_basis="FEFO (expiry date + freshness score)",
        suggestions=suggestions,
    )
