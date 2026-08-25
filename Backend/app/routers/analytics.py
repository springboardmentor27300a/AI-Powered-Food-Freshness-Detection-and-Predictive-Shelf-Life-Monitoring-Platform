from fastapi import APIRouter
from app.db.mongodb import get_database
from typing import Dict, Any

router = APIRouter(prefix="/analytics", tags=["Analytics & Dashboards"])

@router.get("/dashboard")
async def get_dashboard_analytics() -> Dict[str, Any]:
    db = get_database()
    
    total_batches = await db.food_batches.count_documents({})
    available_batches = await db.food_batches.count_documents({"status": "Available"})
    sold_batches = await db.food_batches.count_documents({"status": "Sold"})
    active_warehouses = await db.warehouses.count_documents({})
    total_users = await db.users.count_documents({})

    # Aggregate inventory quantity & revenue
    pipeline_qty = [
        {"$group": {"_id": None, "total_kg": {"$sum": "$quantity_kg"}}}
    ]
    res_qty = await db.food_batches.aggregate(pipeline_qty).to_list(1)
    total_quantity_kg = res_qty[0]["total_kg"] if res_qty else 0.0

    # Total Sold value
    pipeline_sold = [
        {"$match": {"status": "Sold"}},
        {"$project": {"total_val": {"$multiply": ["$quantity_kg", "$unit_price_per_kg"]}}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total_val"}}}
    ]
    res_sold = await db.food_batches.aggregate(pipeline_sold).to_list(1)
    total_sold_revenue = res_sold[0]["total_revenue"] if res_sold else 0.0

    # Freshness breakdown
    fresh_count = await db.food_batches.count_documents({"freshness_status": "Fresh"})
    good_count = await db.food_batches.count_documents({"freshness_status": "Good"})
    acceptable_count = await db.food_batches.count_documents({"freshness_status": "Acceptable"})
    spoilage_count = await db.food_batches.count_documents({"freshness_status": {"$in": ["Near Spoilage", "Spoiled"]}})

    # Recent activity
    recent_cursor = db.food_batches.find({}).sort("_id", -1).limit(5)
    recent_docs = await recent_cursor.to_list(5)
    recent_activity = []
    for d in recent_docs:
        recent_activity.append({
            "batch_id": d["batch_id"],
            "product_name": d["product_name"],
            "warehouse_name": d["warehouse_name"],
            "status": d.get("status", "Available"),
            "freshness_score": d["freshness_score"],
            "quantity_kg": d["quantity_kg"]
        })

    return {
        "total_batches": total_batches,
        "available_batches": available_batches,
        "sold_batches": sold_batches,
        "active_warehouses": active_warehouses,
        "total_users": total_users,
        "total_quantity_kg": round(total_quantity_kg, 2),
        "total_sold_revenue": round(total_sold_revenue, 2),
        "freshness_breakdown": {
            "Fresh": fresh_count,
            "Good": good_count,
            "Acceptable": acceptable_count,
            "Near Spoilage / Spoiled": spoilage_count
        },
        "recent_activity": recent_activity
    }
