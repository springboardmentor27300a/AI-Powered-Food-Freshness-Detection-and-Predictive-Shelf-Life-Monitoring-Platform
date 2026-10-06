from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: Optional[UUID],
    title: str,
    message: str,
    severity: str,
    notification_type: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    action_url: Optional[str] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        severity=severity,
        notification_type=notification_type,
        reference_type=reference_type,
        reference_id=reference_id,
        action_url=action_url,
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


def create_notification_for_all_users(
    db: Session,
    *,
    title: str,
    message: str,
    severity: str,
    notification_type: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    action_url: Optional[str] = None,
):
    from app.models.user import User

    users = db.query(User).all()

    notifications = []

    for user in users:
        notification = Notification(
            user_id=user.id,
            title=title,
            message=message,
            severity=severity,
            notification_type=notification_type,
            reference_type=reference_type,
            reference_id=reference_id,
            action_url=action_url,
        )

        db.add(notification)
        notifications.append(notification)

    db.commit()

    for notification in notifications:
        db.refresh(notification)

    return notifications