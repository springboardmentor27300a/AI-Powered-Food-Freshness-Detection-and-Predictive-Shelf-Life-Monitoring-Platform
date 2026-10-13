"""Shared alert helpers: persistent alerts tied to real users/items/batches,
with role-based recipient routing (Milestone 4) and platform notifications.

Recipient routing rules (broadcast copies use recipient_id=None + recipient_role,
which the alerts API already resolves for the matching role):
  - The acting user always receives their own alert (personal copy).
  - spoilage_detected            -> + Food Quality Inspector, Retail Manager
  - shelf_life_warning           -> + Retail Manager, Administrator
  - inventory_expiry_risk        -> + Retail Manager, Administrator
  - storage_condition_violation  -> + Warehouse Operator, Administrator
  - freshness_warning            -> acting user only
Broadcasts are suppressed for Consumer-owned items (a private home-fridge alert
is not a retail/warehouse event).
"""
import logging
from datetime import datetime, timezone

from database import alert_collection, user_collection

logger = logging.getLogger("alerts")

BROADCAST_ROUTES = {
    "spoilage_detected": ("Food Quality Inspector", "Retail Manager"),
    "shelf_life_warning": ("Retail Manager", "Administrator"),
    "inventory_expiry_risk": ("Retail Manager", "Administrator"),
    "storage_condition_violation": ("Warehouse Operator", "Administrator"),
    "freshness_warning": (),
    "platform_notification": (),
}


async def generate_alerts(payload: dict, shelf_life: dict, storage_assessment: dict | None,
                          created_by: dict | None, item_owner_role: str | None = None) -> list:
    """
    Create alert documents for conditions that genuinely warrant one.
    Returns the list of inserted alert dicts.
    """
    alerts = []
    now = datetime.now(timezone.utc)
    base = {
        "item_id": payload.get("item_id"),
        "batch_id": payload.get("batch_id"),
        "zone": payload.get("storage_zone") or payload.get("zone"),
        "created_at": now,
        "is_read": False,
    }
    item_name = payload.get("name") or "Item"

    if created_by:
        base["recipient_id"] = str(created_by["_id"])
        base["recipient_role"] = created_by.get("role", "Consumer")
        base["recipient_username"] = created_by.get("username")
    else:
        base["recipient_id"] = None
        base["recipient_role"] = "System"
        base["recipient_username"] = None

    if shelf_life:
        ml_status = shelf_life.get("ml_status")
        risk = shelf_life.get("risk_level")
        days = shelf_life.get("effective_remaining_days")
        if ml_status == "Rotten":
            alerts.append({**base, "type": "spoilage_detected", "severity": "critical",
                           "message": f"{item_name} was classified as Rotten by AI inspection. Remove from inventory."})
        elif risk in ("High", "Critical") and days is not None:
            alerts.append({**base, "type": "shelf_life_warning" if risk == "High" else "inventory_expiry_risk",
                           "severity": "critical" if risk == "Critical" else "high",
                           "message": f"{item_name}: only about {days} day(s) of estimated shelf life remain under current conditions."})
        elif risk == "Medium" and days is not None and days <= 7:
            alerts.append({**base, "type": "freshness_warning", "severity": "medium",
                           "message": f"{item_name}: estimated {days} days of shelf life remain. Plan use or rotation."})
        if shelf_life.get("label_expired"):
            alerts.append({**base, "type": "inventory_expiry_risk", "severity": "critical",
                           "message": f"{item_name} is past its label expiry date."})

    if storage_assessment:
        for check in storage_assessment.get("checks", []):
            if check.get("status") == "Critical":
                alerts.append({**base,
                               "type": "storage_condition_violation",
                               "severity": "high",
                               "message": (f"Critical {check['parameter'].replace('_', ' ')} deviation for {item_name} "
                                           f"(value: {check.get('value')}, optimal: {check.get('optimal_range') or check.get('optimal_value')}).")})

    # ---- role-based routing: insert broadcast copies for relevant staff roles ----
    broadcasts = []
    owner_is_consumer = (item_owner_role == "Consumer") or (
        created_by is not None and created_by.get("role") == "Consumer" and item_owner_role is None)
    if not owner_is_consumer:
        seen = set()
        for alert in alerts:
            for role in BROADCAST_ROUTES.get(alert.get("type"), ()):
                key = (alert["type"], role, alert.get("item_id"))
                if key in seen:
                    continue
                seen.add(key)
                broadcasts.append({**alert, "recipient_id": None, "recipient_role": role,
                                   "recipient_username": None})

    if alerts or broadcasts:
        await alert_collection.insert_many(alerts + broadcasts)
        if broadcasts:
            logger.info("Routed %d broadcast alert(s) to staff roles", len(broadcasts))
    return alerts + broadcasts


async def notify_platform(message: str, severity: str = "medium",
                          event_type: str = "platform_notification", target_role: str = "Administrator") -> dict:
    """Platform/system notification broadcast to a role (default: Administrators).

    Used for genuinely system-level events (e.g. new user registration,
    administrative deletion). Persisted in the same alerts collection so the
    existing API and UI handle it with no changes.
    """
    doc = {
        "type": event_type,
        "severity": severity,
        "message": message,
        "item_id": None,
        "batch_id": None,
        "zone": None,
        "recipient_id": None,
        "recipient_role": target_role,
        "recipient_username": None,
        "created_at": datetime.now(timezone.utc),
        "is_read": False,
    }
    await alert_collection.insert_one(doc)
    logger.info("Platform notification sent to role=%s: %s", target_role, message)
    return doc
