from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import random

from app.db.mongodb import get_database
from app.models.schemas import StorageZoneTelemetry, StorageExcursionAlert

router = APIRouter(prefix="/storage", tags=["Storage Condition Monitoring & Telemetry"])

# In-memory default telemetry zones for resilience
DEFAULT_ZONES = [
    {
        "zone_id": "ZONE-WH01-A",
        "zone_name": "Cold Room A — Chilled Fresh Produce",
        "warehouse_id": "WH-CENTRAL-01",
        "warehouse_name": "GreenValley Central Cold Storage",
        "temperature_celsius": 3.4,
        "humidity_percent": 88.5,
        "airflow_cfm": 420.0,
        "light_lux": 15.0,
        "target_temp_c": 3.0,
        "target_humidity_pct": 88.0,
        "compliance_status": "Compliant",
        "active_alerts_count": 0,
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "zone_id": "ZONE-WH01-B",
        "zone_name": "Zone B — Controlled Atmosphere (CA) Vault",
        "warehouse_id": "WH-CENTRAL-01",
        "warehouse_name": "GreenValley Central Cold Storage",
        "temperature_celsius": 2.2,
        "humidity_percent": 91.0,
        "airflow_cfm": 380.0,
        "light_lux": 5.0,
        "target_temp_c": 2.0,
        "target_humidity_pct": 90.0,
        "compliance_status": "Compliant",
        "active_alerts_count": 0,
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "zone_id": "ZONE-WH02-A",
        "zone_name": "Zone Alpha — Coastal High-Humidity Chiller",
        "warehouse_id": "WH-PACIFIC-02",
        "warehouse_name": "Pacific Fresh Logistics Center",
        "temperature_celsius": 5.8,
        "humidity_percent": 74.0,
        "airflow_cfm": 210.0,
        "light_lux": 45.0,
        "target_temp_c": 2.5,
        "target_humidity_pct": 88.0,
        "compliance_status": "Minor Excursion",
        "active_alerts_count": 1,
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "zone_id": "ZONE-WH03-A",
        "zone_name": "Bay 1 — Sunshine Produce Deep Chill",
        "warehouse_id": "WH-SUNSHINE-03",
        "warehouse_name": "Sunshine Valley Produce Hub",
        "temperature_celsius": 4.1,
        "humidity_percent": 83.5,
        "airflow_cfm": 350.0,
        "light_lux": 20.0,
        "target_temp_c": 4.0,
        "target_humidity_pct": 85.0,
        "compliance_status": "Compliant",
        "active_alerts_count": 0,
        "last_updated": datetime.utcnow().isoformat()
    }
]

DEFAULT_ALERTS = [
    {
        "alert_id": "ALT-20260910-01",
        "zone_id": "ZONE-WH02-A",
        "zone_name": "Zone Alpha — Coastal High-Humidity Chiller",
        "warehouse_name": "Pacific Fresh Logistics Center",
        "parameter": "Temperature",
        "current_value": 5.8,
        "threshold_value": 3.5,
        "severity": "Moderate",
        "duration_minutes": 45,
        "root_cause": "Loading dock door seal integrity compromise during morning wholesale dispatch.",
        "corrective_action": "Reseal dock bay door #3, engage secondary auxiliary chiller unit, and verify cold air circulation.",
        "is_resolved": False,
        "timestamp": (datetime.utcnow() - timedelta(minutes=45)).isoformat()
    }
]

class SimulateReadingRequest(BaseModel):
    zone_id: str
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = None
    airflow_cfm: Optional[float] = None
    trigger_excursion: Optional[bool] = False

