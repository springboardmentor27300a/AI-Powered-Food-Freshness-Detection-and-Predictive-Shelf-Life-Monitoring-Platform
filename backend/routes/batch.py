from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import SessionLocal
from models.batch import Batch
from models.food_item import FoodItem
from models.prediction_history import PredictionHistory
from datetime import date, timedelta, datetime
from sqlalchemy.exc import IntegrityError

router = APIRouter()


# ==================================================
# REQUEST MODELS
# ==================================================

class BatchCreate(BaseModel):
    food_item_id: int
    quantity: int
    expiry_date: str


class BatchPredictionUpdate(BaseModel):
    freshness_score: float
    remaining_shelf_life: int
    predicted_expiry_date: str
    spoilage_probability: float
    spoilage_risk: str
    consumption_priority: str
    temperature: float
    humidity: float


# ==================================================
# CREATE BATCH
# ==================================================

@router.post("/batches")
def create_batch(batch: BatchCreate):

    db = SessionLocal()

    try:
        expiry = datetime.strptime(
            batch.expiry_date,
            "%Y-%m-%d"
        ).date()

    except ValueError:
        db.close()

        raise HTTPException(
            status_code=400,
            detail="expiry_date must use YYYY-MM-DD format"
        )

    new_batch = Batch(
        food_item_id=batch.food_item_id,
        quantity=batch.quantity,
        expiry_date=expiry,
        availability=(
            "Available"
            if batch.quantity > 0
            else "Out of Stock"
        )
    )

    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)

    batch_id = new_batch.id

    db.close()

    return {
        "message": "Batch added successfully",
        "id": batch_id
    }


# ==================================================
# DELETE BATCH
# ==================================================

@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: int):

    db = SessionLocal()

    batch = db.query(Batch).filter(
        Batch.id == batch_id
    ).first()

    if not batch:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Batch not found"
        )

    try:
        # Prediction history belongs directly to the batch
        db.query(PredictionHistory).filter(
            PredictionHistory.batch_id == batch_id
        ).delete(synchronize_session=False)

        db.delete(batch)
        db.commit()

    except IntegrityError:
        db.rollback()
        db.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "This batch cannot be deleted because "
                "monitoring or freshness records already exist for it."
            )
        )

    db.close()

    return {
        "message": "Batch deleted successfully"
    }


# ==================================================
# GET ALL BATCHES
# ==================================================

@router.get("/batches")
def get_batches():

    db = SessionLocal()

    batches = db.query(Batch).all()

    result = []

    today = date.today()
    warning_date = today + timedelta(days=7)

    for batch in batches:

        effective_expiry = (
            min(
                batch.expiry_date,
                batch.predicted_expiry_date
            )
            if batch.predicted_expiry_date
            else batch.expiry_date
        )

        if batch.quantity <= 0:
            availability = "Out of Stock"
        elif batch.freshness_score is not None and batch.freshness_score < 40:
            availability = "Spoiled"
        elif effective_expiry < today:
            availability = "Expired"
        else:
            availability = "Available"

        if effective_expiry < today:
            expiry_status = "Expired"

        elif effective_expiry <= warning_date:
            expiry_status = "Expiring Soon"

        else:
            expiry_status = "Safe"

        result.append({
            "id": batch.id,
            "food_item_id": batch.food_item_id,
            "quantity": batch.quantity,
            "availability": availability,

            "expiry_date":
                str(batch.expiry_date),

            "freshness_score":
                batch.freshness_score,

            "remaining_shelf_life":
                batch.remaining_shelf_life,

            "predicted_expiry_date":
                str(batch.predicted_expiry_date)
                if batch.predicted_expiry_date
                else None,

            "spoilage_probability":
                batch.spoilage_probability,

            "spoilage_risk":
                batch.spoilage_risk,

            "consumption_priority":
                batch.consumption_priority,

            "expiry_status":
                expiry_status
        })

    db.close()

    return result


# ==================================================
# UPDATE BATCH QUANTITY
# ==================================================

