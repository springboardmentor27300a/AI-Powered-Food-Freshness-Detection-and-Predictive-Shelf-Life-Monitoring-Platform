"""Report data builders (Milestone 4).

Every value in a generated report originates from persisted MongoDB records or
from the existing deterministic calculation engines (shelf-life / storage
standards). Nothing is fabricated.

Five report types (per platform specification):
  freshness | shelf_life | inventory_quality | waste_reduction | storage_compliance

Each builder returns:
  {
    "title": str,
    "description": str,
    "summary": [{"label","value"}...],
    "tables": [{"name","columns":[...],"rows":[[...],...]}...],
  }
Role scoping: Consumers only ever see data for items they created; staff roles
see platform-wide data. This is enforced with Mongo queries, not UI hiding.
"""
from datetime import datetime, timedelta, timezone

from database import (
    analysis_collection, prediction_collection, food_item_collection,
    storage_readings_collection, lifecycle_events_collection,
)
from dependencies import serialize_doc
from ml.shelf_life import predict_shelf_life

REPORT_TYPES = {
    "freshness": "Freshness Report",
    "shelf_life": "Shelf-Life Report",
    "inventory_quality": "Inventory Quality Report",
    "waste_reduction": "Waste Reduction Report",
    "storage_compliance": "Storage Compliance Report",
}


def _parse_date(value, end_of_day: bool = False):
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    if end_of_day and d.hour == 0 and d.minute == 0 and d.second == 0:
        d = d + timedelta(days=1) - timedelta(milliseconds=1)
    return d


def _iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else dt


def _fmt(v):
    if v is None:
        return "N/A"
    if isinstance(v, float):
        return round(v, 2)
    return v


async def _scope_query(user: dict, collection_item_field: str = "item_id") -> dict:
    """Consumers are restricted to their own items across every report type."""
    if user["role"] != "Consumer":
        return {}
    own_ids = [str(d["_id"]) async for d in food_item_collection.find(
        {"created_by": str(user["_id"])}, {"_id": 1})]
    return {"$or": [{collection_item_field: {"$in": own_ids}}, {"created_by": str(user["_id"])}]}


def _range_filter(filters: dict, field: str) -> dict:
    q = {}
    date_from = _parse_date(filters.get("date_from"))
    date_to = _parse_date(filters.get("date_to"), end_of_day=True)
    if date_from or date_to:
        q[field] = {}
        if date_from:
            q[field]["$gte"] = date_from
        if date_to:
            q[field]["$lte"] = date_to
    return q


async def _build_freshness(filters: dict, user: dict) -> dict:
    query = await _scope_query(user, "item_id")
    query.update(_range_filter(filters, "scanned_at"))
    if filters.get("category"):
        query["category"] = filters["category"]
    if filters.get("item_id"):
        query["item_id"] = filters["item_id"]

    scans = [serialize_doc(d) async for d in
             analysis_collection.find(query).sort("scanned_at", -1).limit(1000)]
    total = len(scans)
    rotten = sum(1 for s in scans if s.get("ml_status") == "Rotten")
    scores = [s.get("quality_score") for s in scans if isinstance(s.get("quality_score"), (int, float))]
    confs = [s.get("confidence") for s in scans if isinstance(s.get("confidence"), (int, float))]

    rows = [[
        s.get("item_id") or "-", s.get("food_type") or "-", s.get("category") or "-",
        s.get("ml_status") or "-", _fmt(s.get("quality_score")), _fmt(s.get("confidence")),
        _iso(s.get("scanned_at")),
    ] for s in scans[:200]]

    return {
        "title": REPORT_TYPES["freshness"],
        "description": "AI inspection (MobileNetV2 + OpenCV) results across the selected period.",
        "summary": [
            {"label": "Total scans", "value": total},
            {"label": "Fresh classifications", "value": total - rotten},
            {"label": "Rotten classifications", "value": rotten},
            {"label": "Spoilage rate", "value": f"{round(rotten / total * 100, 1)}%" if total else "N/A"},
            {"label": "Average quality score", "value": _fmt(round(sum(scores) / len(scores), 1)) if scores else "N/A"},
            {"label": "Average AI confidence", "value": _fmt(round(sum(confs) / len(confs) * 100, 1)) if confs else "N/A"},
        ],
        "tables": [{
            "name": "AI Inspection Records",
            "columns": ["Item ID", "Food Type", "Category", "AI Status", "Quality Score", "Confidence", "Scanned At"],
            "rows": rows,
        }],
    }