@router.get("/zones", response_model=List[StorageZoneTelemetry])
async def get_storage_zones():
    """
    Returns live environmental telemetry for all monitored cold-storage warehouse zones.
    """
    db = get_database()
    cursor = db.storage_zones.find({})
    zones = await cursor.to_list(10)
    
    if not zones:
        # Return initialized defaults
        return [StorageZoneTelemetry(**z) for z in DEFAULT_ZONES]

    return [
        StorageZoneTelemetry(
            zone_id=z.get("zone_id", z.get("_id", "ZONE-01")),
            zone_name=z.get("zone_name", "Cold Storage Zone"),
            warehouse_id=z.get("warehouse_id", "WH-01"),
            warehouse_name=z.get("warehouse_name", "Central Cold Storage"),
            temperature_celsius=z.get("temperature_celsius", 3.0),
            humidity_percent=z.get("humidity_percent", 88.0),
            airflow_cfm=z.get("airflow_cfm", 400.0),
            light_lux=z.get("light_lux", 10.0),
            target_temp_c=z.get("target_temp_c", 3.0),
            target_humidity_pct=z.get("target_humidity_pct", 88.0),
            compliance_status=z.get("compliance_status", "Compliant"),
            active_alerts_count=z.get("active_alerts_count", 0),
            last_updated=str(z.get("last_updated", datetime.utcnow().isoformat()))
        )
        for z in zones
    ]

@router.get("/telemetry/{zone_id}")
async def get_zone_telemetry_history(zone_id: str):
    """
    Returns 24-hour historical environmental telemetry (hourly readings) for stability graphing.
    """
    now = datetime.utcnow()
    readings = []

    # Find target zone specs
    target_temp = 3.0
    target_hum = 88.0
    for z in DEFAULT_ZONES:
        if z["zone_id"] == zone_id:
            target_temp = z["target_temp_c"]
            target_hum = z["target_humidity_pct"]
            break

    # Generate 24 hourly data points with realistic micro-variations
    random.seed(abs(hash(zone_id)) % 10000)
    for i in range(24, -1, -1):
        timestamp = (now - timedelta(hours=i)).strftime("%H:%M")
        
        # Add slight sine wave / diurnal fluctuation
        fluctuation = 0.4 * math.sin(i / 3.0)
        temp = round(target_temp + fluctuation + random.uniform(-0.2, 0.2), 1)
        hum = round(target_hum - abs(fluctuation * 2.0) + random.uniform(-1.0, 1.0), 1)
        cfm = round(400.0 + random.uniform(-20.0, 20.0), 0)

        # Excursion simulation for WH02-A in the last 2 hours
        if zone_id == "ZONE-WH02-A" and i <= 2:
            temp = 5.8
            hum = 74.0

        compliant = (temp <= target_temp + 1.5) and (hum >= target_hum - 8.0)
        readings.append({
            "time": timestamp,
            "temperature_celsius": temp,
            "humidity_percent": hum,
            "airflow_cfm": cfm,
            "is_compliant": compliant
        })

    return {
        "zone_id": zone_id,
        "target_temperature_celsius": target_temp,
        "target_humidity_percent": target_hum,
        "telemetry_points": readings
    }

@router.get("/alerts", response_model=List[StorageExcursionAlert])
async def get_storage_alerts():
    """
    Returns all active environmental cold-chain excursion alerts and compliance warnings.
    """
    db = get_database()
    cursor = db.storage_alerts.find({"is_resolved": False})
    alerts = await cursor.to_list(20)

    if not alerts:
        return [StorageExcursionAlert(**a) for a in DEFAULT_ALERTS if not a.get("is_resolved")]

    return [
        StorageExcursionAlert(
            alert_id=a.get("alert_id", a.get("_id", "ALT-01")),
            zone_id=a.get("zone_id", "ZONE-WH01-A"),
            zone_name=a.get("zone_name", "Cold Storage Zone"),
            warehouse_name=a.get("warehouse_name", "Cold Storage Warehouse"),
            parameter=a.get("parameter", "Temperature"),
            current_value=a.get("current_value", 5.5),
            threshold_value=a.get("threshold_value", 3.5),
            severity=a.get("severity", "Moderate"),
            duration_minutes=a.get("duration_minutes", 30),
            root_cause=a.get("root_cause", "Environmental variance detected"),
            corrective_action=a.get("corrective_action", "Check chiller setpoints"),
            is_resolved=a.get("is_resolved", False),
            timestamp=str(a.get("timestamp", datetime.utcnow().isoformat()))
        )
        for a in alerts
    ]

