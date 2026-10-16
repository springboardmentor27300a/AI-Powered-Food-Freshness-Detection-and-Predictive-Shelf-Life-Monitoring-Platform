import json
import os
import shutil
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from database import SessionLocal
from models.batch import Batch
from models.prediction_history import PredictionHistory
from models.storage_reading import StorageReading
from models.freshness_assessment import FreshnessAssessment
from services.image_analysis import (
    analyze_color, analyze_texture, detect_mold, detect_bruising,
    detect_physical_damage, identify_spoilage, calculate_freshness_score,
    classify_freshness, analyze_freshness_trend, generate_freshness_report,
    predict_cnn_freshness, final_freshness_assessment,
)
from services.shelf_life_prediction import predict_shelf_life, FOOD_STORAGE_DATA
from services.storage_monitoring import analyze_storage_conditions
from services.recommendation_engine import generate_recommendations

router = APIRouter(prefix="/assessments", tags=["Complete Freshness Assessment"])

def _json_default(value):
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "tolist"):
        return value.tolist()
    return str(value)


def _json_dumps(value):
    return json.dumps(value, default=_json_default)

UPLOAD_DIR = "uploads/assessments"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _iso_prediction_date(display_date: str):
    return datetime.strptime(display_date, "%d %B %Y").date()


def _recommended_conditions(food_type):
    data = FOOD_STORAGE_DATA.get(food_type.lower().strip(), {
        "temp_min": 2, "temp_max": 8,
        "humidity_min": 70, "humidity_max": 90,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    })
    return {
        "temperature": round((data["temp_min"] + data["temp_max"]) / 2, 1),
        "humidity": round((data["humidity_min"] + data["humidity_max"]) / 2, 1),
        "air_circulation": data["air_circulation"][0],
        "light_exposure": data["light_exposure"][0],
    }