@router.put("/batches/{batch_id}")
def update_batch_quantity(
    batch_id: int,
    quantity: int
):

    db = SessionLocal()

    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .first()
    )

    if not batch:
        db.close()

        raise HTTPException(
            status_code=404,
            detail="Batch not found"
        )

    batch.quantity = quantity

    effective_expiry = (
        min(batch.expiry_date, batch.predicted_expiry_date)
        if batch.predicted_expiry_date
        else batch.expiry_date
    )

    if quantity <= 0:
        batch.availability = "Out of Stock"
    elif batch.freshness_score is not None and batch.freshness_score < 40:
        batch.availability = "Spoiled"
    elif effective_expiry < date.today():
        batch.availability = "Expired"
    else:
        batch.availability = "Available"

    db.commit()
    db.refresh(batch)

    result = {
        "message":
            "Batch quantity updated successfully",

        "id":
            batch.id,

        "quantity":
            batch.quantity,

        "availability":
            batch.availability
    }

    db.close()

    return result


# ==================================================
# SAVE SHELF-LIFE PREDICTION
# ==================================================

@router.put("/batches/{batch_id}/prediction")
def save_batch_prediction(
    batch_id: int,
    prediction: BatchPredictionUpdate
):

    db = SessionLocal()

    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .first()
    )

    if not batch:
        db.close()

        raise HTTPException(
            status_code=404,
            detail="Batch not found"
        )

    # ----------------------------------------------
    # Convert predicted expiry string into Date
    # ----------------------------------------------

    try:
        predicted_date = datetime.strptime(
            prediction.predicted_expiry_date,
            "%Y-%m-%d"
        ).date()

    except ValueError:
        db.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "predicted_expiry_date must use "
                "YYYY-MM-DD format"
            )
        )

    # ----------------------------------------------
    # Update latest prediction in batches table
    # ----------------------------------------------

    batch.freshness_score = (
        prediction.freshness_score
    )

    batch.remaining_shelf_life = (
        prediction.remaining_shelf_life
    )

    batch.predicted_expiry_date = (
        predicted_date
    )

    batch.spoilage_probability = (
        prediction.spoilage_probability
    )

    batch.spoilage_risk = (
        prediction.spoilage_risk
    )

    batch.consumption_priority = (
        prediction.consumption_priority
    )

    # ----------------------------------------------
    # Store assessment in prediction history
    # ----------------------------------------------

    history = PredictionHistory(
        batch_id=batch.id,

        freshness_score=
            prediction.freshness_score,

        remaining_shelf_life=
            prediction.remaining_shelf_life,

        predicted_expiry_date=
            predicted_date,

        spoilage_probability=
            prediction.spoilage_probability,

        spoilage_risk=
            prediction.spoilage_risk,

        temperature=
            prediction.temperature,

        humidity=
            prediction.humidity
    )

    db.add(history)

    # Save BOTH batch update and history record
    db.commit()

    db.refresh(batch)
    db.refresh(history)

    result = {
        "message":
            "Shelf-life prediction saved successfully",

        "batch_id":
            batch.id,

        "history_id":
            history.id,

        "freshness_score":
            batch.freshness_score,

        "remaining_shelf_life":
            batch.remaining_shelf_life,

        "predicted_expiry_date":
            str(batch.predicted_expiry_date),

        "spoilage_probability":
            batch.spoilage_probability,

        "spoilage_risk":
            batch.spoilage_risk,

        "consumption_priority":
            batch.consumption_priority,

        "temperature":
            history.temperature,

        "humidity":
            history.humidity,

        "recorded_at":
            str(history.recorded_at)
    }

    db.close()

    return result


# ==================================================
# GET EXPIRING BATCHES
# ==================================================