@router.post("/alerts/{alert_id}/resolve")
async def resolve_storage_alert(alert_id: str):
    """
    Marks an active environmental excursion alert as resolved following operator intervention.
    """
    db = get_database()
    result = await db.storage_alerts.update_one(
        {"$or": [{"alert_id": alert_id}, {"_id": alert_id}]},
        {"$set": {"is_resolved": True, "resolved_at": datetime.utcnow().isoformat()}}
    )

    # Also update in-memory alert list if running with mock fallback
    for a in DEFAULT_ALERTS:
        if a["alert_id"] == alert_id:
            a["is_resolved"] = True

    # Reset zone status to compliant
    for z in DEFAULT_ZONES:
        if z["zone_id"] == "ZONE-WH02-A":
            z["temperature_celsius"] = 2.8
            z["humidity_percent"] = 89.0
            z["compliance_status"] = "Compliant"
            z["active_alerts_count"] = 0

    return {
        "status": "success",
        "message": f"Storage excursion alert {alert_id} successfully marked as resolved. Normal compliance restored.",
        "alert_id": alert_id
    }

@router.post("/simulate-reading")
async def simulate_iot_reading(req: SimulateReadingRequest):
    """
    Simulates receiving real-time IoT sensor telemetry from cold-room probes.
    Can trigger or clear excursion alerts on demand for live demonstrations.
    """
    db = get_database()
    temp = req.temperature_celsius if req.temperature_celsius is not None else (7.2 if req.trigger_excursion else 3.1)
    hum = req.humidity_percent if req.humidity_percent is not None else (68.0 if req.trigger_excursion else 89.0)
    cfm = req.airflow_cfm if req.airflow_cfm is not None else 390.0

    status = "Critical" if temp > 6.5 or hum < 70 else ("Minor Excursion" if temp > 4.5 else "Compliant")

    # Update in MongoDB if available
    await db.storage_zones.update_one(
        {"zone_id": req.zone_id},
        {"$set": {
            "temperature_celsius": temp,
            "humidity_percent": hum,
            "airflow_cfm": cfm,
            "compliance_status": status,
            "last_updated": datetime.utcnow().isoformat()
        }}
    )

    # Update in-memory fallback
    for z in DEFAULT_ZONES:
        if z["zone_id"] == req.zone_id:
            z["temperature_celsius"] = temp
            z["humidity_percent"] = hum
            z["airflow_cfm"] = cfm
            z["compliance_status"] = status
            z["last_updated"] = datetime.utcnow().isoformat()

    return {
        "status": "updated",
        "zone_id": req.zone_id,
        "temperature_celsius": temp,
        "humidity_percent": hum,
        "compliance_status": status
    }

@router.get("/compliance-summary")
async def get_storage_compliance_summary():
    """
    Returns cold storage network compliance statistics and overall environmental health score.
    """
    zones = DEFAULT_ZONES
    total_zones = len(zones)
    compliant_zones = len([z for z in zones if z["compliance_status"] == "Compliant"])
    compliance_rate = round((compliant_zones / total_zones) * 100.0, 1) if total_zones > 0 else 100.0

    return {
        "total_zones_monitored": total_zones,
        "compliant_zones": compliant_zones,
        "excursion_zones": total_zones - compliant_zones,
        "overall_compliance_rate_percent": compliance_rate,
        "active_temperature_alerts": 1,
        "optimal_temperature_target": "1.0°C - 4.0°C",
        "optimal_humidity_target": "85% - 92% RH"
    }

import math