async def _build_shelf_life(filters: dict, user: dict) -> dict:
    query = await _scope_query(user, "item_id")
    query.update(_range_filter(filters, "predicted_at"))
    if filters.get("item_id"):
        query["item_id"] = filters["item_id"]

    preds = [serialize_doc(d) async for d in
             prediction_collection.find(query).sort("predicted_at", -1).limit(1000)]
    results = [p.get("result") or {} for p in preds]
    total = len(preds)
    risk_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    days_list = []
    for r in results:
        risk = r.get("risk_level")
        if risk in risk_counts:
            risk_counts[risk] += 1
        if isinstance(r.get("effective_remaining_days"), (int, float)):
            days_list.append(r["effective_remaining_days"])

    rows = [[
        p.get("item_id") or "-", (p.get("inputs") or {}).get("category") or "-",
        r.get("risk_level") or "-", _fmt(r.get("effective_remaining_days")),
        _fmt(r.get("estimated_total_life_days")), _iso(r.get("predicted_expiry_date")),
        f"{r.get('prediction_confidence', 'N/A')}%", _iso(p.get("predicted_at")),
    ] for p, r in list(zip(preds, results))[:200]]

    return {
        "title": REPORT_TYPES["shelf_life"],
        "description": "Parametric Q10 shelf-life estimates persisted by the prediction engine "
                       "(estimates, not guaranteed safe-life dates).",
        "summary": [
            {"label": "Total predictions", "value": total},
            {"label": "Low risk", "value": risk_counts["Low"]},
            {"label": "Medium risk", "value": risk_counts["Medium"]},
            {"label": "High risk", "value": risk_counts["High"]},
            {"label": "Critical risk", "value": risk_counts["Critical"]},
            {"label": "Avg remaining days", "value": _fmt(round(sum(days_list) / len(days_list), 1)) if days_list else "N/A"},
        ],
        "tables": [{
            "name": "Shelf-Life Predictions",
            "columns": ["Item ID", "Category", "Risk", "Effective Remaining (d)", "Total Estimate (d)",
                        "Predicted Expiry", "Confidence", "Predicted At"],
            "rows": rows,
        }],
    }


async def _build_inventory_quality(filters: dict, user: dict) -> dict:
    query = {}
    if user["role"] == "Consumer":
        query["created_by"] = str(user["_id"])
    if filters.get("category"):
        query["category"] = filters["category"]
    if filters.get("item_id"):
        query["_id"] = __import__("bson").ObjectId(filters["item_id"])
    if filters.get("batch_number"):
        query["batch_number"] = filters["batch_number"]
    status = filters.get("status")
    if status and status != "all":
        query["status"] = status

    items = [serialize_doc(d) async for d in food_item_collection.find(query).limit(500)]
    total = len(items)
    total_units = sum((i.get("active_quantity") if i.get("active_quantity") is not None
                       else i.get("quantity")) or 0 for i in items)
    scanned = [i for i in items if i.get("quality_score") is not None]
    scores = [i.get("quality_score") for i in scanned if isinstance(i.get("quality_score"), (int, float))]
    ml_fresh = sum(1 for i in items if i.get("ml_status") == "Fresh")
    ml_rotten = sum(1 for i in items if i.get("ml_status") == "Rotten")
    sold_units = sum(i.get("sold_quantity") or 0 for i in items)
    disposed_units = sum(i.get("disposed_quantity") or 0 for i in items)

    # Lifecycle status distribution (real counts)
    status_counts = {}
    for i in items:
        st = i.get("status") or "Active"
        status_counts[st] = status_counts.get(st, 0) + 1

    # Risk via the existing shelf-life engine (deterministic, per item)
    risk_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    rows = []
    for i in items[:200]:
        pred = predict_shelf_life({
            "category": i.get("category", "Packaged Foods"),
            "name": i.get("name"),
            "quantity": i.get("active_quantity", i.get("quantity")),
            "batch_number": i.get("batch_number"),
            "quality_score": i.get("quality_score"),
            "ml_status": i.get("ml_status"),
            "temperature_c": i.get("temperature_c"),
            "humidity_pct": i.get("humidity_pct"),
            "packaging_type": i.get("packaging_type"),
            "stored_at": i.get("stored_at") or i.get("created_at"),
            "expiry_date": i.get("expiry_date"),
        })
        if pred["risk_level"] in risk_counts:
            risk_counts[pred["risk_level"]] += 1
        rows.append([
            i.get("name"), i.get("category"), i.get("batch_number"),
            i.get("active_quantity", i.get("quantity")), i.get("status") or "Active",
            _fmt(i.get("quality_score")), i.get("ml_status") or "Not scanned",
            pred["risk_level"], _fmt(pred["effective_remaining_days"]),
        ])

    return {
        "title": REPORT_TYPES["inventory_quality"],
        "description": "Inventory-wide quality and lifecycle snapshot with per-item risk from the "
                       "shelf-life estimation engine.",
        "summary": [
            {"label": "Total items", "value": total},
            {"label": "Total active units", "value": total_units},
            {"label": "Items scanned by AI", "value": len(scanned)},
            {"label": "Average quality score", "value": _fmt(round(sum(scores) / len(scores), 1)) if scores else "N/A"},
            {"label": "AI Fresh / Rotten", "value": f"{ml_fresh} / {ml_rotten}"},
            {"label": "Units sold (lifetime)", "value": sold_units},
            {"label": "Units disposed (lifetime)", "value": disposed_units},
            {"label": "At-risk items (High+Critical)", "value": risk_counts["High"] + risk_counts["Critical"]},
            {"label": "Lifecycle status counts", "value": ", ".join(f"{k}: {v}" for k, v in sorted(status_counts.items())) or "None"},
        ],
        "tables": [{
            "name": "Inventory Items",
            "columns": ["Product", "Category", "Batch", "Active Qty", "Status", "Quality",
                        "AI Status", "Risk", "Est. Remaining (d)"],
            "rows": rows,
        }],
    }


