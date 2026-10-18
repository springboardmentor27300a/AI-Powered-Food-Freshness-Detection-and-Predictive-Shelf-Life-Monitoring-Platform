from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.app.database import (
    get_notifications_collection,
    get_alerts_collection,
    get_inventory_collection,
)
from backend.app.utils.dependencies import get_current_user

router = APIRouter(tags=["Notification & Alert System"])


class NotificationCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=3, max_length=500)
    type: str = Field("freshness", description="freshness, shelf_life, spoilage, storage_condition, inventory, platform")
    severity: str = Field("info", description="info, warning, critical")
    target_user_id: Optional[str] = Field(None, description="Target recipient user ID (None for broadcast)")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AlertCreateRequest(BaseModel):
    item_name: Optional[str] = Field("General Inventory", description="Target food item or zone")
    alert_type: str = Field(..., description="freshness, shelf_life, spoilage, storage_condition, inventory, platform")
    severity: str = Field("warning", description="info, warning, critical")
    message: str = Field(..., min_length=5, max_length=500)
    inventory_id: Optional[str] = None
    zone_id: Optional[str] = None
    recommended_action: Optional[str] = None


def _format_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    formatted = dict(doc)
    formatted["id"] = str(formatted.pop("_id"))
    if "user_id" in formatted and isinstance(formatted["user_id"], ObjectId):
        formatted["user_id"] = str(formatted["user_id"])
    if "target_user_id" in formatted and isinstance(formatted["target_user_id"], ObjectId):
        formatted["target_user_id"] = str(formatted["target_user_id"])
    if "inventory_id" in formatted and isinstance(formatted["inventory_id"], ObjectId):
        formatted["inventory_id"] = str(formatted["inventory_id"])
    if "created_at" in formatted and isinstance(formatted["created_at"], datetime):
        formatted["created_at"] = formatted["created_at"].isoformat()
    if "acknowledged_at" in formatted and isinstance(formatted["acknowledged_at"], datetime):
        formatted["acknowledged_at"] = formatted["acknowledged_at"].isoformat()
    return formatted


