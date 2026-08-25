from fastapi import APIRouter, HTTPException, status
from app.models.schemas import WarehouseCreate, WarehouseResponse
from app.db.mongodb import get_database
from datetime import datetime
from bson import ObjectId
from typing import List

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])

def format_warehouse(doc) -> WarehouseResponse:
    created = doc.get("created_at")
    created_str = created.isoformat() if isinstance(created, datetime) else str(created)
    return WarehouseResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        code=doc["code"],
        location=doc["location"],
        capacity_kg=doc["capacity_kg"],
        current_utilization_kg=doc.get("current_utilization_kg", 0.0),
        temperature_range_c=doc.get("temperature_range_c", "2°C - 4°C"),
        humidity_range_pct=doc.get("humidity_range_pct", "85% - 90%"),
        created_at=created_str
    )

@router.get("", response_model=List[WarehouseResponse])
async def list_warehouses():
    db = get_database()
    cursor = db.warehouses.find({}).sort("name", 1)
    docs = await cursor.to_list(length=100)
    return [format_warehouse(d) for d in docs]

@router.post("", response_model=WarehouseResponse)
async def create_warehouse(wh_in: WarehouseCreate):
    db = get_database()
    existing = await db.warehouses.find_one({"code": wh_in.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail=f"Warehouse with code {wh_in.code} already exists.")
    
    doc = {
        "name": wh_in.name,
        "code": wh_in.code.upper(),
        "location": wh_in.location,
        "capacity_kg": wh_in.capacity_kg,
        "current_utilization_kg": 0.0,
        "temperature_range_c": wh_in.temperature_range_c,
        "humidity_range_pct": wh_in.humidity_range_pct,
        "created_at": datetime.utcnow()
    }
    
    res = await db.warehouses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return format_warehouse(doc)
