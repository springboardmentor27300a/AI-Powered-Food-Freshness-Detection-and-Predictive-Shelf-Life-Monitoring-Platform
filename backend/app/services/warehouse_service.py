"""
Warehouse and Cold-Chain Storage Service.
Manages storage zones, authoritative server-side temperature rules,
hardware controller communication, telemetry history, and safety audit trails.
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException, status
from bson import ObjectId

from backend.app.database import (
    get_storage_zones_collection,
    get_storage_readings_collection,
    get_temperature_rules_collection,
    get_temperature_commands_collection,
    get_alerts_collection,
    get_inventory_collection,
    get_audit_logs_collection,
)
from backend.app.services.equipment_service import get_equipment_adapter
from backend.app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


# Default authoritative temperature rules based on FDA Food Code 2022, Codex Alimentarius, and USDA
DEFAULT_TEMPERATURE_RULES = [
    {
        "rule_id": "RULE-DAIRY-MILK",
        "category": "Dairy",
        "product_name": "Pasteurized Whole Milk",
        "min_temperature": 0.0,
        "max_temperature": 4.0,
        "target_temperature": 3.0,
        "min_humidity": 50.0,
        "max_humidity": 75.0,
        "regulatory_source": "FDA Food Code 2022 §3-501.16 (TCS Cold Holding at or below 4°C / 41°F)",
        "notes": "Critical cold-chain threshold. Bacterial kinetic rate increases significantly above 4.0°C.",
    },
    {
        "rule_id": "RULE-DAIRY-BUTTER",
        "category": "Dairy",
        "product_name": "Artisan Butter & Cream",
        "min_temperature": 1.0,
        "max_temperature": 4.5,
        "target_temperature": 3.5,
        "min_humidity": 50.0,
        "max_humidity": 70.0,
        "regulatory_source": "Codex Alimentarius Standard for Butter (CXS 279-1971)",
        "notes": "Prevents lipid auto-oxidation and crystalline phase disruption.",
    },
    {
        "rule_id": "RULE-DAIRY-CHEESE",
        "category": "Dairy",
        "product_name": "Aged Hard Cheeses",
        "min_temperature": 2.0,
        "max_temperature": 6.0,
        "target_temperature": 4.0,
        "min_humidity": 70.0,
        "max_humidity": 85.0,
        "regulatory_source": "USDA Dairy Guidelines & Codex CXS 283-1978",
        "notes": "Requires controlled relative humidity to prevent case hardening.",
    },
    {
        "rule_id": "RULE-DAIRY-YOGURT",
        "category": "Dairy",
        "product_name": "Greek Yogurt / Cultured Dairy",
        "min_temperature": 0.5,
        "max_temperature": 4.0,
        "target_temperature": 3.0,
        "min_humidity": 55.0,
        "max_humidity": 75.0,
        "regulatory_source": "Grade 'A' Pasteurized Milk Ordinance (PMO) 2019",
        "notes": "Maintains probiotic starter culture viability while suppressing spoilage yeasts.",
    },
    {
        "rule_id": "RULE-FREEZER-SEAFOOD",
        "category": "Frozen",
        "product_name": "Frozen Seafood & Poultry",
        "min_temperature": -24.0,
        "max_temperature": -15.0,
        "target_temperature": -18.0,
        "min_humidity": 80.0,
        "max_humidity": 90.0,
        "regulatory_source": "Codex Code of Practice for Fish and Fishery Products (CXC 52-2003)",
        "notes": "Subzero storage suppresses enzymatic lipid rancidity.",
    },
    {
        "rule_id": "RULE-PRODUCE-LEAFY",
        "category": "Fruits & Vegetables",
        "product_name": "Hydroponic Greens & Apples",
        "min_temperature": 1.0,
        "max_temperature": 6.0,
        "target_temperature": 4.0,
        "min_humidity": 85.0,
        "max_humidity": 95.0,
        "regulatory_source": "UC Davis Postharvest Technology Center Perishable Handling Guidelines",
        "notes": "Requires high relative humidity to minimize transpiration mass loss.",
    },
    {
        "rule_id": "RULE-AMBIENT-GRAINS",
        "category": "Bakery & Dry Goods",
        "product_name": "Flour, Bakery & Dry Pulses",
        "min_temperature": 15.0,
        "max_temperature": 24.0,
        "target_temperature": 18.0,
        "min_humidity": 40.0,
        "max_humidity": 60.0,
        "regulatory_source": "ISO 6322 Storage of Cereals and Pulses",
        "notes": "Low humidity prevents fungal spore germination and weevil proliferation.",
    },
]

# Baseline Storage Zones
DEFAULT_STORAGE_ZONES = [
    {
        "zone_id": "ZONE-COLD-B-DAIRY",
        "name": "Chamber B - Dairy & Deli Cold Room",
        "category": "Dairy",
        "target_temperature": 3.0,
        "target_humidity": 78.0,
        "permitted_temp_min": 0.0,
        "permitted_temp_max": 4.0,
        "permitted_humidity_min": 50.0,
        "permitted_humidity_max": 85.0,
        "current_temperature": 3.8,
        "current_humidity": 76.5,
        "sensor_status": "online",
        "equipment_status": "CONNECTED",
        "controller_type": "VIRTUAL_PLC",
        "controller_endpoint": "modbus://192.168.10.52:502/chB_dairy",
        "controller_model": "Honeywell CIP-8000 Industrial Cold Controller",
        "regulatory_source": "FDA Food Code 2022 §3-501.16",
        "capacity_limit": 6000.0,
        "capacity_used": 4200.0,
        "capacity_unit": "kg",
        "status": "Optimal",
    },
    {
        "zone_id": "ZONE-FREEZER-A",
        "name": "Chamber A - Subzero Deep Freeze",
        "category": "Frozen",
        "target_temperature": -18.0,
        "target_humidity": 86.0,
        "permitted_temp_min": -24.0,
        "permitted_temp_max": -15.0,
        "permitted_humidity_min": 80.0,
        "permitted_humidity_max": 95.0,
        "current_temperature": -18.2,
        "current_humidity": 85.4,
        "sensor_status": "online",
        "equipment_status": "CONNECTED",
        "controller_type": "VIRTUAL_PLC",
        "controller_endpoint": "modbus://192.168.10.51:502/chA_freeze",
        "controller_model": "Siemens Simatic S7-1200 Cold Chain Unit",
        "regulatory_source": "Codex Alimentarius CXC 52-2003",
        "capacity_limit": 10000.0,
        "capacity_used": 7800.0,
        "capacity_unit": "kg",
        "status": "Optimal",
    },
    {
        "zone_id": "ZONE-PRODUCE-C",
        "name": "Chamber C - Controlled Atmosphere Produce Bay",
        "category": "Fruits & Vegetables",
        "target_temperature": 4.0,
        "target_humidity": 90.0,
        "permitted_temp_min": 1.0,
        "permitted_temp_max": 6.0,
        "permitted_humidity_min": 80.0,
        "permitted_humidity_max": 96.0,
        "current_temperature": 4.3,
        "current_humidity": 91.2,
        "sensor_status": "online",
        "equipment_status": "CONNECTED",
        "controller_type": "VIRTUAL_PLC",
        "controller_endpoint": "modbus://192.168.10.53:502/chC_produce",
        "controller_model": "Emerson E2 Climate & Ethylene Scrubber",
        "regulatory_source": "UC Davis Postharvest Handling Guide",
        "capacity_limit": 8000.0,
        "capacity_used": 5200.0,
        "capacity_unit": "kg",
        "status": "Optimal",
    },
    {
        "zone_id": "ZONE-AMBIENT-D",
        "name": "Chamber D - Ambient Intake & Dry Staging Bay",
        "category": "Bakery & Dry Goods",
        "target_temperature": 18.0,
        "target_humidity": 55.0,
        "permitted_temp_min": 15.0,
        "permitted_temp_max": 24.0,
        "permitted_humidity_min": 40.0,
        "permitted_humidity_max": 65.0,
        "current_temperature": 19.1,
        "current_humidity": 54.0,
        "sensor_status": "online",
        "equipment_status": "OFFLINE",
        "controller_type": "OFFLINE",
        "controller_endpoint": "modbus://192.168.10.54:502/chD_ambient (Unreachable)",
        "controller_model": "Legacy Ambient Loop Controller (Disconnected)",
        "regulatory_source": "ISO 6322 Storage Standards",
        "capacity_limit": 12000.0,
        "capacity_used": 4500.0,
        "capacity_unit": "kg",
        "status": "Offline",
    },
]


class WarehouseService:
    @staticmethod
    def ensure_defaults():
        """Ensure default rules, zones, and baseline telemetry exist in MongoDB."""
        now = datetime.now(timezone.utc)

        # 1. Rules
        rules_col = get_temperature_rules_collection()
        if rules_col is not None and rules_col.count_documents({}) == 0:
            for r in DEFAULT_TEMPERATURE_RULES:
                doc = {**r, "created_at": now, "updated_at": now}
                rules_col.insert_one(doc)
            logger.info("Initialized authoritative temperature rules in MongoDB.")

        # 2. Zones
        zones_col = get_storage_zones_collection()
        if zones_col is not None and zones_col.count_documents({}) == 0:
            for z in DEFAULT_STORAGE_ZONES:
                doc = {**z, "created_at": now, "updated_at": now}
                zones_col.insert_one(doc)
            logger.info("Initialized default storage zones in MongoDB.")

        # 3. Baseline Readings
        readings_col = get_storage_readings_collection()
        if readings_col is not None and readings_col.count_documents({}) == 0:
            for z in DEFAULT_STORAGE_ZONES:
                base_t = z["target_temperature"]
                base_h = z["target_humidity"]
                zid = z["zone_id"]
                # Create 24 hours of sample hourly readings
                samples = []
                for h in range(24, 0, -1):
                    reading_time = now - timedelta(hours=h)
                    # small natural variance
                    variance_t = ((h % 5) - 2) * 0.15
                    variance_h = ((h % 4) - 2) * 0.8
                    samples.append({
                        "reading_id": f"RDG-{zid}-{h}",
                        "zone_id": zid,
                        "temperature": round(base_t + variance_t, 1),
                        "humidity": round(base_h + variance_h, 1),
                        "ethylene_ppm": 0.2 if "PRODUCE" not in zid else 1.2,
                        "sensor_id": f"SENSOR-{zid}-01",
                        "sensor_status": "online" if z["equipment_status"] != "OFFLINE" else "degraded",
                        "is_violation": False,
                        "recorded_at": reading_time,
                    })
                if samples:
                    readings_col.insert_many(samples)
            logger.info("Initialized baseline storage telemetry readings in MongoDB.")

    @staticmethod
    def get_stored_products_for_zone(zone_id: str, category: str) -> List[Dict[str, Any]]:
        """
        Retrieve products stored in this zone with product-specific permitted ranges.
        Inspects live inventory and merges with authoritative temperature rules.
        """
        WarehouseService.ensure_defaults()
        rules_col = get_temperature_rules_collection()
        inv_col = get_inventory_collection()

        # Find rules matching category
        cat_rules = list(rules_col.find({"category": category})) if rules_col is not None else []
        if not cat_rules and "dairy" in category.lower():
            cat_rules = list(rules_col.find({"category": "Dairy"}))

        products = []
        for r in cat_rules:
            # Check if there are real inventory items for this product name/category
            inv_count = 0
            latest_shelf_life = 7.0
            freshness_score = 92.0
            batch = "BATCH-STD-01"

            if inv_col is not None:
                match = inv_col.find_one({"category": r["category"], "food_name": {"$regex": r.get("product_name", ""), "$options": "i"}})
                if match:
                    freshness_score = match.get("freshness_score") or 88.0
                    batch = match.get("batch_number", "BATCH-INV-2026")

            products.append({
                "product_name": r.get("product_name") or f"{r['category']} Standard",
                "category": r["category"],
                "permitted_temp_min": r["min_temperature"],
                "permitted_temp_max": r["max_temperature"],
                "target_temperature": r["target_temperature"],
                "regulatory_source": r["regulatory_source"],
                "notes": r.get("notes"),
                "batch_number": batch,
                "current_freshness_score": freshness_score,
                "estimated_shelf_life_days": latest_shelf_life,
            })

        return products

    @staticmethod
    def get_all_zones() -> List[Dict[str, Any]]:
        """Retrieve all storage zones with attached products and live telemetry."""
        WarehouseService.ensure_defaults()
        zones_col = get_storage_zones_collection()
        readings_col = get_storage_readings_collection()

        raw_zones = list(zones_col.find({})) if zones_col is not None else []
        output = []

        for z in raw_zones:
            zid = z["zone_id"]
            # get latest reading
            latest_rdg = None
            if readings_col is not None:
                latest_rdg = readings_col.find_one({"zone_id": zid}, sort=[("recorded_at", -1)])

            curr_temp = latest_rdg["temperature"] if latest_rdg else z.get("current_temperature", z["target_temperature"])
            curr_hum = latest_rdg["humidity"] if latest_rdg else z.get("current_humidity", z["target_humidity"])

            stored_products = WarehouseService.get_stored_products_for_zone(zid, z["category"])

            output.append({
                "zone_id": zid,
                "name": z["name"],
                "category": z["category"],
                "target_temperature": z["target_temperature"],
                "target_humidity": z["target_humidity"],
                "permitted_temp_min": z["permitted_temp_min"],
                "permitted_temp_max": z["permitted_temp_max"],
                "permitted_humidity_min": z["permitted_humidity_min"],
                "permitted_humidity_max": z["permitted_humidity_max"],
                "current_temperature": curr_temp,
                "current_humidity": curr_hum,
                "sensor_status": z.get("sensor_status", "online"),
                "equipment_status": z.get("equipment_status", "CONNECTED"),
                "controller_type": z.get("controller_type", "VIRTUAL_PLC"),
                "controller_endpoint": z.get("controller_endpoint"),
                "controller_model": z.get("controller_model"),
                "controller_last_ack": z.get("controller_last_ack"),
                "regulatory_source": z.get("regulatory_source", "FDA Food Safety Modernization Act"),
                "capacity_limit": z.get("capacity_limit", 5000.0),
                "capacity_used": z.get("capacity_used", 3000.0),
                "capacity_unit": z.get("capacity_unit", "kg"),
                "status": z.get("status", "Optimal"),
                "stored_products": stored_products,
                "created_at": z.get("created_at"),
                "updated_at": z.get("updated_at"),
            })

        return output

    @staticmethod
    def get_zone_by_id(zone_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full details for a specific storage zone."""
        WarehouseService.ensure_defaults()
        zones_col = get_storage_zones_collection()
        readings_col = get_storage_readings_collection()

        z = zones_col.find_one({"zone_id": zone_id}) if zones_col is not None else None
        if not z:
            return None

        latest_rdg = None
        if readings_col is not None:
            latest_rdg = readings_col.find_one({"zone_id": zone_id}, sort=[("recorded_at", -1)])

        curr_temp = latest_rdg["temperature"] if latest_rdg else z.get("current_temperature", z["target_temperature"])
        curr_hum = latest_rdg["humidity"] if latest_rdg else z.get("current_humidity", z["target_humidity"])

        stored_products = WarehouseService.get_stored_products_for_zone(zone_id, z["category"])

        return {
            "zone_id": z["zone_id"],
            "name": z["name"],
            "category": z["category"],
            "target_temperature": z["target_temperature"],
            "target_humidity": z["target_humidity"],
            "permitted_temp_min": z["permitted_temp_min"],
            "permitted_temp_max": z["permitted_temp_max"],
            "permitted_humidity_min": z["permitted_humidity_min"],
            "permitted_humidity_max": z["permitted_humidity_max"],
            "current_temperature": curr_temp,
            "current_humidity": curr_hum,
            "sensor_status": z.get("sensor_status", "online"),
            "equipment_status": z.get("equipment_status", "CONNECTED"),
            "controller_type": z.get("controller_type", "VIRTUAL_PLC"),
            "controller_endpoint": z.get("controller_endpoint"),
            "controller_model": z.get("controller_model"),
            "controller_last_ack": z.get("controller_last_ack"),
            "regulatory_source": z.get("regulatory_source", "FDA Food Safety Modernization Act"),
            "capacity_limit": z.get("capacity_limit", 5000.0),
            "capacity_used": z.get("capacity_used", 3000.0),
            "capacity_unit": z.get("capacity_unit", "kg"),
            "status": z.get("status", "Optimal"),
            "stored_products": stored_products,
            "created_at": z.get("created_at"),
            "updated_at": z.get("updated_at"),
        }

    @staticmethod
    def get_zone_temperature_telemetry(zone_id: str) -> Dict[str, Any]:
        """
        Get live temperature readings, target setpoint, permitted range,
        and controller equipment status for a zone.
        """
        zone = WarehouseService.get_zone_by_id(zone_id)
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storage zone '{zone_id}' not found.",
            )

        readings_col = get_storage_readings_collection()
        recent_readings = []
        if readings_col is not None:
            cursor = readings_col.find({"zone_id": zone_id}).sort("recorded_at", -1).limit(10)
            for r in cursor:
                recent_readings.append({
                    "reading_id": r.get("reading_id"),
                    "temperature": r["temperature"],
                    "humidity": r["humidity"],
                    "sensor_status": r.get("sensor_status", "online"),
                    "recorded_at": r["recorded_at"].isoformat() if isinstance(r["recorded_at"], datetime) else str(r["recorded_at"]),
                })

        # Fetch active alerts for this zone
        alerts_col = get_alerts_collection()
        active_alerts = []
        if alerts_col is not None:
            al_cursor = alerts_col.find({"$or": [{"zone_id": zone_id}, {"location": zone["name"]}], "status": "active"})
            for a in al_cursor:
                active_alerts.append({
                    "alert_id": str(a.get("_id")),
                    "alert_type": a.get("alert_type", "storage_warning"),
                    "severity": a.get("severity", "medium"),
                    "message": a.get("message", "Storage condition advisory"),
                    "created_at": a.get("created_at", datetime.now(timezone.utc)).isoformat() if isinstance(a.get("created_at"), datetime) else str(a.get("created_at")),
                })

        return {
            "zone_id": zone["zone_id"],
            "zone_name": zone["name"],
            "category": zone["category"],
            "current_target_temperature": zone["target_temperature"],
            "actual_measured_temperature": zone["current_temperature"],
            "current_measured_humidity": zone["current_humidity"],
            "permitted_temp_min": zone["permitted_temp_min"],
            "permitted_temp_max": zone["permitted_temp_max"],
            "permitted_humidity_min": zone["permitted_humidity_min"],
            "permitted_humidity_max": zone["permitted_humidity_max"],
            "regulatory_source": zone["regulatory_source"],
            "equipment_status": zone["equipment_status"],
            "controller_model": zone["controller_model"],
            "controller_endpoint": zone["controller_endpoint"],
            "controller_last_ack": zone["controller_last_ack"],
            "sensor_status": zone["sensor_status"],
            "stored_products": zone["stored_products"],
            "recent_readings": recent_readings,
            "active_alerts": active_alerts,
        }

    @staticmethod
    def get_zone_temperature_history(zone_id: str, hours: int = 24) -> Dict[str, Any]:
        """Retrieve telemetry time series for visualization."""
        zone = WarehouseService.get_zone_by_id(zone_id)
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storage zone '{zone_id}' not found.",
            )

        readings_col = get_storage_readings_collection()
        points = []
        if readings_col is not None:
            since = datetime.now(timezone.utc) - timedelta(hours=hours)
            cursor = readings_col.find(
                {"zone_id": zone_id, "recorded_at": {"$gte": since}}
            ).sort("recorded_at", 1)

            for r in cursor:
                t_stamp = r["recorded_at"].strftime("%H:%M") if isinstance(r["recorded_at"], datetime) else str(r["recorded_at"])
                points.append({
                    "timestamp": t_stamp,
                    "temperature": r["temperature"],
                    "humidity": r["humidity"],
                    "target_temp": zone["target_temperature"],
                    "min_temp": zone["permitted_temp_min"],
                    "max_temp": zone["permitted_temp_max"],
                    "sensor_status": r.get("sensor_status", "online"),
                })

        return {
            "zone_id": zone["zone_id"],
            "zone_name": zone["name"],
            "category": zone["category"],
            "current_temperature": zone["current_temperature"],
            "current_humidity": zone["current_humidity"],
            "target_temperature": zone["target_temperature"],
            "permitted_temp_min": zone["permitted_temp_min"],
            "permitted_temp_max": zone["permitted_temp_max"],
            "regulatory_source": zone["regulatory_source"],
            "equipment_status": zone["equipment_status"],
            "points": points,
        }

    @staticmethod
    def validate_target_temperature(
        zone_doc: Dict[str, Any], requested_target: float
    ) -> Tuple[bool, float, float, str, str]:
        """
        Authoritative server-side validation against trusted product storage rules.
        Does NOT accept frontend-provided ranges.
        Ensures target satisfies ALL stored products in the zone.
        """
        WarehouseService.ensure_defaults()
        rules_col = get_temperature_rules_collection()

        category = zone_doc.get("category", "")
        zone_rules = list(rules_col.find({"category": category})) if rules_col is not None else []

        if not zone_rules:
            # Fall back to zone document baseline
            min_bound = zone_doc.get("permitted_temp_min", 0.0)
            max_bound = zone_doc.get("permitted_temp_max", 4.0)
            source = zone_doc.get("regulatory_source", "Platform Storage Policy")
            limiting_product = category
        else:
            # Most restrictive boundary among all products stored in this zone
            min_bound = max(r["min_temperature"] for r in zone_rules)
            max_bound = min(r["max_temperature"] for r in zone_rules)
            # Find which rule sets the max bound
            limiting_rule = next(r for r in zone_rules if r["max_temperature"] == max_bound)
            source = limiting_rule["regulatory_source"]
            limiting_product = limiting_rule.get("product_name", category)

        if requested_target < min_bound or requested_target > max_bound:
            err_msg = (
                f"Proposed target temperature of {requested_target:.1f}°C is outside the authoritative "
                f"permitted safety range of [{min_bound:.1f}°C to {max_bound:.1f}°C] for {limiting_product} "
                f"mandated by {source}. Adjustment rejected to prevent food spoilage or freezing damage."
            )
            return False, min_bound, max_bound, source, err_msg

        return True, min_bound, max_bound, source, ""

    @staticmethod
    async def execute_temperature_command(
        zone_id: str,
        operator_user: Dict[str, Any],
        requested_target: float,
        reason: str,
        force_override: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes the safe temperature adjustment workflow with hardware ACK verification,
        auditing, and offline fallback.
        """
        WarehouseService.ensure_defaults()
        zones_col = get_storage_zones_collection()
        commands_col = get_temperature_commands_collection()
        readings_col = get_storage_readings_collection()

        zone = zones_col.find_one({"zone_id": zone_id}) if zones_col is not None else None
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storage zone '{zone_id}' not found.",
            )

        # 1. Authoritative Server-Side Rule Validation
        is_valid, min_allowed, max_allowed, source, err_msg = WarehouseService.validate_target_temperature(
            zone, requested_target
        )

        if not is_valid and not force_override:
            logger.warning(
                "Temperature adjustment rejected for zone %s: %s",
                zone_id,
                err_msg,
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "Permitted Temperature Range Violation",
                    "requested_target": requested_target,
                    "permitted_temp_min": min_allowed,
                    "permitted_temp_max": max_allowed,
                    "regulatory_source": source,
                    "message": err_msg,
                },
            )

        now = datetime.now(timezone.utc)
        cmd_id = f"CMD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        prev_target = zone.get("target_temperature", 3.0)

        # 2. Record initial command in Pending state
        command_doc = {
            "command_id": cmd_id,
            "zone_id": zone_id,
            "zone_name": zone["name"],
            "operator_id": str(operator_user.get("_id", "")),
            "operator_email": operator_user.get("email", "unknown@foodfresh.com"),
            "operator_role": operator_user.get("role", "Warehouse Operator"),
            "previous_target": prev_target,
            "requested_target": requested_target,
            "reason": reason,
            "status": "Pending",
            "applied_to_hardware": False,
            "controller_response": None,
            "created_at": now,
            "updated_at": now,
        }
        if commands_col is not None:
            commands_col.insert_one(command_doc)

        # 3. Transmit through Equipment Adapter
        adapter = get_equipment_adapter(zone)
        controller_result = await adapter.transmit_setpoint(zone_id, requested_target, zone)

        status_outcome = controller_result["status"]
        applied_hardware = controller_result["applied_to_hardware"]

        # 4. Update zone configuration in database
        update_fields = {
            "target_temperature": requested_target,
            "updated_at": now,
        }
        if applied_hardware:
            update_fields["controller_last_ack"] = now

        zones_col.update_one({"zone_id": zone_id}, {"$set": update_fields})

        # 5. Insert telemetry reading with new target
        if readings_col is not None:
            readings_col.insert_one({
                "reading_id": f"RDG-{cmd_id}",
                "zone_id": zone_id,
                "temperature": zone.get("current_temperature", requested_target),
                "humidity": zone.get("current_humidity", zone.get("target_humidity", 75.0)),
                "ethylene_ppm": 0.2,
                "sensor_id": f"SENSOR-{zone_id}-01",
                "sensor_status": "online" if zone.get("equipment_status") != "OFFLINE" else "degraded",
                "is_violation": False,
                "recorded_at": now,
            })

        # 6. Update command record with final result
        if commands_col is not None:
            commands_col.update_one(
                {"command_id": cmd_id},
                {
                    "$set": {
                        "status": status_outcome,
                        "applied_to_hardware": applied_hardware,
                        "controller_response": controller_result,
                        "updated_at": now,
                    }
                },
            )

        # 7. Record Immutable Audit Log
        AuditService.log_event(
            action="WAREHOUSE_TEMPERATURE_SETPOINT_UPDATE",
            actor_id=str(operator_user.get("_id", "")),
            actor_email=operator_user.get("email"),
            actor_role=operator_user.get("role"),
            target_resource=f"storage_zone:{zone_id}",
            previous_value={"target_temperature": prev_target},
            new_value={"target_temperature": requested_target},
            status="success" if applied_hardware else "software_saved_hardware_offline",
            metadata={
                "command_id": cmd_id,
                "zone_name": zone["name"],
                "reason": reason,
                "applied_to_hardware": applied_hardware,
                "lifecycle_state": status_outcome,
                "regulatory_source": source,
                "modbus_packet": controller_result.get("modbus_packet"),
            },
        )

        return {
            "command_id": cmd_id,
            "zone_id": zone_id,
            "zone_name": zone["name"],
            "previous_target": prev_target,
            "requested_target": requested_target,
            "status": status_outcome,
            "applied_to_hardware": applied_hardware,
            "reason": reason,
            "operator_email": operator_user.get("email", ""),
            "operator_role": operator_user.get("role", ""),
            "controller_response": controller_result,
            "message": controller_result["message"],
            "created_at": now,
        }

    @staticmethod
    def get_command_by_id(command_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single temperature adjustment command by ID."""
        WarehouseService.ensure_defaults()
        commands_col = get_temperature_commands_collection()
        cmd = commands_col.find_one({"command_id": command_id}) if commands_col is not None else None
        if not cmd:
            return None
        return {
            "command_id": cmd["command_id"],
            "zone_id": cmd["zone_id"],
            "zone_name": cmd["zone_name"],
            "previous_target": cmd["previous_target"],
            "requested_target": cmd["requested_target"],
            "status": cmd["status"],
            "applied_to_hardware": cmd["applied_to_hardware"],
            "reason": cmd["reason"],
            "operator_email": cmd["operator_email"],
            "operator_role": cmd["operator_role"],
            "controller_response": cmd.get("controller_response"),
            "message": cmd.get("controller_response", {}).get("message", f"Command status: {cmd['status']}"),
            "created_at": cmd["created_at"],
        }

    @staticmethod
    def get_alerts(zone_id: Optional[str] = None, severity: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve active storage and environmental alerts."""
        WarehouseService.ensure_defaults()
        alerts_col = get_alerts_collection()
        query: Dict[str, Any] = {}
        if zone_id:
            query["zone_id"] = zone_id
        if severity:
            query["severity"] = severity

        results = []
        if alerts_col is not None:
            cursor = alerts_col.find(query).sort("created_at", -1).limit(50)
            for a in cursor:
                results.append({
                    "alert_id": str(a.get("_id")),
                    "zone_id": a.get("zone_id"),
                    "zone_name": a.get("zone_name") or a.get("location"),
                    "item_name": a.get("item_name"),
                    "alert_type": a.get("alert_type", "storage_alert"),
                    "severity": a.get("severity", "medium"),
                    "message": a.get("message", "Environmental condition advisory"),
                    "status": a.get("status", "active"),
                    "created_at": a.get("created_at", datetime.now(timezone.utc)),
                })

        # If empty, provide seeded active storage alert
        if not results:
            now = datetime.now(timezone.utc)
            results.append({
                "alert_id": "AL-ZONE-WARM-01",
                "zone_id": "ZONE-COLD-B-DAIRY",
                "zone_name": "Chamber B - Dairy & Deli Cold Room",
                "item_name": "Pasteurized Whole Milk",
                "alert_type": "temperature_advisory",
                "severity": "low",
                "message": "Defrost cycle active in Chamber B: Temperature elevated slightly to +3.8°C (Remains within safe 4.0°C FDA limit).",
                "status": "active",
                "created_at": now - timedelta(minutes=25),
            })

        return results

    @staticmethod
    def get_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve audit log entries for warehouse and temperature adjustment operations."""
        WarehouseService.ensure_defaults()
        audit_col = get_audit_logs_collection()
        logs = []

        if audit_col is not None:
            cursor = audit_col.find(
                {"$or": [
                    {"action": {"$regex": "TEMPERATURE|WAREHOUSE|STORAGE", "$options": "i"}},
                    {"target_resource": {"$regex": "storage_zone", "$options": "i"}},
                ]}
            ).sort("timestamp", -1).limit(limit)

            for l in cursor:
                logs.append({
                    "log_id": str(l.get("_id")),
                    "timestamp": l.get("timestamp", datetime.now(timezone.utc)),
                    "actor_email": l.get("actor_email", "system"),
                    "actor_role": l.get("actor_role", "System"),
                    "action": l.get("action", "TEMPERATURE_SETPOINT_UPDATE"),
                    "target_resource": l.get("target_resource", "storage_zone"),
                    "status": l.get("status", "success"),
                    "metadata": l.get("metadata", {}),
                })

        return logs
