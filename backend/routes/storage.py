import json
from fastapi import APIRouter, Form, HTTPException
from database import SessionLocal
from models.batch import Batch
from models.food_item import FoodItem
from models.storage_reading import StorageReading
from services.storage_monitoring import analyze_storage_conditions

router = APIRouter(prefix="/storage", tags=["Storage Monitoring"])


def _reading_to_dict(reading):
    return {
        "id": reading.id,
        "batch_id": reading.batch_id,
        "food_type": reading.food_type,
        "temperature": reading.temperature,
        "humidity": reading.humidity,
        "air_circulation": reading.air_circulation,
        "light_exposure": reading.light_exposure,
        "packaging_type": reading.packaging_type,
        "storage_duration": reading.storage_duration,
        "compliance_score": reading.compliance_score,
        "overall_status": reading.overall_status,
        "temperature_status": reading.temperature_status,
        "humidity_status": reading.humidity_status,
        "air_status": reading.air_status,
        "light_status": reading.light_status,
        "recommendations": json.loads(reading.recommendations_json or "[]"),
        "recorded_at": str(reading.recorded_at),
    }


@router.post("/analyze")
def analyze_storage(
    food_type: str = Form(...),
    temperature: float = Form(...),
    humidity: float = Form(...),
    air_circulation: str = Form(...),
    light_exposure: str = Form(...),
    packaging_type: str = Form("sealed"),
    storage_duration: int = Form(0),
    batch_id: int | None = Form(None),
    save_reading: bool = Form(False),
):
    if storage_duration < 0:
        raise HTTPException(status_code=400, detail="storage_duration cannot be negative")

    result = analyze_storage_conditions(
        food_type=food_type,
        temperature=temperature,
        humidity=humidity,
        air_circulation=air_circulation,
        light_exposure=light_exposure,
    )

    result["packaging_type"] = packaging_type
    result["storage_duration_days"] = storage_duration
    result["batch_id"] = batch_id

    if save_reading:
        db = SessionLocal()
        try:
            if batch_id is not None and not db.query(Batch).filter(Batch.id == batch_id).first():
                raise HTTPException(status_code=404, detail="Batch not found")

            reading = StorageReading(
                batch_id=batch_id,
                food_type=food_type.strip().title(),
                temperature=temperature,
                humidity=humidity,
                air_circulation=air_circulation.strip().lower(),
                light_exposure=light_exposure.strip().lower(),
                packaging_type=packaging_type.strip().lower(),
                storage_duration=storage_duration,
                compliance_score=result["storage_compliance_score"],
                overall_status=result["overall_storage_status"],
                temperature_status=result["temperature"]["status"],
                humidity_status=result["humidity"]["status"],
                air_status=result["air_circulation"]["status"],
                light_status=result["light_exposure"]["status"],
                recommendations_json=json.dumps(result["recommendations"]),
            )
            db.add(reading)
            db.commit()
            db.refresh(reading)
            result["reading_id"] = reading.id
            result["recorded_at"] = str(reading.recorded_at)
        finally:
            db.close()

    return result


@router.get("/history")
def storage_history(batch_id: int | None = None, limit: int = 100):
    db = SessionLocal()
    try:
        query = db.query(StorageReading)
        if batch_id is not None:
            query = query.filter(StorageReading.batch_id == batch_id)
        readings = query.order_by(StorageReading.recorded_at.desc()).limit(max(1, min(limit, 500))).all()
        return {
            "total": len(readings),
            "readings": [_reading_to_dict(item) for item in readings],
        }
    finally:
        db.close()


@router.get("/overview")
def storage_overview():
    db = SessionLocal()
    try:
        readings = db.query(StorageReading).order_by(StorageReading.recorded_at.desc()).all()
        latest_by_batch = {}
        unlinked = []
        for reading in readings:
            if reading.batch_id is None:
                unlinked.append(reading)
            elif reading.batch_id not in latest_by_batch:
                latest_by_batch[reading.batch_id] = reading

        latest = list(latest_by_batch.values()) + unlinked[:10]
        compliant = sum(1 for item in latest if item.compliance_score >= 75)
        critical = sum(1 for item in latest if item.compliance_score < 50)
        average = round(sum(item.compliance_score for item in latest) / len(latest), 2) if latest else None

        return {
            "summary": {
                "monitored_locations": len(latest),
                "compliant": compliant,
                "needs_attention": len(latest) - compliant,
                "critical": critical,
                "average_compliance": average,
            },
            "latest_readings": [_reading_to_dict(item) for item in latest],
        }
    finally:
        db.close()
