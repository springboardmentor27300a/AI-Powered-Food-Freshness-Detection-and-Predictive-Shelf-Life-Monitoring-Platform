"""
Inventory insights endpoints (Milestone 3).

- GET /insights/inventory          -> aggregate inventory insight cards + at-risk items
- GET /insights/batch/{batch_id}   -> full single-batch insight (prediction + storage + score)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import User
from app.routers.batches import _ensure_can_view, _get_batch_or_404
from app.services.analytics_service import inventory_insights
from app.services.batch_insight import build_batch_insight, same_product_batches

# Inventory-quality / waste insights are retail, warehouse and admin APIs.
router = APIRouter(
    prefix="/insights",
    tags=["Inventory Insights"],
    dependencies=[Depends(require_roles("retail_manager", "warehouse_operator", "administrator"))],
)


@router.get("/inventory", response_model=dict)
def inventory_insights_endpoint(
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    expiring_within: int | None = Query(default=None, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Inventory insight summary.

    Filters (category / status / risk / expiring_within) are applied over the
    same rule-engine values used elsewhere, so the cards stay consistent.
    """
    insights = inventory_insights(db, current_user)
    items = _filtered_items(db, current_user, category, status, risk, expiring_within)
    insights["filtered_items"] = items
    insights["filtered_count"] = len(items)
    return insights


def _filtered_items(db: Session, current_user: User, category, status, risk, expiring_within) -> list:
    from app.models import FoodBatch
    from app.routers.batches import _visible_batches_query
    from app.services.batch_insight import prediction_for_batch, score_for_batch, storage_for_batch

    batches = db.scalars(_visible_batches_query(db, current_user)).all()
    items = []
    for batch in batches:
        prediction = prediction_for_batch(db, batch)
        storage = storage_for_batch(batch)
        score = score_for_batch(batch, prediction, storage)
        if category and batch.category != category:
            continue
        if status and score.freshness_status != status:
            continue
        if risk and prediction.spoilage_risk != risk:
            continue
        if expiring_within is not None and prediction.estimated_remaining_days > expiring_within:
            continue
        items.append({
            "batch_id": batch.batch_id,
            "food_name": batch.food_name,
            "category": batch.category,
            "available_quantity": batch.available_quantity,
            "unit": batch.unit,
            "storage_location": batch.storage_location,
            "remaining_days": prediction.estimated_remaining_days,
            "expected_expiry_date": prediction.expected_expiry_date.isoformat(),
            "spoilage_risk": prediction.spoilage_risk,
            "freshness_status": score.freshness_status,
            "overall_score": score.overall_score,
            "freshness_score": prediction.freshness_score,
        })
    items.sort(key=lambda i: i["remaining_days"])
    return items


@router.get("/batch/{batch_id}", response_model=dict)
def batch_insight(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Complete insight for one batch."""
    from app.services.batch_insight import prediction_for_batch, score_for_batch, storage_for_batch

    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(current_user, batch)

    prediction = prediction_for_batch(db, batch)
    storage = storage_for_batch(batch)
    score = score_for_batch(batch, prediction, storage)
    insight = build_batch_insight(db, batch, same_product_batches(db, batch))

    return {
        "batch_id": batch.batch_id,
        "food_name": batch.food_name,
        "category": batch.category,
        "storage_location": batch.storage_location,
        "available_quantity": batch.available_quantity,
        "unit": batch.unit,
        "received_date": batch.received_date.isoformat(),
        "expiry_date": batch.expiry_date.isoformat(),
        "prediction": {
            "estimated_remaining_days": prediction.estimated_remaining_days,
            "expected_expiry_date": prediction.expected_expiry_date.isoformat(),
            "calendar_remaining_days": prediction.calendar_remaining_days,
            "freshness_score": prediction.freshness_score,
            "shelf_life_score": prediction.shelf_life_score,
            "storage_condition_score": prediction.storage_condition_score,
            "spoilage_risk": prediction.spoilage_risk,
            "risk_score": prediction.risk_score,
            "factors": prediction.factors,
        },
        "storage": {
            "compliance_score": storage.compliance_score,
            "has_storage_data": storage.has_storage_data,
            "optimization_recommendations": storage.optimization_recommendations,
            "temperature": {"value": storage.temperature.value, "status": storage.temperature.status,
                            "recommended": storage.temperature.recommended},
            "humidity": {"value": storage.humidity.value, "status": storage.humidity.status,
                         "recommended": storage.humidity.recommended},
        },
        "score": {
            "visual_condition_score": score.visual_condition_score,
            "storage_condition_score": score.storage_condition_score,
            "shelf_life_score": score.shelf_life_score,
            "product_age_score": score.product_age_score,
            "overall_score": score.overall_score,
            "freshness_status": score.freshness_status,
            "weights": score.weights,
            "notes": score.notes,
        },
        "recommendations": [
            {"category": r.category, "message": r.message, "priority": r.priority} for r in insight["recommendations"]
        ],
        "alerts": [
            {"alert_type": a.alert_type, "severity": a.severity, "message": a.message} for a in insight["alerts"]
        ],
    }