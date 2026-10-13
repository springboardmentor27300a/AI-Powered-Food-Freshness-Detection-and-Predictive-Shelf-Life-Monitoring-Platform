"""
Analytics routes (Milestone 3): aggregated freshness & shelf-life insights
across inventory, storage readings, and scan history. Role-scoped:
staff see platform-wide data; consumers only their own records.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from database import (
    food_item_collection, storage_readings_collection,
    analysis_collection, batch_collection,
)
from ml.shelf_life import predict_shelf_life
from dependencies import get_current_user, serialize_doc

router = APIRouter()


def _to_aware_utc(value: datetime) -> datetime:
    """Coerce a datetime to UTC-aware (Mongo stores naive UTC)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def _item_query(user: dict) -> dict:
    """Consumers restricted to own items; staff see everything. Active inventory only."""
    base = {"$or": [{"status": {"$exists": False}}, {"status": "Active"}]}
    if user["role"] == "Consumer":
        return {**base, "created_by": str(user["_id"])}
    return base


@router.get("/freshness")
async def freshness_analytics(user: dict = Depends(get_current_user)):
    """
    Freshness analytics across inventory (role-scoped):
    - per-item shelf-life estimation (risk levels, remaining days)
    - category breakdown, aggregate risk counts, urgency ordering
    """
    items = []
    cursor = food_item_collection.find(await _item_query(user))
    async for document in cursor:
        items.append(serialize_doc(document))

    now = datetime.now(timezone.utc)
    enriched = []
    for item in items:
        expiry = item.get("expiry_date")
        prediction = predict_shelf_life({
            "category": item.get("category", "Packaged Foods"),
            "name": item.get("name"),
            "quantity": item.get("active_quantity", item.get("quantity")),  # remaining stock
            "batch_number": item.get("batch_number"),
            "quality_score": item.get("quality_score"),
            "ml_status": item.get("ml_status"),
            "temperature_c": item.get("temperature_c"),
            "humidity_pct": item.get("humidity_pct"),
            "packaging_type": item.get("packaging_type"),
            "stored_at": item.get("stored_at") or item.get("created_at"),
            "expiry_date": expiry,
        })
        # Label-expiry-based flag (independent of the estimation model)
        if isinstance(expiry, str):
            try:
                expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            except ValueError:
                expiry_dt = None
        elif isinstance(expiry, datetime):
            expiry_dt = expiry
        else:
            expiry_dt = None
        prediction["label_expired"] = bool(expiry_dt and _to_aware_utc(expiry_dt) < now)
        enriched.append({**item, "shelf_life": prediction})

    # Aggregate stats
    risk_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    category_stats = {}
    for item in enriched:
        sl = item["shelf_life"]
        risk_counts[sl["risk_level"]] = risk_counts.get(sl["risk_level"], 0) + 1
        cat = item.get("category", "Unknown")
        stats = category_stats.setdefault(cat, {
            "count": 0, "units": 0, "avg_remaining_days": 0.0, "_day_sum": 0.0,
        })
        stats["count"] += 1
        stats["units"] += item.get("active_quantity", item.get("quantity")) or 0
        stats["_day_sum"] += sl["effective_remaining_days"]

    for stats in category_stats.values():
        if stats["count"]:
            stats["avg_remaining_days"] = round(stats.pop("_day_sum") / stats["count"], 1)
        else:
            stats.pop("_day_sum", None)

    # Urgent items first
    enriched.sort(key=lambda x: x["shelf_life"]["effective_remaining_days"])

    return {
        "generated_at": now.isoformat(),
        "total_items": len(enriched),
        "total_units": sum(i.get("active_quantity", i.get("quantity")) or 0 for i in enriched),
        "risk_counts": risk_counts,
        "category_breakdown": category_stats,
        "items": enriched,
    }


