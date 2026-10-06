"""
app/services/analytics_service.py — every number here comes from a real
query against the database. Nothing is hardcoded.
"""
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.batch import Batch, BatchStatus
from app.models.food_item import FoodCategory, FoodItem
from app.models.report import FreshnessCategory, FreshnessReport
from app.models.storage import StorageReading
from app.models.user import User, UserRole
from app.services import cnn_service


def inventory_overview(db: Session) -> dict:
    total_food_items = db.query(FoodItem).count()
    total_batches = db.query(Batch).count()
    expiring_soon = db.query(Batch).filter(
        Batch.status.in_([BatchStatus.NEAR_EXPIRY])
    ).count()
    expired = db.query(Batch).filter(Batch.status == BatchStatus.EXPIRED).count()
    low_stock = db.query(Batch).filter(Batch.status == BatchStatus.LOW_STOCK).count()

    category_counts = {}
    for cat in FoodCategory:
        category_counts[cat.value] = db.query(FoodItem).filter(FoodItem.category == cat).count()

    return {
        "total_food_items": total_food_items,
        "total_batches": total_batches,
        "expiring_soon_batches": expiring_soon,
        "expired_batches": expired,
        "low_stock_batches": low_stock,
        "category_counts": category_counts,
    }


def freshness_overview(db: Session) -> dict:
    total_reports = db.query(FreshnessReport).count()
    by_category = {}
    for cat in FreshnessCategory:
        by_category[cat.value] = db.query(FreshnessReport).filter(
            FreshnessReport.freshness_category == cat
        ).count()

    avg_score = db.query(func.avg(FreshnessReport.freshness_score)).scalar()
    recent = (
        db.query(FreshnessReport)
        .order_by(FreshnessReport.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "total_reports": total_reports,
        "reports_by_category": by_category,
        "average_freshness_score": round(avg_score, 2) if avg_score is not None else None,
        "recent_reports": [
            {
                "id": str(r.id), "report_number": r.report_number,
                "freshness_score": r.freshness_score, "category": r.freshness_category.value,
                "created_at": r.created_at.isoformat(),
            } for r in recent
        ],
    }


def storage_overview(db: Session) -> dict:
    since = date.today() - timedelta(days=7)
    total_readings = db.query(StorageReading).count()
    recent_readings = db.query(StorageReading).filter(StorageReading.recorded_at >= since).count()
    non_compliant = db.query(StorageReading).filter(
        StorageReading.recorded_at >= since, StorageReading.is_compliant.is_(False)
    ).count()
    avg_temp = db.query(func.avg(StorageReading.temperature_c)).filter(
        StorageReading.recorded_at >= since
    ).scalar()
    avg_humidity = db.query(func.avg(StorageReading.humidity_pct)).filter(
        StorageReading.recorded_at >= since
    ).scalar()
    return {
        "total_readings": total_readings,
        "readings_last_7_days": recent_readings,
        "non_compliant_last_7_days": non_compliant,
        "average_temperature_c": round(avg_temp, 2) if avg_temp is not None else None,
        "average_humidity_pct": round(avg_humidity, 2) if avg_humidity is not None else None,
    }


def platform_overview(db: Session) -> dict:
    total_users = db.query(User).count()
    users_by_role = {role.value: db.query(User).filter(User.role == role).count() for role in UserRole}
    model_status = cnn_service.model_status()
    return {
        "total_users": total_users,
        "users_by_role": users_by_role,
        "cnn_model_status": model_status,
        "inventory": inventory_overview(db),
        "freshness": freshness_overview(db),
        "storage": storage_overview(db),
    }
