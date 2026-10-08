"""
Storage condition monitoring endpoints (Milestone 3).

- GET  /storage             -> storage analysis for every visible batch
- GET  /storage/{batch_id}  -> current analysis + recent readings history
- POST /storage/{batch_id}  -> record a storage reading (updates live fields + history)
- GET  /storage/history/{batch_id} -> full readings history
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, StorageReading, User
from app.routers.batches import _ensure_can_view, _get_batch_or_404, _visible_batches_query
from app.schemas import (
    ParameterStatusOut,
    StorageAnalysisOut,
    StorageReadingCreate,
    StorageReadingOut,
    StorageRequirementsOut,
)
from app.services.batch_insight import (
    latest_analysis,
    prediction_for_batch,
    same_product_batches,
    score_for_batch,
    unpack_analysis,
)
from app.services.recommendation_service import RecommendationEngine
from app.services.storage_service import (
    StorageAnalyzer,
    normalize_air_circulation,
    normalize_light_exposure,
)

router = APIRouter(prefix="/storage", tags=["Storage Conditions"])


def _param(status) -> ParameterStatusOut:
    return ParameterStatusOut(
        value=status.value,
        recommended=status.recommended,
        status=status.status,
        explanation=status.explanation,
        assessment=status.assessment or status.status.upper(),
        impact=status.impact,
        recommendation=status.recommendation,
    )


def _requirements(rule) -> StorageRequirementsOut:
    return StorageRequirementsOut(
        scope=rule.rule_scope,
        key=rule.rule_key or rule.rule_scope,
        temperature_min_c=rule.temp_min_c,
        temperature_max_c=rule.temp_max_c,
        recommended_temperature_c=rule.recommended_temperature(),
        humidity_min_pct=rule.humidity_min_pct,
        humidity_max_pct=rule.humidity_max_pct,
        recommended_humidity_pct=rule.recommended_humidity(),
        air_circulation=rule.air_circulation_label(),
        light_requirement=rule.light_requirement,
        recommended_duration_days=rule.shelf_life_days,
        maximum_duration_days=rule.max_storage_days,
        packaging_requirement=rule.packaging_requirement,
        storage_environment=rule.storage_environment,
        refrigeration_required=rule.refrigeration_required,
        notes=rule.notes,
    )


def _consumption_priority(prediction) -> str:
    if prediction.expired:
        return "EXPIRED - isolate and follow the applicable disposal policy"
    if prediction.estimated_remaining_days == 0:
        return "EXPIRING TODAY - prioritize safe sale or consumption"
    if prediction.estimated_remaining_days <= 1:
        return "PRIORITY SALE/CONSUMPTION"
    if prediction.estimated_remaining_days <= 3:
        return "USE SOON"
    if prediction.spoilage_risk in {"High", "Critical"}:
        return "PRIORITY REVIEW"
    return "NORMAL ROTATION"


def _analysis_out(batch: FoodBatch, analyzer: StorageAnalyzer, db: Session | None = None) -> dict:
    analysis = analyzer.analyze(
        batch_id=batch.batch_id,
        food_name=batch.food_name,
        category=batch.category,
        received_date=batch.received_date,
        temperature_c=batch.temperature_c,
        humidity_pct=batch.humidity_pct,
        air_circulation=batch.air_circulation,
        light_exposure=batch.light_exposure,
        packaging_type=batch.packaging_type,
        storage_location=batch.storage_location,
    )
    shelf_life = None
    image_context = None
    recommendations = []
    consumption_priority = None
    waste_reduction = None

    if db is not None:
        prediction = prediction_for_batch(db, batch)
        score = score_for_batch(batch, prediction)
        image = latest_analysis(db, batch)
        if image is not None:
            freshness, analysed_on, _ = unpack_analysis(image)
            image_context = {
                "classification": image.classification,
                "freshness_score": freshness,
                "spoilage_detected": image.spoilage_detected,
                "spoilage_probability": image.spoilage_probability,
                "risk_level": image.risk_level,
                "analysed_on": analysed_on.isoformat() if analysed_on else None,
            }
        shelf_life = {
            "estimated_remaining_days": prediction.estimated_remaining_days,
            "expected_expiry_date": prediction.expected_expiry_date.isoformat(),
            "calendar_remaining_days": prediction.calendar_remaining_days,
            "spoilage_risk": prediction.spoilage_risk,
            "risk_score": prediction.risk_score,
            "storage_delta_days": prediction.storage_delta_days,
            "storage_impact": analysis.shelf_life_impact,
            "freshness_score": prediction.freshness_score,
            "overall_freshness_score": score.overall_score,
            "factors": prediction.factors,
        }
        generated = RecommendationEngine().generate_for_batch(
            batch,
            prediction,
            analysis,
            score,
            same_product_batches(db, batch),
        )
        recommendations = [
            {
                "category": recommendation.category,
                "message": recommendation.message,
                "priority": recommendation.priority,
            }
            for recommendation in generated
        ]
        consumption_priority = _consumption_priority(prediction)
        waste_reduction = next(
            (item["message"] for item in recommendations if item["category"] == "waste_reduction"),
            None,
        )

    return StorageAnalysisOut(
        batch_id=analysis.batch_id,
        food_name=analysis.food_name,
        category=analysis.category,
        requirements=_requirements(analysis.rule).model_dump(),
        current_conditions={
            "temperature_c": batch.temperature_c,
            "humidity_pct": batch.humidity_pct,
            "air_circulation": batch.air_circulation,
            "light_exposure": batch.light_exposure,
            "storage_duration_days": analysis.days_stored,
            "packaging_type": batch.packaging_type,
            "storage_location": batch.storage_location,
        },
        temperature=_param(analysis.temperature),
        humidity=_param(analysis.humidity),
        air_circulation=_param(analysis.air_circulation),
        light_exposure=_param(analysis.light_exposure),
        duration=_param(analysis.duration),
        packaging=_param(analysis.packaging),
        storage_environment=_param(analysis.storage_environment),
        compliance_score=analysis.compliance_score,
        condition_status=analysis.condition_status,
        condition_summary=analysis.condition_summary,
        shelf_life_impact=analysis.shelf_life_impact,
        sub_scores=analysis.sub_scores,
        shelf_life_delta_days=analysis.shelf_life_delta_days,
        optimization_recommendations=analysis.optimization_recommendations,
        has_storage_data=analysis.has_storage_data,
        storage_type=analysis.rule.storage_type,
        storage_start_date=analysis.storage_start_date,
        current_date=analysis.current_date,
        days_stored=analysis.days_stored,
        remaining_storage_duration_days=analysis.remaining_storage_duration_days,
        available_quantity=batch.available_quantity,
        unit=batch.unit,
        shelf_life=shelf_life,
        image_analysis_context=image_context,
        recommendations=recommendations,
        consumption_priority=consumption_priority,
        waste_reduction=waste_reduction,
    ).model_dump()


@router.get("")
def list_storage_analysis(
    q: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Storage analysis for every visible batch."""
    query = _visible_batches_query(db, current_user)
    if category:
        query = query.where(FoodBatch.category == category)
    # FEFO: nearest expiry first so the batches needing attention come first.
    batches = db.scalars(query.order_by(FoodBatch.expiry_date.asc(), FoodBatch.id.asc()).limit(limit)).all()
    analyzer = StorageAnalyzer()
    results = []
    for batch in batches:
        analysis = _analysis_out(batch, analyzer)
        if q and q.lower() not in batch.food_name.lower() and q.lower() not in batch.batch_id.lower():
            continue
        analysis["batch_id"] = batch.batch_id
        analysis["food_name"] = batch.food_name
        analysis["category"] = batch.category
        analysis["storage_location"] = batch.storage_location
        results.append(analysis)
    return results


