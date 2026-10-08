"""
Aggregated inventory insights and analytics (Milestone 3).

All numbers are computed from real batch data and are role-scoped exactly like
/batches (consumers only see their own inventory; staff roles see everything).
Freshness/risk values use the same rule engines as the detail endpoints so the
dashboard never disagrees with the shelf-life page.
"""
from collections import Counter
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FoodBatch, ShelfLifePrediction, User
from app.routers.batches import _visible_batches_query
from app.services.batch_insight import build_batch_insight, prediction_for_batch, storage_for_batch


def _visible(db: Session, user: User):
    return db.scalars(_visible_batches_query(db, user)).all()


def inventory_insights(db: Session, user: User) -> dict:
    """Summary cards, status counts, at-risk & waste-risk inventory, averages."""
    batches = _visible(db, user)
    total = len(batches)

    insights = {
        "total_products": total,
        "fresh_count": 0,
        "acceptable_count": 0,
        "needs_attention_count": 0,
        "spoiled_count": 0,
        "expired_count": 0,
        "expiring_soon_count": 0,      # registered label states
        "at_risk_count": 0,            # predicted risk high/critical
        "expiring_within_7_count": 0,
        "average_freshness_score": 0.0,
        "average_shelf_life_days": 0.0,
        "average_storage_compliance": 0.0,
        "waste_risk_items": [],
        "by_category": {},
    }

    if total == 0:
        return insights

    sum_freshness = 0.0
    sum_shelf = 0.0
    sum_storage = 0.0
    storage_count = 0
    cat_counts = Counter()
    at_risk_items = []

    for batch in batches:
        prediction = prediction_for_batch(db, batch)
        storage = storage_for_batch(batch)
        score = build_batch_insight(db, batch)["score"]

        cat_counts[batch.category] += 1
        sum_freshness += score.overall_score
        sum_shelf += prediction.estimated_remaining_days

        if score.freshness_status == "Fresh":
            insights["fresh_count"] += 1
        elif score.freshness_status == "Acceptable":
            insights["acceptable_count"] += 1
        elif score.freshness_status == "Needs Attention":
            insights["needs_attention_count"] += 1
        else:
            insights["spoiled_count"] += 1

        if prediction.estimated_remaining_days <= 0:
            insights["expired_count"] += 1
        if 0 < prediction.estimated_remaining_days <= 7:
            insights["expiring_within_7_count"] += 1

        if prediction.spoilage_risk in ("High", "Critical"):
            insights["at_risk_count"] += 1
            at_risk_items.append(_waste_item(batch, prediction, score))

        if storage.has_storage_data:
            sum_storage += storage.compliance_score
            storage_count += 1

    insights["average_freshness_score"] = round(sum_freshness / total, 1)
    insights["average_shelf_life_days"] = round(sum_shelf / total, 1)
    insights["average_storage_compliance"] = round(sum_storage / storage_count, 1) if storage_count else 0.0
    insights["by_category"] = dict(sorted(cat_counts.items()))

    at_risk_items.sort(key=lambda i: i["remaining_days"])
    insights["waste_risk_items"] = at_risk_items[:20]
    return insights


def _waste_item(batch, prediction, score) -> dict:
    return {
        "batch_id": batch.batch_id,
        "food_name": batch.food_name,
        "category": batch.category,
        "available_quantity": batch.available_quantity,
        "unit": batch.unit,
        "remaining_days": prediction.estimated_remaining_days,
        "expected_expiry_date": prediction.expected_expiry_date.isoformat(),
        "freshness_status": score.freshness_status,
        "spoilage_risk": prediction.spoilage_risk,
        "risk_score": prediction.risk_score,
    }


def freshness_distribution(db: Session, user: User) -> dict:
    batches = _visible(db, user)
    counts = Counter()
    for batch in batches:
        score = build_batch_insight(db, batch)["score"]
        counts[score.freshness_status] += 1
    return {
        "Fresh": counts.get("Fresh", 0),
        "Acceptable": counts.get("Acceptable", 0),
        "Needs Attention": counts.get("Needs Attention", 0),
        "Spoiled": counts.get("Spoiled", 0),
        "total": len(batches),
    }


