"""Food inventory CRUD with authentication, role-based visibility, persistent batches,
and a full lifecycle: Active -> Sold Out / Consumed / Disposed / Expired / Archived.

Lifecycle rules:
- Sales/disposals/adjustments decrement active_quantity; the document is never destroyed
  by selling. Historical analyses/reports/predictions stay linked via item_id.
- Retail Manager (+ Admin): sell. Warehouse Operator (+ Admin): adjust / damage / dispose.
- Consumer: archive ("Remove from My Food") their OWN items only.
- Inspector: view only.
- Administrator: archive everything; permanent delete is admin-only and confirmation-gated.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from models import (
    FoodItemCreate, FoodItemInDB, SaleRequest, DisposeRequest,
    AdjustQuantityRequest, ArchiveRequest, ItemLifecycle,
)
from database import food_item_collection, batch_collection, lifecycle_events_collection
from dependencies import require_roles, serialize_doc, to_object_id
from ml.alert_helpers import notify_platform

router = APIRouter()

STAFF_ROLES = ("Retail Manager", "Warehouse Operator", "Food Quality Inspector", "Administrator")
ALL_ROLES = STAFF_ROLES + ("Consumer",)
SELL_ROLES = ("Retail Manager",)
DISPOSE_ROLES = ("Warehouse Operator",)
VIEW_ALL_ROLES = ("Retail Manager", "Warehouse Operator", "Food Quality Inspector")
# Registration is inventory-ownership: Inspector is view/analysis only
REGISTER_ROLES = ("Retail Manager", "Warehouse Operator", "Consumer")

INACTIVE_STATUSES = {
    ItemLifecycle.SOLD_OUT.value, ItemLifecycle.CONSUMED.value,
    ItemLifecycle.DISPOSED.value, ItemLifecycle.EXPIRED.value, ItemLifecycle.ARCHIVED.value,
}


async def _log_event(item, event_type: str, quantity_delta: int, actor: dict,
                     reason: Optional[str] = None, notes: Optional[str] = None,
                     extra: Optional[dict] = None) -> None:
    """Append an immutable lifecycle event for audit/analytics."""
    doc = {
        "item_id": str(item["_id"]),
        "batch_id": str(item["batch_id"]) if item.get("batch_id") else None,
        "event_type": event_type,  # registered | sold | disposed | adjusted | archived | deleted
        "quantity_delta": quantity_delta,
        "quantity_after": item.get("active_quantity"),
        "reason": reason,
        "notes": notes,
        "performed_by": str(actor["_id"]),
        "performed_by_username": actor["username"],
        "performed_by_role": actor["role"],
        "created_at": datetime.now(timezone.utc),
    }
    if extra:
        doc.update(extra)
    await lifecycle_events_collection.insert_one(doc)


async def _get_item_checked(item_id: str, user: dict) -> dict:
    """Load an item and enforce view permission (consumers: own items only)."""
    doc = await food_item_collection.find_one({"_id": to_object_id(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    if user["role"] == "Consumer" and doc.get("created_by") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Not your inventory item")
    return doc


async def _apply_lifecycle(item: dict, status: str, actor: dict,
                           sold_qty: int = 0, disposed_qty: int = 0,
                           sold_at=None, disposed_at=None,
                           reason: Optional[str] = None, notes: Optional[str] = None,
                           extra: Optional[dict] = None,
                           event_type: Optional[str] = None) -> dict:
    """Persist a lifecycle transition atomically and log the event."""
    set_fields: dict = {
        "status": status,
        "active_quantity": max(0, (item.get("active_quantity", item.get("quantity", 0)) or 0)
                               - sold_qty - disposed_qty),
        "updated_at": datetime.now(timezone.utc),
    }
    if sold_qty:
        set_fields["sold_quantity"] = (item.get("sold_quantity") or 0) + sold_qty
        set_fields["sold_at"] = sold_at or datetime.now(timezone.utc)
        set_fields["sold_by"] = actor["username"]
    if disposed_qty:
        set_fields["disposed_quantity"] = (item.get("disposed_quantity") or 0) + disposed_qty
        set_fields["disposed_at"] = disposed_at or datetime.now(timezone.utc)
        set_fields["disposed_by"] = actor["username"]
    if status == ItemLifecycle.ARCHIVED.value:
        set_fields["archived_at"] = datetime.now(timezone.utc)
        set_fields["archived_by"] = actor["username"]
    if extra:
        set_fields.update(extra)

    updated = await food_item_collection.find_one_and_update(
        {"_id": item["_id"]}, {"$set": set_fields}, return_document=True)

    resolved_event = event_type or {
        ItemLifecycle.SOLD_OUT.value: "sold",
        ItemLifecycle.CONSUMED.value: "sold",
        ItemLifecycle.DISPOSED.value: "disposed",
        ItemLifecycle.EXPIRED.value: "disposed",
        ItemLifecycle.ARCHIVED.value: "archived",
    }.get(status, "adjusted")
    await _log_event(updated, resolved_event,
                     -(sold_qty + disposed_qty) if (sold_qty or disposed_qty) else 0,
                     actor, reason=reason, notes=notes, extra=extra)
    return serialize_doc(updated)


@router.post("/", response_model=FoodItemInDB)
async def create_food_item(item: FoodItemCreate, user: dict = Depends(require_roles(*REGISTER_ROLES))) -> dict:
    """Register a food product + batch. Retail/Warehouse/Consumer(own)/Admin only; Inspector forbidden."""
    now = datetime.now(timezone.utc)
    item_dict = item.dict()
    item_dict.update({
        "created_by": str(user["_id"]),
        "created_by_username": user["username"],
        "created_at": now,
        "updated_at": now,
        # lifecycle defaults
        "status": ItemLifecycle.ACTIVE.value,
        "active_quantity": item.quantity,
        "sold_quantity": 0,
        "disposed_quantity": 0,
    })
    result = await food_item_collection.insert_one(item_dict)
    item_id = result.inserted_id

    batch_doc = {
        "item_id": item_id,
        "batch_number": item.batch_number,
        "quantity": item.quantity,
        "expiry_date": item.expiry_date,
        "storage_zone": item.storage_zone,
        "stored_at": item.stored_at or now,
        "temperature_c": item.temperature_c,
        "humidity_pct": item.humidity_pct,
        "packaging_type": item.packaging_type,
        "created_by": str(user["_id"]),
        "created_at": now,
    }
    await batch_collection.insert_one(batch_doc)

    item_doc = item_dict | {"_id": item_id, "batch_id": str(batch_doc["_id"])}
    await food_item_collection.update_one({"_id": item_id}, {"$set": {"batch_id": str(batch_doc["_id"])}})
    await _log_event(item_doc, "registered", item.quantity, user,
                     notes=f"Batch {item.batch_number} registered with {item.quantity} units")
    return serialize_doc(item_doc)


def _backfill(item: dict) -> dict:
    """Fill lifecycle defaults for legacy documents created before lifecycle fields existed."""
    item.setdefault("status", ItemLifecycle.ACTIVE.value)
    item.setdefault("sold_quantity", 0)
    item.setdefault("disposed_quantity", 0)
    item.setdefault("active_quantity", item.get("quantity", 0))
    return item


@router.get("/", response_model=List[dict])
async def list_food_items(
    scope: str = Query("auto", pattern="^(auto|mine|all)$"),
    lifecycle: str = Query("active", pattern="^(active|archived_view|all)$"),
    user: dict = Depends(require_roles(*ALL_ROLES)),
):
    """
    List inventory. Staff see all items; consumers only their own.
    lifecycle=active (default) excludes Sold Out/Disposed/Archived items;
    lifecycle=archived_view returns ONLY inactive items; lifecycle=all returns both.
    """
    query: dict = {}
    if user["role"] == "Consumer" or scope == "mine":
        query["created_by"] = str(user["_id"])
    if lifecycle == "active":
        query["status"] = {"$nin": list(INACTIVE_STATUSES)}
    elif lifecycle == "archived_view":
        query["status"] = {"$in": list(INACTIVE_STATUSES)}

    items = []
    cursor = food_item_collection.find(query).sort("created_at", -1)
    async for document in cursor:
        items.append(serialize_doc(_backfill(document)))
    return items


@router.get("/stats")
async def inventory_stats(user: dict = Depends(require_roles(*ALL_ROLES))):
    """Active vs inactive inventory counts (lifecycle-aware)."""
    match: dict = {}
    if user["role"] == "Consumer":
        match["created_by"] = str(user["_id"])
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "active_units": {"$sum": {"$ifNull": ["$active_quantity", "$quantity"]}},
        }},
    ]
    by_status = {}
    async for row in food_item_collection.aggregate(pipeline):
        by_status[row["_id"] or "Active"] = {"count": row["count"], "active_units": row["active_units"]}
    active = sum(v["count"] for k, v in by_status.items() if k == ItemLifecycle.ACTIVE.value)
    inactive = sum(v["count"] for k, v in by_status.items() if k != ItemLifecycle.ACTIVE.value)
    return {
        "active_items": active,
        "inactive_items": inactive,
        "active_units": sum(v["active_units"] for k, v in by_status.items() if k == ItemLifecycle.ACTIVE.value),
        "sold_out_items": by_status.get(ItemLifecycle.SOLD_OUT.value, {}).get("count", 0),
        "disposed_items": by_status.get(ItemLifecycle.DISPOSED.value, {}).get("count", 0)
                          + by_status.get(ItemLifecycle.EXPIRED.value, {}).get("count", 0),
        "archived_items": by_status.get(ItemLifecycle.ARCHIVED.value, {}).get("count", 0),
    }


@router.get("/{item_id}/history")
async def item_history(item_id: str, user: dict = Depends(require_roles(*ALL_ROLES))):
    """Standalone lifecycle event history for an item."""
    await _get_item_checked(item_id, user)
    events = [serialize_doc(e) async for e in
              lifecycle_events_collection.find({"item_id": item_id}).sort("created_at", -1).limit(200)]
    return {"item_id": item_id, "events": events}


@router.get("/{item_id}")
async def get_food_item(item_id: str, user: dict = Depends(require_roles(*ALL_ROLES))):
    """Item details + batches + full lifecycle event history."""
    doc = await _get_item_checked(item_id, user)
    result = serialize_doc(_backfill(doc))
    result["batches"] = [serialize_doc(b) async for b in batch_collection.find({"item_id": doc["_id"]})]
    for batch in result["batches"]:
        if batch["batch_number"] == result.get("batch_number"):
            result["batch_id"] = batch["_id"]
            break
    result["lifecycle_events"] = [
        serialize_doc(e) async for e in
        lifecycle_events_collection.find({"item_id": item_id}).sort("created_at", -1).limit(100)
    ]
    return result


@router.post("/{item_id}/sell")
async def sell_item(item_id: str, sale: SaleRequest, user: dict = Depends(require_roles(*SELL_ROLES))):
    """Retail Manager: record a sale. Partial sale keeps the item Active; full sale -> Sold Out."""
    item = await _get_item_checked(item_id, user)
    _backfill(item)
    if item["status"] != ItemLifecycle.ACTIVE.value:
        raise HTTPException(status_code=409, detail=f"Item is {item['status']}; cannot sell")
    available = item.get("active_quantity", item.get("quantity", 0)) or 0
    if sale.quantity_sold > available:
        raise HTTPException(status_code=400, detail=f"Cannot sell {sale.quantity_sold}; only {available} active")

    remaining = available - sale.quantity_sold
    if remaining == 0:
        return await _apply_lifecycle(item, ItemLifecycle.SOLD_OUT.value, user, sold_qty=sale.quantity_sold,
                                      reason="sale", notes=sale.notes,
                                      sold_at=sale.sale_date, extra={"is_available": False},
                                      event_type="sold")
    return await _apply_lifecycle(item, ItemLifecycle.ACTIVE.value, user, sold_qty=sale.quantity_sold,
                                  reason="sale", notes=sale.notes, sold_at=sale.sale_date,
                                  event_type="sold")


@router.post("/{item_id}/dispose")
async def dispose_item(item_id: str, disposal: DisposeRequest, user: dict = Depends(require_roles(*DISPOSE_ROLES))):
    """Warehouse Operator: record damage/disposal/spoilage. Full disposal -> Disposed."""
    item = await _get_item_checked(item_id, user)
    _backfill(item)
    if item["status"] != ItemLifecycle.ACTIVE.value:
        raise HTTPException(status_code=409, detail=f"Item is {item['status']}; cannot dispose")
    available = item.get("active_quantity", item.get("quantity", 0)) or 0
    if disposal.quantity_disposed > available:
        raise HTTPException(status_code=400, detail=f"Cannot dispose {disposal.quantity_disposed}; only {available} active")

    remaining = available - disposal.quantity_disposed
    if remaining == 0:
        return await _apply_lifecycle(item, ItemLifecycle.DISPOSED.value, user, disposed_qty=disposal.quantity_disposed,
                                      reason=disposal.reason, notes=disposal.notes,
                                      disposed_at=disposal.disposal_date, extra={"is_available": False})
    return await _apply_lifecycle(item, ItemLifecycle.ACTIVE.value, user, disposed_qty=disposal.quantity_disposed,
                                  reason=disposal.reason, notes=disposal.notes, disposed_at=disposal.disposal_date)


@router.post("/{item_id}/adjust")
async def adjust_item(item_id: str, adjustment: AdjustQuantityRequest, user: dict = Depends(require_roles(*DISPOSE_ROLES))):
    """Warehouse Operator: manual quantity correction (stock count reconciliation)."""
    item = await _get_item_checked(item_id, user)
    _backfill(item)
    if item["status"] != ItemLifecycle.ACTIVE.value:
        raise HTTPException(status_code=409, detail=f"Item is {item['status']}; cannot adjust")
    current = item.get("active_quantity", item.get("quantity", 0)) or 0
    delta = adjustment.new_quantity - current
    if delta == 0:
        raise HTTPException(status_code=400, detail="New quantity equals current quantity")

    set_fields = {"active_quantity": adjustment.new_quantity, "updated_at": datetime.now(timezone.utc)}
    if adjustment.new_quantity == 0:
        set_fields["status"] = ItemLifecycle.CONSUMED.value
        set_fields["is_available"] = False
    await food_item_collection.update_one({"_id": item["_id"]}, {"$set": set_fields})
    updated = await food_item_collection.find_one({"_id": item["_id"]})
    updated = _backfill(updated)
    await _log_event(updated, "adjusted", delta, user, reason=adjustment.reason, notes=adjustment.notes)
    return serialize_doc(updated)


@router.post("/{item_id}/mark-expired")
async def mark_expired(item_id: str, user: dict = Depends(require_roles(*DISPOSE_ROLES, "Retail Manager"))):
    """Warehouse/Retail: flag an item as Expired (quantity moves out of active stock)."""
    item = await _get_item_checked(item_id, user)
    _backfill(item)
    if item["status"] != ItemLifecycle.ACTIVE.value:
        raise HTTPException(status_code=409, detail=f"Item is {item['status']}; already resolved")
    available = item.get("active_quantity", item.get("quantity", 0)) or 0
    return await _apply_lifecycle(item, ItemLifecycle.EXPIRED.value, user, disposed_qty=available,
                                  reason="label expiry / freshness expiry",
                                  extra={"is_available": False})


@router.post("/{item_id}/archive")
async def archive_item(item_id: str, archive: ArchiveRequest, user: dict = Depends(require_roles(*ALL_ROLES))):
    """
    Archive (soft-hide) an item.
    Consumers may archive their OWN items ("Remove from My Food").
    Retail/Warehouse/Admin may archive; Inspectors are view-only.
    """
    if user["role"] == "Food Quality Inspector":
        raise HTTPException(status_code=403, detail="Inspectors cannot modify inventory lifecycle")
    item = await _get_item_checked(item_id, user)
    _backfill(item)
    if item["status"] == ItemLifecycle.ARCHIVED.value:
        raise HTTPException(status_code=409, detail="Item is already archived")
    return await _apply_lifecycle(item, ItemLifecycle.ARCHIVED.value, user,
                                  reason=archive.reason or "user archive",
                                  extra={"is_available": False})


@router.patch("/{item_id}", response_model=FoodItemInDB)
async def update_food_item(item_id: str, update: FoodItemCreate, user: dict = Depends(require_roles("Retail Manager", "Warehouse Operator", "Administrator"))):
    """Edit product details (staff roles). Consumer editing is intentionally not exposed."""
    doc = await _get_item_checked(item_id, user)
    update_dict = update.dict()
    update_dict["updated_at"] = datetime.now(timezone.utc)
    # keep quantity fields in sync: editing quantity re-baselines active stock
    update_dict["active_quantity"] = update.quantity
    await food_item_collection.update_one({"_id": doc["_id"]}, {"$set": update_dict})
    await batch_collection.update_one(
        {"item_id": doc["_id"], "batch_number": update.batch_number},
        {"$set": {
            "quantity": update.quantity, "expiry_date": update.expiry_date,
            "storage_zone": update.storage_zone, "stored_at": update.stored_at,
            "temperature_c": update.temperature_c, "humidity_pct": update.humidity_pct,
            "packaging_type": update.packaging_type,
        }},
    )
    updated = await food_item_collection.find_one({"_id": doc["_id"]})
    return serialize_doc(updated)


@router.delete("/{item_id}")
async def delete_food_item(item_id: str, confirm: str = Query(None), user: dict = Depends(require_roles("Administrator"))):
    """
    ADMINISTRATIVE PERMANENT DELETE. Requires ?confirm=DELETE-PERMANENTLY.
    Staff and consumers can never call this (403). Removes item + batches;
    historical analyses/reports stay in their collections for audit.
    """
    if confirm != "DELETE-PERMANENTLY":
        raise HTTPException(status_code=400,
                            detail="Administrative deletion requires confirm=DELETE-PERMANENTLY")
    doc = await food_item_collection.find_one({"_id": to_object_id(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    await food_item_collection.delete_one({"_id": doc["_id"]})
    await batch_collection.delete_many({"item_id": doc["_id"]})
    await _log_event(doc, "deleted", 0, user, reason="administrative permanent delete")
    try:
        await notify_platform(
            f"Item '{doc.get('name')}' (batch {doc.get('batch_number')}) was permanently deleted "
            f"by administrator {user['username']}.", severity="medium")
    except Exception:
        pass
    return {"deleted": True, "id": item_id, "note": "Item and batches removed; analyses/reports retained"}
