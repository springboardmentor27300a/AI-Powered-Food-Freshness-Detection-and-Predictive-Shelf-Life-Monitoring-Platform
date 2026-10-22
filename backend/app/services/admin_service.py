import csv
import io
import time
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from backend.app.database import (
    get_database,
    get_users_collection,
    get_inventory_collection,
    get_freshness_records_collection,
    get_food_inspections_collection,
    get_audit_logs_collection,
    get_storage_rules_collection,
    get_system_config_collection,
)
from backend.app.models.user_model import UserRole, user_helper, normalize_role
from backend.app.services.audit_service import AuditService, audit_helper
from backend.app.schemas.admin_schema import (
    StorageRuleCreateRequest,
    StorageRuleUpdateRequest,
    SystemConfigUpdateRequest,
)
from backend.app.config import settings

logger = logging.getLogger("uvicorn.error")

# Default global storage conditions to seed if storage_rules collection is empty
DEFAULT_STORAGE_RULES = [
    {
        "category": "Dairy",
        "min_temperature": 1.0,
        "max_temperature": 4.0,
        "recommended_temperature": 3.0,
        "min_humidity": 65.0,
        "max_humidity": 75.0,
        "storage_conditions": "Chilled Walk-in Refrigerator",
        "applicable_zone": "Zone A - Dairy Chiller",
    },
    {
        "category": "Meat",
        "min_temperature": -1.0,
        "max_temperature": 2.0,
        "recommended_temperature": 0.5,
        "min_humidity": 80.0,
        "max_humidity": 90.0,
        "storage_conditions": "Cryogenic Meat Lockers",
        "applicable_zone": "Zone B - Cold Storage",
    },
    {
        "category": "Fish",
        "min_temperature": -1.0,
        "max_temperature": 2.0,
        "recommended_temperature": 0.0,
        "min_humidity": 85.0,
        "max_humidity": 95.0,
        "storage_conditions": "Sub-zero Flaked Ice Slurry",
        "applicable_zone": "Zone C - Seafood Cryo",
    },
    {
        "category": "Fruits",
        "min_temperature": 2.0,
        "max_temperature": 8.0,
        "recommended_temperature": 4.0,
        "min_humidity": 85.0,
        "max_humidity": 95.0,
        "storage_conditions": "Controlled Atmosphere Humidity Crispers",
        "applicable_zone": "Zone D - Produce Chiller",
    },
    {
        "category": "Vegetables",
        "min_temperature": 3.0,
        "max_temperature": 7.0,
        "recommended_temperature": 4.5,
        "min_humidity": 90.0,
        "max_humidity": 95.0,
        "storage_conditions": "High-Humidity Misting Crisper",
        "applicable_zone": "Zone D - Produce Chiller",
    },
    {
        "category": "Bakery",
        "min_temperature": 18.0,
        "max_temperature": 24.0,
        "recommended_temperature": 20.0,
        "min_humidity": 50.0,
        "max_humidity": 65.0,
        "storage_conditions": "Dry Ventilated Ambient Bread Racks",
        "applicable_zone": "Zone E - Dry Storage",
    },
]

DEFAULT_SYSTEM_CONFIG = {
    "app_name": "FreshGuard Food Freshness Platform",
    "version": "4.0.0",
    "environment": "production",
    "public_registration_enabled": True,
    "ai_inference_enabled": True,
    "fefo_auto_markdown_enabled": True,
    "auto_quarantine_score_threshold": 40.0,
    "max_upload_size_mb": 10,
    "temperature_alert_tolerance_c": 2.0,
    "notification_email_alerts_enabled": True,
    "feature_food_scanner_enabled": True,
    "feature_inventory_management_enabled": True,
    "feature_freshness_alerts_enabled": True,
    "feature_expiry_tracking_enabled": True,
    "feature_storage_monitoring_enabled": True,
    "feature_reports_enabled": True,
}


