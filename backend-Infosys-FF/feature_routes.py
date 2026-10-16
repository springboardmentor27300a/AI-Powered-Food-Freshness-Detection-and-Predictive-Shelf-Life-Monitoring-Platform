
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import (
    User,
    FoodItem,
    FoodBatch,
    AnalysisReport,
    StorageUnit,
    TemperatureReading,
    StorageRequirement,
    WasteRecord,
    Notification,
)
from schemas import (
    StorageUnitCreate,
    StorageUnitResponse,
    TemperatureReadingCreate,
    TemperatureReadingResponse,
    StorageRequirementCreate,
    WasteRecordCreate,
    WasteRecordResponse,
    NotificationResponse,
)
from auth import verify_access_token


router = APIRouter(tags=["Freshness features"])
security = HTTPBearer()


MANAGER_ROLES = {
    "Retail Manager",
    "Warehouse Operator",
    "Food Quality Inspector",
    "Administrator",
}


ROLE_ALIASES = {
    "admin": "Administrator",
    "administrator": "Administrator",
    "consumer": "Consumer",
    "retail manager": "Retail Manager",
    "warehouse operator": "Warehouse Operator",
    "food quality inspector": "Food Quality Inspector",
}


def normalize_role(role: str) -> str:
    if not role:
        return "Consumer"

    cleaned = str(role).strip()
    return ROLE_ALIASES.get(cleaned.lower(), cleaned)


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    payload = verify_access_token(credentials.credentials)

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    user.role = normalize_role(user.role)
    return user


def require_manager(user=Depends(current_user)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions",
        )

    return user


def notify_once(
    db: Session,
    *,
    event_key: str,
    title: str,
    message: str,
    severity: str,
    notification_type: str,
    food_batch_id: Optional[int] = None,
    storage_unit_id: Optional[int] = None,
    target_role: Optional[str] = None,
):
    existing = (
        db.query(Notification)
        .filter(Notification.event_key == event_key)
        .first()
    )

    if existing:
        return False

    notification = Notification(
        event_key=event_key,
        title=title,
        message=message,
        severity=severity,
        notification_type=notification_type,
        food_batch_id=food_batch_id,
        storage_unit_id=storage_unit_id,
        target_role=target_role,
    )

    db.add(notification)
    return True


def check_recommendations_access(user):
    """Allow recommendations for internal operational roles only."""
    role = str(
        user.get("role", "")
        if isinstance(user, dict)
        else getattr(user, "role", "")
    ).strip().lower().replace("_", " ").replace("-", " ")

    allowed_roles = {
        "admin",
        "administrator",
        "retail manager",
        "warehouse manager",
        "warehouse operator",
        "quality inspector",
        "food quality inspector",
    }

    if role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access recommendations.",
        )


