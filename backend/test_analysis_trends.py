from datetime import datetime, timedelta

from app.auth import hash_password
from app.models import FreshnessAnalysis, User


def _add_analysis(db, user_id, *, created_at, quality_score, spoilage_probability):
    analysis = FreshnessAnalysis(
        user_id=user_id,
        item_name="Trend test item",
        classification="Acceptable",
        confidence=0.8,
        quality_score=quality_score,
        spoilage_probability=spoilage_probability,
        predicted_class="freshapples",
        created_at=created_at,
    )
    db.add(analysis)
    db.commit()
    return analysis


def test_analysis_trends_aggregate_user_history(client, db, consumer_user, consumer_headers):
    today = datetime.utcnow()
    _add_analysis(
        db,
        consumer_user.id,
        created_at=today - timedelta(hours=1),
        quality_score=80,
        spoilage_probability=0.2,
    )
    _add_analysis(
        db,
        consumer_user.id,
        created_at=today - timedelta(hours=2),
        quality_score=60,
        spoilage_probability=0.4,
    )
    _add_analysis(
        db,
        consumer_user.id,
        created_at=today - timedelta(days=40),
        quality_score=10,
        spoilage_probability=0.9,
    )

    other_user = User(
        full_name="Other User",
        email="other-trend-user@example.com",
        password_hash=hash_password("password123"),
        role="consumer",
    )
    db.add(other_user)
    db.commit()
    _add_analysis(
        db,
        other_user.id,
        created_at=today,
        quality_score=0,
        spoilage_probability=1.0,
    )

    response = client.get("/analysis/trends?days=30", headers=consumer_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["days"] == 30
    assert data["assessment_count"] == 2
    assert data["points"] == [
        {
            "date": today.date().isoformat(),
            "assessment_count": 2,
            "average_quality_score": 70.0,
            "average_spoilage_probability": 0.3,
        }
    ]


def test_analysis_trends_requires_authentication_and_valid_window(client, consumer_headers):
    assert client.get("/analysis/trends").status_code == 401
    assert client.get("/analysis/trends?days=0", headers=consumer_headers).status_code == 422
    assert client.get("/analysis/trends?days=366", headers=consumer_headers).status_code == 422
