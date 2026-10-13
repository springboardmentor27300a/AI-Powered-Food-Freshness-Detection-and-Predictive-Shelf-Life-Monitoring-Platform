"""Executive analytics (Milestone 4): cross-module KPIs, 14-day time series,
and per-category analytics - all computed from real MongoDB records.

Access: Administrator, Retail Manager, Warehouse Operator (management roles).
No values are fabricated; "N/A" is returned when no records exist.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from database import (
    food_item_collection, storage_readings_collection,
    analysis_collection, lifecycle_events_collection,
    alert_collection, report_collection,
)
from ml.shelf_life import predict_shelf_life
from dependencies import get_current_user, require_roles

router = APIRouter()

DAYS = 14


def _active_query(user: dict) -> dict:
    base = {"$or": [{"status": {"$exists": False}}, {"status": "Active"}]}
    if user["role"] == "Consumer":
        return {**base, "created_by": str(user["_id"])}
    return base


def _shelf_inputs(item: dict) -> dict:
    return {
        "category": item.get("category", "Packaged Foods"),
        "name": item.get("name"),
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


def _day_buckets(days: int):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    labels = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    return start, {lab: 0 for lab in labels}


@router.get("/executive")
async def executive_analytics(user: dict = Depends(require_roles(
        "Administrator", "Retail Manager", "Warehouse Operator"))):
    now = datetime.now(timezone.utc)

    # ---------------- inventory (active) ----------------
    items = []
    async for d in food_item_collection.find(_active_query(user)).limit(1000):
        items.append(d)
    total_items = len(items)
    total_units = sum((i.get("active_quantity") if i.get("active_quantity") is not None
                       else i.get("quantity")) or 0 for i in items)

    risk = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    days_left = []
    cat_stats = {}
    for it in items:
        pred = predict_shelf_life(_shelf_inputs(it))
        if pred["risk_level"] in risk:
            risk[pred["risk_level"]] += 1
        days_left.append(pred["effective_remaining_days"])
        cat = it.get("category", "Unknown")
        st = cat_stats.setdefault(cat, {"items": 0, "units": 0, "_days": 0.0})
        st["items"] += 1
        st["units"] += (it.get("active_quantity") if it.get("active_quantity") is not None
                        else it.get("quantity")) or 0
        st["_days"] += pred["effective_remaining_days"]

    # ---------------- scans ----------------
    scans = []
    async for d in analysis_collection.find({}).sort("scanned_at", -1).limit(2000):
        scans.append(d)
    total_scans = len(scans)
    rotten_scans = sum(1 for s in scans if s.get("ml_status") == "Rotten")
    quality_scores = [s.get("quality_score") for s in scans
                      if isinstance(s.get("quality_score"), (int, float))]

    # ---------------- waste (lifecycle, lifetime + period) ----------------
    pipeline = [
        {"$group": {"_id": "$status", "units": {"$sum": {"$ifNull": ["$active_quantity", "$quantity"]}},
                    "sold": {"$sum": {"$ifNull": ["$sold_quantity", 0]}},
                    "disposed": {"$sum": {"$ifNull": ["$disposed_quantity", 0]}},
                    "count": {"$sum": 1}}},
    ]
    lifecycle = {}
    async for row in food_item_collection.aggregate(pipeline):
        lifecycle[row["_id"] or "Active"] = row
    disposed_units = sum(v.get("disposed") or 0 for k, v in lifecycle.items())
    sold_units = sum(v.get("sold") or 0 for k, v in lifecycle.items())

    # ---------------- storage compliance (latest per zone) ----------------
    latest_by_zone = {}
    async for r in storage_readings_collection.find({}).sort("recorded_at", -1).limit(200):
        z = r.get("zone", "Unknown")
        if z not in latest_by_zone:
            latest_by_zone[z] = r
    zones = list(latest_by_zone.values())
    compliant_zones = sum(1 for z in zones if z.get("compliance_status") == "Compliant")

    kpis = {
        "total_active_items": total_items,
        "total_active_units": total_units,
        "fresh_pct": round(risk["Low"] / total_items * 100, 1) if total_items else None,
        "at_risk_pct": round((risk["High"] + risk["Critical"]) / total_items * 100, 1) if total_items else None,
        "spoilage_pct": round(rotten_scans / total_scans * 100, 1) if total_scans else None,
        "waste_units": disposed_units,
        "sold_units": sold_units,
        "storage_compliance_pct": round(compliant_zones / len(zones) * 100, 1) if zones else None,
        "avg_quality_score": round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None,
        "avg_remaining_shelf_life_days": round(sum(days_left) / len(days_left), 1) if days_left else None,
        "risk_counts": risk,
    }

    # ---------------- 14-day time series ----------------
    scan_start, scan_buckets_fresh = _day_buckets(DAYS)
    _, scan_buckets_rotten = _day_buckets(DAYS)
    async for s in analysis_collection.find({"scanned_at": {"$gte": scan_start}}):
        lab = s["scanned_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        if lab in scan_buckets_fresh:
            if s.get("ml_status") == "Rotten":
                scan_buckets_rotten[lab] += 1
            else:
                scan_buckets_fresh[lab] += 1

    _, disposal_buckets = _day_buckets(DAYS)
    _, sold_buckets = _day_buckets(DAYS)
    async for e in lifecycle_events_collection.find(
            {"created_at": {"$gte": scan_start}, "event_type": {"$in": ["disposed", "sold", "adjusted"]}}):
        lab = e["created_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        units = abs(e.get("quantity_delta") or 0)
        if lab in disposal_buckets:
            if e["event_type"] == "sold":
                sold_buckets[lab] += units
            elif e["event_type"] == "disposed":
                disposal_buckets[lab] += units

    _, score_sum = _day_buckets(DAYS)
    _, score_cnt = _day_buckets(DAYS)
    async for r in storage_readings_collection.find({"recorded_at": {"$gte": scan_start}}):
        lab = r["recorded_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        if lab in score_sum and isinstance(r.get("storage_score"), (int, float)):
            score_sum[lab] += r["storage_score"]
            score_cnt[lab] += 1

    _, reg_buckets = _day_buckets(DAYS)
    async for it in food_item_collection.find({"created_at": {"$gte": scan_start}}):
        lab = it["created_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        if lab in reg_buckets:
            reg_buckets[lab] += 1

    labels = list(scan_buckets_fresh.keys())
    series = {
        "labels": labels,
        "scans_fresh": [scan_buckets_fresh[l] for l in labels],
        "scans_rotten": [scan_buckets_rotten[l] for l in labels],
        "disposal_units": [disposal_buckets[l] for l in labels],
        "sold_units_series": [sold_buckets[l] for l in labels],
        "registrations": [reg_buckets[l] for l in labels],
        "avg_storage_score": [
            round(score_sum[l] / score_cnt[l], 1) if score_cnt[l] else None for l in labels
        ],
    }

    category_analytics = [
        {"category": c, "items": s["items"], "units": s["units"],
         "avg_remaining_days": round(s["_days"] / s["items"], 1)}
        for c, s in sorted(cat_stats.items(), key=lambda kv: -kv[1]["items"])
    ]

    alert_count = await alert_collection.count_documents({})
    report_count = await report_collection.count_documents({})

    return {
        "generated_at": now.isoformat(),
        "kpis": kpis,
        "series": series,
        "category_analytics": category_analytics,
        "lifecycle_counts": {k: v.get("count", 0) for k, v in lifecycle.items()},
        "total_alerts": alert_count,
        "total_reports": report_count,
    }