async def _build_waste_reduction(filters: dict, user: dict) -> dict:
    query = await _scope_query(user, "item_id")
    query.update(_range_filter(filters, "created_at"))
    if filters.get("category"):
        pass  # disposal events do not store category; filter applied after join below
    if filters.get("item_id"):
        query["item_id"] = filters["item_id"]

    events = [serialize_doc(d) async for d in
              lifecycle_events_collection.find(
                  {**query, "event_type": {"$in": ["disposed", "sold"]}}).sort("created_at", -1).limit(1000)]

    # attach item names/categories (join on item_id)
    item_ids = list({e.get("item_id") for e in events if e.get("item_id")})
    item_meta = {}
    if item_ids:
        async for d in food_item_collection.find({"_id": {"$in": [
                __import__("bson").ObjectId(i) for i in item_ids if i]}}):
            item_meta[str(d["_id"])] = {"name": d.get("name"), "category": d.get("category")}
    if filters.get("category"):
        events = [e for e in events
                  if item_meta.get(e.get("item_id"), {}).get("category") == filters["category"]]

    disposed = [e for e in events if e.get("event_type") == "disposed"]
    disposed_units = sum(e.get("quantity_delta") and abs(e["quantity_delta"]) or 0 for e in disposed)
    reasons = {}
    for e in disposed:
        r = e.get("reason") or "unspecified"
        reasons[r] = reasons.get(r, 0) + 1
    sold_units = sum(e.get("quantity_delta") and abs(e["quantity_delta"]) or 0
                     for e in events if e.get("event_type") == "sold")

    # Forward-looking waste risk from the shelf-life engine over currently active stock
    inv_query = {"$or": [{"status": {"$exists": False}}, {"status": "Active"}]}
    if user["role"] == "Consumer":
        inv_query["created_by"] = str(user["_id"])
    if filters.get("category"):
        inv_query["category"] = filters["category"]
    at_risk_units = 0
    markdown = []
    async for item in food_item_collection.find(inv_query).limit(500):
        pred = predict_shelf_life({
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
        })
        days = pred["effective_remaining_days"]
        units = item.get("active_quantity", item.get("quantity")) or 0
        if days <= 2:
            at_risk_units += units
        if 0 < days <= 3:
            markdown.append([item.get("name"), item.get("batch_number"), units,
                             _fmt(days), pred["risk_level"]])

    rows = [[
        item_meta.get(e.get("item_id"), {}).get("name") or e.get("item_id") or "-",
        item_meta.get(e.get("item_id"), {}).get("category") or "-",
        e.get("event_type"), abs(e.get("quantity_delta") or 0),
        e.get("reason") or "-", e.get("performed_by_username") or "-", _iso(e.get("created_at")),
    ] for e in events[:200]]

    return {
        "title": REPORT_TYPES["waste_reduction"],
        "description": "Recorded disposals/sales in the period plus forward-looking waste risk for "
                       "currently active stock (from the shelf-life estimation engine).",
        "summary": [
            {"label": "Disposed units (period)", "value": disposed_units},
            {"label": "Disposal events (period)", "value": len(disposed)},
            {"label": "Disposal reasons", "value": ", ".join(f"{k}: {v}" for k, v in sorted(reasons.items())) or "None"},
            {"label": "Sold units (period)", "value": sold_units},
            {"label": "Units at waste risk now (<=2 d left)", "value": at_risk_units},
            {"label": "Markdown candidates now (<=3 d left)", "value": len(markdown)},
        ],
        "tables": [
            {
                "name": "Disposal & Sale Events",
                "columns": ["Product", "Category", "Event", "Units", "Reason", "Performed By", "Date"],
                "rows": rows,
            },
            {
                "name": "Markdown Candidates (act today)",
                "columns": ["Product", "Batch", "Units", "Est. Remaining (d)", "Risk"],
                "rows": markdown[:100],
            },
        ],
    }


