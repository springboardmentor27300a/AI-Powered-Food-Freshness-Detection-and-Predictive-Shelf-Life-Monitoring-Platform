import io
import csv
from datetime import datetime, timezone, date, timedelta
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

from backend.app.database import (
    get_inventory_collection,
    get_freshness_records_collection,
    get_storage_conditions_collection,
    get_alerts_collection,
    get_notifications_collection,
)
from backend.app.models.user_model import UserRole
from backend.app.models.inventory_model import inventory_helper, FreshnessStatus, FoodCategory, StorageType
from backend.app.schemas.retailer_schema import (
    RetailerProductCreateRequest,
    RetailerProductUpdateRequest,
    StockUpdateRequest,
)
from backend.app.ml.cv_analyzer import image_analyzer
from backend.app.ml.shelf_life_model import shelf_life_predictor
from backend.app.ml.recommendation_engine import recommendation_engine
from backend.app.config import settings


# Food-specific recommended storage parameters
RECOMMENDED_STORAGE = {
    FoodCategory.FRUITS.value: {"optimal_temp": 4.0, "min_temp": 1.0, "max_temp": 6.0, "optimal_rh": 90.0, "min_rh": 80.0, "max_rh": 95.0},
    FoodCategory.VEGETABLES.value: {"optimal_temp": 4.0, "min_temp": 1.0, "max_temp": 6.0, "optimal_rh": 92.0, "min_rh": 85.0, "max_rh": 98.0},
    FoodCategory.DAIRY.value: {"optimal_temp": 3.0, "min_temp": 0.0, "max_temp": 4.0, "optimal_rh": 60.0, "min_rh": 40.0, "max_rh": 70.0},
    FoodCategory.MEAT.value: {"optimal_temp": 1.0, "min_temp": -1.0, "max_temp": 2.5, "optimal_rh": 75.0, "min_rh": 65.0, "max_rh": 85.0},
    FoodCategory.FISH.value: {"optimal_temp": 0.5, "min_temp": -1.0, "max_temp": 2.0, "optimal_rh": 80.0, "min_rh": 70.0, "max_rh": 90.0},
    FoodCategory.BAKERY.value: {"optimal_temp": 20.0, "min_temp": 18.0, "max_temp": 24.0, "optimal_rh": 48.0, "min_rh": 35.0, "max_rh": 60.0},
    FoodCategory.GRAINS.value: {"optimal_temp": 18.0, "min_temp": 15.0, "max_temp": 22.0, "optimal_rh": 45.0, "min_rh": 30.0, "max_rh": 55.0},
    FoodCategory.PACKAGED_FOOD.value: {"optimal_temp": 20.0, "min_temp": 15.0, "max_temp": 25.0, "optimal_rh": 50.0, "min_rh": 30.0, "max_rh": 65.0},
    FoodCategory.OTHER.value: {"optimal_temp": 15.0, "min_temp": 5.0, "max_temp": 22.0, "optimal_rh": 55.0, "min_rh": 30.0, "max_rh": 70.0},
}