@router.post("/complete")
async def complete_assessment(
    food_type: str = Form(...),
    image: UploadFile = File(...),
    batch_id: int | None = Form(None),
    prediction_mode: str = Form("recommended"),
    temperature: float | None = Form(None),
    humidity: float | None = Form(None),
    air_circulation: str = Form("moderate"),
    light_exposure: str = Form("low"),
    packaging_type: str = Form("sealed"),
    storage_duration: int = Form(0),
):
    food_key = food_type.strip().lower()
    mode = prediction_mode.strip().lower()
    packaging = packaging_type.strip().lower()
    if mode not in {"recommended", "monitored"}:
        raise HTTPException(status_code=400, detail="prediction_mode must be recommended or monitored")
    if packaging not in {"vacuum", "sealed", "ventilated"}:
        raise HTTPException(status_code=400, detail="packaging_type must be vacuum, sealed, or ventilated")
    if storage_duration < 0:
        raise HTTPException(status_code=400, detail="storage_duration cannot be negative")

    if mode == "recommended":
        baseline = _recommended_conditions(food_key)
        temperature = baseline["temperature"]
        humidity = baseline["humidity"]
        air_circulation = baseline["air_circulation"]
        light_exposure = baseline["light_exposure"]
    elif temperature is None or humidity is None:
        raise HTTPException(status_code=400, detail="Temperature and humidity are required in monitored mode")

    safe_name = f"{uuid.uuid4().hex}_{os.path.basename(image.filename or 'food.jpg')}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    color = analyze_color(file_path)
    texture = analyze_texture(file_path)
    mold = detect_mold(file_path)
    bruising = detect_bruising(file_path)
    physical = detect_physical_damage(file_path)
    cnn = predict_cnn_freshness(file_path)
    spoilage_visual = identify_spoilage(color, texture, mold, bruising, physical)
    final = final_freshness_assessment(cnn, color, texture, mold, bruising, physical)
    freshness = calculate_freshness_score(cnn, color, texture, mold, bruising, physical, final)
    classification = classify_freshness(freshness)
    freshness_trend = analyze_freshness_trend(freshness, classification)
    freshness_report = generate_freshness_report(
        food_type, color, texture, mold, bruising, physical,
        spoilage_visual, freshness, classification, freshness_trend, final,
    )

    score = float(freshness["freshness_score"])
    freshness_status = (
        final.get("final_classification")
        or classification.get("quality_classification")
        or "Assessed"
    )

    shelf = predict_shelf_life(
        food_type=food_type,
        freshness_score=score,
        temperature=float(temperature),
        humidity=float(humidity),
        storage_duration=storage_duration,
        packaging_type=packaging,
        air_circulation=air_circulation,
        light_exposure=light_exposure,
    )

    # Safety override: once visual assessment classifies the item as Spoiled,
    # it must not be presented as having usable shelf life remaining.
    if str(freshness_status).strip().lower() == "spoiled":
        shelf["remaining_shelf_life_days"] = 0
        shelf["predicted_expiry_date"] = datetime.now().strftime("%d %B %Y")
        shelf["shelf_life_status"] = "Shelf life exhausted"
        shelf["safety_override"] = True
        shelf["decision_basis"] = (
            "Visual freshness assessment classified the product as Spoiled."
        )

    storage = analyze_storage_conditions(
        food_type, float(temperature), float(humidity), air_circulation, light_exposure
    )
    recs = generate_recommendations(
        food_type=food_type,
        remaining_days=int(shelf["remaining_shelf_life_days"]),
        spoilage_probability=float(shelf["spoilage_probability"]),
        temperature_status=storage["temperature"]["status"],
        humidity_status=storage["humidity"]["status"],
        air_status=storage["air_circulation"]["status"],
        light_status=storage["light_exposure"]["status"],
        recommended_temperature=storage["temperature"]["recommended"],
        recommended_humidity=storage["humidity"]["recommended"],
        predicted_expiry_date=shelf["predicted_expiry_date"],
        freshness_status=freshness_status,
    )

    shelf_score = max(0, min(100, 100 - float(shelf["spoilage_probability"])))
    product_age_score = max(0, 100 - min(storage_duration * 5, 100))
    weighted_health = round(
        score * 0.40 + float(storage["storage_compliance_score"]) * 0.25
        + shelf_score * 0.20 + product_age_score * 0.15, 2
    )

    # Keep the required weighted score calculation, but apply a safety cap to
    # the user-facing health score when the item is already classified Spoiled.
    overall_health = (
        min(weighted_health, round(score, 2))
        if str(freshness_status).strip().lower() == "spoiled"
        else weighted_health
    )
    shelf["weighted_health_score_before_safety_override"] = weighted_health

    predicted_date = _iso_prediction_date(shelf["predicted_expiry_date"])

    db = SessionLocal()
    try:
        batch = None
        if batch_id is not None:
            batch = db.query(Batch).filter(Batch.id == batch_id).first()
            if not batch:
                raise HTTPException(status_code=404, detail="Batch not found")

        assessment = FreshnessAssessment(
            batch_id=batch_id,
            food_type=food_type.strip().title(),
            image_name=image.filename,
            image_path=file_path,
            freshness_score=score,
            freshness_status=freshness_status,
            spoilage_probability=float(shelf["spoilage_probability"]),
            spoilage_risk=shelf["spoilage_risk"],
            shelf_life_at_assessment=int(shelf["remaining_shelf_life_days"]),
            predicted_expiry_date=predicted_date,
            temperature=float(temperature),
            humidity=float(humidity),
            air_circulation=air_circulation.lower(),
            light_exposure=light_exposure.lower(),
            packaging_type=packaging,
            storage_duration=storage_duration,
            storage_compliance_score=float(storage["storage_compliance_score"]),
            overall_storage_status=storage["overall_storage_status"],
            overall_health_score=overall_health,
            color_analysis_json=_json_dumps(color),
            texture_analysis_json=_json_dumps(texture),
            mold_analysis_json=_json_dumps(mold),
            bruising_analysis_json=_json_dumps(bruising),
            physical_damage_json=_json_dumps(physical),
            final_assessment_json=_json_dumps(final),
            storage_json=_json_dumps(storage),
            shelf_life_json=_json_dumps(shelf),
            recommendations_json=_json_dumps(recs),
        )
        db.add(assessment)

        reading = StorageReading(
            batch_id=batch_id,
            food_type=food_type.strip().title(),
            temperature=float(temperature), humidity=float(humidity),
            air_circulation=air_circulation.lower(), light_exposure=light_exposure.lower(),
            packaging_type=packaging, storage_duration=storage_duration,
            compliance_score=float(storage["storage_compliance_score"]),
            overall_status=storage["overall_storage_status"],
            temperature_status=storage["temperature"]["status"],
            humidity_status=storage["humidity"]["status"],
            air_status=storage["air_circulation"]["status"],
            light_status=storage["light_exposure"]["status"],
            recommendations_json=_json_dumps(storage["recommendations"]),
        )
        db.add(reading)

        if batch:
            batch.freshness_score = score
            batch.remaining_shelf_life = int(shelf["remaining_shelf_life_days"])
            batch.predicted_expiry_date = predicted_date
            batch.spoilage_probability = float(shelf["spoilage_probability"])
            batch.spoilage_risk = shelf["spoilage_risk"]
            batch.consumption_priority = recs["consumption_priority"]
            history = PredictionHistory(
                batch_id=batch.id,
                freshness_score=score,
                remaining_shelf_life=int(shelf["remaining_shelf_life_days"]),
                predicted_expiry_date=predicted_date,
                spoilage_probability=float(shelf["spoilage_probability"]),
                spoilage_risk=shelf["spoilage_risk"],
                temperature=float(temperature), humidity=float(humidity),
            )
            db.add(history)

        db.commit()
        db.refresh(assessment)
        db.refresh(reading)

        return {
            "message": "Complete freshness assessment generated and saved",
            "assessment_id": assessment.id,
            "batch_id": batch_id,
            "food_type": food_type.strip().title(),
            "image_name": image.filename,
            "image_url": f"/assessment-images/{safe_name}",
            "prediction_mode": mode,
            "visual_analysis": {
                "color_analysis": color,
                "texture_analysis": texture,
                "mold_analysis": mold,
                "bruising_analysis": bruising,
                "physical_damage_analysis": physical,
                "spoilage_analysis": spoilage_visual,
                "cnn_analysis": cnn,
                "final_assessment": final,
                "freshness_analysis": freshness,
                "classification": classification,
                "freshness_trend": freshness_trend,
                "freshness_report": freshness_report,
            },
            "shelf_life": shelf,
            "storage": storage,
            "conditions_used": {
                "temperature": temperature,
                "humidity": humidity,
                "air_circulation": air_circulation,
                "light_exposure": light_exposure,
                "packaging_type": packaging,
                "storage_duration_days": storage_duration,
            },
            "recommendations": recs,
            "overall_health_score": overall_health,
            "storage_reading_id": reading.id,
            "report_urls": {
                "json": f"/reports/assessment/{assessment.id}",
                "pdf": f"/reports/assessment/{assessment.id}/pdf",
                "excel": f"/reports/assessment/{assessment.id}/excel",
            },
        }
    finally:
        db.close()


