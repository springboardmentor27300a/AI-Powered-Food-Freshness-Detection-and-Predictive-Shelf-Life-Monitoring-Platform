"""
Combined per-item analysis endpoint (Milestone 3).

Bundles shelf-life estimation (current + historical trend), the
overall food health score breakdown, rule-based recommendations, the
latest storage condition, and item-specific alerts into one response
so the Freshness Analysis page can render all of its new sections/cards
with a single request.

Ownership is enforced exactly as in app/api/inventory.py and
app/api/freshness.py: the item must belong to the authenticated user,
or a 404 is returned.
"""
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.alerts import generate_alerts_for_item
from app.core.deps import get_current_user
from app.core.access import inventory_scope, record_scope
from app.core.food_rules import build_storage_guidance
from app.core.freshness_scoring import determine_trend_direction
from app.core.health_score import calculate_overall_health_score
from app.core.recommendations import generate_recommendations
from app.core.shelf_life import estimate_shelf_life, product_age_score, shelf_life_score
from app.database import get_db
from app.models.freshness_assessment import FreshnessAssessment
from app.models.inventory import FoodInventory
from app.models.storage_condition import StorageCondition
from app.models.user import User
from app.schemas.analysis import (
    AlertResponse,
    HealthScoreResponse,
    ItemAnalysisResponse,
    RecommendationResponse,
    ShelfLifeResponse,
    StorageGuidanceResponse,
    ShelfLifeTrendPoint,
    ShelfLifeTrendResponse,
)
from app.schemas.storage_condition import StorageConditionResponse

router = APIRouter(tags=["Analysis"])

# Neutral fallback score (out of 100) used only when no freshness
# assessment or storage reading exists yet for an item, so the health
# score can still be computed rather than failing outright.
NEUTRAL_FALLBACK_SCORE = 70.0


