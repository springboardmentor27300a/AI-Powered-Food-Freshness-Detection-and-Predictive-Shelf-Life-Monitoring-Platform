from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from models import ShelfLifeRequest
from ml.recommendations import generate_recommendations
from ml.shelf_life import predict_shelf_life
from ml.storage_conditions import validate_storage_conditions
from ml.storage_standards import CATEGORY_STORAGE_PROFILES
from database import recommendation_collection, food_item_collection
from dependencies import get_current_user, require_roles, serialize_doc, to_object_id

router = APIRouter()

STAFF_ROLES = ("Retail Manager", "Warehouse Operator", "Food Quality Inspector")


class OverviewRequest(BaseModel):
    """Optional filter: restrict the overview to specific item ids."""
    item_ids: Optional[List[str]] = None


@router.post("/item")
async def recommend_for_item(request: ShelfLifeRequest, user: dict = Depends(get_current_user)):
    """Full recommendation set for one item: consumption, storage, rotation, waste reduction."""
    try:
        payload = request.dict()
        for key in ("category", "packaging_type", "air_circulation", "light_exposure"):
            if payload.get(key) is not None and hasattr(payload[key], "value"):
                payload[key] = payload[key].value
        return generate_recommendations(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation generation failed: {str(e)}")


@router.get("/storage/{category}")
async def storage_guidance(category: str, user: dict = Depends(get_current_user)):
    """Baseline storage guidance and optimal ranges for a food category."""
    profile = CATEGORY_STORAGE_PROFILES.get(category)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Unknown category: {category}")
    return {
        "category": category,
        "optimal_temperature_c": [profile["temp_min"], profile["temp_max"]],
        "optimal_humidity_pct": [profile["humidity_min"], profile["humidity_max"]],
        "max_shelf_life_days": profile["max_shelf_life_days"],
        "air_circulation": profile["air_circulation"],
        "light_exposure": profile["light_exposure"],
        "packaging_factors": profile["packaging_factors"],
        "baseline_recommendations": profile["recommendations"],
        "source_type": "author_defined_industry_typical",
        "note": "General guidance values defined by the project authors; not an official standard.",
    }


@router.get("/inventory-overview")
@router.post("/inventory-overview")
async def inventory_insights(
    request: OverviewRequest = None,
    user: dict = Depends(require_roles(*STAFF_ROLES, "Administrator")),
):
    """
    Generate inventory insights from real database records for staff roles.
    Both GET and POST are supported so the dashboard contract is unambiguous.
    """
    query: dict = {"$or": [{"status": {"$exists": False}}, {"status": "Active"}]}
    if request and request.item_ids:
        query["_id"] = {"$in": [to_object_id(i) for i in request.item_ids]}

    results = []
    cursor = food_item_collection.find(query)
    async for item in cursor:
        payload = {
            "item_id": str(item["_id"]),
            "name": item.get("name"),
            "category": item.get("category", "Packaged Foods"),
            "quantity": item.get("active_quantity", item.get("quantity")),
            "batch_number": item.get("batch_number"),
            "quality_score": item.get("quality_score"),
            "ml_status": item.get("ml_status"),
            "temperature_c": item.get("temperature_c"),
            "humidity_pct": item.get("humidity_pct"),
            "packaging_type": item.get("packaging_type"),
            "stored_at": item.get("stored_at") or item.get("created_at"),
            "expiry_date": item.get("expiry_date"),
        }
        entry = generate_recommendations(payload)
        entry["item_id"] = str(item["_id"])
        results.append(entry)

    def _days(entry):
        return entry["shelf_life"]["effective_remaining_days"]

    results.sort(key=_days)

    total_units = sum(r["item"].get("quantity") or 0 for r in results)
    urgent_units = sum(
        (r["item"].get("quantity") or 0)
        for r in results
        if r["shelf_life"]["risk_level"] in ("High", "Critical")
    )
    critical_count = sum(1 for r in results if r["shelf_life"]["risk_level"] == "Critical")
    high_count = sum(1 for r in results if r["shelf_life"]["risk_level"] == "High")
    avg_shelf_life = round(sum(_days(r) for r in results) / len(results), 1) if results else 0.0
    estimated_waste_units = sum(
        (r["item"].get("quantity") or 0)
        for r in results
        if r["shelf_life"]["effective_remaining_days"] <= 2
    )

    now = datetime.now(timezone.utc)
    for r in results[:20]:
        await recommendation_collection.insert_one({
            "item_id": r["item_id"],
            "generated_by": str(user["_id"]),
            "generated_at": now,
            "payload": {
                "category": r["item"].get("category"),
                "temperature_c": r["shelf_life"].get("temperature_c"),
                "humidity_pct": r["shelf_life"].get("humidity_pct"),
                "packaging_type": r["shelf_life"].get("packaging_type"),
            },
            "result": {
                "risk_level": r["shelf_life"]["risk_level"],
                "effective_remaining_days": r["shelf_life"]["effective_remaining_days"],
                "recommendations": r["recommendations"],
            },
        })

    return {
        "total_items": len(results),
        "total_units": total_units,
        "urgent_units": urgent_units,
        "risk_counts": {"critical": critical_count, "high": high_count},
        "average_remaining_days": avg_shelf_life,
        "estimated_waste_units": estimated_waste_units,
        "items": results,
    }


@router.get("/history")
async def recommendation_history(item_id: str = None, limit: int = 50, user: dict = Depends(get_current_user)):
    """Persisted recommendation history for an item."""
    query = {"item_id": item_id} if item_id else {}
    docs = []
    cursor = recommendation_collection.find(query).sort("generated_at", -1).limit(min(limit, 200))
    async for document in cursor:
        docs.append(serialize_doc(document))
    return docs