@router.get("/history")
def assessment_history():
    db = SessionLocal()
    try:
        items = (
            db.query(FreshnessAssessment)
            .order_by(FreshnessAssessment.recorded_at.desc())
            .all()
        )

        return {
            "total": len(items),
            "assessments": [
                {
                    "assessment_id": item.id,
                    "batch_id": item.batch_id,
                    "food_type": item.food_type,
                    "freshness_score": item.freshness_score,
                    "freshness_status": item.freshness_status,
                    "spoilage_probability": item.spoilage_probability,
                    "spoilage_risk": item.spoilage_risk,
                    "shelf_life_at_assessment": item.shelf_life_at_assessment,
                    "predicted_expiry_date": str(item.predicted_expiry_date),
                    "storage_compliance_score": item.storage_compliance_score,
                    "overall_health_score": item.overall_health_score,
                    "recorded_at": str(item.recorded_at),
                    "report_urls": {
                        "json": f"/reports/assessment/{item.id}",
                        "pdf": f"/reports/assessment/{item.id}/pdf",
                        "excel": f"/reports/assessment/{item.id}/excel",
                    },
                }
                for item in items
            ],
        }
    finally:
        db.close()


@router.get("/{assessment_id}")
def get_assessment(assessment_id: int):
    db = SessionLocal()
    try:
        item = db.query(FreshnessAssessment).filter(FreshnessAssessment.id == assessment_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {
            "assessment_id": item.id,
            "batch_id": item.batch_id,
            "food_type": item.food_type,
            "image_name": item.image_name,
            "freshness_score": item.freshness_score,
            "freshness_status": item.freshness_status,
            "shelf_life_at_assessment": item.shelf_life_at_assessment,
            "predicted_expiry_date": str(item.predicted_expiry_date),
            "spoilage_probability": item.spoilage_probability,
            "spoilage_risk": item.spoilage_risk,
            "storage_compliance_score": item.storage_compliance_score,
            "overall_health_score": item.overall_health_score,
            "recorded_at": str(item.recorded_at),
        }
    finally:
        db.close()
