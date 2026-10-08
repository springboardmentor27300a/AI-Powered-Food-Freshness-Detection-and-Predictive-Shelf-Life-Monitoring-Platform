"""
Analytics dashboard endpoints (Milestone 3).

- GET /analytics/dashboard  -> combined summary for the dashboard main view
- GET /analytics/freshness  -> freshness status distribution
- GET /analytics/shelf-life -> shelf-life bucket counts
- GET /analytics/storage    -> storage parameter compliance distribution
- GET /analytics/risk       -> spoilage-risk level counts
- GET /analytics/expiry     -> registered expiry bucket counts
- GET /analytics/trends     -> freshness / shelf-life trend from persisted history
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import User
from app.routers.batches import _get_batch_or_404
from app.services import analytics_service

# Platform analytics are staff/admin APIs: consumers are not allowed to call them.
router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_roles("retail_manager", "warehouse_operator", "quality_inspector", "administrator"))],
)


@router.get("/dashboard", response_model=dict)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Everything the analytics dashboard needs in one call."""
    from app.services.batch_insight import prediction_for_batch, score_for_batch, storage_for_batch
    from app.routers.batches import _visible_batches_query
    from app.models import FoodBatch

    batches = db.scalars(_visible_batches_query(db, current_user)).all()
    series = []
    for batch in batches:
        prediction = prediction_for_batch(db, batch)
        storage = storage_for_batch(batch)
        score = score_for_batch(batch, prediction, storage)
        series.append({
            "batch_id": batch.batch_id,
            "food_name": batch.food_name,
            "category": batch.category,
            "remaining_days": prediction.estimated_remaining_days,
            "risk": prediction.spoilage_risk,
            "freshness_status": score.freshness_status,
            "overall_score": score.overall_score,
            "expiry_date": batch.expiry_date.isoformat(),
        })

    return {
        "as_of": date.today().isoformat(),
        "inventory": analytics_service.inventory_insights(db, current_user),
        "freshness": analytics_service.freshness_distribution(db, current_user),
        "shelf_life": analytics_service.shelf_life_analytics(db, current_user),
        "storage": analytics_service.storage_analytics(db, current_user),
        "risk": analytics_service.risk_analytics(db, current_user),
        "expiry": analytics_service.expiry_analysis(db, current_user),
        "trends": analytics_service.trends(db, current_user),
        "series": series,
    }


@router.get("/freshness", response_model=dict)
def freshness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return analytics_service.freshness_distribution(db, current_user)


@router.get("/shelf-life", response_model=dict)
def shelf_life(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return analytics_service.shelf_life_analytics(db, current_user)


@router.get("/storage", response_model=dict)
def storage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return analytics_service.storage_analytics(db, current_user)


@router.get("/risk", response_model=dict)
def risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return analytics_service.risk_analytics(db, current_user)


@router.get("/expiry", response_model=dict)
def expiry(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return analytics_service.expiry_analysis(db, current_user)


@router.get("/trends", response_model=dict)
def trends(
    batch_id: str | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Freshness / shelf-life trend lines from persisted prediction history."""
    if batch_id:
        _get_batch_or_404(db, batch_id)  # 404 if missing (visibility handled downstream)
    return analytics_service.trends(db, current_user, batch_id=batch_id, days=days)