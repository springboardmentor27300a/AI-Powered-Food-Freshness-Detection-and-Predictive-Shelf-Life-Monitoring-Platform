"""Tests for M4 Notification & Alert System."""
import pytest
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, Notification
from app.auth import hash_password, create_token

# Uses shared conftest.py fixtures: client, db, setup_db, consumer_user, consumer_headers, admin_user, admin_headers, etc.


@pytest.fixture
def consumer_headers(consumer_user):
    token = create_token(consumer_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    token = create_token(admin_user)
    return {"Authorization": f"Bearer {token}"}


def test_notification_creation(client, consumer_headers, consumer_user, db):
    """Test that notifications can be created and stored."""
    # Create a spoiled freshness analysis
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Test Apple",
        classification="Spoiled",
        confidence=0.95,
        quality_score=20,
        spoilage_probability=0.9,
    )
    db.add(analysis)
    db.commit()

    # Generate notifications
    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1

    # Verify notification was created
    notifications = db.query(Notification).filter(Notification.user_id == consumer_user.id).all()
    assert len(notifications) >= 1
    assert any(n.notification_type == "freshness_alert" for n in notifications)


def test_notification_retrieval(client, consumer_headers, consumer_user, db):
    """Test that notifications can be retrieved."""
    # Create a notification directly
    notif = Notification(
        user_id=consumer_user.id,
        notification_type="platform_notification",
        severity="info",
        title="Test Notification",
        message="This is a test notification",
    )
    db.add(notif)
    db.commit()

    response = client.get("/notifications", headers=consumer_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 1
    assert data["unread_count"] >= 1
    assert len(data["notifications"]) >= 1


def test_notification_response_has_consistent_counts_when_empty(client, consumer_headers):
    response = client.get("/notifications", headers=consumer_headers)
    assert response.status_code == 200
    assert response.json() == {
        "notifications": [],
        "unread_count": 0,
        "total_count": 0,
    }


def test_user_cannot_mark_another_users_notification_read(
    client, consumer_headers, retail_manager_user, db
):
    notification = Notification(
        user_id=retail_manager_user.id,
        notification_type="platform_notification",
        severity="info",
        title="Private notification",
        message="Only its owner can read this notification.",
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    response = client.patch(
        f"/notifications/{notification.id}/read", headers=consumer_headers
    )
    assert response.status_code == 404
    db.refresh(notification)
    assert notification.is_read is False


def test_unread_notification_count(client, consumer_headers, consumer_user, db):
    """Test unread notification count endpoint."""
    # Create notifications
    for i in range(3):
        db.add(Notification(
            user_id=consumer_user.id,
            notification_type="platform_notification",
            severity="info",
            title=f"Test {i}",
            message=f"Message {i}",
        ))
    db.commit()

    response = client.get("/notifications/unread", headers=consumer_headers)
    assert response.status_code == 200
    assert response.json()["unread_count"] == 3


def test_mark_notification_as_read(client, consumer_headers, consumer_user, db):
    """Test marking a single notification as read."""
    notif = Notification(
        user_id=consumer_user.id,
        notification_type="platform_notification",
        severity="info",
        title="Test",
        message="Test message",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    response = client.patch(f"/notifications/{notif.id}/read", headers=consumer_headers)
    assert response.status_code == 200

    db.refresh(notif)
    assert notif.is_read is True


def test_mark_all_notifications_read(client, consumer_headers, consumer_user, db):
    """Test marking all notifications as read."""
    for i in range(3):
        db.add(Notification(
            user_id=consumer_user.id,
            notification_type="platform_notification",
            severity="info",
            title=f"Test {i}",
            message=f"Message {i}",
        ))
    db.commit()

    response = client.patch("/notifications/read-all", headers=consumer_headers)
    assert response.status_code == 200

    unread = db.query(Notification).filter(
        Notification.user_id == consumer_user.id,
        Notification.is_read == False,
    ).count()
    assert unread == 0


def test_user_notification_isolation(client, consumer_headers, consumer_user, db):
    """Test that users cannot see other users' notifications."""
    # Create another user
    other_user = User(
        full_name="Other User",
        email="other@test.com",
        password_hash=hash_password("pass123"),
        role="consumer",
    )
    db.add(other_user)
    db.commit()

    # Create notification for other user
    db.add(Notification(
        user_id=other_user.id,
        notification_type="platform_notification",
        severity="info",
        title="Other User Notification",
        message="This should not be visible",
    ))
    db.commit()

    # Consumer should not see other user's notification
    response = client.get("/notifications", headers=consumer_headers)
    data = response.json()
    assert all(n["title"] != "Other User Notification" for n in data["notifications"])


def test_freshness_alert_generation(client, consumer_headers, consumer_user, db):
    """Test freshness alert is generated for spoiled items."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Rotten Tomato",
        classification="Spoiled",
        confidence=0.92,
        quality_score=15,
        spoilage_probability=0.88,
    )
    db.add(analysis)
    db.commit()

    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200

    notifications = db.query(Notification).filter(
        Notification.user_id == consumer_user.id,
        Notification.notification_type == "freshness_alert",
    ).all()
    assert len(notifications) >= 1
    assert notifications[0].severity == "critical"


def test_shelf_life_warning_generation(client, consumer_headers, consumer_user, db):
    """Test shelf-life warning is generated for high-risk predictions."""
    from datetime import date
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="tomato",
        remaining_shelf_life_days=1,
        predicted_expiry_date=date(2026, 10, 1),
        risk_level="high",
        official_freshness_score=30,
        visual_condition_score=50,
        storage_condition_score=40,
        shelf_life_score=20,
        product_age_score=60,
        input_snapshot='{"temperature_c": 25}',
        recommendations='[]',
        storage_compliance="needs_attention",
    )
    db.add(pred)
    db.commit()

    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200

    notifications = db.query(Notification).filter(
        Notification.user_id == consumer_user.id,
        Notification.notification_type == "shelf_life_warning",
    ).all()
    assert len(notifications) >= 1


def test_spoilage_notification_generation(client, consumer_headers, consumer_user, db):
    """Test spoilage notification for high spoilage probability."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Spoiled Fish",
        classification="Spoiled",
        confidence=0.88,
        quality_score=10,
        spoilage_probability=0.85,
    )
    db.add(analysis)
    db.commit()

    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200

    notifications = db.query(Notification).filter(
        Notification.user_id == consumer_user.id,
        Notification.notification_type == "spoilage_notification",
    ).all()
    assert len(notifications) >= 1


def test_storage_alert_generation(client, consumer_headers, consumer_user, db):
    """Test storage condition alert for non-compliant predictions."""
    from datetime import date
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="seafood",
        remaining_shelf_life_days=3,
        predicted_expiry_date=date(2026, 10, 3),
        risk_level="moderate",
        official_freshness_score=50,
        visual_condition_score=70,
        storage_condition_score=30,
        shelf_life_score=40,
        product_age_score=80,
        input_snapshot='{"temperature_c": 5}',
        recommendations='[]',
        storage_compliance="needs_attention",
    )
    db.add(pred)
    db.commit()

    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200

    notifications = db.query(Notification).filter(
        Notification.user_id == consumer_user.id,
        Notification.notification_type == "storage_condition_alert",
    ).all()
    assert len(notifications) >= 1


def test_inventory_alert_generation(client, consumer_headers, consumer_user, db):
    """Test inventory alert for expired items."""
    from datetime import date, timedelta
    yesterday = date.today() - timedelta(days=1)
    item = FoodItem(
        name="Expired Milk",
        category="Dairy",
        batch_number="B-001",
        quantity=1,
        expiry_date=yesterday,
        created_by=consumer_user.id,
    )
    db.add(item)
    db.commit()

    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200

    notifications = db.query(Notification).filter(
        Notification.user_id == consumer_user.id,
        Notification.notification_type == "inventory_expired",
    ).all()
    assert len(notifications) >= 1


def test_no_alerts_case(client, consumer_headers, consumer_user, db):
    """Test that no alerts are generated when there is no concerning data."""
    response = client.post("/notifications/generate", headers=consumer_headers)
    assert response.status_code == 200
    assert response.json()["count"] == 0

    # Verify empty notification list
    response = client.get("/notifications", headers=consumer_headers)
    data = response.json()
    assert data["total_count"] == 0
    assert data["unread_count"] == 0


def test_admin_can_access_admin_endpoints(client, admin_headers):
    """Test that admin can access admin endpoints."""
    response = client.get("/admin/users", headers=admin_headers)
    assert response.status_code == 200

    response = client.get("/admin/stats", headers=admin_headers)
    assert response.status_code == 200


def test_non_admin_cannot_access_admin_endpoints(client, consumer_headers):
    """Test that non-admin users cannot access admin endpoints."""
    response = client.get("/admin/users", headers=consumer_headers)
    assert response.status_code == 403

    response = client.get("/admin/stats", headers=consumer_headers)
    assert response.status_code == 403


def test_notification_requires_auth(client):
    """Test that notification endpoints require authentication."""
    response = client.get("/notifications")
    assert response.status_code == 401

    response = client.post("/notifications/generate")
    assert response.status_code == 401
