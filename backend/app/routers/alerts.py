"""
Notification/alert endpoints (Milestone 3).

- GET  /alerts             -> alerts for the visible inventory
- POST /alerts/generate    -> generate + persist alerts from real batch state
- POST /alerts/{id}/read   -> mark one alert read
- POST /alerts/read-all    -> mark all alerts read
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, User
from app.routers.batches import _get_batch_or_404, _visible_batches_query
from app.schemas import AlertAck, AlertOut
from app.services.alert_service import AlertService
from app.services.batch_insight import prediction_for_batch, score_for_batch, storage_for_batch

router = APIRouter(prefix="/alerts", tags=["Alerts"])


def _query_visible(db: Session, current_user: User):
    batches = db.scalars(_visible_batches_query(db, current_user)).all()
    ids = [b.batch_id for b in batches]
    return ids


def _persist_alerts(db: Session, current_user: User) -> int:
    """Generate alerts for all visible batches and persist the active ones.

    Alerts are owned by the BATCH OWNER (owning consumer/business creates the
    batch); staff roles can see everything but do not "own" other people's
    alerts. This keeps one batch's alerts with exactly one owner.
    """
    service = AlertService()
    count = 0
    for batch in _visible_batches(db, current_user):
        prediction = prediction_for_batch(db, batch)
        storage = storage_for_batch(batch)
        score = score_for_batch(batch, prediction, storage)
        for alert in service.generate_for_batch(batch, prediction, storage, score):
            existing = db.scalar(
                select(Alert).where(
                    Alert.batch_id_ref == batch.batch_id,
                    Alert.alert_type == alert.alert_type,
                    Alert.is_read.is_(False),
                ).limit(1)
            )
            if existing:
                continue
            db.add(Alert(
                batch_id_ref=batch.batch_id,
                user_id=batch.user_id,
                alert_type=alert.alert_type,
                severity=alert.severity,
                message=alert.message,
            ))
            count += 1
    db.commit()
    return count


def _visible_batches(db: Session, current_user: User):
    from app.models import FoodBatch
    return db.scalars(_visible_batches_query(db, current_user)).all()


@router.get("", response_model=list[AlertOut])
def list_alerts(
    alert_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    unread_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alerts for the visible inventory scope."""
    query = select(Alert).order_by(Alert.created_at.desc())
    if current_user.role == "consumer":
        query = query.where(Alert.user_id == current_user.id)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)
    if severity:
        query = query.where(Alert.severity == severity)
    if unread_only:
        query = query.where(Alert.is_read.is_(False))

    rows = db.scalars(query.limit(limit)).all()
    ids = set(_query_visible(db, current_user))
    return [r for r in rows if r.batch_id_ref is None or r.batch_id_ref in ids]


@router.post("/generate")
def generate_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and persist alerts from the current batch state."""
    count = _persist_alerts(db, current_user)
    return {"generated": count, "scope": "visible inventory"}


@router.post("/{alert_id}/read", response_model=AlertOut)
def mark_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found.")
    if current_user.role == "consumer" and alert.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Alert).where(Alert.is_read.is_(False))
    if current_user.role == "consumer":
        query = query.where(Alert.user_id == current_user.id)
    count = 0
    for alert in db.scalars(query).all():
        alert.is_read = True
        count += 1
    db.commit()
    return {"marked_read": count}