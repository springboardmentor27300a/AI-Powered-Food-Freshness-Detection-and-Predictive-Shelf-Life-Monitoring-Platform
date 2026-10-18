import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from bson import ObjectId
from backend.app.database import get_audit_logs_collection

logger = logging.getLogger("uvicorn.error")

SENSITIVE_KEYS = {"password", "password_hash", "confirm_password", "token", "access_token", "secret", "credentials"}


def sanitize_payload(data: Any) -> Any:
    """Recursively strip sensitive credentials and tokens from audit payloads."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS):
                sanitized[k] = "[REDACTED]"
            elif isinstance(v, (dict, list)):
                sanitized[k] = sanitize_payload(v)
            else:
                sanitized[k] = v
        return sanitized
    elif isinstance(data, list):
        return [sanitize_payload(item) for item in data]
    return data


def audit_helper(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert an audit log MongoDB document into a clean API response dictionary."""
    if not doc:
        return {}
    return {
        "id": str(doc.get("_id")),
        "timestamp": doc.get("timestamp"),
        "actor_id": str(doc.get("actor_id")) if doc.get("actor_id") else None,
        "actor_email": doc.get("actor_email"),
        "actor_role": doc.get("actor_role"),
        "action": doc.get("action", "UNKNOWN_ACTION"),
        "target_id": str(doc.get("target_id")) if doc.get("target_id") else None,
        "target_resource": doc.get("target_resource"),
        "previous_value": doc.get("previous_value"),
        "new_value": doc.get("new_value"),
        "status": doc.get("status", "success"),
        "metadata": doc.get("metadata"),
    }


class AuditService:
    @staticmethod
    def log_event(
        action: str,
        actor_id: Optional[str] = None,
        actor_email: Optional[str] = None,
        actor_role: Optional[str] = None,
        target_id: Optional[str] = None,
        target_resource: Optional[str] = None,
        previous_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Record an immutable administrative or security audit event in MongoDB.
        Never throws unhandled exceptions to prevent disrupting caller transactions.
        """
        try:
            col = get_audit_logs_collection()
            if col is None:
                logger.warning("Audit log collection unavailable; skipping audit record.")
                return None

            event = {
                "timestamp": datetime.now(timezone.utc),
                "actor_id": ObjectId(actor_id) if actor_id and ObjectId.is_valid(actor_id) else actor_id,
                "actor_email": actor_email,
                "actor_role": actor_role,
                "action": action.strip().upper(),
                "target_id": ObjectId(target_id) if target_id and ObjectId.is_valid(target_id) else target_id,
                "target_resource": target_resource,
                "previous_value": sanitize_payload(previous_value),
                "new_value": sanitize_payload(new_value),
                "status": status,
                "metadata": sanitize_payload(metadata) if metadata else {},
            }

            res = col.insert_one(event)
            return str(res.inserted_id)
        except Exception as e:
            logger.error(f"Failed to record audit event '{action}': {e}")
            return None

    @staticmethod
    def list_logs(
        action: Optional[str] = None,
        actor_email: Optional[str] = None,
        target_resource: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> Dict[str, Any]:
        """Query audit trail with multi-filtering and pagination."""
        col = get_audit_logs_collection()
        if col is None:
            return {"items": [], "total": 0, "limit": limit, "skip": skip}

        query: Dict[str, Any] = {}
        if action:
            query["action"] = {"$regex": action.strip(), "$options": "i"}
        if actor_email:
            query["actor_email"] = {"$regex": actor_email.strip(), "$options": "i"}
        if target_resource:
            query["target_resource"] = {"$regex": target_resource.strip(), "$options": "i"}
        if status:
            query["status"] = status.strip().lower()

        total = col.count_documents(query)
        cursor = col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        items = [audit_helper(doc) for doc in cursor]

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "skip": skip,
        }