def _get_owned_inventory_item_or_404(
    db: Session, inventory_id: uuid.UUID, current_user: User
) -> FoodInventory:
    item = (
        db.query(FoodInventory)
        .filter(FoodInventory.id == inventory_id, inventory_scope(current_user))
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")
    return item


def _nearest_storage_at_or_before(
    storage_history: List[StorageCondition], as_of: datetime
) -> Optional[StorageCondition]:
    candidates = [s for s in storage_history if s.recorded_at <= as_of]
    if not candidates:
        return None
    return max(candidates, key=lambda s: s.recorded_at)


def _shelf_life_response(r) -> ShelfLifeResponse:
    return ShelfLifeResponse(
        remaining_shelf_life_days=r.remaining_shelf_life_days,
        original_expiry_date=r.original_expiry_date,
        analysis_date=r.analysis_date,
        forecasted_expiry_date=r.forecasted_expiry_date,
        is_expired=r.is_expired,
        risk_level=r.risk_level,
        risk_reasons=r.risk_reasons,
        factors=r.factors,
        matched_food_rule=r.matched_food_rule,
        storage_method_used=r.storage_method_used,
        method=r.method,
    )


@router.get(
    "/api/inventory/{inventory_id}/analysis",
    response_model=ItemAnalysisResponse,
    summary="Get shelf-life, health score, recommendations, and alerts for one inventory item",
)
def get_item_analysis(
    inventory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _get_owned_inventory_item_or_404(db, inventory_id, current_user)
    today = datetime.now(timezone.utc).date()

    assessments = (
        db.query(FreshnessAssessment)
        .filter(
            FreshnessAssessment.inventory_item_id == inventory_id,
            record_scope(FreshnessAssessment.user_id, current_user),
        )
        .order_by(FreshnessAssessment.created_at.asc())
        .all()
    )
    storage_history = (
        db.query(StorageCondition)
        .filter(
            StorageCondition.inventory_item_id == inventory_id,
            record_scope(StorageCondition.user_id, current_user),
        )
        .order_by(StorageCondition.recorded_at.asc())
        .all()
    )

    latest_assessment: Optional[FreshnessAssessment] = assessments[-1] if assessments else None
    latest_storage: Optional[StorageCondition] = storage_history[-1] if storage_history else None

    latest_freshness_category = latest_assessment.freshness_category if latest_assessment else None
    latest_storage_status = latest_storage.compliance_status if latest_storage else None

    latest_temperature = latest_storage.temperature_celsius if latest_storage else None
    latest_humidity = latest_storage.humidity_percent if latest_storage else None

    trend_direction = None
    if len(assessments) >= 2:
        trend_direction = determine_trend_direction(
            [a.freshness_score for a in reversed(assessments)]
        )

    # ---- Current shelf life (food-specific; see app/core/shelf_life.py) ----
    current_result = estimate_shelf_life(
        food_name=item.food_name,
        category=item.category,
        purchase_date=item.purchase_date,
        expiry_date=item.expiry_date,
        as_of=today,
        freshness_category=latest_freshness_category,
        storage_status=latest_storage_status,
        storage_temperature_celsius=latest_temperature,
        storage_location_text=item.storage_location,
        trend_direction=trend_direction,
    )

    # ---- Historical trend points (real data only, one per assessment) ----
    trend_points: List[ShelfLifeTrendPoint] = []
    for assessment in assessments:
        as_of_date = assessment.created_at.date()
        storage_at_time = _nearest_storage_at_or_before(storage_history, assessment.created_at)
        point_result = estimate_shelf_life(
            food_name=item.food_name,
            category=item.category,
            purchase_date=item.purchase_date,
            expiry_date=item.expiry_date,
            as_of=as_of_date,
            freshness_category=assessment.freshness_category,
            storage_status=storage_at_time.compliance_status if storage_at_time else None,
            storage_temperature_celsius=storage_at_time.temperature_celsius if storage_at_time else None,
            storage_location_text=item.storage_location,
        )
        trend_points.append(
            ShelfLifeTrendPoint(
                assessment_date=assessment.created_at,
                remaining_shelf_life_days=point_result.remaining_shelf_life_days,
                freshness_category=assessment.freshness_category,
                freshness_score=assessment.freshness_score,
            )
        )

    shelf_life_trend = ShelfLifeTrendResponse(
        current=_shelf_life_response(current_result),
        points=trend_points,
        has_sufficient_history=len(trend_points) >= 2,
    )

    # ---- Overall health score ----
    visual_score = float(latest_assessment.freshness_score) if latest_assessment else NEUTRAL_FALLBACK_SCORE
    storage_score = NEUTRAL_FALLBACK_SCORE
    if latest_storage is not None:
        from app.core.storage_scoring import evaluate_storage_conditions
        storage_score = evaluate_storage_conditions(
            item.category, latest_storage.temperature_celsius, latest_storage.humidity_percent
        ).storage_score

    sl_score = shelf_life_score(current_result.remaining_shelf_life_days, item.purchase_date, item.expiry_date)
    age_score = product_age_score(item.purchase_date, item.expiry_date, today)

    breakdown = calculate_overall_health_score(
        visual_condition_score=visual_score,
        storage_condition_score=storage_score,
        shelf_life_score=sl_score,
        product_age_score=age_score,
    )
    health_score_response = HealthScoreResponse(**breakdown.__dict__)

    # ---- Storage guidance (always present, even with no readings) ----
    guidance = build_storage_guidance(
        food_name=item.food_name,
        category=item.category,
        storage_location=item.storage_location,
        temperature_celsius=latest_temperature,
        humidity_percent=latest_humidity,
    )
    storage_guidance_response = StorageGuidanceResponse(
        basis=guidance.basis,
        rule_label=guidance.rule_label,
        recommended_method=guidance.recommended_method,
        temperature_range_c=list(guidance.temperature_range_c) if guidance.temperature_range_c else None,
        humidity_range_percent=list(guidance.humidity_range_percent) if guidance.humidity_range_percent else None,
        packaging=guidance.packaging,
        handling=guidance.handling,
        actual_method=guidance.actual_method,
        has_readings=guidance.has_readings,
        comparison_notes=guidance.comparison_notes,
    )

    # ---- Recommendations ----
    spoilage_probability = latest_assessment.spoilage_probability if latest_assessment else None
    recs = generate_recommendations(
        freshness_category=latest_freshness_category,
        spoilage_probability=spoilage_probability,
        remaining_shelf_life_days=current_result.remaining_shelf_life_days,
        risk_level=current_result.risk_level,
        storage_status=latest_storage_status,
        quantity=item.quantity,
        has_storage_data=latest_storage is not None,
        storage_guidance=guidance,
        is_expired=current_result.is_expired,
    )
    recommendation_responses = [RecommendationResponse(type=r.type, message=r.message) for r in recs]

    # ---- Alerts for this item ----
    raw_alerts = generate_alerts_for_item(
        food_name=item.food_name,
        freshness_category=latest_freshness_category,
        remaining_shelf_life_days=current_result.remaining_shelf_life_days,
        storage_status=latest_storage_status,
    )
    alert_responses = [
        AlertResponse(
            type=a.type, severity=a.severity, message=a.message,
            inventory_item_id=item.id, food_name=item.food_name,
        )
        for a in raw_alerts
    ]

    latest_storage_dict = (
        StorageConditionResponse.model_validate(latest_storage).model_dump(mode="json")
        if latest_storage is not None
        else None
    )

    return ItemAnalysisResponse(
        inventory_item_id=item.id,
        shelf_life=shelf_life_trend,
        health_score=health_score_response,
        recommendations=recommendation_responses,
        latest_storage_condition=latest_storage_dict,
        storage_guidance=storage_guidance_response,
        alerts=alert_responses,
    )
