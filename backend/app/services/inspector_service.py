import os
import io
import csv
import math
import uuid
import shutil
from datetime import datetime, timezone, date, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
from bson import ObjectId
from fastapi import HTTPException, status, UploadFile
from fastapi.responses import StreamingResponse

from backend.app.database import (
    get_food_inspections_collection,
    get_inventory_collection,
    get_alerts_collection,
    get_notifications_collection,
)
from backend.app.models.inventory_model import FoodCategory
from backend.app.schemas.inspector_schema import (
    InspectionCreateRequest,
    InspectionReviewRequest,
    InspectionFlagRequest,
    AlertResolveRequest,
)
from backend.app.ml.cv_analyzer import image_analyzer
from backend.app.ml.shelf_life_model import shelf_life_predictor
from backend.app.config import settings

# Food Science Storage Thresholds (Aligned across the platform)
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


class FoodQualityInspectorService:
    """
    Core business service for the Food Quality Inspector role.
    Handles food inspections, AI visual diagnostics, Arrhenius shelf-life review,
    storage compliance evaluation, separate inspector validation, alerts, and analytics.
    """

    @staticmethod
    def _decorate_inspection(doc: Dict[str, Any]) -> Dict[str, Any]:
        if not doc:
            return {}
        
        doc_id = str(doc.get("_id"))
        storage = doc.get("storage_review") or {}
        ai_res = doc.get("ai_result") or {}
        review = doc.get("inspector_review") or {}

        # Safe date string representations
        created_at = doc.get("created_at")
        if isinstance(created_at, datetime):
            created_at_str = created_at.isoformat()
        else:
            created_at_str = str(created_at or "")

        updated_at = doc.get("updated_at")
        if isinstance(updated_at, datetime):
            updated_at_str = updated_at.isoformat()
        else:
            updated_at_str = str(updated_at or "")

        return {
            "id": doc_id,
            "inspection_id": doc.get("inspection_id", f"INS-{doc_id[:8]}"),
            "inspector_id": str(doc.get("inspector_id", "")),
            "inspector_name": doc.get("inspector_name", "Quality Inspector"),
            "inspector_email": doc.get("inspector_email", ""),
            "product_name": doc.get("product_name", "Unknown Food Product"),
            "category": doc.get("category", "Other"),
            "batch_number": doc.get("batch_number"),
            "inventory_id": str(doc.get("inventory_id")) if doc.get("inventory_id") else None,
            "image_reference": doc.get("image_reference"),
            "storage_review": {
                "current_temperature": storage.get("current_temperature"),
                "current_humidity": storage.get("current_humidity"),
                "recommended_temperature": storage.get("recommended_temperature", 4.0),
                "permitted_temp_min": storage.get("permitted_temp_min", 1.0),
                "permitted_temp_max": storage.get("permitted_temp_max", 6.0),
                "recommended_humidity": storage.get("recommended_humidity", 85.0),
                "permitted_humidity_min": storage.get("permitted_humidity_min", 75.0),
                "permitted_humidity_max": storage.get("permitted_humidity_max", 95.0),
                "storage_location": storage.get("storage_location"),
                "status": storage.get("status", "Normal"),
                "notes": storage.get("notes"),
            },
            "ai_result": {
                "classification": ai_res.get("classification", "Not Analyzed"),
                "confidence": float(ai_res.get("confidence", 0.0)),
                "quality_score": float(ai_res.get("quality_score", 0.0)),
                "spoilage_risk": ai_res.get("spoilage_risk", "Low"),
                "spoilage_probability": float(ai_res.get("spoilage_probability", 0.0)),
                "estimated_shelf_life_days": float(ai_res.get("estimated_shelf_life_days", 0.0)),
                "detected_defects": ai_res.get("detected_defects", []),
                "mold_detected": bool(ai_res.get("mold_detected", False)),
                "mold_coverage_pct": float(ai_res.get("mold_coverage_pct", 0.0)),
                "bruising_detected": bool(ai_res.get("bruising_detected", False)),
                "physical_damage_detected": bool(ai_res.get("physical_damage_detected", False)),
                "browning_index": float(ai_res.get("browning_index", 0.0)),
                "roughness_index": float(ai_res.get("roughness_index", 0.0)),
                "color_score": float(ai_res.get("color_score", 0.0)),
                "texture_score": float(ai_res.get("texture_score", 0.0)),
                "analyzed_at": ai_res.get("analyzed_at"),
            },
            "inspector_review": {
                "decision": review.get("decision", "Pending"),
                "reason": review.get("reason"),
                "comments": review.get("comments"),
                "issue_type": review.get("issue_type"),
                "severity": review.get("severity"),
                "reviewed_at": review.get("reviewed_at"),
                "inspector_id": str(review.get("inspector_id")) if review.get("inspector_id") else None,
                "inspector_name": review.get("inspector_name"),
                "inspector_adjusted_shelf_life": review.get("inspector_adjusted_shelf_life"),
            },
            "status": doc.get("status", "Pending"),
            "created_at": created_at_str,
            "updated_at": updated_at_str,
        }

    @classmethod
    def create_inspection(
        cls,
        product_name: str,
        category: str,
        batch_number: Optional[str],
        inventory_id: Optional[str],
        storage_temperature: Optional[float],
        storage_humidity: Optional[float],
        storage_location: Optional[str],
        notes: Optional[str],
        image_file: Optional[UploadFile],
        image_url: Optional[str],
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Creates a new food inspection record, processes the food image through OpenCV,
        evaluates storage conditions, runs Arrhenius shelf-life kinetics, and registers alerts.
        """
        col = get_food_inspections_collection()
        if col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        now = datetime.now(timezone.utc)
        today = date.today()

        # Handle image file upload or image_url reference
        image_reference = image_url
        image_file_path = None

        if image_file and image_file.filename:
            file_ext = Path(image_file.filename).suffix.lower()
            if file_ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported image format '{file_ext}'. Allowed formats: .jpg, .jpeg, .png, .webp."
                )

            filename = f"insp_{uuid.uuid4().hex[:12]}{file_ext}"
            save_path = settings.UPLOAD_DIR / filename
            try:
                with open(save_path, "wb") as buffer:
                    shutil.copyfileobj(image_file.file, buffer)
                image_reference = f"/uploads/{filename}"
                image_file_path = str(save_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to persist uploaded image: {e}")
        elif image_url:
            s = image_url.strip()
            if s.startswith(("http://", "https://")):
                try:
                    import httpx
                    with httpx.Client(timeout=8.0, follow_redirects=True) as client:
                        resp = client.get(s)
                        if resp.status_code == 200 and len(resp.content) > 0:
                            # Try to infer extension or default to .jpg
                            ext = ".jpg"
                            if ".png" in s.lower(): ext = ".png"
                            elif ".webp" in s.lower(): ext = ".webp"
                            filename = f"insp_{uuid.uuid4().hex[:12]}{ext}"
                            save_path = settings.UPLOAD_DIR / filename
                            with open(save_path, "wb") as f:
                                f.write(resp.content)
                            image_reference = f"/uploads/{filename}"
                            image_file_path = str(save_path)
                        else:
                            image_reference = image_url
                            image_file_path = image_url
                except Exception:
                    image_reference = image_url
                    image_file_path = image_url
            else:
                clean_ref = image_url.lstrip("/").replace("uploads/", "")
                cand_path = settings.UPLOAD_DIR / clean_ref
                if cand_path.exists():
                    image_file_path = str(cand_path)
                image_reference = image_url

        # 1. Execute live Computer Vision Freshness Engine
        cv_result = image_analyzer.analyze_image(
            image_input=image_file_path if image_file_path else b"",
            category=category
        )

        visual_score = float(cv_result.get("visual_score", 75.0))
        freshness_label = cv_result.get("freshness_label", "Fresh")

        # Normalize label for consistency
        if freshness_label == "Expiring Soon":
            display_classification = "Moderately Fresh"
        elif freshness_label == "Spoiled":
            display_classification = "Spoiled"
        else:
            display_classification = "Fresh"

        # Calculate AI Confidence score based on spectral clarity & defect signal
        confidence = round(min(0.98, max(0.85, 0.78 + (abs(visual_score - 50.0) / 50.0) * 0.18)), 2)

        # Determine Spoilage Risk
        if visual_score < 40.0 or cv_result.get("mold_detected"):
            spoilage_risk = "Critical" if visual_score < 25.0 else "High"
        elif visual_score < 70.0:
            spoilage_risk = "Medium"
        else:
            spoilage_risk = "Low"

        # 2. Execute Arrhenius Shelf-Life Engine
        rec_storage = RECOMMENDED_STORAGE.get(category, RECOMMENDED_STORAGE[FoodCategory.OTHER.value])
        kinetics = shelf_life_predictor.CATEGORY_KINETICS.get(category, shelf_life_predictor.CATEGORY_KINETICS["Other"])

        shelf_res = shelf_life_predictor.predict_shelf_life(
            category=category,
            purchase_date_val=today,
            expiry_date_val=today + timedelta(days=kinetics["default_days"]),
            storage_temperature=storage_temperature if storage_temperature is not None else rec_storage["optimal_temp"],
            storage_humidity=storage_humidity if storage_humidity is not None else rec_storage["optimal_rh"],
            current_freshness_score=visual_score,
        )
        estimated_shelf_life_days = float(shelf_res.get("predicted_remaining_days", 5.0))

        # 3. Evaluate Storage Conditions against Food Science Standards
        storage_status = "Normal"
        storage_notes_list = []

        if storage_temperature is not None:
            if storage_temperature > rec_storage["max_temp"]:
                storage_status = "Temperature Violation"
                storage_notes_list.append(f"Temperature (+{storage_temperature}°C) exceeds max permitted (+{rec_storage['max_temp']}°C).")
            elif storage_temperature < rec_storage["min_temp"]:
                storage_status = "Temperature Violation"
                storage_notes_list.append(f"Temperature ({storage_temperature}°C) below minimum safe threshold ({rec_storage['min_temp']}°C).")

        if storage_humidity is not None:
            if storage_humidity < rec_storage["min_rh"]:
                if storage_status == "Normal":
                    storage_status = "Humidity Deficit"
                storage_notes_list.append(f"Relative humidity ({storage_humidity}%) below optimal range ({rec_storage['min_rh']}% - {rec_storage['max_rh']}%).")
            elif storage_humidity > rec_storage["max_rh"]:
                if storage_status == "Normal":
                    storage_status = "Excess Humidity"
                storage_notes_list.append(f"Relative humidity ({storage_humidity}%) exceeds upper condensation threshold.")

        storage_notes = " | ".join(storage_notes_list) if storage_notes_list else "Environmental conditions within compliant tolerances."

        # Unique Human-Readable Inspection ID (INS-YYYYMMDD-XXXX)
        unique_suffix = uuid.uuid4().hex[:4].upper()
        inspection_id = f"INS-{today.strftime('%Y%m%d')}-{unique_suffix}"

        # Determine Initial Inspection Status
        if visual_score < 40.0 or cv_result.get("mold_detected") or storage_status == "Temperature Violation":
            initial_status = "Under Review"
        else:
            initial_status = "Pending"

        # Assemble Separate AI Result (Preserved for traceability)
        ai_result = {
            "classification": display_classification,
            "confidence": confidence,
            "quality_score": visual_score,
            "spoilage_risk": spoilage_risk,
            "spoilage_probability": float(cv_result.get("spoilage_probability", 0.0)),
            "estimated_shelf_life_days": estimated_shelf_life_days,
            "detected_defects": cv_result.get("detected_defects", []),
            "mold_detected": bool(cv_result.get("mold_detected", False)),
            "mold_coverage_pct": float(cv_result.get("mold_coverage_pct", 0.0)),
            "bruising_detected": bool(cv_result.get("bruising_detected", False)),
            "physical_damage_detected": bool(cv_result.get("physical_damage_detected", False)),
            "browning_index": float(cv_result.get("browning_index", 0.0)),
            "roughness_index": float(cv_result.get("roughness_index", 0.0)),
            "color_score": float(cv_result.get("color_score", 0.0)),
            "texture_score": float(cv_result.get("texture_score", 0.0)),
            "analyzed_at": now.isoformat(),
        }

        # Storage Review Subdocument
        storage_review = {
            "current_temperature": storage_temperature,
            "current_humidity": storage_humidity,
            "recommended_temperature": rec_storage["optimal_temp"],
            "permitted_temp_min": rec_storage["min_temp"],
            "permitted_temp_max": rec_storage["max_temp"],
            "recommended_humidity": rec_storage["optimal_rh"],
            "permitted_humidity_min": rec_storage["min_rh"],
            "permitted_humidity_max": rec_storage["max_rh"],
            "storage_location": storage_location or "Inspection Sample Bay",
            "status": storage_status,
            "notes": storage_notes,
        }

        # Inspector Review Subdocument (Initially Pending)
        inspector_review = {
            "decision": "Pending",
            "reason": None,
            "comments": notes,
            "issue_type": "None",
            "severity": "None",
            "reviewed_at": None,
            "inspector_id": str(current_user.get("id") or current_user.get("_id")),
            "inspector_name": current_user.get("name", "Quality Inspector"),
            "inspector_adjusted_shelf_life": None,
        }

        inspector_oid = current_user.get("_id")
        if not isinstance(inspector_oid, ObjectId):
            try:
                inspector_oid = ObjectId(current_user.get("id"))
            except Exception:
                inspector_oid = current_user.get("id")

        inv_oid = None
        if inventory_id:
            try:
                inv_oid = ObjectId(inventory_id)
            except Exception:
                inv_oid = inventory_id

        doc = {
            "inspection_id": inspection_id,
            "inspector_id": inspector_oid,
            "inspector_name": current_user.get("name", "Quality Inspector"),
            "inspector_email": current_user.get("email", ""),
            "product_name": product_name.strip(),
            "category": category,
            "batch_number": batch_number.strip() if batch_number else None,
            "inventory_id": inv_oid,
            "image_reference": image_reference,
            "storage_review": storage_review,
            "ai_result": ai_result,
            "inspector_review": inspector_review,
            "status": initial_status,
            "created_at": now,
            "updated_at": now,
        }

        result = col.insert_one(doc)
        doc["_id"] = result.inserted_id

        # Generate automated alert if spoilage or severe condition detected
        alerts_col = get_alerts_collection()
        if alerts_col is not None and (visual_score < 40.0 or cv_result.get("mold_detected") or storage_status == "Temperature Violation"):
            alert_type = "spoilage_suspected" if (visual_score < 40.0 or cv_result.get("mold_detected")) else "temperature_violation"
            sev = "critical" if visual_score < 25.0 else ("high" if visual_score < 40.0 else "medium")
            alert_msg = f"Inspection {inspection_id} for '{product_name}': {', '.join(cv_result.get('detected_defects', ['Spoilage suspected']))}."
            
            alerts_col.insert_one({
                "user_id": inspector_oid,
                "item_name": product_name,
                "inspection_id": inspection_id,
                "alert_type": alert_type,
                "severity": sev,
                "message": alert_msg,
                "status": "active",
                "created_at": now,
            })

        return cls._decorate_inspection(doc)

    @classmethod
    def get_inspection(cls, inspection_id_or_oid: str) -> Dict[str, Any]:
        col = get_food_inspections_collection()
        if col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(inspection_id_or_oid)
            doc = col.find_one({"_id": oid})
        except Exception:
            doc = col.find_one({"inspection_id": inspection_id_or_oid})

        if not doc:
            raise HTTPException(status_code=404, detail=f"Inspection '{inspection_id_or_oid}' not found.")
        return cls._decorate_inspection(doc)

    @classmethod
    def review_inspection(
        cls,
        inspection_id_or_oid: str,
        data: InspectionReviewRequest,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Records the inspector's validation decision without overwriting the original AI prediction.
        """
        col = get_food_inspections_collection()
        if col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(inspection_id_or_oid)
            doc = col.find_one({"_id": oid})
        except Exception:
            doc = col.find_one({"inspection_id": inspection_id_or_oid})

        if not doc:
            raise HTTPException(status_code=404, detail=f"Inspection '{inspection_id_or_oid}' not found.")

        valid_decisions = ["Confirmed", "Flagged", "Requires Further Inspection", "Completed"]
        clean_decision = data.decision.strip().title()
        if clean_decision not in valid_decisions and data.decision not in valid_decisions:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid decision '{data.decision}'. Allowed decisions: Confirmed, Flagged, Requires Further Inspection."
            )

        now = datetime.now(timezone.utc)
        inspector_uid = str(current_user.get("id") or current_user.get("_id"))
        inspector_name = current_user.get("name", "Quality Inspector")

        # Map to overall inspection status
        if clean_decision == "Confirmed":
            new_status = "Confirmed"
        elif clean_decision == "Flagged":
            new_status = "Flagged"
        elif clean_decision == "Requires Further Inspection":
            new_status = "Requires Further Inspection"
        else:
            new_status = "Completed"

        update_fields = {
            "inspector_review.decision": clean_decision,
            "inspector_review.reason": data.reason or f"Inspector review marked as {clean_decision}",
            "inspector_review.comments": data.comments,
            "inspector_review.reviewed_at": now.isoformat(),
            "inspector_review.inspector_id": inspector_uid,
            "inspector_review.inspector_name": inspector_name,
            "status": new_status,
            "updated_at": now,
        }

        if data.adjusted_shelf_life is not None:
            update_fields["inspector_review.inspector_adjusted_shelf_life"] = float(data.adjusted_shelf_life)

        col.update_one({"_id": doc["_id"]}, {"$set": update_fields})
        updated_doc = col.find_one({"_id": doc["_id"]})
        return cls._decorate_inspection(updated_doc)

    @classmethod
    def flag_inspection(
        cls,
        inspection_id_or_oid: str,
        data: InspectionFlagRequest,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Flags an inspection with a designated issue type and severity level.
        Generates an active quality alert in the alerts collection.
        """
        col = get_food_inspections_collection()
        alerts_col = get_alerts_collection()
        if col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(inspection_id_or_oid)
            doc = col.find_one({"_id": oid})
        except Exception:
            doc = col.find_one({"inspection_id": inspection_id_or_oid})

        if not doc:
            raise HTTPException(status_code=404, detail=f"Inspection '{inspection_id_or_oid}' not found.")

        now = datetime.now(timezone.utc)
        inspector_uid = str(current_user.get("id") or current_user.get("_id"))
        inspector_name = current_user.get("name", "Quality Inspector")

        update_fields = {
            "inspector_review.decision": "Flagged",
            "inspector_review.issue_type": data.issue_type,
            "inspector_review.severity": data.severity,
            "inspector_review.reason": data.reason,
            "inspector_review.comments": data.comments,
            "inspector_review.reviewed_at": now.isoformat(),
            "inspector_review.inspector_id": inspector_uid,
            "inspector_review.inspector_name": inspector_name,
            "status": "Flagged",
            "updated_at": now,
        }

        col.update_one({"_id": doc["_id"]}, {"$set": update_fields})

        # Insert / Update alert
        if alerts_col is not None:
            alerts_col.insert_one({
                "user_id": doc.get("inspector_id"),
                "item_name": doc.get("product_name"),
                "inspection_id": doc.get("inspection_id"),
                "alert_type": data.issue_type.lower().replace(" ", "_"),
                "severity": data.severity.lower(),
                "message": f"[{data.severity.upper()}] Flagged: {data.reason}",
                "status": "active",
                "created_at": now,
            })

        updated_doc = col.find_one({"_id": doc["_id"]})
        return cls._decorate_inspection(updated_doc)

    @classmethod
    def list_inspections(
        cls,
        category: Optional[str] = None,
        freshness_status: Optional[str] = None,
        inspection_status: Optional[str] = None,
        severity: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        col = get_food_inspections_collection()
        if col is None:
            return []

        query: Dict[str, Any] = {}

        if category and category.lower() != "all":
            query["category"] = category

        if freshness_status and freshness_status.lower() != "all":
            # Map friendly status names
            if freshness_status.lower() == "moderate" or freshness_status.lower() == "moderately fresh":
                query["ai_result.classification"] = {"$in": ["Moderately Fresh", "Expiring Soon"]}
            else:
                query["ai_result.classification"] = {"$regex": f"^{freshness_status}$", "$options": "i"}

        if inspection_status and inspection_status.lower() != "all":
            query["status"] = {"$regex": f"^{inspection_status}$", "$options": "i"}

        if severity and severity.lower() != "all":
            query["inspector_review.severity"] = {"$regex": f"^{severity}$", "$options": "i"}

        if search and search.strip():
            rgx = {"$regex": search.strip(), "$options": "i"}
            query["$or"] = [
                {"product_name": rgx},
                {"batch_number": rgx},
                {"inspection_id": rgx},
                {"inspector_name": rgx},
            ]

        # Date range filtering on created_at
        if start_date or end_date:
            date_filter = {}
            if start_date:
                try:
                    s_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    date_filter["$gte"] = s_dt
                except Exception:
                    pass
            if end_date:
                try:
                    e_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                    date_filter["$lte"] = e_dt
                except Exception:
                    pass
            if date_filter:
                query["created_at"] = date_filter

        cursor = col.find(query).sort("created_at", -1).skip(skip).limit(limit)
        return [cls._decorate_inspection(doc) for doc in cursor]

    @classmethod
    def get_dashboard(cls, current_user: Dict[str, Any]) -> Dict[str, Any]:
        col = get_food_inspections_collection()
        alerts_col = get_alerts_collection()

        if col is None:
            return {
                "kpis": {},
                "recent_inspections": [],
                "pending_reviews": [],
                "active_alerts": []
            }

        docs = list(col.find({}))
        total_inspections = len(docs)

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_inspections = 0
        pending_reviews = 0
        fresh_items = 0
        moderate_items = 0
        spoiled_items = 0
        flagged_results = 0
        quality_score_sum = 0.0
        confidence_sum = 0.0

        for d in docs:
            c_at = d.get("created_at")
            if isinstance(c_at, datetime):
                c_at_cmp = c_at.replace(tzinfo=timezone.utc) if c_at.tzinfo is None else c_at
                if c_at_cmp >= today_start:
                    today_inspections += 1

            st = d.get("status", "Pending")
            if st in ["Pending", "Under Review", "Requires Further Inspection"]:
                pending_reviews += 1
            if st == "Flagged" or (d.get("inspector_review", {}).get("decision") == "Flagged"):
                flagged_results += 1

            ai = d.get("ai_result") or {}
            clf = ai.get("classification", "")
            if clf == "Fresh":
                fresh_items += 1
            elif clf in ["Moderately Fresh", "Expiring Soon"]:
                moderate_items += 1
            elif clf == "Spoiled":
                spoiled_items += 1

            q_score = float(ai.get("quality_score", 0.0))
            quality_score_sum += q_score

            conf = float(ai.get("confidence", 0.0))
            confidence_sum += conf

        avg_quality = round(quality_score_sum / total_inspections, 1) if total_inspections > 0 else 0.0
        avg_confidence = round((confidence_sum / total_inspections) * 100.0, 1) if total_inspections > 0 else 0.0

        # Spoilage & Quality Alerts count
        spoilage_alerts_count = 0
        active_alerts = []
        if alerts_col is not None:
            active_alerts_cursor = alerts_col.find({"status": "active"}).sort("created_at", -1).limit(10)
            for a in active_alerts_cursor:
                spoilage_alerts_count += 1
                active_alerts.append({
                    "id": str(a.get("_id")),
                    "item_name": a.get("item_name", "Unknown Item"),
                    "inspection_id": a.get("inspection_id"),
                    "alert_type": a.get("alert_type", "Quality Alert"),
                    "severity": a.get("severity", "medium"),
                    "message": a.get("message", ""),
                    "created_at": a.get("created_at").isoformat() if isinstance(a.get("created_at"), datetime) else str(a.get("created_at") or ""),
                })

        # Recent 5 inspections
        recent_cursor = col.find({}).sort("created_at", -1).limit(6)
        recent_inspections = [cls._decorate_inspection(d) for d in recent_cursor]

        # Pending 5 inspections requiring review
        pending_cursor = col.find({"status": {"$in": ["Pending", "Under Review", "Requires Further Inspection"]}}).sort("created_at", -1).limit(6)
        pending_list = [cls._decorate_inspection(d) for d in pending_cursor]

        return {
            "kpis": {
                "total_inspections": total_inspections,
                "today_inspections": today_inspections,
                "pending_reviews": pending_reviews,
                "fresh_items": fresh_items,
                "moderate_items": moderate_items,
                "spoiled_items": spoiled_items,
                "spoilage_alerts": spoilage_alerts_count,
                "flagged_results": flagged_results,
                "average_quality_score": avg_quality,
                "average_ai_confidence": avg_confidence,
            },
            "recent_inspections": recent_inspections,
            "pending_reviews": pending_list,
            "active_alerts": active_alerts,
        }

    @classmethod
    def get_quality_analytics(cls) -> Dict[str, Any]:
        col = get_food_inspections_collection()
        dashboard_data = cls.get_dashboard({})
        kpis = dashboard_data["kpis"]

        if col is None:
            return {
                "kpis": kpis,
                "freshness_distribution": {"Fresh": 0, "Moderately Fresh": 0, "Spoiled": 0},
                "quality_trends": [],
                "spoilage_trends": [],
                "inspection_activity": [],
                "category_breakdown": [],
            }

        docs = list(col.find({}))

        freshness_dist = {
            "Fresh": kpis.get("fresh_items", 0),
            "Moderately Fresh": kpis.get("moderate_items", 0),
            "Spoiled": kpis.get("spoiled_items", 0),
        }

        # Date bucketing for recent 7 days
        today = date.today()
        day_buckets: Dict[str, Dict[str, Any]] = {}
        for i in range(6, -1, -1):
            d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            day_buckets[d_str] = {
                "date": d_str,
                "label": (today - timedelta(days=i)).strftime("%b %d"),
                "total_count": 0,
                "quality_score_sum": 0.0,
                "spoiled_count": 0,
                "flagged_count": 0,
            }

        category_counts: Dict[str, int] = {}

        for d in docs:
            c_at = d.get("created_at")
            if isinstance(c_at, datetime):
                d_key = c_at.strftime("%Y-%m-%d")
            elif isinstance(c_at, str) and len(c_at) >= 10:
                d_key = c_at[:10]
            else:
                d_key = today.strftime("%Y-%m-%d")

            cat = d.get("category", "Other")
            category_counts[cat] = category_counts.get(cat, 0) + 1

            if d_key in day_buckets:
                day_buckets[d_key]["total_count"] += 1
                q_score = float(d.get("ai_result", {}).get("quality_score", 0.0))
                day_buckets[d_key]["quality_score_sum"] += q_score
                
                clf = d.get("ai_result", {}).get("classification")
                if clf == "Spoiled":
                    day_buckets[d_key]["spoiled_count"] += 1
                if d.get("status") == "Flagged" or d.get("inspector_review", {}).get("decision") == "Flagged":
                    day_buckets[d_key]["flagged_count"] += 1

        quality_trends = []
        spoilage_trends = []
        inspection_activity = []

        for d_key, b in day_buckets.items():
            avg_q = round(b["quality_score_sum"] / b["total_count"], 1) if b["total_count"] > 0 else 0.0
            quality_trends.append({"date": b["label"], "average_quality": avg_q})
            spoilage_trends.append({"date": b["label"], "spoiled_count": b["spoiled_count"], "flagged_count": b["flagged_count"]})
            inspection_activity.append({"date": b["label"], "count": b["total_count"]})

        category_breakdown = [{"category": k, "count": v} for k, v in category_counts.items()]

        return {
            "kpis": kpis,
            "freshness_distribution": freshness_dist,
            "quality_trends": quality_trends,
            "spoilage_trends": spoilage_trends,
            "inspection_activity": inspection_activity,
            "category_breakdown": category_breakdown,
        }

    @classmethod
    def get_alerts(cls, status_filter: str = "all") -> List[Dict[str, Any]]:
        alerts_col = get_alerts_collection()
        if alerts_col is None:
            return []

        query = {}
        if status_filter != "all":
            query["status"] = status_filter

        cursor = alerts_col.find(query).sort("created_at", -1).limit(50)
        alerts_list = []
        for a in cursor:
            c_at = a.get("created_at")
            alerts_list.append({
                "id": str(a.get("_id")),
                "item_name": a.get("item_name", "Unknown Item"),
                "inspection_id": a.get("inspection_id"),
                "alert_type": a.get("alert_type", "Quality Alert"),
                "severity": a.get("severity", "medium"),
                "message": a.get("message", ""),
                "status": a.get("status", "active"),
                "resolution_notes": a.get("resolution_notes"),
                "created_at": c_at.isoformat() if isinstance(c_at, datetime) else str(c_at or ""),
            })
        return alerts_list

    @classmethod
    def resolve_alert(cls, alert_id: str, data: AlertResolveRequest, current_user: Dict[str, Any]) -> Dict[str, Any]:
        alerts_col = get_alerts_collection()
        if alerts_col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        try:
            oid = ObjectId(alert_id)
            alert = alerts_col.find_one({"_id": oid})
        except Exception:
            alert = alerts_col.find_one({"_id": alert_id})

        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")

        now = datetime.now(timezone.utc)
        alerts_col.update_one(
            {"_id": alert["_id"]},
            {"$set": {
                "status": "resolved",
                "resolution_notes": data.resolution_notes or "Resolved by Quality Inspector",
                "action_taken": data.action_taken or "Corrective action executed",
                "resolved_by": current_user.get("name", "Quality Inspector"),
                "resolved_at": now,
            }}
        )

        updated = alerts_col.find_one({"_id": alert["_id"]})
        return {
            "id": str(updated["_id"]),
            "status": "resolved",
            "message": "Quality alert resolved successfully.",
            "resolution_notes": updated.get("resolution_notes"),
        }

    @classmethod
    def get_storage_condition_review(
        cls,
        category: str,
        current_temperature: Optional[float] = None,
        current_humidity: Optional[float] = None
    ) -> Dict[str, Any]:
        rec = RECOMMENDED_STORAGE.get(category, RECOMMENDED_STORAGE[FoodCategory.OTHER.value])
        
        status_eval = "Normal"
        violations = []

        if current_temperature is not None:
            if current_temperature > rec["max_temp"]:
                status_eval = "Temperature Violation"
                violations.append(f"Temperature (+{current_temperature}°C) is above maximum permissible (+{rec['max_temp']}°C).")
            elif current_temperature < rec["min_temp"]:
                status_eval = "Temperature Violation"
                violations.append(f"Temperature ({current_temperature}°C) is below minimum safe threshold ({rec['min_temp']}°C).")

        if current_humidity is not None:
            if current_humidity < rec["min_rh"]:
                violations.append(f"Humidity ({current_humidity}%) is too low; causes moisture loss and surface wrinkling.")
            elif current_humidity > rec["max_rh"]:
                violations.append(f"Humidity ({current_humidity}%) exceeds upper dew point; risk of surface condensation and mold.")

        return {
            "category": category,
            "current_temperature": current_temperature,
            "current_humidity": current_humidity,
            "recommended_temperature": rec["optimal_temp"],
            "permitted_temp_min": rec["min_temp"],
            "permitted_temp_max": rec["max_temp"],
            "recommended_humidity": rec["optimal_rh"],
            "permitted_humidity_min": rec["min_rh"],
            "permitted_humidity_max": rec["max_rh"],
            "status": status_eval,
            "violations": violations,
            "action_advice": "Maintain temperature within permissible bounds to prevent Arrhenius degradation acceleration."
        }

    @classmethod
    def export_csv(cls) -> StreamingResponse:
        col = get_food_inspections_collection()
        if col is None:
            raise HTTPException(status_code=503, detail="Database service unavailable.")

        docs = list(col.find({}).sort("created_at", -1))

        output = io.StringIO()
        writer = csv.writer(output)

        # Write CSV Header
        writer.writerow([
            "Inspection ID",
            "Product Name",
            "Category",
            "Batch Number",
            "Inspector Name",
            "AI Classification",
            "Quality Score",
            "Confidence (%)",
            "Spoilage Risk",
            "Shelf Life (Days)",
            "Storage Temp (°C)",
            "Storage Humidity (%)",
            "Storage Status",
            "Inspector Decision",
            "Issue Type",
            "Severity",
            "Inspector Reason",
            "Inspection Status",
            "Date",
        ])

        for d in docs:
            ai = d.get("ai_result") or {}
            st = d.get("storage_review") or {}
            rev = d.get("inspector_review") or {}
            c_at = d.get("created_at")
            date_str = c_at.strftime("%Y-%m-%d %H:%M") if isinstance(c_at, datetime) else str(c_at or "")

            writer.writerow([
                d.get("inspection_id", ""),
                d.get("product_name", ""),
                d.get("category", ""),
                d.get("batch_number", "N/A"),
                d.get("inspector_name", ""),
                ai.get("classification", "Not Analyzed"),
                ai.get("quality_score", 0),
                round(float(ai.get("confidence", 0)) * 100, 1),
                ai.get("spoilage_risk", "Low"),
                ai.get("estimated_shelf_life_days", 0),
                st.get("current_temperature", "N/A"),
                st.get("current_humidity", "N/A"),
                st.get("status", "Normal"),
                rev.get("decision", "Pending"),
                rev.get("issue_type", "None"),
                rev.get("severity", "None"),
                rev.get("reason", ""),
                d.get("status", "Pending"),
                date_str,
            ])

        output.seek(0)
        timestamp = date.today().strftime("%Y%m%d")
        filename = f"food_quality_inspections_{timestamp}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