def shelf_life_analytics(db: Session, user: User) -> dict:
    batches = _visible(db, user)
    remaining = [prediction_for_batch(db, b).estimated_remaining_days for b in batches]
    avg = round(sum(remaining) / len(remaining), 1) if remaining else 0.0

    def count_within(limit: int) -> int:
        return sum(1 for r in remaining if r <= limit)

    return {
        "average_remaining_days": avg,
        "expiring_in_1_day": count_within(1),
        "expiring_in_3_days": count_within(3),
        "expiring_in_7_days": count_within(7),
        "expired": sum(1 for r in remaining if r <= 0),
        "healthy": sum(1 for r in remaining if r > 7),
    }


def expiry_analysis(db: Session, user: User) -> dict:
    today = date.today()
    batches = _visible(db, user)
    bucket = {"expired": 0, "today": 0, "within_1_day": 0, "within_3_days": 0, "within_7_days": 0}
    for b in batches:
        days = (b.expiry_date - today).days
        if days < 0:
            bucket["expired"] += 1
        elif days == 0:
            bucket["today"] += 1
        elif days <= 1:
            bucket["within_1_day"] += 1
        elif days <= 3:
            bucket["within_3_days"] += 1
        elif days <= 7:
            bucket["within_7_days"] += 1
    return bucket


def storage_analytics(db: Session, user: User) -> dict:
    batches = _visible(db, user)
    agg = {
        "temperature": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
        "humidity": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
        "air_circulation": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
        "light_exposure": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
        "duration": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
        "packaging": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
        "storage_environment": {"good": 0, "warning": 0, "critical": 0, "unknown": 0},
    }
    compliance = []
    monitored = 0
    by_condition = {"good": 0, "warning": 0, "unsuitable": 0, "critical": 0, "unknown": 0}
    rule_coverage = {"food": 0, "category": 0, "general": 0}
    for b in batches:
        storage = storage_for_batch(b)
        for name in agg:
            status = getattr(storage, name)
            key = status.status if status.status in agg[name] else "unknown"
            agg[name][key] += 1
        if storage.has_storage_data:
            compliance.append(storage.compliance_score)
            monitored += 1
        by_condition[storage.condition_status.lower()] += 1
        rule_coverage[storage.rule.rule_scope] += 1
        agg["duration"][storage.duration.status] += 1

    return {
        "by_parameter": agg,
        "overall_compliance": round(sum(compliance) / len(compliance), 1) if compliance else 0.0,
        "monitored_batches": monitored,
        "total_batches": len(batches),
        "by_condition": by_condition,
        "rule_coverage": rule_coverage,
    }


def risk_analytics(db: Session, user: User) -> dict:
    batches = _visible(db, user)
    counts = Counter()
    for b in batches:
        counts[prediction_for_batch(db, b).spoilage_risk] += 1
    return {
        "low": counts.get("Low", 0),
        "moderate": counts.get("Moderate", 0),
        "high": counts.get("High", 0),
        "critical": counts.get("Critical", 0),
        "total": len(batches),
    }


def trends(db: Session, user: User, batch_id: str | None = None, days: int = 30) -> dict:
    """Freshness & shelf-life trend lines from real persisted prediction history."""
    horizon = date.today() - timedelta(days=days)
    query = select(ShelfLifePrediction).order_by(ShelfLifePrediction.predicted_on.asc())
    if batch_id:
        query = query.where(ShelfLifePrediction.batch_id_ref == batch_id)
    records = db.scalars(query).all()

    freshness_points = []
    shelf_points = []
    seen = set()
    for rec in records:
        if rec.user_id != user.id and user.role == "consumer":
            continue
        if rec.predicted_on in seen:
            continue
        seen.add(rec.predicted_on)
        key = rec.predicted_on.isoformat()
        freshness_points.append({"date": key, "value": rec.freshness_score})
        shelf_points.append({"date": key, "value": rec.estimated_remaining_days})

    # If no history exists (new feature), report empty so the UI shows a hint
    # instead of inventing fake historical records.
    return {
        "freshness_trend": freshness_points,
        "shelf_life_trend": shelf_points,
        "note": "History starts being recorded from the current implementation."
                if not freshness_points else None,
    }