@router.get("/recommendations")
def get_recommendations(
    category: Optional[str] = None,
    priority: Optional[str] = Query(
        default=None,
        pattern="^(Critical|High|Medium|Low)$",
    ),
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    check_recommendations_access(user)

    today = date.today()

    rows = (
        db.query(FoodBatch, FoodItem)
        .join(FoodItem, FoodBatch.food_item_id == FoodItem.id)
        .filter(FoodBatch.quantity > 0)
        .all()
    )

    items = []

    for batch, food in rows:
        if category and (
            (food.category or "").lower() != category.lower()
        ):
            continue

        report = (
            db.query(AnalysisReport)
            .filter(AnalysisReport.food_batch_id == batch.id)
            .order_by(AnalysisReport.created_at.desc())
            .first()
        )

        days_left = (
            (batch.expiry_date - today).days
            if batch.expiry_date
            else None
        )

        score = (
            float(report.freshness_score)
            if report and report.freshness_score is not None
            else None
        )

        classification = (
            (report.freshness_classification or "").lower()
            if report
            else ""
        )

        mold = (
            (report.mold_level or "").lower()
            if report
            else ""
        )

        temperature_issue = False

        if batch.storage_unit_id:
            unit = (
                db.query(StorageUnit)
                .filter(StorageUnit.id == batch.storage_unit_id)
                .first()
            )

            if (
                unit
                and unit.current_temperature is not None
            ):
                temperature_issue = not (
                    float(unit.min_temperature)
                    <= float(unit.current_temperature)
                    <= float(unit.max_temperature)
                )

        if days_left is not None and days_left < 0:
            level = "Critical"
            action = (
                "Hold the batch and follow inspection/disposition procedures."
            )
            reason = "The recorded expiry date has passed."

        elif (
            "rotten" in classification
            or "spoiled" in classification
        ):
            level = "Critical"
            action = "Isolate the batch for food-safety inspection."
            reason = (
                "The latest linked report classified the food as "
                "rotten or spoiled."
            )

        elif temperature_issue:
            level = "Critical"
            action = "Hold affected stock for food-safety inspection."
            reason = (
                "The associated storage unit is outside its configured "
                "temperature range."
            )

        elif mold and mold not in {"none", "low", "no mold"}:
            level = "Critical"
            action = "Isolate the batch for food-safety inspection."
            reason = "The latest linked report indicates a mold concern."

        elif score is not None and score < 40:
            level = "High"
            action = (
                "Inspect promptly and determine the appropriate disposition."
            )
            reason = (
                "The recorded freshness score is low. The score alone "
                "does not establish whether food is safe."
            )

        elif days_left is not None and days_left <= 3:
            level = "High"
            action = (
                "Review the batch and prioritize appropriate stock rotation."
            )
            reason = (
                f"The recorded expiry date is {days_left} day(s) away."
            )

        elif score is not None and score < 70:
            level = "Medium"
            action = "Inspect and continue monitoring."
            reason = "The latest linked freshness score is below 70."

        elif days_left is not None and days_left <= 7:
            level = "Medium"
            action = "Review stock rotation and expected demand."
            reason = (
                f"The recorded expiry date is {days_left} day(s) away."
            )

        else:
            level = "Low"
            action = (
                "Continue routine monitoring and FEFO stock rotation."
            )
            reason = (
                "No higher-priority condition was found in the available records."
            )

        if priority and priority != level:
            continue

        items.append({
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "food_item_id": food.id,
            "food_name": food.name,
            "category": food.category,
            "quantity": float(batch.quantity),
            "unit": batch.unit,
            "expiry_date": batch.expiry_date,
            "days_until_expiry": days_left,
            "freshness_score": score,
            "freshness_classification": (
                report.freshness_classification if report else None
            ),
            "priority": level,
            "recommended_action": action,
            "reason": reason,
            "storage_unit_id": batch.storage_unit_id,
            "temperature_issue": temperature_issue,
            "data_note": (
                None
                if report
                else (
                    "No batch-linked freshness report is available. "
                    "This recommendation uses inventory and expiry data only."
                )
            ),
        })

    ranking = {
        "Critical": 0,
        "High": 1,
        "Medium": 2,
        "Low": 3,
    }

    items.sort(
        key=lambda item: (
            ranking[item["priority"]],
            item["days_until_expiry"]
            if item["days_until_expiry"] is not None
            else 99999,
        )
    )

    return {
        "count": len(items),
        "items": items,
    }

# ============================================================
# STORAGE UNITS
# ============================================================

@router.post("/storage/units", response_model=StorageUnitResponse)
def create_storage_unit(
    payload: StorageUnitCreate,
    db: Session = Depends(get_db),
    user=Depends(require_manager),
):
    if payload.min_temperature > payload.max_temperature:
        raise HTTPException(
            status_code=422,
            detail="Minimum temperature cannot exceed maximum temperature",
        )

    if not (
        payload.min_temperature
        <= payload.target_temperature
        <= payload.max_temperature
    ):
        raise HTTPException(
            status_code=422,
            detail="Target temperature must be within the configured range",
        )

    unit = StorageUnit(**payload.model_dump())
    db.add(unit)

    try:
        db.commit()
        db.refresh(unit)

        if unit.current_temperature is not None:
            reading = TemperatureReading(
                storage_unit_id=unit.id,
                temperature=unit.current_temperature,
                source="manual",
                recorded_by=user.id,
            )
            db.add(reading)
            db.commit()

    except Exception:
        db.rollback()
        raise

    return unit


@router.get("/storage/units", response_model=list[StorageUnitResponse])
def list_storage_units(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    return db.query(StorageUnit).order_by(StorageUnit.name).all()


@router.post(
    "/storage/units/{unit_id}/readings",
    response_model=TemperatureReadingResponse,
)
def add_temperature_reading(
    unit_id: int,
    payload: TemperatureReadingCreate,
    db: Session = Depends(get_db),
    user=Depends(require_manager),
):
    unit = (
        db.query(StorageUnit)
        .filter(
            StorageUnit.id == unit_id,
            StorageUnit.is_active.is_(True),
        )
        .first()
    )

    if not unit:
        raise HTTPException(
            status_code=404,
            detail="Active storage unit not found",
        )

    unit.current_temperature = payload.temperature

    reading = TemperatureReading(
        storage_unit_id=unit.id,
        temperature=payload.temperature,
        source=payload.source,
        recorded_by=user.id,
    )
    db.add(reading)

    outside_range = not (
        float(unit.min_temperature)
        <= float(payload.temperature)
        <= float(unit.max_temperature)
    )

    if outside_range:
        notify_once(
            db,
            event_key=(
                f"storage-temp:{unit.id}:{date.today().isoformat()}"
            ),
            title=f"Temperature deviation: {unit.name}",
            message=(
                f"Recorded temperature {payload.temperature} is outside "
                f"the configured range {unit.min_temperature} to "
                f"{unit.max_temperature}. Inspect affected stock."
            ),
            severity="Critical",
            notification_type="temperature_deviation",
            storage_unit_id=unit.id,
            target_role="Food Quality Inspector",
        )

    try:
        db.commit()
        db.refresh(reading)
    except Exception:
        db.rollback()
        raise

    return reading


@router.get(
    "/storage/units/{unit_id}/readings",
    response_model=list[TemperatureReadingResponse],
)
def get_temperature_history(
    unit_id: int,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    exists = (
        db.query(StorageUnit.id)
        .filter(StorageUnit.id == unit_id)
        .first()
    )

    if not exists:
        raise HTTPException(
            status_code=404,
            detail="Storage unit not found",
        )

    return (
        db.query(TemperatureReading)
        .filter(TemperatureReading.storage_unit_id == unit_id)
        .order_by(TemperatureReading.recorded_at.desc())
        .limit(limit)
        .all()
    )


# ============================================================
# CATEGORY-SPECIFIC STORAGE REQUIREMENTS
# ============================================================

@router.post("/storage/requirements")
def save_storage_requirement(
    payload: StorageRequirementCreate,
    db: Session = Depends(get_db),
    user=Depends(require_manager),
):
    if payload.min_temperature > payload.max_temperature:
        raise HTTPException(
            status_code=422,
            detail="Minimum temperature cannot exceed maximum temperature",
        )

    if not (
        payload.min_temperature
        <= payload.target_temperature
        <= payload.max_temperature
    ):
        raise HTTPException(
            status_code=422,
            detail="Target temperature must be within the configured range",
        )

    requirement = (
        db.query(StorageRequirement)
        .filter(
            func.lower(StorageRequirement.category)
            == payload.category.lower(),
            func.lower(StorageRequirement.storage_type)
            == payload.storage_type.lower(),
        )
        .first()
    )

    if requirement:
        for key, value in payload.model_dump().items():
            setattr(requirement, key, value)
    else:
        requirement = StorageRequirement(**payload.model_dump())
        db.add(requirement)

    try:
        db.commit()
        db.refresh(requirement)
    except Exception:
        db.rollback()
        raise

    return requirement


@router.get("/storage/requirements")
def get_storage_requirements(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    return (
        db.query(StorageRequirement)
        .order_by(StorageRequirement.category)
        .all()
    )


# ============================================================
# STORAGE ANALYTICS
# ============================================================

@router.get("/storage/analytics")
def get_storage_analytics(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    units = (
        db.query(StorageUnit)
        .filter(StorageUnit.is_active.is_(True))
        .all()
    )

    latest_readings = []
    out_of_range_count = 0
    units_without_readings = 0

    for unit in units:
        latest = (
            db.query(TemperatureReading)
            .filter(TemperatureReading.storage_unit_id == unit.id)
            .order_by(TemperatureReading.recorded_at.desc())
            .first()
        )

        if latest is None:
            units_without_readings += 1
            continue

        temp = float(latest.temperature)
        in_range = (
            float(unit.min_temperature)
            <= temp
            <= float(unit.max_temperature)
        )

        latest_readings.append({
            "storage_unit_id": unit.id,
            "name": unit.name,
            "temperature": temp,
            "recorded_at": latest.recorded_at,
            "min_temperature": float(unit.min_temperature),
            "max_temperature": float(unit.max_temperature),
            "in_range": in_range,
        })

        if not in_range:
            out_of_range_count += 1

    reading_count = (
        db.query(func.count(TemperatureReading.id)).scalar() or 0
    )

    return {
        "active_storage_units": len(units),
        "units_with_readings": len(latest_readings),
        "units_without_readings": units_without_readings,
        "units_out_of_range": out_of_range_count,
        "total_recorded_readings": reading_count,
        "latest_readings": latest_readings,
        "trend_note": (
            "Historical trends use timestamped temperature readings. "
            "Missing readings are not estimated."
        ),
    }

# ============================================================
# WASTE RECORDS AND ANALYTICS
# ============================================================

@router.post(
    "/waste/records",
    response_model=WasteRecordResponse,
)
def create_waste_record(
    payload: WasteRecordCreate,
    db: Session = Depends(get_db),
    user=Depends(require_manager),
):
    batch = None

    if payload.food_batch_id is not None:
        batch = (
            db.query(FoodBatch)
            .filter(FoodBatch.id == payload.food_batch_id)
            .first()
        )

        if not batch:
            raise HTTPException(
                status_code=404,
                detail="Food batch not found",
            )

        if payload.unit != batch.unit:
            raise HTTPException(
                status_code=422,
                detail=f"Batch unit is {batch.unit}; use the same unit",
            )

        if Decimal(str(payload.quantity)) > Decimal(str(batch.quantity)):
            raise HTTPException(
                status_code=422,
                detail="Waste quantity cannot exceed the batch's recorded quantity",
            )

        batch.quantity = (
            Decimal(str(batch.quantity))
            - Decimal(str(payload.quantity))
        )

    record = WasteRecord(
        **payload.model_dump(),
        responsible_user_id=user.id,
    )

    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save waste record",
        )

    return record


@router.get(
    "/waste/records",
    response_model=list[WasteRecordResponse],
)
def get_waste_records(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date cannot be after end_date",
        )

    query = db.query(WasteRecord)

    if start_date:
        query = query.filter(
            WasteRecord.recorded_date >= start_date
        )

    if end_date:
        query = query.filter(
            WasteRecord.recorded_date <= end_date
        )

    return query.order_by(
        WasteRecord.recorded_date.desc()
    ).all()


@router.get("/waste/analytics")
def get_waste_analytics(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    record_count = (
        db.query(func.count(WasteRecord.id)).scalar() or 0
    )

    totals = (
        db.query(
            WasteRecord.waste_type,
            WasteRecord.unit,
            func.sum(WasteRecord.quantity),
        )
        .group_by(
            WasteRecord.waste_type,
            WasteRecord.unit,
        )
        .all()
    )

    quantities = [
        {
            "waste_type": waste_type,
            "unit": unit,
            "quantity": float(quantity or 0),
        }
        for waste_type, unit, quantity in totals
    ]

    return {
        "total_waste_records": record_count,
        "quantities_by_type_and_unit": quantities,
        "waste_percentage": None,
        "waste_percentage_note": (
            "A waste percentage is not calculated because the database "
            "does not record a reliable total food-throughput denominator."
        ),
    }

# ============================================================
# NOTIFICATION GENERATION
# ============================================================

@router.post("/notifications/generate")
def generate_notifications(
    db: Session = Depends(get_db),
    user=Depends(require_manager),
):
    today = date.today()
    now = datetime.now(timezone.utc)
    created = 0

    # --------------------------------------------------------
    # 1. EXPIRY ALERTS
    # --------------------------------------------------------
    batches = (
        db.query(FoodBatch, FoodItem)
        .join(FoodItem, FoodBatch.food_item_id == FoodItem.id)
        .filter(
            FoodBatch.quantity > 0,
            FoodBatch.expiry_date.isnot(None),
        )
        .all()
    )

    for batch, food in batches:
        days_left = (batch.expiry_date - today).days

        if days_left < 0:
            event_key = (
                f"expired:{batch.id}:{batch.expiry_date.isoformat()}"
            )
            title = f"Expired batch: {batch.batch_number}"
            message = (
                f"{food.name}, batch {batch.batch_number}, has passed "
                "its recorded expiry date. Hold it and follow approved "
                "food-safety inspection and disposition procedures."
            )
            severity = "Critical"
            kind = "expired_batch"
            role = "Food Quality Inspector"

        elif days_left == 0:
            event_key = (
                f"expiry-today:{batch.id}:{batch.expiry_date.isoformat()}"
            )
            title = f"Batch expires today: {batch.batch_number}"
            message = (
                f"{food.name}, batch {batch.batch_number}, reaches its "
                "recorded expiry date today. Review its condition and "
                "follow approved handling procedures."
            )
            severity = "Warning"
            kind = "expiry_today"
            role = "Retail Manager"

        elif days_left == 1:
            event_key = (
                f"expiry-tomorrow:{batch.id}:"
                f"{batch.expiry_date.isoformat()}"
            )
            title = f"Batch expires tomorrow: {batch.batch_number}"
            message = (
                f"{food.name}, batch {batch.batch_number}, has one day "
                "until its recorded expiry date. Review stock rotation."
            )
            severity = "Warning"
            kind = "expiry_tomorrow"
            role = "Retail Manager"

        elif days_left <= 3:
            event_key = (
                f"expiry-3-days:{batch.id}:{batch.expiry_date.isoformat()}"
            )
            title = f"Expiry approaching: {batch.batch_number}"
            message = (
                f"{food.name}, batch {batch.batch_number}, has "
                f"{days_left} days until its recorded expiry date. "
                "Review stock rotation and condition."
            )
            severity = "Warning"
            kind = "expiry_approaching"
            role = "Retail Manager"

        elif days_left <= 7:
            event_key = (
                f"expiry-7-days:{batch.id}:{batch.expiry_date.isoformat()}"
            )
            title = f"Batch nearing expiry: {batch.batch_number}"
            message = (
                f"{food.name}, batch {batch.batch_number}, has "
                f"{days_left} days until its recorded expiry date. "
                "Plan stock rotation and expected demand."
            )
            severity = "Informational"
            kind = "expiry_within_7_days"
            role = "Retail Manager"

        else:
            continue

        if notify_once(
            db,
            event_key=event_key,
            title=title,
            message=message,
            severity=severity,
            notification_type=kind,
            food_batch_id=batch.id,
            target_role=role,
        ):
            created += 1

    # --------------------------------------------------------
    # 2. FRESHNESS ALERTS
    # --------------------------------------------------------
    reports = (
        db.query(AnalysisReport)
        .order_by(AnalysisReport.created_at.desc())
        .all()
    )

    for report in reports:
        classification = (
            (report.freshness_classification or "").strip().lower()
        )
        condition = (report.condition or "").strip().lower()

        score = (
            float(report.freshness_score)
            if report.freshness_score is not None
            else None
        )

        is_spoiled = any(
            word in value
            for value in (classification, condition)
            for word in ("rotten", "spoiled")
        )

        is_low_freshness = score is not None and score < 40

        if not is_spoiled and not is_low_freshness:
            continue

        if is_spoiled:
            severity = "Critical"
            title = "Critical freshness alert"
            message = (
                f"Analysis report {report.id} classified food as "
                f"'{report.freshness_classification or report.condition}'. "
                "Isolate the affected food and arrange a food-safety inspection."
            )
        else:
            severity = "Warning"
            title = "Low freshness score detected"
            message = (
                f"Analysis report {report.id} recorded a freshness score "
                f"of {score:.1f}. Inspect the food and assess its condition. "
                "A low score alone does not establish food safety."
            )

        if notify_once(
            db,
            event_key=f"freshness-report:{report.id}",
            title=title,
            message=message,
            severity=severity,
            notification_type="freshness_alert",
            food_batch_id=report.food_batch_id,
            target_role="Food Quality Inspector",
        ):
            created += 1

    # --------------------------------------------------------
    # 3. STORAGE ALERTS
    # --------------------------------------------------------
    units = (
        db.query(StorageUnit)
        .filter(StorageUnit.is_active.is_(True))
        .all()
    )

    for unit in units:
        latest = (
            db.query(TemperatureReading)
            .filter(
                TemperatureReading.storage_unit_id == unit.id
            )
            .order_by(TemperatureReading.recorded_at.desc())
            .first()
        )

        if latest is None:
            if notify_once(
                db,
                event_key=(
                    f"storage-reading-missing:"
                    f"{unit.id}:{today.isoformat()}"
                ),
                title=f"No temperature reading: {unit.name}",
                message=(
                    f"Storage unit '{unit.name}' has no recorded "
                    "temperature reading. Record and verify its temperature."
                ),
                severity="Warning",
                notification_type="missing_temperature_reading",
                storage_unit_id=unit.id,
                target_role="Food Quality Inspector",
            ):
                created += 1

        else:
            recorded_at = latest.recorded_at

            if recorded_at is not None:
                if recorded_at.tzinfo is None:
                    recorded_at = recorded_at.replace(
                        tzinfo=timezone.utc
                    )

                age_hours = (
                    now - recorded_at.astimezone(timezone.utc)
                ).total_seconds() / 3600

                if age_hours > 24:
                    if notify_once(
                        db,
                        event_key=(
                            f"storage-reading-outdated:"
                            f"{unit.id}:{today.isoformat()}"
                        ),
                        title=(
                            f"Temperature reading is outdated: {unit.name}"
                        ),
                        message=(
                            f"The latest temperature reading for "
                            f"'{unit.name}' is approximately "
                            f"{int(age_hours)} hours old. Record a new "
                            "reading and verify the unit."
                        ),
                        severity="Warning",
                        notification_type="outdated_temperature_reading",
                        storage_unit_id=unit.id,
                        target_role="Food Quality Inspector",
                    ):
                        created += 1

        if unit.current_temperature is None:
            continue

        outside = not (
            float(unit.min_temperature)
            <= float(unit.current_temperature)
            <= float(unit.max_temperature)
        )

        if outside:
            if notify_once(
                db,
                event_key=(
                    f"storage-temp:{unit.id}:{today.isoformat()}"
                ),
                title=f"Temperature deviation: {unit.name}",
                message=(
                    f"Current temperature {unit.current_temperature} "
                    f"is outside the configured range "
                    f"{unit.min_temperature} to {unit.max_temperature}. "
                    "Inspect potentially affected stock."
                ),
                severity="Critical",
                notification_type="temperature_deviation",
                storage_unit_id=unit.id,
                target_role="Food Quality Inspector",
            ):
                created += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "created": created,
        "message": "Notification generation completed.",
    }

# ============================================================
# NOTIFICATION LIST
# ============================================================

@router.get(
    "/notifications",
    response_model=list[NotificationResponse],
)
def get_notifications(
    unread_only: bool = False,
    severity: Optional[str] = Query(
        default=None,
        pattern="^(Critical|Warning|Informational)$",
    ),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    query = db.query(Notification).filter(
        (Notification.user_id == user.id)
        | (Notification.target_role == user.role)
        | (
            Notification.user_id.is_(None)
            & Notification.target_role.is_(None)
        )
    )

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    if severity:
        query = query.filter(Notification.severity == severity)

    return (
        query.order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/notifications/unread-count")
def get_unread_notification_count(
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    visible = (
        (Notification.user_id == user.id)
        | (Notification.target_role == user.role)
        | (
            Notification.user_id.is_(None)
            & Notification.target_role.is_(None)
        )
    )

    count = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.is_read.is_(False),
            visible,
        )
        .scalar()
        or 0
    )

    return {"unread_count": count}


@router.patch("/notifications/{notification_id}/read")
def set_notification_read_status(
    notification_id: int,
    is_read: bool = True,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    visible = (
        (Notification.user_id == user.id)
        | (Notification.target_role == user.role)
        | (
            Notification.user_id.is_(None)
            & Notification.target_role.is_(None)
        )
    )

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            visible,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    notification.is_read = is_read
    notification.read_at = (
        datetime.now(timezone.utc) if is_read else None
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "id": notification.id,
        "is_read": notification.is_read,
    }
