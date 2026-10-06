"""
app/services/recommendation_service.py — Milestone 3.

Generates Recommendation rows purely from real inputs: the batch, its
latest shelf-life prediction, its latest storage reading, and (optionally)
the latest freshness report. Nothing here is hand-authored per item.
"""
import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.models.recommendation import Recommendation, RecommendationPriority, RecommendationType
from app.services import storage_service


def _add(db, batch_id, rtype, priority, title, message, based_on):
    row = Recommendation(
        batch_id=batch_id, type=rtype, priority=priority,
        title=title, message=message, based_on=based_on,
    )
    db.add(row)
    return row


def generate_for_batch(db: Session, batch, shelf_life_prediction=None, freshness_report=None) -> list[Recommendation]:
    generated: list[Recommendation] = []
    latest_reading = storage_service.latest_reading_for_batch(db, batch.id)

    # --- Storage recommendations ---
    if latest_reading and not latest_reading.is_compliant:
        generated.append(_add(
            db, batch.id, RecommendationType.STORAGE, RecommendationPriority.HIGH,
            "Storage conditions out of compliant range",
            f"Latest reading: {latest_reading.temperature_c}C / {latest_reading.humidity_pct}% humidity. "
            f"{latest_reading.compliance_notes or ''} Adjust storage to bring conditions back within range.",
            f"storage_readings id={latest_reading.id}, recorded_at={latest_reading.recorded_at}",
        ))
    elif latest_reading is None:
        generated.append(_add(
            db, batch.id, RecommendationType.STORAGE, RecommendationPriority.MEDIUM,
            "No storage readings logged yet",
            "Log a storage reading for this batch so shelf-life and freshness scoring can use real "
            "temperature/humidity data instead of defaults.",
            "no storage_readings found for this batch",
        ))

    # --- Consumption / shelf-life recommendations ---
    if shelf_life_prediction:
        risk = shelf_life_prediction.risk_level.value
        days = shelf_life_prediction.estimated_days_remaining
        if risk in ("high", "critical"):
            generated.append(_add(
                db, batch.id, RecommendationType.CONSUMPTION, RecommendationPriority.URGENT,
                "Consume soon or inspect immediately",
                f"Estimated {days} day(s) of shelf life remaining (risk: {risk}). "
                "Do not rely solely on this estimate — inspect the item and follow standard food safety guidance "
                "before consuming.",
                f"shelf_life_predictions id={shelf_life_prediction.id}",
            ))
        elif risk == "moderate":
            generated.append(_add(
                db, batch.id, RecommendationType.CONSUMPTION, RecommendationPriority.MEDIUM,
                "Monitor closely",
                f"Estimated {days} day(s) of shelf life remaining. Re-check freshness soon.",
                f"shelf_life_predictions id={shelf_life_prediction.id}",
            ))
        else:
            generated.append(_add(
                db, batch.id, RecommendationType.CONSUMPTION, RecommendationPriority.LOW,
                "Suitable for continued storage",
                f"Estimated {days} day(s) of shelf life remaining under current conditions.",
                f"shelf_life_predictions id={shelf_life_prediction.id}",
            ))

    # --- Inventory rotation (FEFO) ---
    days_to_expiry = (batch.expiry_date - date.today()).days
    if days_to_expiry <= 3:
        generated.append(_add(
            db, batch.id, RecommendationType.ROTATION, RecommendationPriority.HIGH,
            "Prioritize for FEFO rotation",
            f"This batch expires in {days_to_expiry} day(s) (expiry: {batch.expiry_date}). "
            "Move to the front for First-Expired-First-Out picking.",
            f"batches.expiry_date={batch.expiry_date}",
        ))

    # --- Waste reduction ---
    if days_to_expiry <= 5 and batch.quantity > 0:
        generated.append(_add(
            db, batch.id, RecommendationType.WASTE_REDUCTION, RecommendationPriority.MEDIUM,
            "At-risk inventory — consider markdown or reallocation",
            f"{batch.quantity} {batch.unit.value} of this batch expires within {days_to_expiry} day(s). "
            "Consider a promotional markdown, reallocating to a faster-moving channel, or donation.",
            f"batches.quantity={batch.quantity}, expiry_date={batch.expiry_date}",
        ))

    # --- Quality improvement ---
    if freshness_report and freshness_report.freshness_category in ("near_spoilage", "spoiled"):
        generated.append(_add(
            db, batch.id, RecommendationType.QUALITY_IMPROVEMENT, RecommendationPriority.HIGH,
            "Review storage and handling for this batch",
            f"Freshness report {freshness_report.report_number} scored this batch as "
            f"'{freshness_report.freshness_category}'. Inspect storage conditions, packaging integrity, and "
            "handling procedures for this batch/location.",
            f"freshness_reports id={freshness_report.id}",
        ))

    db.commit()
    for r in generated:
        db.refresh(r)
    return generated


def list_for_batch(db: Session, batch_id: uuid.UUID, limit: int = 50):
    query = db.query(Recommendation).filter(Recommendation.batch_id == batch_id).order_by(
        Recommendation.created_at.desc()
    )
    total = query.count()
    return query.limit(limit).all(), total
