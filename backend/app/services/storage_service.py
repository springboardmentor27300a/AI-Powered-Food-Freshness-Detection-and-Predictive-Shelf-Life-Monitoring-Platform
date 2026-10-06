"""
app/services/storage_service.py — Milestone 3 storage monitoring.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session
from app.models.storage import StorageReading
from app.schemas.storage import StorageReadingCreate
from app.models.batch import Batch
from app.models.food_item import FoodItem
from app.services.notification_service import create_notification


# Documented general-purpose compliance bounds (cold-chain guidance).
# A per-category version could be added; kept general here for simplicity
# and documented as such.
COMPLIANT_TEMP_RANGE_C = (-2.0, 8.0)
COMPLIANT_HUMIDITY_RANGE_PCT = (30.0, 95.0)


def _check_compliance(temp_c: float, humidity_pct: float) -> tuple[bool, str | None]:
    issues = []
    if not (COMPLIANT_TEMP_RANGE_C[0] <= temp_c <= COMPLIANT_TEMP_RANGE_C[1]):
        issues.append(f"Temperature {temp_c}C is outside the compliant range "
                       f"{COMPLIANT_TEMP_RANGE_C[0]}-{COMPLIANT_TEMP_RANGE_C[1]}C")
    if not (COMPLIANT_HUMIDITY_RANGE_PCT[0] <= humidity_pct <= COMPLIANT_HUMIDITY_RANGE_PCT[1]):
        issues.append(f"Humidity {humidity_pct}% is outside the compliant range "
                       f"{COMPLIANT_HUMIDITY_RANGE_PCT[0]}-{COMPLIANT_HUMIDITY_RANGE_PCT[1]}%")
    return (len(issues) == 0, "; ".join(issues) if issues else None)


def create_reading(db: Session, data: StorageReadingCreate, recorded_by: uuid.UUID) -> StorageReading:
    is_compliant, notes = _check_compliance(data.temperature_c, data.humidity_pct)
    reading = StorageReading(
        batch_id=data.batch_id,
        storage_location=data.storage_location,
        temperature_c=data.temperature_c,
        humidity_pct=data.humidity_pct,
        air_circulation=data.air_circulation,
        light_exposure=data.light_exposure,
        is_compliant=is_compliant,
        compliance_notes=notes,
        recorded_by=recorded_by,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # --- Storage condition notification ---
    if not reading.is_compliant:
        create_notification(
            db,
            user_id=recorded_by,
            title=f"Storage Alert: {data.storage_location}",
            message=(
                f"Storage conditions for batch {data.batch_id} are outside "
                f"the configured compliance range. "
                f"{reading.compliance_notes or 'Please check the storage conditions.'}"
            ),
            severity="critical",
            notification_type="storage",
            reference_type="storage_reading",
            reference_id=reading.id,
            action_url=f"/storage/{reading.id}",
        )

    return reading


def list_readings(db: Session, batch_id: uuid.UUID | None = None,
                   storage_location: str | None = None, limit: int = 100):
    query = db.query(StorageReading)
    if batch_id:
        query = query.filter(StorageReading.batch_id == batch_id)
    if storage_location:
        query = query.filter(StorageReading.storage_location == storage_location)
    query = query.order_by(StorageReading.recorded_at.desc())
    total = query.count()
    items = query.limit(limit).all()
    return items, total


def latest_reading_for_batch(db: Session, batch_id: uuid.UUID) -> StorageReading | None:
    return (
        db.query(StorageReading)
        .filter(StorageReading.batch_id == batch_id)
        .order_by(StorageReading.recorded_at.desc())
        .first()
    )


def trend_for_location(db: Session, storage_location: str, days: int = 7):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    readings = (
        db.query(StorageReading)
        .filter(and_(StorageReading.storage_location == storage_location, StorageReading.recorded_at >= since))
        .order_by(StorageReading.recorded_at.asc())
        .all()
    )
    return readings
def storage_alerts(db: Session):
    batches = (
        db.query(Batch)
        .join(FoodItem, Batch.food_item_id == FoodItem.id)
        .order_by(Batch.expiry_date.asc())
        .all()
    )

    alerts = []

    for batch in batches:
        reading = latest_reading_for_batch(db, batch.id)

        if reading is None:
            alerts.append({
                "batch_id": str(batch.id),
                "batch_code": batch.batch_code,
                "food_item_id": str(batch.food_item_id),
                "food_name": batch.food_item.name,
                "expiry_date": batch.expiry_date,
                "storage_location": None,
                "temperature_c": None,
                "humidity_pct": None,
                "status": "no_data",
                "message": "No storage reading logged for this batch.",
                "is_compliant": None,
            })
            continue

        if reading.is_compliant:
            status = "compliant"
            message = "Storage conditions are within the configured range."
        else:
            status = "attention"
            message = reading.compliance_notes or "Storage conditions require attention."

        alerts.append({
            "batch_id": str(batch.id),
            "batch_code": batch.batch_code,
            "food_item_id": str(batch.food_item_id),
            "food_name": batch.food_item.name,
            "expiry_date": batch.expiry_date,
            "storage_location": reading.storage_location,
            "temperature_c": reading.temperature_c,
            "humidity_pct": reading.humidity_pct,
            "status": status,
            "message": message,
            "is_compliant": reading.is_compliant,
        })

    return alerts