@router.get("/batches/expiring")
def get_expiring_batches():

    db = SessionLocal()

    batches = db.query(Batch).all()

    result = []

    for batch in batches:

        effective_expiry = (
            min(
                batch.expiry_date,
                batch.predicted_expiry_date
            )
            if batch.predicted_expiry_date
            else batch.expiry_date
        )

        result.append({
            "id":
                batch.id,

            "food_item_id":
                batch.food_item_id,

            "quantity":
                batch.quantity,

            "original_expiry_date":
                str(batch.expiry_date),

            "predicted_expiry_date":
                str(batch.predicted_expiry_date)
                if batch.predicted_expiry_date
                else None,

            "effective_expiry_date":
                str(effective_expiry)
        })

    db.close()

    return result
# ==================================================
# GET BATCH PREDICTION HISTORY / TREND
# ==================================================

@router.get("/batches/{batch_id}/history")
def get_batch_prediction_history(batch_id: int):

    db = SessionLocal()

    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .first()
    )

    if not batch:
        db.close()

        raise HTTPException(
            status_code=404,
            detail="Batch not found"
        )

    history_records = (
        db.query(PredictionHistory)
        .filter(PredictionHistory.batch_id == batch_id)
        .order_by(PredictionHistory.recorded_at.asc())
        .all()
    )

    trend = []

    for record in history_records:

        trend.append({
            "history_id": record.id,

            "recorded_at":
                str(record.recorded_at),

            "freshness_score":
                record.freshness_score,

            "remaining_shelf_life":
                record.remaining_shelf_life,

            "predicted_expiry_date":
                str(record.predicted_expiry_date),

            "spoilage_probability":
                record.spoilage_probability,

            "spoilage_risk":
                record.spoilage_risk,

            "temperature":
                record.temperature,

            "humidity":
                record.humidity
        })

    db.close()

    return {
        "batch_id": batch_id,
        "total_assessments": len(trend),
        "trend": trend
    }
# ==================================================
# GET PROJECTED SHELF-LIFE TREND
# ==================================================

@router.get("/batches/{batch_id}/shelf-life-trend")
def get_projected_shelf_life_trend(batch_id: int):

    db = SessionLocal()

    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .first()
    )

    if not batch:
        db.close()

        raise HTTPException(
            status_code=404,
            detail="Batch not found"
        )

    if batch.remaining_shelf_life is None:
        db.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "No shelf-life prediction available "
                "for this batch"
            )
        )

    today = date.today()

    remaining_days = batch.remaining_shelf_life

    trend = []

    for day_number in range(remaining_days + 1):

        forecast_date = (
            today + timedelta(days=day_number)
        )

        days_left = (
            remaining_days - day_number
        )

        # Determine projected condition
        if days_left == 0:
            status = "Predicted Expiry"

        elif days_left <= 2:
            status = "Critical"

        elif days_left <= 5:
            status = "Consume Soon"

        else:
            status = "Fresh"

        trend.append({
            "date": str(forecast_date),
            "day_number": day_number,
            "remaining_shelf_life": days_left,
            "status": status
        })

    predicted_expiry = (
        today + timedelta(days=remaining_days)
    )

    db.close()

    return {
        "batch_id": batch_id,

        "current_remaining_shelf_life":
            remaining_days,

        "projected_expiry_date":
            str(predicted_expiry),

        "trend":
            trend
    }


# ==================================================
# EXPIRY INTELLIGENCE / INVENTORY ROTATION
# ==================================================

