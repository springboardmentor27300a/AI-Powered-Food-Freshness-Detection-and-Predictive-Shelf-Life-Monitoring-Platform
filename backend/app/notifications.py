"""Authenticated in-app notification endpoints and alert generation."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import FoodItem, FreshnessAnalysis, Notification, ShelfLifePrediction, User
from .schemas import NotificationListResponse, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _add_once(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    severity: str,
    title: str,
    message: str,
    related_item_id: int | None = None,
    related_prediction_id: int | None = None,
    related_analysis_id: int | None = None,
) -> bool:
    """Insert an alert once per source record, so repeated generation is safe."""
    filters = [
        Notification.user_id == user_id,
        Notification.notification_type == notification_type,
    ]
    if related_analysis_id is not None:
        filters.append(Notification.related_analysis_id == related_analysis_id)
    elif related_prediction_id is not None:
        filters.append(Notification.related_prediction_id == related_prediction_id)
    elif related_item_id is not None:
        filters.append(Notification.related_item_id == related_item_id)
    else:
        return False

    if db.scalar(select(Notification.id).where(*filters).limit(1)) is not None:
        return False

    db.add(Notification(
        user_id=user_id,
        notification_type=notification_type,
        severity=severity,
        title=title,
        message=message,
        related_item_id=related_item_id,
        related_prediction_id=related_prediction_id,
        related_analysis_id=related_analysis_id,
    ))
    return True


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = list(db.scalars(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    ))
    unread_count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
    ) or 0
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total_count": len(notifications),
    }


@router.get("/unread")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
    ) or 0
    return {"unread_count": count}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.commit()
    return {"message": "Notifications marked as read", "updated_count": result.rowcount or 0}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.scalar(select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ))
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/generate")
def generate_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate idempotent alerts from the user's existing analysis and inventory."""
    generated = 0

    analyses = db.scalars(select(FreshnessAnalysis).where(
        FreshnessAnalysis.user_id == current_user.id,
    ))
    for analysis in analyses:
        classification = (analysis.classification or "").lower()
        name = analysis.item_name or "Food item"
        if classification in {"spoiled", "rotten"}:
            generated += _add_once(
                db, user_id=current_user.id, notification_type="freshness_alert",
                severity="critical", title="Freshness alert",
                message=f"{name} was classified as {analysis.classification}.",
                related_analysis_id=analysis.id,
            )
        if analysis.spoilage_probability >= 0.8:
            generated += _add_once(
                db, user_id=current_user.id, notification_type="spoilage_notification",
                severity="high", title="High spoilage probability",
                message=f"{name} has a high estimated spoilage probability. This model result is not a food-safety determination.",
                related_analysis_id=analysis.id,
            )

    predictions = db.scalars(select(ShelfLifePrediction).where(
        ShelfLifePrediction.user_id == current_user.id,
    ))
    for prediction in predictions:
        if (prediction.risk_level or "").lower() in {"high", "critical"} or prediction.remaining_shelf_life_days <= 1:
            generated += _add_once(
                db, user_id=current_user.id, notification_type="shelf_life_warning",
                severity="high", title="Shelf-life warning",
                message=f"{prediction.food_type} has {prediction.remaining_shelf_life_days} estimated shelf-life day(s) remaining.",
                related_prediction_id=prediction.id,
            )
        if (prediction.storage_compliance or "").lower() in {"needs_attention", "non_compliant"}:
            generated += _add_once(
                db, user_id=current_user.id, notification_type="storage_condition_alert",
                severity="warning", title="Storage conditions need attention",
                message=f"Storage conditions for {prediction.food_type} need attention.",
                related_prediction_id=prediction.id,
            )

    expired_items = db.scalars(select(FoodItem).where(
        FoodItem.created_by == current_user.id,
        FoodItem.expiry_date < date.today(),
    ))
    for item in expired_items:
        generated += _add_once(
            db, user_id=current_user.id, notification_type="inventory_expired",
            severity="critical", title="Expired inventory item",
            message=f"{item.name} passed its listed expiry date.",
            related_item_id=item.id,
        )

    db.commit()
    return {"count": generated}