async def _build_storage_compliance(filters: dict, user: dict) -> dict:
    query = await _scope_query(user, "item_id")
    query.update(_range_filter(filters, "recorded_at"))
    if filters.get("item_id"):
        query["item_id"] = filters["item_id"]

    readings = [serialize_doc(d) async for d in
                storage_readings_collection.find(query).sort("recorded_at", -1).limit(1000)]
    if filters.get("category"):
        readings = [r for r in readings if r.get("category") == filters["category"]]

    total = len(readings)
    compliant = sum(1 for r in readings if r.get("compliance_status") == "Compliant")
    partial = sum(1 for r in readings if r.get("compliance_status") == "Partially Compliant")
    non = sum(1 for r in readings if r.get("compliance_status") == "Non-Compliant")
    scores = [r.get("storage_score") for r in readings if isinstance(r.get("storage_score"), (int, float))]
    breaches = {"temperature": 0, "humidity": 0, "air_circulation": 0, "light_exposure": 0}
    for r in readings:
        for check in (r.get("validation") or {}).get("checks", []):
            if not check.get("compliant") and not check.get("not_recorded"):
                breaches[check["parameter"]] = breaches.get(check["parameter"], 0) + 1

    rows = [[
        r.get("zone") or "-", r.get("category") or "-", _fmt(r.get("temperature_c")),
        _fmt(r.get("humidity_pct")), r.get("air_circulation") or "-", r.get("light_exposure") or "-",
        _fmt(r.get("storage_score")), r.get("compliance_status") or "-",
        ", ".join(r.get("violations") or []) or "None", _iso(r.get("recorded_at")),
    ] for r in readings[:200]]

    return {
        "title": REPORT_TYPES["storage_compliance"],
        "description": "Storage-environment compliance across zones for the selected period "
                       "(manual readings validated against category storage profiles).",
        "summary": [
            {"label": "Total readings", "value": total},
            {"label": "Compliant", "value": compliant},
            {"label": "Partially compliant", "value": partial},
            {"label": "Non-compliant", "value": non},
            {"label": "Compliance rate", "value": f"{round(compliant / total * 100, 1)}%" if total else "N/A"},
            {"label": "Average storage score", "value": _fmt(round(sum(scores) / len(scores), 1)) if scores else "N/A"},
            {"label": "Temperature breaches", "value": breaches["temperature"]},
            {"label": "Humidity breaches", "value": breaches["humidity"]},
        ],
        "tables": [{
            "name": "Storage Readings",
            "columns": ["Zone", "Category", "Temp (C)", "Humidity (%)", "Air Circ.", "Light",
                        "Score", "Status", "Violations", "Recorded At"],
            "rows": rows,
        }],
    }


BUILDERS = {
    "freshness": _build_freshness,
    "shelf_life": _build_shelf_life,
    "inventory_quality": _build_inventory_quality,
    "waste_reduction": _build_waste_reduction,
    "storage_compliance": _build_storage_compliance,
}


async def build_report_data(report_type: str, filters: dict, user: dict) -> dict:
    if report_type not in BUILDERS:
        raise ValueError(f"Unknown report type: {report_type}")
    return await BUILDERS[report_type](filters or {}, user)
