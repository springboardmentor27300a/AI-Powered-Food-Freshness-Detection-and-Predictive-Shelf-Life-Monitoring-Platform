from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from models import ShelfLifeRequest, BatchShelfLifeRequest
from database import prediction_collection, food_item_collection
from ml.shelf_life import predict_shelf_life, batch_predict
from dependencies import get_current_user, serialize_doc, to_object_id

router = APIRouter()


def _normalize(payload: dict) -> dict:
    for key in ("category", "packaging_type", "air_circulation", "light_exposure"):
        if payload.get(key) is not None and hasattr(payload[key], "value"):
            payload[key] = payload[key].value
    return payload


@router.post("/predict")
async def predict_shelf_life_endpoint(request: ShelfLifeRequest, user: dict = Depends(get_current_user)):
    """Estimate remaining shelf life, persist the prediction, and return it with provenance."""
    try:
        payload = _normalize(request.dict())
        prediction = predict_shelf_life(payload)

        doc = {
            "item_id": payload.get("item_id"),
            "batch_id": payload.get("batch_id"),
            "requested_by": str(user["_id"]),
            "requested_by_username": user["username"],
            "inputs": {k: payload.get(k) for k in (
                "category", "quality_score", "ml_status", "temperature_c",
                "humidity_pct", "packaging_type", "stored_at", "expiry_date")},
            "result": prediction,
            "predicted_at": datetime.now(timezone.utc),
        }
        result = await prediction_collection.insert_one(doc)
        prediction["prediction_id"] = str(result.inserted_id)
        return prediction
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shelf-life prediction failed: {str(e)}")


@router.post("/predict-for-item/{item_id}")
async def predict_for_item(item_id: str, user: dict = Depends(get_current_user)):
    """Estimate shelf life for a stored inventory item using its persisted storage data."""
    item = await food_item_collection.find_one({"_id": to_object_id(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    payload = _normalize({
        "item_id": str(item["_id"]),
        "batch_id": str(item["batch_id"]) if item.get("batch_id") else None,
        "name": item.get("name"),
        "category": item.get("category", "Packaged Foods"),
        "quantity": item.get("quantity"),
        "batch_number": item.get("batch_number"),
        "quality_score": item.get("quality_score"),
        "ml_status": item.get("ml_status"),
        "temperature_c": item.get("temperature_c"),
        "humidity_pct": item.get("humidity_pct"),
        "packaging_type": item.get("packaging_type"),
        "stored_at": item.get("stored_at") or item.get("created_at"),
        "expiry_date": item.get("expiry_date"),
    })
    prediction = predict_shelf_life(payload)
    doc = {
        "item_id": str(item["_id"]),
        "batch_id": payload.get("batch_id"),
        "requested_by": str(user["_id"]),
        "requested_by_username": user["username"],
        "inputs": {k: payload.get(k) for k in (
            "category", "quality_score", "ml_status", "temperature_c",
            "humidity_pct", "packaging_type", "stored_at", "expiry_date")},
        "result": prediction,
        "predicted_at": datetime.now(timezone.utc),
    }
    result = await prediction_collection.insert_one(doc)
    prediction["prediction_id"] = str(result.inserted_id)
    return prediction


@router.post("/batch")
async def predict_batch_endpoint(request: BatchShelfLifeRequest, user: dict = Depends(get_current_user)):
    """Estimate shelf life for multiple items in one call (not persisted; used for what-if analysis)."""
    try:
        payloads = [_normalize(item.dict()) for item in request.items]
        return {"count": len(payloads), "predictions": batch_predict(payloads)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


@router.get("/history")
async def prediction_history(item_id: str = None, limit: int = 50, user: dict = Depends(get_current_user)):
    """Persisted prediction history, optionally filtered by item."""
    query = {"item_id": item_id} if item_id else {}
    docs = []
    cursor = prediction_collection.find(query).sort("predicted_at", -1).limit(min(limit, 200))
    async for document in cursor:
        docs.append(serialize_doc(document))
    return docs
