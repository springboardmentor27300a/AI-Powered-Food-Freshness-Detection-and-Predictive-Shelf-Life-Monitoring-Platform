"""Storage environment readings: full CRUD, item/batch linkage, compliance, alerts.

All readings entered through the UI are labeled source="manual" (no IoT integration).
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from models import StorageReadingCreate, StorageReadingInDB
from database import storage_readings_collection, food_item_collection, user_collection
from ml.storage_conditions import validate_storage_conditions
from ml.alert_helpers import generate_alerts
from dependencies import get_current_user, require_roles, serialize_doc, to_object_id

router = APIRouter()


def _violations(validation: dict) -> List[str]:
    return [c["parameter"] for c in validation.get("checks", [])
            if not c.get("compliant") and not c.get("not_recorded")]


@router.post("/", response_model=StorageReadingInDB)
async def create_storage_reading(reading: StorageReadingCreate, user: dict = Depends(get_current_user)):
    """Record a storage-environment reading (manual entry) with automatic compliance validation."""
    now = datetime.now(timezone.utc)

    item = None
    category = reading.category.value
    zone = reading.zone
    if reading.item_id:
        item = await food_item_collection.find_one({"_id": to_object_id(reading.item_id)})
        if not item:
            raise HTTPException(status_code=404, detail="Linked item not found")
        category = item.get("category", category)
        zone = reading.zone or item.get("storage_zone") or zone

    validation = validate_storage_conditions(
        category,
        reading.temperature_c,
        reading.humidity_pct,
        reading.air_circulation.value if reading.air_circulation else None,
        reading.light_exposure.value if reading.light_exposure else None,
    )

    doc = {
        "item_id": str(item["_id"]) if item else None,
        "batch_id": reading.batch_id,
        "zone": zone,
        "category": category,
        "temperature_c": reading.temperature_c,
        "humidity_pct": reading.humidity_pct,
        "air_circulation": reading.air_circulation.value if reading.air_circulation else None,
        "light_exposure": reading.light_exposure.value if reading.light_exposure else None,
        "recorded_at": reading.recorded_at or now,
        "notes": reading.notes,
        "source": "manual",
        "recorded_by": str(user["_id"]),
        "recorded_by_username": user["username"],
        "compliance_status": validation["compliance_status"],
        "storage_score": validation["storage_score"],
        "violations": _violations(validation),
        "validation": validation,
        "created_at": now,
    }
    insert_result = await storage_readings_collection.insert_one(doc)

    if item:
        payload = {
            "item_id": doc["item_id"],
            "batch_id": doc["batch_id"],
            "name": item.get("name"),
            "storage_zone": zone,
        }
        from bson import ObjectId
        owner = await user_collection.find_one({"_id": ObjectId(item["created_by"])}) if item.get("created_by") else None
        await generate_alerts(payload, None, validation, user,
                              item_owner_role=owner.get("role") if owner else None)
    else:
        zone_payload = {"item_id": None, "batch_id": None, "name": f"Zone '{zone}'", "storage_zone": zone}
        await generate_alerts(zone_payload, None, validation, user, item_owner_role=None)

    return serialize_doc(doc | {"_id": insert_result.inserted_id})


@router.get("/", response_model=List[dict])
async def list_storage_readings(
    item_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """List the most recent storage readings, optionally for one item."""
    query: dict = {}
    if item_id:
        query["item_id"] = item_id
    readings = []
    cursor = storage_readings_collection.find(query).sort("recorded_at", -1).limit(min(limit, 500))
    async for document in cursor:
        readings.append(serialize_doc(document))
    return readings


@router.get("/status")
async def storage_overview(user: dict = Depends(get_current_user)):
    """
    Aggregated storage compliance overview: latest reading per zone,
    compliance counts, and average storage score across the last 100 readings.
    """
    latest_by_zone = {}
    cursor = storage_readings_collection.find({}).sort("recorded_at", -1).limit(200)
    async for document in cursor:
        zone = document.get("zone", "Unknown")
        if zone not in latest_by_zone:
            latest_by_zone[zone] = serialize_doc(document)

    zones = list(latest_by_zone.values())
    compliant = sum(1 for z in zones if z.get("compliance_status") == "Compliant")
    partial = sum(1 for z in zones if z.get("compliance_status") == "Partially Compliant")
    non_compliant = sum(1 for z in zones if z.get("compliance_status") == "Non-Compliant")

    recent = []
    cursor = storage_readings_collection.find({}).sort("recorded_at", -1).limit(100)
    async for document in cursor:
        recent.append(serialize_doc(document))

    avg_score = round(sum(r.get("storage_score") or 0 for r in recent) / len(recent), 1) if recent else None

    return {
        "total_zones": len(zones),
        "zones": zones,
        "compliance_counts": {
            "compliant": compliant,
            "partially_compliant": partial,
            "non_compliant": non_compliant,
            "unknown": max(0, len(zones) - compliant - partial - non_compliant),
        },
        "average_storage_score": avg_score,
        "recent_readings_count": len(recent),
    }