class RetailerService:

    @staticmethod
    def _get_user_oid(current_user: Dict[str, Any]) -> Any:
        uid = current_user.get("id") or current_user.get("_id")
        return ObjectId(uid) if ObjectId.is_valid(uid) else uid

    @staticmethod
    def _verify_item_ownership(item: Dict[str, Any], current_user: Dict[str, Any]) -> None:
        """Enforces that the item is owned by the authenticated retailer."""
        user_role = current_user.get("role")
        if user_role == UserRole.ADMIN.value:
            return  # Platform Admin has operational audit access
        user_id_str = str(current_user.get("id") or current_user.get("_id"))
        item_user_id_str = str(item.get("user_id"))
        if user_id_str != item_user_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You are not authorized to access or modify this retailer's inventory."
            )

    @classmethod
    def create_product(cls, data: RetailerProductCreateRequest, current_user: Dict[str, Any]) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        user_oid = cls._get_user_oid(current_user)
        now = datetime.now(timezone.utc)

        # Baseline remaining shelf life estimation based on purchase & expiry
        try:
            exp_date = datetime.strptime(data.expiry_date, "%Y-%m-%d").date()
            today = date.today()
            initial_shelf_life = max(0, (exp_date - today).days)
        except Exception:
            initial_shelf_life = 7.0

        item_doc = {
            "user_id": user_oid,
            "food_name": data.food_name.strip(),
            "category": data.category,
            "quantity": float(data.quantity),
            "unit": data.unit.strip(),
            "purchase_date": data.purchase_date,
            "expiry_date": data.expiry_date,
            "storage_type": data.storage_type,
            "storage_temperature": data.storage_temperature,
            "storage_humidity": data.storage_humidity,
            "location": data.location.strip() if data.location else "Main Retail Display",
            "batch_number": data.batch_number.strip() if data.batch_number else None,
            "image_url": data.image_url,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "shelf_life_days": float(initial_shelf_life),
            "is_archived": False,
            "low_stock_threshold": float(data.low_stock_threshold or 5.0),
            "stock_history": [
                {
                    "timestamp": now.isoformat(),
                    "old_quantity": 0.0,
                    "new_quantity": float(data.quantity),
                    "reason": "Initial product stock intake",
                    "adjusted_by": current_user.get("name", "Retailer")
                }
            ],
            "created_at": now,
            "updated_at": now,
        }

        result = inv_col.insert_one(item_doc)
        created_item = inv_col.find_one({"_id": result.inserted_id})
        return cls._decorate_retailer_item(created_item)

    @classmethod
    def list_products(
        cls,
        current_user: Dict[str, Any],
        search: Optional[str] = None,
        category: Optional[str] = None,
        freshness_status: Optional[str] = None,
        expiry_status: Optional[str] = None,
        is_archived: Optional[bool] = False,
        low_stock_only: Optional[bool] = False,
        sort_by: str = "expiry_date",
        sort_order: str = "asc",
    ) -> List[Dict[str, Any]]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        user_oid = cls._get_user_oid(current_user)
        # If retailer has no inventory, automatically seed demonstration grocery products
        if inv_col.count_documents({"user_id": {"$in": [user_oid, str(user_oid)]}}) == 0:
            cls.seed_retailer_inventory(current_user)
        query: Dict[str, Any] = {"user_id": user_oid}

        # Filter by archive status
        if is_archived is not None:
            query["is_archived"] = is_archived

        # Category filter
        if category and category.lower() != "all":
            query["category"] = category

        # Freshness status filter
        if freshness_status and freshness_status.lower() != "all":
            query["freshness_status"] = freshness_status

        # Search filter
        if search and search.strip():
            term = search.strip()
            regex = {"$regex": term, "$options": "i"}
            or_clauses = [
                {"food_name": regex},
                {"location": regex},
                {"batch_number": regex},
            ]
            if ObjectId.is_valid(term):
                or_clauses.append({"_id": ObjectId(term)})
            query["$or"] = or_clauses

        today = date.today()
        today_str = today.strftime("%Y-%m-%d")
        soon_str = (today + timedelta(days=3)).strftime("%Y-%m-%d")

        if expiry_status == "expired":
            query["expiry_date"] = {"$lt": today_str}
        elif expiry_status == "approaching_expiry" or expiry_status == "expiring_soon":
            query["expiry_date"] = {"$gte": today_str, "$lte": soon_str}
        elif expiry_status == "safe":
            query["expiry_date"] = {"$gt": soon_str}

        # Sorting
        sort_direction = 1 if sort_order.lower() == "asc" else -1
        allowed_sort_fields = ["expiry_date", "purchase_date", "food_name", "quantity", "created_at", "freshness_score"]
        effective_sort_by = sort_by if sort_by in allowed_sort_fields else "expiry_date"

        items = list(inv_col.find(query).sort(effective_sort_by, sort_direction))

        decorated = [cls._decorate_retailer_item(item) for item in items]

        if low_stock_only:
            decorated = [item for item in decorated if item.get("is_low_stock")]

        return decorated

    @classmethod
    def get_product(cls, item_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            item = inv_col.find_one({"_id": item_id})

        if not item:
            raise HTTPException(status_code=404, detail=f"Food product '{item_id}' not found.")

        cls._verify_item_ownership(item, current_user)
        return cls._decorate_retailer_item(item)

    @classmethod
    def update_product(
        cls,
        item_id: str,
        data: RetailerProductUpdateRequest,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(status_code=404, detail=f"Food product '{item_id}' not found.")

        cls._verify_item_ownership(item, current_user)

        update_fields: Dict[str, Any] = {}
        dumped = data.model_dump(exclude_unset=True)
        for k, v in dumped.items():
            if v is not None:
                update_fields[k] = v

        if not update_fields:
            return cls._decorate_retailer_item(item)

        now = datetime.now(timezone.utc)
        update_fields["updated_at"] = now

        inv_col.update_one({"_id": item["_id"]}, {"$set": update_fields})
        updated = inv_col.find_one({"_id": item["_id"]})
        return cls._decorate_retailer_item(updated)

    @classmethod
    def update_stock(
        cls,
        item_id: str,
        data: StockUpdateRequest,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(status_code=404, detail=f"Food product '{item_id}' not found.")

        cls._verify_item_ownership(item, current_user)

        current_qty = float(item.get("quantity", 0))
        adj_type = (data.adjustment_type or "set").lower()

        if adj_type == "add":
            new_qty = current_qty + float(data.quantity)
        elif adj_type == "deduct":
            new_qty = current_qty - float(data.quantity)
        else:
            new_qty = float(data.quantity)

        # Enforce non-negative stock constraint
        if new_qty < 0:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid stock update: resulting stock quantity ({new_qty}) cannot be negative."
            )

        now = datetime.now(timezone.utc)
        history_entry = {
            "timestamp": now.isoformat(),
            "old_quantity": current_qty,
            "new_quantity": new_qty,
            "adjustment_type": adj_type,
            "amount": float(data.quantity),
            "reason": data.reason or "Stock count modification",
            "adjusted_by": current_user.get("name", "Retailer")
        }

        inv_col.update_one(
            {"_id": item["_id"]},
            {
                "$set": {"quantity": new_qty, "updated_at": now},
                "$push": {"stock_history": history_entry}
            }
        )

        # Generate low stock alert / notification if threshold breached
        low_threshold = float(item.get("low_stock_threshold", 5.0))
        if new_qty <= low_threshold:
            cls._create_system_alert(
                user_id=item["user_id"],
                inventory_id=item["_id"],
                alert_type="LOW_STOCK",
                product_name=item.get("food_name"),
                severity="Warning",
                reason=f"Stock for '{item.get('food_name')}' fell to {new_qty} {item.get('unit', 'units')} (Threshold: {low_threshold}).",
                action="Order replacement stock or update inventory replenishment."
            )

        updated = inv_col.find_one({"_id": item["_id"]})
        return cls._decorate_retailer_item(updated)

    @classmethod
    def archive_product(
        cls,
        item_id: str,
        is_archived: bool,
        reason: Optional[str],
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(status_code=404, detail=f"Food product '{item_id}' not found.")

        cls._verify_item_ownership(item, current_user)

        now = datetime.now(timezone.utc)
        inv_col.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "is_archived": is_archived,
                    "updated_at": now,
                    "archive_reason": reason or ("Archived by store manager" if is_archived else "Restored to active stock")
                }
            }
        )

        updated = inv_col.find_one({"_id": item["_id"]})
        return cls._decorate_retailer_item(updated)

    @classmethod
    def delete_product(cls, item_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        alerts_col = get_alerts_collection()
        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(status_code=404, detail=f"Food product '{item_id}' not found.")

        cls._verify_item_ownership(item, current_user)

        inv_col.delete_one({"_id": item["_id"]})
        if alerts_col is not None:
            alerts_col.delete_many({"inventory_id": item["_id"]})

        return {
            "success": True,
            "message": f"Product '{item.get('food_name')}' removed permanently from retailer inventory.",
            "id": str(item["_id"])
        }

    @classmethod
    def analyze_retailer_product(
        cls,
        item_id: str,
        image_url: Optional[str],
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Executes real computer vision and shelf-life analysis on a retailer's product.
        Updates MongoDB and stores historical freshness and alert records.
        """
        inv_col = get_inventory_collection()
        fresh_col = get_freshness_records_collection()
        if inv_col is None or fresh_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(status_code=404, detail=f"Food product '{item_id}' not found.")

        cls._verify_item_ownership(item, current_user)

        target_img = image_url or item.get("image_url")
        image_file_path = None
        if target_img:
            clean_ref = target_img.lstrip("/").replace("uploads/", "")
            candidate = settings.UPLOAD_DIR / clean_ref
            if candidate.exists():
                image_file_path = str(candidate)

        # 1. Run Computer Vision Feature Extraction
        cv_result = image_analyzer.analyze_image(
            image_input=image_file_path if image_file_path else b"",
            category=item.get("category", "Fruits")
        )

        # 2. Run Arrhenius Kinetic Shelf Life Prediction
        shelf_life_res = shelf_life_predictor.predict_shelf_life(
            category=item.get("category", "Fruits"),
            purchase_date_val=item.get("purchase_date", ""),
            expiry_date_val=item.get("expiry_date", ""),
            storage_temperature=item.get("storage_temperature"),
            storage_humidity=item.get("storage_humidity"),
            current_freshness_score=cv_result.get("visual_score", 85.0)
        )

        predicted_days = shelf_life_res.get("predicted_remaining_days", 7.0)
        visual_score = cv_result.get("visual_score", 85.0)
        freshness_label = cv_result.get("freshness_label", "Fresh")

        # 3. Generate Prescriptive Decision Recommendations
        rec_res = recommendation_engine.generate_recommendations(
            category=item.get("category", "Fruits"),
            freshness_status=freshness_label,
            freshness_score=visual_score,
            days_remaining=predicted_days,
            temperature=item.get("storage_temperature"),
            humidity=item.get("storage_humidity"),
            quantity=float(item.get("quantity", 1.0)),
            unit=item.get("unit", "kg")
        )

        now = datetime.now(timezone.utc)

        # Update Inventory document
        inv_col.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "freshness_status": freshness_label,
                    "freshness_score": visual_score,
                    "shelf_life_days": predicted_days,
                    "recommendations": rec_res.get("recommendations", []),
                    "last_analyzed_at": now,
                    "updated_at": now,
                }
            }
        )

        # Insert record into freshness_records
        fresh_record = {
            "inventory_id": item["_id"],
            "user_id": item["user_id"],
            "image_url": target_img,
            "freshness_score": visual_score,
            "freshness_label": freshness_label,
            "spoilage_probability": cv_result.get("spoilage_probability", 0.05),
            "color_score": cv_result.get("color_score", 90.0),
            "texture_score": cv_result.get("texture_score", 90.0),
            "browning_index": cv_result.get("browning_index", 5.0),
            "roughness_index": cv_result.get("roughness_index", 20.0),
            "mold_detected": cv_result.get("mold_detected", False),
            "bruising_detected": cv_result.get("bruising_detected", False),
            "predicted_shelf_life": predicted_days,
            "recommendations": rec_res.get("recommendations", []),
            "analysis_date": now,
        }
        fresh_col.insert_one(fresh_record)

        # Trigger Spoilage / Low Quality Alert if warranted
        if freshness_label == FreshnessStatus.SPOILED.value or visual_score < 50.0:
            cls._create_system_alert(
                user_id=item["user_id"],
                inventory_id=item["_id"],
                alert_type="SPOILAGE_RISK",
                product_name=item.get("food_name"),
                severity="Critical",
                reason=f"AI scan detected spoilage/low visual quality (Score: {visual_score}%).",
                action="Remove item from retail sale display and inspect for diversion/composting."
            )
        elif predicted_days <= 2.0:
            cls._create_system_alert(
                user_id=item["user_id"],
                inventory_id=item["_id"],
                alert_type="SHORT_SHELF_LIFE",
                product_name=item.get("food_name"),
                severity="Warning",
                reason=f"Predicted shelf life is down to {predicted_days:.1f} days.",
                action=rec_res.get("markdown_action", "Apply front-of-shelf clearance discount.")
            )

        updated_item = inv_col.find_one({"_id": item["_id"]})
        return {
            "success": True,
            "inventory_id": str(item["_id"]),
            "food_name": item.get("food_name"),
            "analysis": cv_result,
            "shelf_life_prediction": shelf_life_res,
            "prescriptive_recommendations": rec_res,
            "updated_inventory": cls._decorate_retailer_item(updated_item),
        }

    @classmethod
    def get_expiry_tracking(cls, current_user: Dict[str, Any], threshold_days: int = 7) -> Dict[str, Any]:
        items = cls.list_products(current_user=current_user, is_archived=False)

        today = date.today()
        expired_list = []
        approaching_list = []
        safe_list = []

        for item in items:
            days = item.get("days_to_expiry")
            if days is None:
                continue

            entry = {
                "id": item["id"],
                "food_name": item["food_name"],
                "category": item["category"],
                "quantity": item["quantity"],
                "unit": item["unit"],
                "batch_number": item["batch_number"],
                "location": item["location"],
                "recorded_expiry_date": item["expiry_date"],
                "days_to_expiry": days,
                "expiry_category": item["expiry_category"],
                "predicted_remaining_shelf_life": item.get("shelf_life_days"),
                "freshness_status": item["freshness_status"],
                "freshness_score": item["freshness_score"],
                "action_priority": "Immediate Attention" if days <= 0 else ("Urgent Markdown" if days <= 3 else ("Plan Rotation" if days <= threshold_days else "Standard")),
            }

            if days < 0:
                expired_list.append(entry)
            elif days <= threshold_days:
                approaching_list.append(entry)
            else:
                safe_list.append(entry)

        return {
            "summary": {
                "total_tracked": len(items),
                "expired_count": len(expired_list),
                "approaching_expiry_count": len(approaching_list),
                "safe_count": len(safe_list),
                "threshold_days": threshold_days,
            },
            "expired": expired_list,
            "approaching_expiry": approaching_list,
            "safe": safe_list,
        }

    @classmethod
    def get_shelf_life_monitoring(cls, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        items = cls.list_products(current_user=current_user, is_archived=False)
        monitoring_records = []

        for item in items:
            shelf_life = item.get("shelf_life_days")
            days_to_exp = item.get("days_to_expiry")
            rec_params = RECOMMENDED_STORAGE.get(item.get("category"), {})

            warning_status = "Optimal"
            if (shelf_life is not None and shelf_life <= 2.0) or (days_to_exp is not None and days_to_exp <= 2):
                warning_status = "Critical (Immediate Action)"
            elif (shelf_life is not None and shelf_life <= 4.0) or (days_to_exp is not None and days_to_exp <= 4):
                warning_status = "Warning (Prepare Markdown)"

            monitoring_records.append({
                "id": item["id"],
                "food_name": item["food_name"],
                "category": item["category"],
                "quantity": item["quantity"],
                "unit": item["unit"],
                "batch_number": item["batch_number"],
                "recorded_expiry_date": item["expiry_date"],
                "days_to_expiry": days_to_exp,
                "predicted_shelf_life_days": round(shelf_life, 1) if shelf_life is not None else None,
                "freshness_status": item["freshness_status"],
                "freshness_score": item["freshness_score"],
                "storage_temperature": item.get("storage_temperature"),
                "recommended_temperature": rec_params.get("optimal_temp"),
                "storage_humidity": item.get("storage_humidity"),
                "warning_status": warning_status,
                "latest_analysis_date": item.get("updated_at")
            })

        return monitoring_records

    @classmethod
    def get_spoilage_alerts(cls, current_user: Dict[str, Any], status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieves persistent and live-evaluated retailer alerts.
        Deduplicates and ensures real conditions from the database.
        """
        alerts_col = get_alerts_collection()
        user_oid = cls._get_user_oid(current_user)

        # Refresh / generate active alerts based on live inventory conditions
        cls._evaluate_and_sync_inventory_alerts(current_user)

        query: Dict[str, Any] = {"user_id": user_oid}
        if status_filter and status_filter.lower() != "all":
            query["status"] = status_filter

        alerts = list(alerts_col.find(query).sort("timestamp", -1)) if alerts_col is not None else []
        return [
            {
                "id": str(a["_id"]),
                "type": a.get("type", "GENERAL"),
                "product_name": a.get("product_name", "Unknown Item"),
                "inventory_id": str(a.get("inventory_id")),
                "batch_number": a.get("batch_number"),
                "severity": a.get("severity", "Warning"),
                "timestamp": a.get("timestamp") or a.get("created_at") or datetime.now(timezone.utc),
                "reason": a.get("reason", ""),
                "status": a.get("status", "Active"),
                "action": a.get("action", "Inspect product")
            }
            for a in alerts
        ]

    @classmethod
    def acknowledge_alert(cls, alert_id: str, note: Optional[str], current_user: Dict[str, Any]) -> Dict[str, Any]:
        alerts_col = get_alerts_collection()
        if alerts_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(alert_id)
            alert = alerts_col.find_one({"_id": oid})
        except Exception:
            oid = alert_id
            alert = alerts_col.find_one({"_id": oid})

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found.")

        user_id_str = str(current_user.get("id") or current_user.get("_id"))
        if str(alert.get("user_id")) != user_id_str and current_user.get("role") != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Access denied: Cannot acknowledge another user's alert.")

        now = datetime.now(timezone.utc)
        alerts_col.update_one(
            {"_id": alert["_id"]},
            {
                "$set": {
                    "status": "Acknowledged",
                    "acknowledged_at": now,
                    "review_note": note or "Acknowledged by store manager",
                    "acknowledged_by": current_user.get("name", "Retailer")
                }
            }
        )

        return {
            "success": True,
            "message": "Alert marked as acknowledged.",
            "id": str(alert["_id"])
        }

    @classmethod
    def get_storage_monitoring(cls, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Inspects environmental storage compliance for all retailer items.
        Compares actual recorded temperatures and humidities with target ranges.
        """
        items = cls.list_products(current_user=current_user, is_archived=False)
        storage_evaluations = []

        for item in items:
            cat = item.get("category", FoodCategory.OTHER.value)
            st = item.get("storage_type", StorageType.REFRIGERATED.value)
            temp = item.get("storage_temperature")
            rh = item.get("storage_humidity")
            rec = RECOMMENDED_STORAGE.get(cat, RECOMMENDED_STORAGE[FoodCategory.OTHER.value])

            is_compliant = True
            violations = []

            if temp is not None:
                if temp < rec["min_temp"]:
                    is_compliant = False
                    violations.append(f"Temperature too cold: {temp}°C (Minimum recommended: {rec['min_temp']}°C)")
                elif temp > rec["max_temp"]:
                    is_compliant = False
                    violations.append(f"Temperature too warm: {temp}°C (Maximum recommended: {rec['max_temp']}°C)")

            if rh is not None:
                if rh < rec["min_rh"]:
                    is_compliant = False
                    violations.append(f"Humidity too low: {rh}% RH (Target: {rec['min_rh']}% - {rec['max_rh']}%)")
                elif rh > rec["max_rh"]:
                    is_compliant = False
                    violations.append(f"Humidity too high: {rh}% RH (Excess moisture risk)")

            compliance_status = "Compliant" if is_compliant else "Temperature / Humidity Violation"

            storage_evaluations.append({
                "id": item["id"],
                "food_name": item["food_name"],
                "category": cat,
                "location": item["location"],
                "storage_type": st,
                "current_temperature": temp,
                "current_humidity": rh,
                "recommended_temperature": rec["optimal_temp"],
                "permitted_temperature_range": f"{rec['min_temp']}°C to {rec['max_temp']}°C",
                "recommended_humidity_range": f"{rec['min_rh']}% to {rec['max_rh']}% RH",
                "compliance_status": compliance_status,
                "violations": violations,
                "last_recorded": item.get("updated_at")
            })

        return storage_evaluations

    @classmethod
    def get_waste_reduction_prioritization(cls, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Algorithmically segments inventory into waste-mitigation priorities (FEFO & Markdowns).
        """
        items = cls.list_products(current_user=current_user, is_archived=False)

        urgent_action = []       # Expired or <= 1 day
        critical_clearance = []  # 2 to 3 days (40-50% markdown)
        attention_fefo = []      # 4 to 5 days (20-30% markdown)
        standard_stock = []      # > 5 days

        total_at_risk_qty = 0.0

        for item in items:
            days = item.get("days_to_expiry", 99)
            shelf_life = item.get("shelf_life_days")
            qty = float(item.get("quantity", 0))

            effective_days = min(days if days is not None else 99, int(shelf_life) if shelf_life is not None else 99)

            rec_markdown = "Standard Price"
            priority = "Normal"
            action_desc = "Standard rotation"

            if effective_days < 0 or item.get("freshness_status") == FreshnessStatus.SPOILED.value:
                priority = "Immediate Removal"
                rec_markdown = "Discard or Anaerobic Compost"
                action_desc = "Product past consumable life; route away from human retail."
                urgent_action.append({**item, "priority": priority, "markdown": rec_markdown, "action_desc": action_desc})
                total_at_risk_qty += qty
            elif effective_days <= 1:
                priority = "Urgent Clearance"
                rec_markdown = "50% Flash Sale or Food Rescue Donation"
                action_desc = "Immediate markdown label generation or direct partner pickup."
                urgent_action.append({**item, "priority": priority, "markdown": rec_markdown, "action_desc": action_desc})
                total_at_risk_qty += qty
            elif effective_days <= 3:
                priority = "Critical FEFO"
                rec_markdown = "30% - 40% Dynamic Clearance"
                action_desc = "Move to eye-level front-of-shelf display with clearance tag."
                critical_clearance.append({**item, "priority": priority, "markdown": rec_markdown, "action_desc": action_desc})
                total_at_risk_qty += qty
            elif effective_days <= 5:
                priority = "Early Attention"
                rec_markdown = "15% - 20% 'Eat Soon' Discount"
                action_desc = "FEFO picking priority for outgoing order fulfillment."
                attention_fefo.append({**item, "priority": priority, "markdown": rec_markdown, "action_desc": action_desc})
            else:
                standard_stock.append({**item, "priority": priority, "markdown": rec_markdown, "action_desc": action_desc})

        return {
            "summary": {
                "total_items_analyzed": len(items),
                "total_quantity_at_risk": round(total_at_risk_qty, 2),
                "urgent_action_count": len(urgent_action),
                "critical_clearance_count": len(critical_clearance),
                "early_attention_count": len(attention_fefo),
                "potential_waste_avoidance_rate": round(max(0, 100.0 - (len(urgent_action) * 8.0)), 1)
            },
            "urgent_action": urgent_action,
            "critical_clearance": critical_clearance,
            "early_attention": attention_fefo,
            "standard_stock": standard_stock[:10]  # top 10
        }

    @classmethod
    def get_retailer_analytics(cls, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Computes accurate KPIs and Chart.js datasets based exclusively on the retailer's data.
        """
        inv_col = get_inventory_collection()
        fresh_col = get_freshness_records_collection()
        user_oid = cls._get_user_oid(current_user)

        items = cls.list_products(current_user=current_user, is_archived=False)

        total_items = len(items)
        total_quantity = sum(float(i.get("quantity", 0)) for i in items)

        fresh_count = sum(1 for i in items if i.get("freshness_status") == FreshnessStatus.FRESH.value)
        moderate_count = sum(1 for i in items if i.get("freshness_status") in ["Moderate", "Moderately Fresh", "Near Spoilage", "At Risk"])
        spoiled_count = sum(1 for i in items if i.get("freshness_status") == FreshnessStatus.SPOILED.value)
        not_analyzed_count = sum(1 for i in items if i.get("freshness_status") == FreshnessStatus.NOT_ANALYZED.value or not i.get("freshness_status"))

        expired_count = sum(1 for i in items if i.get("expiry_category") == "Expired")
        approaching_count = sum(1 for i in items if i.get("expiry_category") == "Approaching Expiry" or (i.get("days_to_expiry") is not None and 0 <= i.get("days_to_expiry") <= 3))
        at_risk_count = sum(
            1 for i in items
            if i.get("freshness_status") in ["Moderate", "Moderately Fresh", "Near Spoilage", "At Risk"]
            or (i.get("days_to_expiry") is not None and 0 <= i.get("days_to_expiry") <= 3 and i.get("freshness_status") != FreshnessStatus.SPOILED.value)
        )

        wasted_items = [
            i for i in items
            if i.get("freshness_status") == FreshnessStatus.SPOILED.value
            or i.get("expiry_category") == "Expired"
            or (i.get("days_to_expiry") is not None and i.get("days_to_expiry") < 0)
        ]
        total_waste_qty = round(sum(float(i.get("quantity", 0)) for i in wasted_items), 2)
        total_waste_count = len(wasted_items)
        low_stock_count = sum(1 for i in items if i.get("is_low_stock"))

        scored_items = [i.get("freshness_score") for i in items if i.get("freshness_score") is not None]
        avg_quality_score = round(sum(scored_items) / len(scored_items), 1) if scored_items else 0.0

        # Freshness records count
        total_analyses = fresh_col.count_documents({"user_id": user_oid}) if fresh_col is not None else 0

        # Category distribution
        cat_counts: Dict[str, int] = {}
        cat_quantities: Dict[str, float] = {}
        for i in items:
            cat = i.get("category", "Other")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            cat_quantities[cat] = round(cat_quantities.get(cat, 0.0) + float(i.get("quantity", 0)), 1)

        # Expiry Horizons
        horizon_buckets = {"0-2 Days": 0, "3-5 Days": 0, "6-10 Days": 0, "11-20 Days": 0, "20+ Days": 0}
        for i in items:
            d = i.get("days_to_expiry")
            if d is None:
                continue
            if d <= 2:
                horizon_buckets["0-2 Days"] += 1
            elif d <= 5:
                horizon_buckets["3-5 Days"] += 1
            elif d <= 10:
                horizon_buckets["6-10 Days"] += 1
            elif d <= 20:
                horizon_buckets["11-20 Days"] += 1
            else:
                horizon_buckets["20+ Days"] += 1

        # Storage violations
        storage_evals = cls.get_storage_monitoring(current_user)
        storage_violations = sum(1 for s in storage_evals if s.get("compliance_status") != "Compliant")

        return {
            "kpis": {
                "total_inventory_items": total_items,
                "total_products": total_items,
                "total_stock_quantity": round(total_quantity, 2),
                "fresh_count": fresh_count,
                "fresh_products": fresh_count,
                "moderate_count": moderate_count,
                "at_risk_count": at_risk_count,
                "at_risk_products": at_risk_count,
                "spoiled_count": spoiled_count,
                "spoiled_products": spoiled_count,
                "pending_analysis_count": not_analyzed_count,
                "approaching_expiry_count": approaching_count,
                "products_nearing_expiry": approaching_count,
                "expired_count": expired_count,
                "total_food_waste": total_waste_qty,
                "total_food_waste_items": total_waste_count,
                "low_stock_count": low_stock_count,
                "average_quality_score": avg_quality_score,
                "total_analyses": total_analyses,
                "storage_violations_count": storage_violations,
                "waste_avoidance_rate": round(max(0, 100.0 - (expired_count * 5.0 + spoiled_count * 7.0)), 1)
            },
            "charts": {
                "freshness_distribution": {
                    "labels": ["Fresh", "Moderately Fresh / At Risk", "Spoiled / Critical", "Pending Analysis"],
                    "data": [fresh_count, at_risk_count, spoiled_count, not_analyzed_count]
                },
                "category_breakdown": {
                    "categories": list(cat_counts.keys()),
                    "counts": list(cat_counts.values()),
                    "quantities": [cat_quantities.get(c, 0.0) for c in cat_counts.keys()]
                },
                "expiry_horizons": {
                    "ranges": list(horizon_buckets.keys()),
                    "counts": list(horizon_buckets.values())
                },
                "stock_levels": {
                    "products": [i["food_name"] for i in items[:8]],
                    "quantities": [float(i.get("quantity", 0)) for i in items[:8]],
                    "thresholds": [float(i.get("low_stock_threshold", 5.0)) for i in items[:8]]
                }
            },
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

    @classmethod
    def get_retailer_dashboard(cls, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Single aggregated overview for the Retailer Dashboard.
        """
        analytics = cls.get_retailer_analytics(current_user)
        items = cls.list_products(current_user=current_user, is_archived=False)
        alerts = cls.get_spoilage_alerts(current_user=current_user, status_filter="Active")
        waste_priority = cls.get_waste_reduction_prioritization(current_user=current_user)

        fresh_col = get_freshness_records_collection()
        user_oid = cls._get_user_oid(current_user)
        user_id_str = str(current_user.get("id") or current_user.get("_id"))
        recent_scans = []
        if fresh_col is not None:
            try:
                query_cond = {"$or": [{"user_id": user_oid}, {"user_id": user_id_str}]}
                scans_cursor = list(fresh_col.find(query_cond).sort("analysis_date", -1).limit(6))
                for sc in scans_cursor:
                    ad = sc.get("analysis_date")
                    ad_str = ad.strftime("%Y-%m-%d %H:%M") if isinstance(ad, datetime) else str(ad or "")
                    recent_scans.append({
                        "id": str(sc["_id"]),
                        "food_name": sc.get("food_name", "Food Specimen"),
                        "category": sc.get("category", "General"),
                        "image_url": sc.get("image_url"),
                        "freshness_score": sc.get("freshness_score") if sc.get("freshness_score") is not None else sc.get("composite_freshness_score"),
                        "freshness_label": sc.get("freshness_label") or sc.get("freshness_category") or "Fresh",
                        "confidence": sc.get("confidence") or sc.get("confidence_score") or 0.94,
                        "estimated_shelf_life_days": sc.get("estimated_shelf_life_days") or 7.0,
                        "analysis_date": ad_str,
                    })
            except Exception:
                pass

        return {
            "kpis": analytics["kpis"],
            "recent_inventory": items[:10],
            "recent_scans": recent_scans,
            "active_alerts": alerts[:6],
            "priority_items": (waste_priority.get("urgent_action", []) + waste_priority.get("critical_clearance", []))[:5],
            "charts": analytics["charts"],
            "retailer_name": current_user.get("name", "Retail Store"),
            "last_refreshed": datetime.now(timezone.utc).isoformat()
        }

    @classmethod
    def get_retailer_reports_summary(
        cls,
        current_user: Dict[str, Any],
        category: Optional[str] = None,
        freshness_status: Optional[str] = None
    ) -> Dict[str, Any]:
        items = cls.list_products(
            current_user=current_user,
            category=category,
            freshness_status=freshness_status,
            is_archived=False
        )

        total_records = len(items)
        total_quantity = sum(item.get("quantity", 0) for item in items)
        
        fresh_count = 0
        at_risk_count = 0
        expired_count = 0
        scores = []

        category_breakdown = {}
        expiry_buckets = {"expired": 0, "d1_3": 0, "d4_7": 0, "d8_14": 0, "d15_plus": 0}
        quality_buckets = {"grade_a": 0, "grade_b": 0, "grade_c": 0, "critical": 0}

        for it in items:
            cat = it.get("category", "Other")
            if cat not in category_breakdown:
                category_breakdown[cat] = {
                    "category": cat,
                    "batches": 0,
                    "total_quantity": 0,
                    "fresh": 0,
                    "at_risk": 0,
                    "expired": 0,
                    "scores": []
                }
            category_breakdown[cat]["batches"] += 1
            category_breakdown[cat]["total_quantity"] += it.get("quantity", 0)

            st = it.get("freshness_status")
            days = it.get("days_to_expiry")
            score = it.get("freshness_score")

            if score is not None:
                try:
                    s_val = float(score)
                    scores.append(s_val)
                    category_breakdown[cat]["scores"].append(s_val)
                    if s_val >= 80:
                        quality_buckets["grade_a"] += 1
                    elif s_val >= 60:
                        quality_buckets["grade_b"] += 1
                    elif s_val >= 40:
                        quality_buckets["grade_c"] += 1
                    else:
                        quality_buckets["critical"] += 1
                except Exception:
                    pass

            # Expiry timeline bucketing
            if days is not None:
                if days < 0 or st == "Spoiled":
                    expiry_buckets["expired"] += 1
                elif 0 <= days <= 3:
                    expiry_buckets["d1_3"] += 1
                elif 4 <= days <= 7:
                    expiry_buckets["d4_7"] += 1
                elif 8 <= days <= 14:
                    expiry_buckets["d8_14"] += 1
                else:
                    expiry_buckets["d15_plus"] += 1

            # Status classification
            if st == "Spoiled" or (days is not None and days < 0):
                expired_count += 1
                category_breakdown[cat]["expired"] += 1
            elif st == "At Risk" or (days is not None and 0 <= days <= 3):
                at_risk_count += 1
                category_breakdown[cat]["at_risk"] += 1
            else:
                fresh_count += 1
                category_breakdown[cat]["fresh"] += 1

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        # Finalize category breakdown
        cat_list = []
        for cat, data in category_breakdown.items():
            cat_avg = round(sum(data["scores"]) / len(data["scores"]), 1) if data["scores"] else 0.0
            data["avg_quality_score"] = cat_avg
            data.pop("scores", None)
            cat_list.append(data)

        cat_list.sort(key=lambda c: c["batches"], reverse=True)

        return {
            "total_records": total_records,
            "total_quantity": total_quantity,
            "fresh_count": fresh_count,
            "at_risk_count": at_risk_count,
            "expired_count": expired_count,
            "fresh_pct": round((fresh_count / total_records) * 100, 1) if total_records > 0 else 0,
            "at_risk_pct": round((at_risk_count / total_records) * 100, 1) if total_records > 0 else 0,
            "expired_pct": round((expired_count / total_records) * 100, 1) if total_records > 0 else 0,
            "avg_quality_score": avg_score,
            "category_breakdown": cat_list,
            "expiry_buckets": expiry_buckets,
            "quality_buckets": quality_buckets,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "retailer": current_user.get("name", "Retail Store"),
            "items": items
        }

    @classmethod
    def export_retailer_csv(cls, current_user: Dict[str, Any], category: Optional[str] = None) -> StreamingResponse:
        items = cls.list_products(current_user=current_user, category=category, is_archived=False)

        output = io.StringIO()
        writer = csv.writer(output)

        # Write CSV headers
        writer.writerow([
            "Product ID",
            "Product Name",
            "Category",
            "Stock Quantity",
            "Unit",
            "Batch Number",
            "Purchase Date",
            "Recorded Expiry Date",
            "Days to Expiry",
            "Expiry Category",
            "Storage Method",
            "Storage Temperature (°C)",
            "Storage Humidity (%)",
            "Storage Location",
            "Freshness Status",
            "Quality Score",
            "Predicted Shelf Life (Days)",
            "Is Low Stock",
            "Last Updated"
        ])

        for item in items:
            writer.writerow([
                item.get("id"),
                item.get("food_name"),
                item.get("category"),
                item.get("quantity"),
                item.get("unit"),
                item.get("batch_number") or "N/A",
                item.get("purchase_date"),
                item.get("expiry_date"),
                item.get("days_to_expiry"),
                item.get("expiry_category"),
                item.get("storage_type"),
                item.get("storage_temperature") if item.get("storage_temperature") is not None else "N/A",
                item.get("storage_humidity") if item.get("storage_humidity") is not None else "N/A",
                item.get("location") or "N/A",
                item.get("freshness_status"),
                item.get("freshness_score") if item.get("freshness_score") is not None else "N/A",
                item.get("shelf_life_days") if item.get("shelf_life_days") is not None else "N/A",
                "Yes" if item.get("is_low_stock") else "No",
                item.get("updated_at")
            ])

        output.seek(0)
        filename = f"retailer_inventory_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    @classmethod
    def get_notifications(cls, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        notif_col = get_notifications_collection()
        user_oid = cls._get_user_oid(current_user)

        cls._evaluate_and_sync_inventory_alerts(current_user)

        notifications = list(notif_col.find({"user_id": user_oid}).sort("created_at", -1).limit(50)) if notif_col is not None else []
        return [
            {
                "id": str(n["_id"]),
                "user_id": str(n.get("user_id")),
                "type": n.get("type", "INFO"),
                "title": n.get("title", "Notification"),
                "message": n.get("message", ""),
                "severity": n.get("severity", "Info"),
                "inventory_id": str(n.get("inventory_id")) if n.get("inventory_id") else None,
                "is_read": bool(n.get("is_read", False)),
                "created_at": n.get("created_at")
            }
            for n in notifications
        ]

    @classmethod
    def mark_notification_read(cls, notif_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
        notif_col = get_notifications_collection()
        if notif_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(notif_id)
            notif = notif_col.find_one({"_id": oid})
        except Exception:
            oid = notif_id
            notif = notif_col.find_one({"_id": oid})

        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found.")

        user_id_str = str(current_user.get("id") or current_user.get("_id"))
        if str(notif.get("user_id")) != user_id_str and current_user.get("role") != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Access denied.")

        notif_col.update_one({"_id": notif["_id"]}, {"$set": {"is_read": True}})
        return {"success": True, "message": "Notification marked as read."}

    @classmethod
    def mark_all_notifications_read(cls, current_user: Dict[str, Any]) -> Dict[str, Any]:
        notif_col = get_notifications_collection()
        if notif_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        user_oid = cls._get_user_oid(current_user)
        notif_col.update_many({"user_id": user_oid, "is_read": False}, {"$set": {"is_read": True}})
        return {"success": True, "message": "All notifications marked as read."}

    # Internal helpers
    @classmethod
    def _decorate_retailer_item(cls, item: Dict[str, Any]) -> Dict[str, Any]:
        helper_data = inventory_helper(item)
        exp_str = item.get("expiry_date")
        days = None
        category = "Safe"

        if exp_str:
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
                today = date.today()
                days = (exp_date - today).days

                if days < 0:
                    category = "Expired"
                elif days <= 3:
                    category = "Approaching Expiry"
                else:
                    category = "Safe"
            except Exception:
                pass

        qty = float(item.get("quantity", 0))
        threshold = float(item.get("low_stock_threshold", 5.0))

        helper_data["days_to_expiry"] = days
        helper_data["expiry_category"] = category
        helper_data["is_low_stock"] = (qty <= threshold)
        return helper_data

    @classmethod
    def _create_system_alert(
        cls,
        user_id: Any,
        inventory_id: Any,
        alert_type: str,
        product_name: str,
        severity: str,
        reason: str,
        action: str
    ) -> None:
        alerts_col = get_alerts_collection()
        notif_col = get_notifications_collection()
        now = datetime.now(timezone.utc)

        # Deduplicate active alerts
        if alerts_col is not None:
            existing = alerts_col.find_one({
                "user_id": user_id,
                "inventory_id": inventory_id,
                "type": alert_type,
                "status": "Active"
            })
            if not existing:
                alerts_col.insert_one({
                    "user_id": user_id,
                    "inventory_id": inventory_id,
                    "type": alert_type,
                    "product_name": product_name,
                    "severity": severity,
                    "reason": reason,
                    "action": action,
                    "status": "Active",
                    "timestamp": now,
                })

        if notif_col is not None:
            notif_col.insert_one({
                "user_id": user_id,
                "inventory_id": inventory_id,
                "type": alert_type,
                "title": f"{severity.upper()}: {product_name}",
                "message": reason,
                "severity": severity,
                "is_read": False,
                "created_at": now
            })

    @classmethod
    def _evaluate_and_sync_inventory_alerts(cls, current_user: Dict[str, Any]) -> None:
        """Evaluates active items and creates alerts if conditions require attention."""
        inv_col = get_inventory_collection()
        user_oid = cls._get_user_oid(current_user)
        if inv_col is None:
            return

        items = list(inv_col.find({"user_id": user_oid, "is_archived": False}))
        today = date.today()

        for item in items:
            p_name = item.get("food_name", "Product")
            exp_str = item.get("expiry_date")
            qty = float(item.get("quantity", 0))
            threshold = float(item.get("low_stock_threshold", 5.0))
            st_status = item.get("freshness_status")
            score = item.get("freshness_score")
            shelf_days = item.get("shelf_life_days")

            # 1. Check Expiry
            if exp_str:
                try:
                    exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
                    delta = (exp_date - today).days
                    if delta < 0:
                        cls._create_system_alert(
                            user_id=item["user_id"],
                            inventory_id=item["_id"],
                            alert_type="EXPIRED",
                            product_name=p_name,
                            severity="Critical",
                            reason=f"Product passed recorded expiry date by {abs(delta)} days ({exp_str}).",
                            action="Remove from retail shelves immediately."
                        )
                    elif delta <= 3:
                        cls._create_system_alert(
                            user_id=item["user_id"],
                            inventory_id=item["_id"],
                            alert_type="EXPIRING_SOON",
                            product_name=p_name,
                            severity="Warning",
                            reason=f"Product expires in {delta} day(s) on {exp_str}.",
                            action="Prioritize FEFO sale or apply 30% clearance discount."
                        )
                except Exception:
                    pass

            # 2. Check Spoilage / Low Quality
            if st_status == FreshnessStatus.SPOILED.value or (score is not None and score < 50):
                cls._create_system_alert(
                    user_id=item["user_id"],
                    inventory_id=item["_id"],
                    alert_type="SPOILAGE_RISK",
                    product_name=p_name,
                    severity="Critical",
                    reason=f"AI quality scan indicates spoilage risk (Score: {score}%).",
                    action="Inspect food product and isolate affected batch."
                )

            # 3. Check Low Stock
            if qty <= threshold:
                cls._create_system_alert(
                    user_id=item["user_id"],
                    inventory_id=item["_id"],
                    alert_type="LOW_STOCK",
                    product_name=p_name,
                    severity="Warning",
                    reason=f"Stock level is low: {qty} {item.get('unit', 'units')} remaining (Threshold: {threshold}).",
                    action="Place replenishment order with warehouse or supplier."
                )

    @classmethod
    def seed_retailer_inventory(cls, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Seeds realistic supermarket inventory items, scans, storage readings,
        and alerts for the authenticated retailer if their inventory is empty.
        """
        user_oid = cls._get_user_oid(current_user)
        inv_col = get_inventory_collection()
        fresh_col = get_freshness_records_collection()
        cond_col = get_storage_conditions_collection()
        notif_col = get_notifications_collection()

        if inv_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        from seed_retailer_data import generate_retailer_catalog
        catalog = generate_retailer_catalog(user_oid)

        res = inv_col.insert_many(catalog)
        inserted_ids = res.inserted_ids

        now = datetime.now(timezone.utc)

        # Scans
        if fresh_col is not None and fresh_col.count_documents({"user_id": user_oid}) == 0:
            scans = [
                {
                    "user_id": user_oid,
                    "inventory_id": str(inserted_ids[0]),
                    "food_name": "Crisp Fuji Apples",
                    "category": "Fruits",
                    "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80",
                    "freshness_score": 96.5,
                    "freshness_label": "Fresh",
                    "confidence": 0.97,
                    "estimated_shelf_life_days": 14.0,
                    "analysis_date": now - timedelta(hours=3),
                },
                {
                    "user_id": user_oid,
                    "inventory_id": str(inserted_ids[3]),
                    "food_name": "Farm Fresh Strawberries",
                    "category": "Fruits",
                    "image_url": "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80",
                    "freshness_score": 94.0,
                    "freshness_label": "Fresh",
                    "confidence": 0.95,
                    "estimated_shelf_life_days": 5.0,
                    "analysis_date": now - timedelta(hours=6),
                },
                {
                    "user_id": user_oid,
                    "inventory_id": str(inserted_ids[2]),
                    "food_name": "Ripe Bananas with Sugar Spots",
                    "category": "Fruits",
                    "image_url": "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=400&q=80",
                    "freshness_score": 62.0,
                    "freshness_label": "At Risk",
                    "confidence": 0.92,
                    "estimated_shelf_life_days": 1.0,
                    "analysis_date": now - timedelta(hours=14),
                },
                {
                    "user_id": user_oid,
                    "inventory_id": str(inserted_ids[8]),
                    "food_name": "Bacterial Soft-Rot Tomatoes",
                    "category": "Vegetables",
                    "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=80",
                    "freshness_score": 18.0,
                    "freshness_label": "Spoiled",
                    "confidence": 0.98,
                    "estimated_shelf_life_days": 0.0,
                    "analysis_date": now - timedelta(hours=20),
                },
                {
                    "user_id": user_oid,
                    "inventory_id": str(inserted_ids[10]),
                    "food_name": "Farm Fresh Whole Milk",
                    "category": "Dairy",
                    "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
                    "freshness_score": 98.0,
                    "freshness_label": "Fresh",
                    "confidence": 0.96,
                    "estimated_shelf_life_days": 8.0,
                    "analysis_date": now - timedelta(days=1),
                },
            ]
            fresh_col.insert_many(scans)

        # Storage readings
        if cond_col is not None and cond_col.count_documents({"user_id": user_oid}) == 0:
            storage_readings = [
                {
                    "user_id": user_oid,
                    "location_name": "Walk-In Produce Cooler A",
                    "category": "Vegetables",
                    "current_temperature": 4.1,
                    "target_temperature": 4.0,
                    "min_temp": 1.0,
                    "max_temp": 6.0,
                    "current_humidity": 88.0,
                    "target_humidity": 90.0,
                    "compliance_status": "Compliant",
                    "item_count": 8,
                    "recorded_at": now,
                },
                {
                    "user_id": user_oid,
                    "location_name": "Dairy Chiller Wall 1",
                    "category": "Dairy",
                    "current_temperature": 3.0,
                    "target_temperature": 3.0,
                    "min_temp": 0.0,
                    "max_temp": 4.0,
                    "current_humidity": 58.0,
                    "target_humidity": 60.0,
                    "compliance_status": "Compliant",
                    "item_count": 5,
                    "recorded_at": now,
                },
                {
                    "user_id": user_oid,
                    "location_name": "Seafood Cold Bed A",
                    "category": "Fish",
                    "current_temperature": 1.1,
                    "target_temperature": 0.5,
                    "min_temp": -1.0,
                    "max_temp": 2.0,
                    "current_humidity": 82.0,
                    "target_humidity": 80.0,
                    "compliance_status": "Compliant",
                    "item_count": 3,
                    "recorded_at": now,
                },
                {
                    "user_id": user_oid,
                    "location_name": "Clearance Fruit Stand",
                    "category": "Fruits",
                    "current_temperature": 21.0,
                    "target_temperature": 4.0,
                    "min_temp": 1.0,
                    "max_temp": 6.0,
                    "current_humidity": 55.0,
                    "target_humidity": 90.0,
                    "compliance_status": "Non-Compliant (High Temp)",
                    "item_count": 2,
                    "recorded_at": now,
                },
            ]
            cond_col.insert_many(storage_readings)

        # Store Notifications
        if notif_col is not None and notif_col.count_documents({"user_id": user_oid}) == 0:
            notifs = [
                {
                    "user_id": user_oid,
                    "title": "Welcome to Retailer Operations Hub",
                    "message": "Your retail store inventory and AI monitoring hub are fully initialized.",
                    "type": "SYSTEM",
                    "is_read": False,
                    "created_at": now - timedelta(hours=1),
                },
                {
                    "user_id": user_oid,
                    "title": "Spoilage Flag: Bacterial Soft-Rot Tomatoes",
                    "message": "Quality score dropped to 18%. Immediate disposal advised.",
                    "type": "ALERT",
                    "is_read": False,
                    "created_at": now - timedelta(hours=5),
                },
                {
                    "user_id": user_oid,
                    "title": "FEFO Priority: Bananas & Spinach",
                    "message": "Markdown discounts recommended for 2 products expiring within 24-48 hours.",
                    "type": "ACTION",
                    "is_read": False,
                    "created_at": now - timedelta(hours=10),
                },
                {
                    "user_id": user_oid,
                    "title": "Restock Notice: Brown Basmati Rice",
                    "message": "Stock fell below safe buffer threshold (2 remaining / 5 required).",
                    "type": "STOCK",
                    "is_read": False,
                    "created_at": now - timedelta(hours=16),
                },
            ]
            notif_col.insert_many(notifs)

        # Sync real-time alerts
        cls._evaluate_and_sync_inventory_alerts(current_user)

        return {
            "success": True,
            "message": f"Seeded {len(inserted_ids)} demo products and telemetry.",
            "inserted_count": len(inserted_ids),
        }

    _sync_realtime_alerts = _evaluate_and_sync_inventory_alerts
