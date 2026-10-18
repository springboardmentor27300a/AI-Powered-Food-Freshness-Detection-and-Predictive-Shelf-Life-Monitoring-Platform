from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel

from backend.app.database import (
    get_inventory_collection,
    get_freshness_records_collection,
    get_storage_conditions_collection,
)
from backend.app.models.user_model import UserRole
from backend.app.ml.shelf_life_model import shelf_life_predictor
from backend.app.ml.recommendation_engine import recommendation_engine
from backend.app.utils.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["Executive Analytics & Insights"])


@router.get(
    "/executive",
    summary="Retrieve Comprehensive Executive Analytics Dashboard Metrics and Chart Datasets"
)
async def get_executive_analytics(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Category filter"),
    location: Optional[str] = Query(None, description="Storage location filter"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Computes real-time executive dashboard KPIs and Chart.js visualization datasets
    from actual MongoDB documents, respecting user roles and scoping.
    """
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()
    env_col = get_storage_conditions_collection()

    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    # 1. Base Query Scoping by Role
    query: Dict[str, Any] = {}
    user_role = current_user.get("role")

    if user_role not in [UserRole.ADMIN.value, UserRole.WAREHOUSE_MANAGER.value, UserRole.SUPPLY_CHAIN_OPERATOR.value]:
        user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
        query["user_id"] = user_oid

    if category and category.lower() != "all":
        query["category"] = category

    if location and location.lower() != "all":
        query["location"] = location

    if start_date or end_date:
        date_q: Dict[str, Any] = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        query["purchase_date"] = date_q

    # Retrieve items
    items = list(inv_col.find(query))

    today_str = date.today().strftime("%Y-%m-%d")
    soon_str = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")

    # 2. KPI Metrics Aggregation
    total_items = len(items)
    total_quantity = sum(float(i.get("quantity", 0)) for i in items)

    fresh_count = 0
    moderate_count = 0
    spoiled_count = 0
    unanalyzed_count = 0

    scores: List[float] = []
    remaining_days_list: List[float] = []
    approaching_expiry = 0
    active_storage_alerts = 0
    waste_risk_usd = 0.0

    # Dictionaries for visual charts
    cat_stats: Dict[str, Dict[str, Any]] = {}
    shelf_life_bins = {
        "0-2 days (Critical)": 0,
        "3-5 days (Urgent)": 0,
        "6-10 days (Moderate)": 0,
        "11+ days (Fresh)": 0,
    }

    for item in items:
        cat = item.get("category", "Other")
        if cat not in cat_stats:
            cat_stats[cat] = {"count": 0, "total_score": 0.0, "scored_count": 0, "total_qty": 0.0, "spoiled": 0}

        qty = float(item.get("quantity", 0))
        cat_stats[cat]["count"] += 1
        cat_stats[cat]["total_qty"] += qty

        # Status and score
        status = item.get("freshness_status")
        score = item.get("freshness_score")

        if score is not None:
            scores.append(float(score))
            cat_stats[cat]["total_score"] += float(score)
            cat_stats[cat]["scored_count"] += 1

        exp = item.get("expiry_date", "")
        if exp:
            if exp < today_str or status == "Spoiled":
                spoiled_count += 1
                cat_stats[cat]["spoiled"] += 1
                # Add to financial waste risk
                unit_price = recommendation_engine.CATEGORY_THRESHOLDS.get(cat, {}).get("default_price_per_unit", 4.0)
                waste_risk_usd += qty * unit_price
            elif exp <= soon_str:
                approaching_expiry += 1
                moderate_count += 1
            elif status == "Fresh":
                fresh_count += 1
            elif status == "Expiring Soon":
                moderate_count += 1
            else:
                unanalyzed_count += 1
        else:
            unanalyzed_count += 1

        # Run dynamic shelf-life estimation
        pred = shelf_life_predictor.predict_shelf_life(
            category=cat,
            purchase_date_val=item.get("purchase_date", today_str),
            expiry_date_val=item.get("expiry_date", today_str),
            storage_temperature=item.get("storage_temperature"),
            storage_humidity=item.get("storage_humidity"),
            current_freshness_score=float(score) if score is not None else 85.0
        )
        rem_days = pred["predicted_remaining_days"]
        remaining_days_list.append(rem_days)

        if rem_days <= 2:
            shelf_life_bins["0-2 days (Critical)"] += 1
        elif rem_days <= 5:
            shelf_life_bins["3-5 days (Urgent)"] += 1
        elif rem_days <= 10:
            shelf_life_bins["6-10 days (Moderate)"] += 1
        else:
            shelf_life_bins["11+ days (Fresh)"] += 1

        # Storage Alerts Anomaly Check
        temp = item.get("storage_temperature")
        hum = item.get("storage_humidity")
        thresh = recommendation_engine.CATEGORY_THRESHOLDS.get(cat, recommendation_engine.CATEGORY_THRESHOLDS["Other"])
        if temp is not None and (temp > thresh["temp_max"] or temp < thresh["temp_min"]):
            active_storage_alerts += 1
        elif hum is not None and (hum > thresh["hum_max"] or hum < thresh["hum_min"]):
            active_storage_alerts += 1

    avg_quality_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    avg_remaining_days = round(sum(remaining_days_list) / len(remaining_days_list), 1) if remaining_days_list else 0.0

    # Total historical analyses
    total_analyses = fresh_col.count_documents({})

    # 3. Format Category Visualization
    category_chart_data = []
    for cat_name, c_data in cat_stats.items():
        avg_cat_score = round(c_data["total_score"] / c_data["scored_count"], 1) if c_data["scored_count"] > 0 else 0.0
        category_chart_data.append({
            "category": cat_name,
            "item_count": c_data["count"],
            "total_quantity": round(c_data["total_qty"], 1),
            "average_score": avg_cat_score,
            "spoiled_count": c_data["spoiled"],
        })

    # Sort categories by item count descending
    category_chart_data.sort(key=lambda x: x["item_count"], reverse=True)

    # 4. Storage Telemetry History (Last 15 records)
    storage_readings = []
    if env_col is not None:
        recent_env = list(env_col.find({}).sort("recorded_at", -1).limit(15))
        for r in reversed(recent_env):
            storage_readings.append({
                "recorded_at": r.get("recorded_at").strftime("%H:%M") if r.get("recorded_at") else "",
                "temperature": r.get("temperature"),
                "humidity": r.get("humidity"),
                "location": r.get("storage_location", "Storage"),
            })

    # 5. Factual Real Insights derived from database
    factual_insights = []
    if approaching_expiry > 0:
        factual_insights.append(
            f"⚠️ {approaching_expiry} item(s) are approaching designated expiry within the next 72 hours."
        )
    if active_storage_alerts > 0:
        factual_insights.append(
            f"🌡️ {active_storage_alerts} item(s) are experiencing ambient temperature or humidity outside ideal preservation limits."
        )
    if spoiled_count > 0:
        factual_insights.append(
            f"☣️ {spoiled_count} item(s) are recorded as spoiled or expired, accounting for an estimated ${round(waste_risk_usd, 2)} in potential loss."
        )
    if avg_quality_score >= 75.0:
        factual_insights.append(
            f"✨ Overall inventory visual health is robust with a mean score of {avg_quality_score}% across evaluated products."
        )
    if not factual_insights:
        factual_insights.append("All inventory parameters are currently within normal baseline operational limits.")

    return {
        "kpis": {
            "total_inventory_items": total_items,
            "total_inventory_quantity": round(total_quantity, 2),
            "total_freshness_analyses": total_analyses,
            "fresh_items_count": fresh_count,
            "moderately_fresh_count": moderate_count,
            "spoiled_or_high_risk_count": spoiled_count,
            "unanalyzed_count": unanalyzed_count,
            "average_quality_score": avg_quality_score,
            "average_predicted_remaining_days": avg_remaining_days,
            "items_approaching_expiry": approaching_expiry,
            "active_storage_alerts": active_storage_alerts,
            "estimated_inventory_waste_usd": round(waste_risk_usd, 2),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        },
        "charts": {
            "freshness_distribution": {
                "labels": ["Fresh", "Expiring Soon", "Spoiled / High Risk", "Analysis Pending"],
                "data": [fresh_count, moderate_count, spoiled_count, unanalyzed_count],
                "colors": ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"],
            },
            "category_analysis": category_chart_data,
            "shelf_life_distribution": {
                "labels": list(shelf_life_bins.keys()),
                "data": list(shelf_life_bins.values()),
            },
            "storage_monitoring": storage_readings,
        },
        "insights": factual_insights,
    }