@router.get("/expiry/overview")
def get_expiry_overview():

    db = SessionLocal()

    batches = db.query(Batch).all()
    foods = db.query(FoodItem).all()

    food_map = {
        food.id: food.name
        for food in foods
    }

    today = date.today()

    result = []

    summary = {
        "total_batches": 0,
        "fresh": 0,
        "near_expiry": 0,
        "critical": 0,
        "expired": 0,
        "high_waste_risk": 0
    }

    for batch in batches:

        # ------------------------------------------
        # Effective expiry
        # Predicted expiry gets priority
        # ------------------------------------------

        effective_expiry = (
            min(
                batch.expiry_date,
                batch.predicted_expiry_date
            )
            if batch.predicted_expiry_date
            else batch.expiry_date
        )

        days_remaining = (
            effective_expiry - today
        ).days


        # ------------------------------------------
        # EXPIRY STATUS
        # ------------------------------------------

        if days_remaining < 0:

            expiry_status = "Expired"
            summary["expired"] += 1

        elif days_remaining <= 3:

            expiry_status = "Critical"
            summary["critical"] += 1

        elif days_remaining <= 7:

            expiry_status = "Near Expiry"
            summary["near_expiry"] += 1

        else:

            expiry_status = "Fresh"
            summary["fresh"] += 1


        # ------------------------------------------
        # FEFO / INVENTORY ROTATION PRIORITY
        # ------------------------------------------

        if days_remaining < 0:

            rotation_priority = "CRITICAL"

        elif days_remaining <= 3:

            rotation_priority = "USE FIRST"

        elif days_remaining <= 7:

            rotation_priority = "CONSUME SOON"

        else:

            rotation_priority = "SAFE"


        # ------------------------------------------
        # WASTE RISK
        # ------------------------------------------

        spoilage_probability = (
            batch.spoilage_probability
            if batch.spoilage_probability is not None
            else 0
        )

        freshness_score = (
            batch.freshness_score
            if batch.freshness_score is not None
            else 100
        )

        if (
            days_remaining <= 2
            or spoilage_probability >= 60
            or freshness_score < 40
        ):

            waste_risk = "High"

        elif (
            days_remaining <= 7
            or spoilage_probability >= 30
            or freshness_score < 70
        ):

            waste_risk = "Moderate"

        else:

            waste_risk = "Low"


        if waste_risk == "High":
            summary["high_waste_risk"] += 1


        # ------------------------------------------
        # RECOMMENDED ACTION
        # ------------------------------------------

        if days_remaining < 0:

            recommended_action = (
                "Expired. Inspect immediately and "
                "remove from usable inventory if unsafe."
            )

        elif days_remaining <= 2:

            recommended_action = (
                "Use this batch first. "
                "Consume as soon as possible."
            )

        elif days_remaining <= 7:

            recommended_action = (
                "Prioritize this batch for consumption "
                "before later-expiring stock."
            )

        elif waste_risk == "High":

            recommended_action = (
                "High waste risk detected. "
                "Inspect freshness and prioritize usage."
            )

        elif waste_risk == "Moderate":

            recommended_action = (
                "Continue monitoring freshness "
                "and storage conditions."
            )

        else:

            recommended_action = (
                "No immediate action required. "
                "Maintain recommended storage."
            )


        result.append({

            "batch_id":
                batch.id,

            "food_item_id":
                batch.food_item_id,

            "food_name":
                food_map.get(
                    batch.food_item_id,
                    "Unknown Food"
                ),

            "quantity":
                batch.quantity,

            "availability":
    (
        "Available"
        if batch.quantity > 0
        else "Out of Stock"
    ),

            "original_expiry_date":
                str(batch.expiry_date),

            "predicted_expiry_date":
                (
                    str(batch.predicted_expiry_date)
                    if batch.predicted_expiry_date
                    else None
                ),

            "effective_expiry_date":
                str(effective_expiry),

            "days_remaining":
                days_remaining,

            "expiry_status":
                expiry_status,

            "freshness_score":
                batch.freshness_score,

            "remaining_shelf_life":
                batch.remaining_shelf_life,

            "spoilage_probability":
                batch.spoilage_probability,

            "spoilage_risk":
                batch.spoilage_risk,

            "rotation_priority":
                rotation_priority,

            "waste_risk":
                waste_risk,

            "recommended_action":
                recommended_action
        })


    # ------------------------------------------
    # FEFO SORT
    # Earliest expiry shown first
    # ------------------------------------------

    result.sort(
        key=lambda item:
            item["effective_expiry_date"]
    )

    summary["total_batches"] = len(result)


    db.close()


    return {

        "summary":
            summary,

        "batches":
            result
    }