@router.get("/notifications", summary="Retrieve User Notifications with Multi-Criteria Filtering")
async def get_notifications(
    type: Optional[str] = Query(None, description="freshness, shelf_life, spoilage, storage_condition, inventory, platform"),
    severity: Optional[str] = Query(None, description="info, warning, critical"),
    read: Optional[bool] = Query(None, description="Filter by read/unread status"),
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    notif_col = get_notifications_collection()
    if notif_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    uid = current_user.get("_id")
    role = current_user.get("role", "")

    # Query for notifications targeted to this user or broadcast (target_user_id is None)
    query: Dict[str, Any] = {
        "$or": [
            {"target_user_id": uid},
            {"target_user_id": str(uid)},
            {"target_user_id": None},
            {"target_role": role},
        ]
    }

    if type:
        query["type"] = type
    if severity:
        query["severity"] = severity
    if read is not None:
        query["read"] = read

    cursor = notif_col.find(query).sort("created_at", -1).limit(limit)
    items = [_format_doc(doc) for doc in cursor]

    # If empty, create initial baseline notification for the user
    if not items:
        now = datetime.now(timezone.utc)
        welcome_notif = {
            "title": "Welcome to Food Freshness Platform",
            "message": f"Welcome {current_user.get('name', 'User')}. Live telemetry, CV scan diagnostics, and shelf-life monitoring active.",
            "type": "platform",
            "severity": "info",
            "read": False,
            "target_user_id": uid,
            "created_at": now,
        }
        res = notif_col.insert_one(welcome_notif)
        welcome_notif["_id"] = res.inserted_id
        items.append(_format_doc(welcome_notif))

    return {
        "success": True,
        "count": len(items),
        "notifications": items
    }


@router.get("/notifications/unread-count", summary="Get Count of Unread Notifications")
async def get_unread_count(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    notif_col = get_notifications_collection()
    if notif_col is None:
        return {"unread_count": 0}

    uid = current_user.get("_id")
    role = current_user.get("role", "")
    query = {
        "$or": [
            {"target_user_id": uid},
            {"target_user_id": str(uid)},
            {"target_user_id": None},
            {"target_role": role},
        ],
        "read": False,
    }
    count = notif_col.count_documents(query)
    return {"unread_count": count}


@router.post("/notifications/{notification_id}/read", summary="Mark Notification as Read")
@router.put("/notifications/{notification_id}/read", summary="Mark Notification as Read (PUT alias)")
async def mark_notification_read(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    notif_col = get_notifications_collection()
    if notif_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(notification_id)
        q = {"_id": oid}
    except Exception:
        q = {"_id": notification_id}

    result = notif_col.update_one(q, {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")

    return {"success": True, "message": "Notification marked as read."}


@router.post("/notifications/read-all", summary="Mark All Notifications as Read for Current User")
async def mark_all_notifications_read(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    notif_col = get_notifications_collection()
    if notif_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    uid = current_user.get("_id")
    role = current_user.get("role", "")
    query = {
        "$or": [
            {"target_user_id": uid},
            {"target_user_id": str(uid)},
            {"target_user_id": None},
            {"target_role": role},
        ],
        "read": False,
    }
    result = notif_col.update_many(query, {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}})
    return {"success": True, "modified_count": result.modified_count}


@router.post("/notifications", summary="Dispatch / Create a Notification")
async def create_notification(
    data: NotificationCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    notif_col = get_notifications_collection()
    if notif_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    now = datetime.now(timezone.utc)
    doc = {
        "title": data.title,
        "message": data.message,
        "type": data.type,
        "severity": data.severity,
        "read": False,
        "target_user_id": data.target_user_id,
        "metadata": data.metadata,
        "created_by": str(current_user.get("_id")),
        "created_at": now,
    }
    res = notif_col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "notification": _format_doc(doc)}


@router.get("/alerts", summary="Retrieve Operational Quality, Freshness & Temperature Alerts")
async def get_alerts(
    severity: Optional[str] = Query(None, description="critical, warning, high, medium, low"),
    alert_type: Optional[str] = Query(None, description="spoilage_suspected, temperature_violation, near_expiry, freshness_degradation, etc."),
    status_filter: Optional[str] = Query(None, alias="status", description="active, acknowledged, resolved"),
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    alerts_col = get_alerts_collection()
    if alerts_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if severity:
        query["severity"] = severity.lower()
    if alert_type:
        query["alert_type"] = alert_type
    if status_filter:
        query["status"] = status_filter

    cursor = alerts_col.find(query).sort("created_at", -1).limit(limit)
    items = [_format_doc(doc) for doc in cursor]

    # If no alerts, generate realistic alerts from inventory items with near expiry or low score
    if not items:
        inv_col = get_inventory_collection()
        if inv_col is not None:
            low_items = list(inv_col.find({"freshness_score": {"$lt": 60.0}}).limit(3))
            now = datetime.now(timezone.utc)
            for it in low_items:
                al = {
                    "item_name": it.get("food_name", "Inventory Item"),
                    "alert_type": "freshness_degradation",
                    "severity": "critical" if float(it.get("freshness_score", 50)) < 40 else "warning",
                    "message": f"Visual & composite freshness degraded to {it.get('freshness_score', 50)}% for {it.get('food_name')}.",
                    "status": "active",
                    "inventory_id": str(it.get("_id")),
                    "recommended_action": "Repackage under modified atmosphere or initiate immediate markdown.",
                    "created_at": now,
                }
                res = alerts_col.insert_one(al)
                al["_id"] = res.inserted_id
                items.append(_format_doc(al))

    return {
        "success": True,
        "count": len(items),
        "alerts": items
    }


@router.get("/alerts/summary", summary="Retrieve Metric Summary Breakdown of Platform Alerts")
async def get_alerts_summary(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    alerts_col = get_alerts_collection()
    if alerts_col is None:
        return {"total_alerts": 0, "critical": 0, "warning": 0, "info": 0, "active": 0}

    total = alerts_col.count_documents({})
    critical = alerts_col.count_documents({"severity": {"$in": ["critical", "high"]}})
    warning = alerts_col.count_documents({"severity": {"$in": ["warning", "medium"]}})
    info = alerts_col.count_documents({"severity": {"$in": ["info", "low"]}})
    active = alerts_col.count_documents({"status": "active"})

    return {
        "total_alerts": total,
        "critical_count": critical,
        "warning_count": warning,
        "info_count": info,
        "active_count": active,
    }


@router.post("/alerts/{alert_id}/acknowledge", summary="Acknowledge an Operational Alert")
@router.put("/alerts/{alert_id}/acknowledge", summary="Acknowledge an Operational Alert (PUT alias)")
async def acknowledge_alert(
    alert_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    alerts_col = get_alerts_collection()
    if alerts_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(alert_id)
        q = {"_id": oid}
    except Exception:
        q = {"_id": alert_id}

    now = datetime.now(timezone.utc)
    result = alerts_col.update_one(
        q,
        {"$set": {
            "status": "acknowledged",
            "acknowledged_at": now,
            "acknowledged_by": current_user.get("email"),
            "acknowledged_by_name": current_user.get("name"),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found.")

    return {"success": True, "message": "Alert acknowledged successfully."}


@router.post("/alerts", summary="Create or Ingest Operational Alert")
async def create_alert(
    data: AlertCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    alerts_col = get_alerts_collection()
    if alerts_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    now = datetime.now(timezone.utc)
    doc = {
        "item_name": data.item_name,
        "alert_type": data.alert_type,
        "severity": data.severity,
        "message": data.message,
        "status": "active",
        "inventory_id": data.inventory_id,
        "zone_id": data.zone_id,
        "recommended_action": data.recommended_action or "Review storage parameters and product visual condition.",
        "created_by": current_user.get("email"),
        "created_at": now,
    }
    res = alerts_col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "alert": _format_doc(doc)}