@router.post("/{batch_id}", response_model=StorageReadingOut)
def record_storage_reading(
    batch_id: str,
    payload: StorageReadingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a storage-condition reading and update the batch's live fields."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)

    updates = payload.model_dump(exclude_unset=True)
    updates.pop("notes", None)

    air = normalize_air_circulation(updates.get("air_circulation"))
    light = normalize_light_exposure(updates.get("light_exposure"))
    if air is None and "air_circulation" in updates:
        raise HTTPException(status_code=400, detail="air_circulation must be good, moderate or poor.")
    if light is None and "light_exposure" in updates:
        raise HTTPException(status_code=400, detail="light_exposure must be appropriate, low, moderate, high, controlled, excessive or not_applicable.")

    if updates.get("temperature_c") is not None:
        batch.temperature_c = updates["temperature_c"]
    if updates.get("humidity_pct") is not None:
        batch.humidity_pct = updates["humidity_pct"]
    if air is not None:
        batch.air_circulation = air
    if light is not None:
        batch.light_exposure = light

    analysis = StorageAnalyzer().analyze(
        batch_id=batch.batch_id,
        food_name=batch.food_name,
        category=batch.category,
        received_date=batch.received_date,
        temperature_c=batch.temperature_c,
        humidity_pct=batch.humidity_pct,
        air_circulation=batch.air_circulation,
        light_exposure=batch.light_exposure,
        packaging_type=batch.packaging_type,
        storage_location=batch.storage_location,
    )

    reading = StorageReading(
        batch_id_ref=batch.batch_id,
        user_id=current_user.id,
        temperature_c=batch.temperature_c,
        humidity_pct=batch.humidity_pct,
        air_circulation=batch.air_circulation,
        light_exposure=batch.light_exposure,
        compliance_score=analysis.compliance_score,
        notes=payload.notes,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/{batch_id}", response_model=dict)
def batch_storage(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Current storage analysis + recent readings for a batch."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)

    analysis = _analysis_out(batch, StorageAnalyzer(), db)
    readings = db.scalars(
        select(StorageReading)
        .where(StorageReading.batch_id_ref == batch.batch_id)
        .order_by(StorageReading.recorded_at.desc())
        .limit(10)
    ).all()

    analysis["recent_readings"] = [
        StorageReadingOut.model_validate(r).model_dump() for r in readings
    ]
    return analysis


@router.get("/history/{batch_id}", response_model=list[StorageReadingOut])
def storage_history(
    batch_id: str,
    limit: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Readings history for a batch."""
    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)
    readings = db.scalars(
        select(StorageReading)
        .where(StorageReading.batch_id_ref == batch.batch_id)
        .order_by(StorageReading.recorded_at.desc())
        .limit(limit)
    ).all()
    return [StorageReadingOut.model_validate(r) for r in readings]