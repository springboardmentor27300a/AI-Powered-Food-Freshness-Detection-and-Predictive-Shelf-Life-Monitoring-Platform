"""
/api/notifications — notification management.

Permissions:
  - View: any authenticated user
  - Mark read: any authenticated user
"""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse,
)
from app.services.notification_service import create_notification

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
)
from app.services.notification_service import (
    create_notification,
    create_notification_for_all_users,
)

@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    return (
        query
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {"count": count}


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(notification)

    return notification


@router.patch("/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .all()
    )

    now = datetime.now(timezone.utc)

    for notification in notifications:
        notification.is_read = True
        notification.read_at = now

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated": len(notifications),
    }
@router.post("/test")
def create_test_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = create_notification(
        db,
        user_id=current_user.id,
        title="FoodCare Test Alert",
        message="This is a test notification from the FoodCare alert system.",
        severity="info",
        notification_type="platform",
    )

    return {
        "message": "Test notification created",
        "notification_id": notification.id,
    }