@router.get("/storage-compliance")
async def storage_compliance_analytics(user: dict = Depends(get_current_user)):
    """
    Storage compliance analytics: latest reading per zone, trend of the last
    30 readings, and per-parameter breach counts across recent history.
    """
    query: dict = {}
    if user["role"] == "Consumer":
        # consumers see readings of their own items or readings they recorded
        own_items = [str(d["_id"]) async for d in food_item_collection.find(
            {"created_by": str(user["_id"])}, {"_id": 1})]
        query = {"$or": [{"item_id": {"$in": own_items}}, {"recorded_by": str(user["_id"])}]}

    readings = []
    cursor = storage_readings_collection.find(query).sort("recorded_at", -1).limit(200)
    async for document in cursor:
        readings.append(serialize_doc(document))

    latest_by_zone = {}
    for reading in readings:
        latest_by_zone.setdefault(reading.get("zone", "Unknown"), reading)

    breach_counts = {"temperature": 0, "humidity": 0, "air_circulation": 0, "light_exposure": 0}
    scores = []
    for reading in readings:
        scores.append(reading.get("storage_score") or 0.0)
        validation = reading.get("validation") or {}
        for check in validation.get("checks", []):
            if not check.get("compliant") and not check.get("not_recorded"):
                breach_counts[check["parameter"]] = breach_counts.get(check["parameter"], 0) + 1

    chronological = list(reversed(readings[:30]))  # oldest -> newest for trend charts

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_readings": len(readings),
        "zones": list(latest_by_zone.values()),
        "compliance_counts": {
            "compliant": sum(1 for z in latest_by_zone.values() if z.get("compliance_status") == "Compliant"),
            "partially_compliant": sum(1 for z in latest_by_zone.values() if z.get("compliance_status") == "Partially Compliant"),
            "non_compliant": sum(1 for z in latest_by_zone.values() if z.get("compliance_status") == "Non-Compliant"),
        },
        "average_storage_score": round(sum(scores) / len(scores), 1) if scores else None,
        "breach_counts": breach_counts,
        "trend": [
            {
                "recorded_at": r.get("recorded_at"),
                "zone": r.get("zone"),
                "temperature_c": r.get("temperature_c"),
                "humidity_pct": r.get("humidity_pct"),
                "storage_score": r.get("storage_score"),
                "source": r.get("source", "manual"),
            }
            for r in chronological
        ],
    }


@router.get("/scans")
async def scan_analytics(user: dict = Depends(get_current_user)):
    """Aggregate statistics from persisted AI inspection scans (role-scoped)."""
    query: dict = {}
    if user["role"] == "Consumer":
        query = {"$or": [{"scanned_by": str(user["_id"])}, {"owner_id": str(user["_id"])}]}

    scans = []
    cursor = analysis_collection.find(query).sort("scanned_at", -1).limit(200)
    async for document in cursor:
        scans.append(serialize_doc(document))

    total = len(scans)
    rotten = sum(1 for s in scans if s.get("ml_status") == "Rotten")
    scores = [s.get("quality_score") for s in scans if isinstance(s.get("quality_score"), (int, float))]

    category_counts = {}
    for scan in scans:
        cat = scan.get("quality_category") or "Unknown"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        "total_scans": total,
        "rotten_scans": rotten,
        "fresh_scans": total - rotten,
        "spoilage_rate_pct": round(rotten / total * 100, 1) if total else 0.0,
        "average_quality_score": round(sum(scores) / len(scores), 1) if scores else None,
        "quality_category_counts": category_counts,
        "recent_scans": scans[:20],
    }


@router.get("/overview")
async def platform_overview(user: dict = Depends(get_current_user)):
    """
    Cross-module counts derived from real records. Uninstrumented metrics
    (e.g. API request counters) are explicitly reported as not available.
    """
    item_query = await _item_query(user)
    total_items = await food_item_collection.count_documents(item_query)
    batch_query = {}
    if user["role"] == "Consumer":
        batch_query["created_by"] = str(user["_id"])
    total_batches = await batch_collection.count_documents(batch_query)
    scan_query = {}
    if user["role"] == "Consumer":
        scan_query = {"$or": [{"scanned_by": str(user["_id"])}, {"owner_id": str(user["_id"])}]}
    total_scans = await analysis_collection.count_documents(scan_query)
    spoiled = await analysis_collection.count_documents({**scan_query, "ml_status": "Rotten"})
    reading_query: dict = {}
    if user["role"] == "Consumer":
        own_items = [str(d["_id"]) async for d in food_item_collection.find(
            {"created_by": str(user["_id"])}, {"_id": 1})]
        reading_query = {"$or": [{"item_id": {"$in": own_items}}, {"recorded_by": str(user["_id"])}]}
    total_readings = await storage_readings_collection.count_documents(reading_query)

    return {
        "total_food_items": total_items,
        "total_batches": total_batches,
        "total_scans": total_scans,
        "spoiled_scans": spoiled,
        "total_storage_readings": total_readings,
        "api_request_count": "Not available (not instrumented)",
        "system_uptime": "Not available (not instrumented)",
    }