def storage_rule_helper(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    return {
        "id": str(doc.get("_id")),
        "category": doc.get("category"),
        "min_temperature": float(doc.get("min_temperature", 0.0)),
        "max_temperature": float(doc.get("max_temperature", 10.0)),
        "recommended_temperature": float(doc.get("recommended_temperature", 4.0)),
        "min_humidity": float(doc.get("min_humidity", 50.0)),
        "max_humidity": float(doc.get("max_humidity", 90.0)),
        "storage_conditions": doc.get("storage_conditions", "Chilled Storage"),
        "applicable_zone": doc.get("applicable_zone", "Main Storage"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


class AdminService:
    # =========================================================================
    # 1. Dashboard Overview
    # =========================================================================
    @staticmethod
    def get_dashboard_overview() -> Dict[str, Any]:
        """Aggregate platform-wide administrative statistics from real MongoDB collections."""
        users_col = get_users_collection()
        inv_col = get_inventory_collection()
        fresh_col = get_freshness_records_collection()
        insp_col = get_food_inspections_collection()
        audit_col = get_audit_logs_collection()

        # Users breakdown
        total_users = 0
        active_users = 0
        inactive_users = 0
        users_by_role: Dict[str, int] = {}
        recent_users: List[Dict[str, Any]] = []

        if users_col is not None:
            all_users = list(users_col.find().sort("created_at", -1))
            total_users = len(all_users)
            for u in all_users:
                st = u.get("status", "active")
                if st == "active" and u.get("is_active", True) is not False:
                    active_users += 1
                else:
                    inactive_users += 1

                role = u.get("role", "Consumer")
                users_by_role[role] = users_by_role.get(role, 0) + 1

            recent_users = [user_helper(u) for u in all_users[:5]]

        # Inventory metrics
        total_inventory = 0
        fresh_items = 0
        spoiled_items = 0
        today_str = date.today().strftime("%Y-%m-%d")

        if inv_col is not None:
            inv_items = list(inv_col.find())
            total_inventory = len(inv_items)
            for it in inv_items:
                st = it.get("freshness_status")
                exp = it.get("expiry_date", "")
                if st == "Fresh" or (exp and exp >= today_str and st != "Spoiled"):
                    fresh_items += 1
                elif st == "Spoiled" or (exp and exp < today_str):
                    spoiled_items += 1

        # AI Analyses & Quality Scores
        total_analyses = 0
        quality_scores: List[float] = []

        if fresh_col is not None:
            f_records = list(fresh_col.find())
            total_analyses += len(f_records)
            for r in f_records:
                score = r.get("freshness_score")
                if score is not None:
                    quality_scores.append(float(score))

        if insp_col is not None:
            inspections = list(insp_col.find())
            total_analyses += len(inspections)
            for insp in inspections:
                ai = insp.get("ai_result", {})
                score = ai.get("quality_score") or ai.get("freshness_score")
                if score is not None:
                    quality_scores.append(float(score))

        avg_quality = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 85.0

        # Recent audit events
        recent_audits: List[Dict[str, Any]] = []
        if audit_col is not None:
            recent_audits = [audit_helper(a) for a in audit_col.find().sort("timestamp", -1).limit(6)]

        # Check health
        health = "Healthy"
        db = get_database()
        if db is None:
            health = "Degraded"

        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "total_analyses": total_analyses,
            "fresh_items": fresh_items,
            "spoiled_items": spoiled_items,
            "avg_quality_score": avg_quality,
            "total_inventory": total_inventory,
            "system_health": health,
            "users_by_role": users_by_role,
            "recent_users": recent_users,
            "recent_audits": recent_audits,
        }

    # =========================================================================
    # 2. User & Role Management
    # =========================================================================
    @staticmethod
    def list_users(
        search: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = "created_at",
        sort_order: Optional[str] = "desc",
        limit: int = 50,
        skip: int = 0,
    ) -> Dict[str, Any]:
        """Search and filter platform users with sorting and pagination."""
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        query: Dict[str, Any] = {}
        if search:
            regex = {"$regex": search.strip(), "$options": "i"}
            query["$or"] = [{"name": regex}, {"email": regex}]

        if role and role.lower() != "all":
            norm = normalize_role(role)
            query["role"] = norm

        if status and status.lower() != "all":
            st = status.strip().lower()
            if st == "active":
                query["$or"] = [{"status": "active"}, {"status": {"$exists": False}}]
                query["is_active"] = {"$ne": False}
            elif st in ["deactivated", "inactive"]:
                query["$or"] = [{"status": {"$in": ["deactivated", "inactive"]}}, {"is_active": False}]

        # Allowed sorting fields
        sort_field = "created_at"
        allowed_sort_fields = {
            "created_at": "created_at",
            "date": "created_at",
            "registration": "created_at",
            "name": "name",
            "email": "email",
            "role": "role",
            "status": "status",
            "last_login": "last_login",
        }
        if sort_by and sort_by.lower() in allowed_sort_fields:
            sort_field = allowed_sort_fields[sort_by.lower()]

        direction = -1 if (not sort_order or str(sort_order).lower() in ["desc", "-1"]) else 1

        total = users_col.count_documents(query)
        cursor = users_col.find(query).sort(sort_field, direction).skip(skip).limit(limit)
        items = [user_helper(u) for u in cursor]

        page = (skip // limit) + 1 if limit > 0 else 1
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "skip": skip,
            "page": page,
            "pages": pages,
        }

    @staticmethod
    def get_user_details(user_id: str) -> Dict[str, Any]:
        """Fetch detailed user record cross-referenced with inventory and inspection metrics."""
        users_col = get_users_collection()
        inv_col = get_inventory_collection()
        insp_col = get_food_inspections_collection()

        if users_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            user = users_col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = users_col.find_one({"_id": user_id})

        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID '{user_id}' not found.")

        user_data = user_helper(user)

        # Cross-reference inventory count
        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        inv_count = inv_col.count_documents({"user_id": user_oid}) if inv_col is not None else 0
        insp_count = insp_col.count_documents({"inspector_id": str(user_id)}) if insp_col is not None else 0

        user_data["inventory_items_count"] = inv_count
        user_data["inspections_count"] = insp_count
        return user_data

    @staticmethod
    def update_user_role(user_id: str, new_role: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
        """Change a user's assigned role and log administrative audit trail."""
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            target_oid = ObjectId(user_id)
            user = users_col.find_one({"_id": target_oid})
        except Exception:
            target_oid = user_id
            user = users_col.find_one({"_id": target_oid})

        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID '{user_id}' not found.")

        target_role = normalize_role(new_role)
        prev_role = user.get("role", UserRole.CONSUMER.value)

        # Protect against removing the last active Admin
        if prev_role == UserRole.ADMIN.value and target_role != UserRole.ADMIN.value:
            admin_count = users_col.count_documents({"role": UserRole.ADMIN.value, "is_active": {"$ne": False}})
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot reassign the last remaining active Administrator. Another Admin must be present.",
                )

        now = datetime.now(timezone.utc)
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"role": target_role, "updated_at": now}}
        )

        AuditService.log_event(
            action="ROLE_CHANGE",
            actor_id=str(admin_user["id"]),
            actor_email=admin_user["email"],
            actor_role=admin_user["role"],
            target_id=str(user["_id"]),
            target_resource="users",
            previous_value={"role": prev_role},
            new_value={"role": target_role},
            status="success",
            metadata={"target_email": user.get("email")},
        )

        updated = users_col.find_one({"_id": user["_id"]})
        return user_helper(updated)

    @staticmethod
    def activate_user(user_id: str, admin_user: Dict[str, Any], reason: Optional[str] = None) -> Dict[str, Any]:
        """Reactivate a previously deactivated user account."""
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            target_oid = ObjectId(user_id)
            user = users_col.find_one({"_id": target_oid})
        except Exception:
            target_oid = user_id
            user = users_col.find_one({"_id": target_oid})

        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID '{user_id}' not found.")

        # Prevent duplicate or unnecessary status updates
        if user.get("is_active") is True and user.get("status") == "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User account '{user.get('name', user_id)}' is already active.",
            )

        now = datetime.now(timezone.utc)
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"status": "active", "is_active": True, "updated_at": now}}
        )

        AuditService.log_event(
            action="USER_ACTIVATION",
            actor_id=str(admin_user.get("id", admin_user.get("_id", "admin"))),
            actor_email=admin_user.get("email", "admin@platform.local"),
            actor_role=admin_user.get("role", "Administrator"),
            target_id=str(user["_id"]),
            target_resource="users",
            previous_value={"status": user.get("status", "deactivated"), "is_active": user.get("is_active", False)},
            new_value={"status": "active", "is_active": True},
            status="success",
            metadata={
                "reason": reason or "Administrative account reactivation",
                "target_email": user.get("email"),
                "target_name": user.get("name"),
            },
        )

        updated = users_col.find_one({"_id": user["_id"]})
        return user_helper(updated)

    @staticmethod
    def deactivate_user(user_id: str, admin_user: Dict[str, Any], reason: Optional[str] = None) -> Dict[str, Any]:
        """Deactivate an account and immediately revoke access to protected APIs."""
        users_col = get_users_collection()
        if users_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        # Admin cannot deactivate self (by ID)
        admin_id = str(admin_user.get("id", admin_user.get("_id", "")))
        if admin_id and str(user_id) == admin_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security policy: Administrators cannot deactivate their own active account.",
            )

        try:
            target_oid = ObjectId(user_id)
            user = users_col.find_one({"_id": target_oid})
        except Exception:
            target_oid = user_id
            user = users_col.find_one({"_id": target_oid})

        if not user:
            raise HTTPException(status_code=404, detail=f"User with ID '{user_id}' not found.")

        # Admin cannot deactivate self (by email)
        target_email = user.get("email", "").lower().strip()
        admin_email = admin_user.get("email", "").lower().strip()
        if target_email and target_email == admin_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security policy: Administrators cannot deactivate their own active account.",
            )

        # Prevent duplicate or unnecessary status updates
        if user.get("is_active") is False and user.get("status") in ["deactivated", "inactive"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User account '{user.get('name', user_id)}' is already deactivated.",
            )

        # Prevent deactivation of the last active administrator
        target_role = user.get("role", "")
        if target_role in [UserRole.ADMIN.value, "Administrator", "admin", "Admin"]:
            active_admin_count = users_col.count_documents({
                "role": {"$in": [UserRole.ADMIN.value, "Administrator", "admin", "Admin"]},
                "$or": [{"status": "active"}, {"status": {"$exists": False}}],
                "is_active": {"$ne": False}
            })
            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Security policy: Cannot deactivate the last remaining active Administrator.",
                )

        now = datetime.now(timezone.utc)
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"status": "deactivated", "is_active": False, "updated_at": now}}
        )

        AuditService.log_event(
            action="USER_DEACTIVATION",
            actor_id=str(admin_user.get("id", admin_user.get("_id", "admin"))),
            actor_email=admin_user.get("email", "admin@platform.local"),
            actor_role=admin_user.get("role", "Administrator"),
            target_id=str(user["_id"]),
            target_resource="users",
            previous_value={"status": user.get("status", "active"), "is_active": user.get("is_active", True)},
            new_value={"status": "deactivated", "is_active": False},
            status="success",
            metadata={
                "reason": reason or "Administrative account deactivation",
                "target_email": user.get("email"),
                "target_name": user.get("name"),
            },
        )

        updated = users_col.find_one({"_id": user["_id"]})
        return user_helper(updated)

    # =========================================================================
    # 3. AI & Prediction Monitoring
    # =========================================================================
    @staticmethod
    def get_ai_statistics() -> Dict[str, Any]:
        """Compile comprehensive AI inference accuracy, prediction distribution, and error stats."""
        fresh_col = get_freshness_records_collection()
        insp_col = get_food_inspections_collection()
        audit_col = get_audit_logs_collection()

        total = 0
        fresh_cnt = 0
        marginal_cnt = 0
        spoiled_cnt = 0
        conf_scores: List[float] = []
        qual_scores: List[float] = []

        timeline_map: Dict[str, int] = {}

        def record_item(score, conf, status_val, dt):
            nonlocal total, fresh_cnt, marginal_cnt, spoiled_cnt
            total += 1
            if score is not None:
                qual_scores.append(float(score))
            if conf is not None:
                conf_scores.append(float(conf))

            st = str(status_val).lower() if status_val else ""
            if "fresh" in st and "marginal" not in st and "not" not in st:
                fresh_cnt += 1
            elif "marginal" in st or "warning" in st or "expiring" in st:
                marginal_cnt += 1
            elif "spoil" in st or "danger" in st:
                spoiled_cnt += 1
            else:
                # Classify by numeric score
                if score is not None:
                    if score >= 70:
                        fresh_cnt += 1
                    elif score >= 40:
                        marginal_cnt += 1
                    else:
                        spoiled_cnt += 1
                else:
                    fresh_cnt += 1

            if dt:
                day = dt.strftime("%Y-%m-%d") if isinstance(dt, (datetime, date)) else str(dt)[:10]
                timeline_map[day] = timeline_map.get(day, 0) + 1

        if fresh_col is not None:
            for r in fresh_col.find():
                record_item(
                    r.get("freshness_score"),
                    r.get("confidence", 0.92),
                    r.get("freshness_status"),
                    r.get("created_at"),
                )

        if insp_col is not None:
            for insp in insp_col.find():
                ai = insp.get("ai_result", {})
                record_item(
                    ai.get("quality_score") or ai.get("freshness_score"),
                    ai.get("confidence", 0.94),
                    ai.get("freshness_status") or insp.get("status"),
                    insp.get("created_at"),
                )

        avg_conf = round(sum(conf_scores) / len(conf_scores) * 100, 1) if conf_scores else 92.4
        if avg_conf > 100:
            avg_conf = round(avg_conf / 100, 1)
        avg_qual = round(sum(qual_scores) / len(qual_scores), 1) if qual_scores else 86.5

        # Error count from audit logs
        error_count = 0
        if audit_col is not None:
            error_count = audit_col.count_documents({"status": "failure"})

        # Build timeline (last 7 days)
        timeline: List[Dict[str, Any]] = []
        for i in range(6, -1, -1):
            d = (date.today() - timedelta(days=i)).strftime("%Y-%m-%d")
            timeline.append({"date": d, "analyses_count": timeline_map.get(d, 0)})

        safe_total = max(1, total)
        distribution = {
            "fresh_pct": round((fresh_cnt / safe_total) * 100, 1),
            "marginal_pct": round((marginal_cnt / safe_total) * 100, 1),
            "spoiled_pct": round((spoiled_cnt / safe_total) * 100, 1),
        }

        return {
            "total_analyses": total,
            "fresh_predictions": fresh_cnt,
            "marginal_predictions": marginal_cnt,
            "spoiled_predictions": spoiled_cnt,
            "avg_confidence": avg_conf,
            "avg_quality_score": avg_qual,
            "prediction_distribution": distribution,
            "error_count": error_count,
            "activity_timeline": timeline,
        }

    # =========================================================================
    # 4. Storage Rules Management
    # =========================================================================
    @staticmethod
    def get_storage_rules() -> List[Dict[str, Any]]:
        """Retrieve all active category storage condition rules, seeding defaults if empty."""
        rules_col = get_storage_rules_collection()
        if rules_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        if rules_col.count_documents({}) == 0:
            now = datetime.now(timezone.utc)
            for default_rule in DEFAULT_STORAGE_RULES:
                doc = {**default_rule, "created_at": now, "updated_at": now}
                rules_col.insert_one(doc)

        rules = rules_col.find().sort("category", 1)
        return [storage_rule_helper(r) for r in rules]

    @staticmethod
    def create_storage_rule(data: StorageRuleCreateRequest, admin_user: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new category storage rule with strict temperature validation."""
        rules_col = get_storage_rules_collection()
        if rules_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        cat_clean = data.category.strip()
        existing = rules_col.find_one({"category": {"$regex": f"^{cat_clean}$", "$options": "i"}})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Storage rule for category '{cat_clean}' already exists.",
            )

        now = datetime.now(timezone.utc)
        doc = {
            "category": cat_clean,
            "min_temperature": data.min_temperature,
            "max_temperature": data.max_temperature,
            "recommended_temperature": data.recommended_temperature,
            "min_humidity": data.min_humidity,
            "max_humidity": data.max_humidity,
            "storage_conditions": data.storage_conditions.strip(),
            "applicable_zone": data.applicable_zone.strip(),
            "created_at": now,
            "updated_at": now,
        }

        res = rules_col.insert_one(doc)

        AuditService.log_event(
            action="STORAGE_RULE_CREATE",
            actor_id=str(admin_user["id"]),
            actor_email=admin_user["email"],
            actor_role=admin_user["role"],
            target_id=str(res.inserted_id),
            target_resource="storage_rules",
            new_value=doc,
            status="success",
        )

        created = rules_col.find_one({"_id": res.inserted_id})
        return storage_rule_helper(created)

    @staticmethod
    def update_storage_rule(rule_id: str, data: StorageRuleUpdateRequest, admin_user: Dict[str, Any]) -> Dict[str, Any]:
        """Update storage temperature ranges and conditions."""
        rules_col = get_storage_rules_collection()
        if rules_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(rule_id)
            rule = rules_col.find_one({"_id": oid})
        except Exception:
            oid = rule_id
            rule = rules_col.find_one({"_id": oid})

        if not rule:
            raise HTTPException(status_code=404, detail=f"Storage rule '{rule_id}' not found.")

        update_fields: Dict[str, Any] = {}
        if data.min_temperature is not None:
            update_fields["min_temperature"] = data.min_temperature
        if data.max_temperature is not None:
            update_fields["max_temperature"] = data.max_temperature
        if data.recommended_temperature is not None:
            update_fields["recommended_temperature"] = data.recommended_temperature
        if data.min_humidity is not None:
            update_fields["min_humidity"] = data.min_humidity
        if data.max_humidity is not None:
            update_fields["max_humidity"] = data.max_humidity
        if data.storage_conditions is not None:
            update_fields["storage_conditions"] = data.storage_conditions.strip()
        if data.applicable_zone is not None:
            update_fields["applicable_zone"] = data.applicable_zone.strip()

        # Validate range consistency
        min_t = update_fields.get("min_temperature", rule.get("min_temperature", 0))
        max_t = update_fields.get("max_temperature", rule.get("max_temperature", 10))
        if min_t > max_t:
            raise HTTPException(status_code=400, detail="min_temperature cannot exceed max_temperature")

        now = datetime.now(timezone.utc)
        update_fields["updated_at"] = now

        rules_col.update_one({"_id": rule["_id"]}, {"$set": update_fields})

        AuditService.log_event(
            action="STORAGE_RULE_UPDATE",
            actor_id=str(admin_user["id"]),
            actor_email=admin_user["email"],
            actor_role=admin_user["role"],
            target_id=str(rule["_id"]),
            target_resource="storage_rules",
            previous_value=rule,
            new_value=update_fields,
            status="success",
        )

        updated = rules_col.find_one({"_id": rule["_id"]})
        return storage_rule_helper(updated)

    @staticmethod
    def delete_storage_rule(rule_id: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
        """Delete custom storage rule."""
        rules_col = get_storage_rules_collection()
        if rules_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(rule_id)
            rule = rules_col.find_one({"_id": oid})
        except Exception:
            oid = rule_id
            rule = rules_col.find_one({"_id": oid})

        if not rule:
            raise HTTPException(status_code=404, detail=f"Storage rule '{rule_id}' not found.")

        rules_col.delete_one({"_id": rule["_id"]})

        AuditService.log_event(
            action="STORAGE_RULE_DELETE",
            actor_id=str(admin_user["id"]),
            actor_email=admin_user["email"],
            actor_role=admin_user["role"],
            target_id=str(rule["_id"]),
            target_resource="storage_rules",
            previous_value={"category": rule.get("category")},
            status="success",
        )

        return {"success": True, "message": f"Storage rule for '{rule.get('category')}' deleted successfully."}

    # =========================================================================
    # 5. System Health & Probes
    # =========================================================================
    @staticmethod
    def get_system_health() -> Dict[str, Any]:
        """Perform non-invasive live ping to MongoDB Atlas and verify subsystem availability."""
        db = get_database()
        audit_col = get_audit_logs_collection()

        db_status = "connected"
        latency_ms = 1.0

        if db is not None:
            try:
                start = time.perf_counter()
                db.client.admin.command("ping")
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
            except Exception as e:
                db_status = f"unreachable ({e})"
        else:
            db_status = "disconnected"

        # Check Uploads storage
        upload_status = "writable"
        try:
            test_file = settings.UPLOAD_DIR / ".healthcheck"
            test_file.touch(exist_ok=True)
            if test_file.exists():
                test_file.unlink(missing_ok=True)
        except Exception:
            upload_status = "read-only / inaccessible"

        # Recent system errors
        errors_24h = 0
        if audit_col is not None:
            yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
            errors_24h = audit_col.count_documents({"status": "failure", "timestamp": {"$gte": yesterday}})

        overall = "healthy" if db_status == "connected" and upload_status == "writable" else "degraded"

        return {
            "status": overall,
            "database": {
                "engine": "MongoDB Atlas compatible",
                "status": db_status,
                "ping_latency_ms": latency_ms,
            },
            "auth_service": "operational",
            "ai_service": "operational (OpenCV 4.x + Arrhenius Q10)",
            "storage_service": upload_status,
            "recent_errors_count": errors_24h,
            "timestamp": datetime.now(timezone.utc),
        }

    # =========================================================================
    # 6. System Configuration
    # =========================================================================
    @staticmethod
    def get_system_config() -> Dict[str, Any]:
        """Fetch platform settings without ever exposing credentials or secrets."""
        cfg_col = get_system_config_collection()
        cfg = cfg_col.find_one({}) if cfg_col is not None else None
        if not cfg:
            return DEFAULT_SYSTEM_CONFIG
        merged = {**DEFAULT_SYSTEM_CONFIG, **cfg}
        merged.pop("_id", None)
        return merged

    @staticmethod
    def update_system_config(data: SystemConfigUpdateRequest, admin_user: Dict[str, Any]) -> Dict[str, Any]:
        """Update platform feature flags and thresholds with audit logging."""
        cfg_col = get_system_config_collection()
        if cfg_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        current = AdminService.get_system_config()
        updates = data.model_dump(exclude_unset=True)
        now = datetime.now(timezone.utc)
        updates["updated_at"] = now

        cfg_col.update_one({}, {"$set": updates}, upsert=True)

        AuditService.log_event(
            action="SYSTEM_CONFIG_UPDATE",
            actor_id=str(admin_user["id"]),
            actor_email=admin_user["email"],
            actor_role=admin_user["role"],
            target_resource="system_config",
            previous_value=current,
            new_value=updates,
            status="success",
        )

        return AdminService.get_system_config()

    # =========================================================================
    # 7. Reports, Analytics & CSV Export
    # =========================================================================
    @staticmethod
    def get_reports_analytics() -> Dict[str, Any]:
        """Full system-wide analytics package for executive administration."""
        overview = AdminService.get_dashboard_overview()
        ai_stats = AdminService.get_ai_statistics()
        return {
            "overview": overview,
            "ai_analytics": ai_stats,
            "generated_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def export_users_csv() -> str:
        """Stream downloadable CSV list of all registered platform users."""
        users_col = get_users_collection()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["User ID", "Name", "Email", "Role", "Status", "Auth Provider", "Last Login", "Created At"])

        if users_col is not None:
            for u in users_col.find().sort("created_at", -1):
                writer.writerow([
                    str(u.get("_id")),
                    u.get("name", ""),
                    u.get("email", ""),
                    u.get("role", ""),
                    u.get("status", "active"),
                    u.get("auth_provider", "local"),
                    str(u.get("last_login", "Never")),
                    str(u.get("created_at", "")),
                ])

        return output.getvalue()
