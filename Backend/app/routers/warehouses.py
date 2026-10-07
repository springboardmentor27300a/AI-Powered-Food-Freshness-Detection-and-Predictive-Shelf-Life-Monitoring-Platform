from fastapi import APIRouter, HTTPException, status, Header, Depends
from app.models.schemas import WarehouseCreate, WarehouseResponse, AssignOperatorRequest
from app.core.config import settings
from app.db.mongodb import get_database
from jose import jwt, JWTError
from datetime import datetime
from bson import ObjectId
from typing import List, Optional

router = APIRouter(prefix="/warehouses", tags=["Warehouses & Logistics Hubs"])

def format_warehouse(doc) -> WarehouseResponse:
    created = doc.get("created_at")
    created_str = created.isoformat() if isinstance(created, datetime) else str(created)
    return WarehouseResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        code=doc["code"],
        location=doc["location"],
        capacity_kg=float(doc.get("capacity_kg", 5000.0)),
        current_utilization_kg=float(doc.get("current_utilization_kg", 0.0)),
        temperature_range_c=doc.get("temperature_range_c", "2°C - 4°C"),
        humidity_range_pct=doc.get("humidity_range_pct", "85% - 90%"),
        created_by_user_id=doc.get("created_by_user_id"),
        created_by_name=doc.get("created_by_name"),
        assigned_operator_id=doc.get("assigned_operator_id"),
        assigned_operator_name=doc.get("assigned_operator_name"),
        assigned_operator_email=doc.get("assigned_operator_email"),
        created_at=created_str
    )

async def get_caller_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None
    db = get_database()
    try:
        return await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return await db.users.find_one({"_id": user_id})

@router.get("", response_model=List[WarehouseResponse])
async def list_warehouses():
    """
    Returns all registered warehouse hubs.
    """
    db = get_database()
    cursor = db.warehouses.find({}).sort("name", 1)
    docs = await cursor.to_list(length=100)
    return [format_warehouse(d) for d in docs]

@router.get("/available-operators")
async def list_available_operators():
    """
    Returns all registered Warehouse Operators for Retail Manager assignment.
    Workflow: Retail Manager -> Assigns Warehouse Operator to a Hub.
    """
    db = get_database()
    cursor = db.users.find({"role": "Warehouse Operator"}).sort("name", 1)
    operators = await cursor.to_list(100)
    return [
        {
            "id": str(op["_id"]),
            "name": op.get("name", "Unnamed Operator"),
            "email": op.get("email", ""),
            "organization": op.get("organization"),
            "assigned_warehouse_id": op.get("warehouse_id"),
            "assigned_warehouse_name": op.get("warehouse_name")
        }
        for op in operators
    ]

@router.post("", response_model=WarehouseResponse)
async def create_warehouse(wh_in: WarehouseCreate, authorization: str = Header(None)):
    """
    Retail Manager creates a Warehouse Hub.
    Workflow: Retail Manager -> Creates Warehouse Hub (requires Admin approval).
    """
    db = get_database()
    caller = await get_caller_user(authorization)
    
    # If caller is Retail Manager, verify they have been approved by Admin
    if caller and caller.get("role") == "Retail Manager":
        if not caller.get("is_approved", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your Retail Manager account is pending Administrator approval before creating warehouse hubs."
            )

    code_upper = wh_in.code.upper().strip()
    existing = await db.warehouses.find_one({"code": code_upper})
    if existing:
        raise HTTPException(status_code=400, detail=f"Warehouse hub with code '{code_upper}' already exists.")

    operator_id = wh_in.assigned_operator_id
    operator_name = wh_in.assigned_operator_name
    operator_email = wh_in.assigned_operator_email

    # If operator_id is provided, fetch operator details if not passed
    if operator_id:
        try:
            op_doc = await db.users.find_one({"_id": ObjectId(operator_id)})
        except Exception:
            op_doc = await db.users.find_one({"_id": operator_id})
        if op_doc:
            operator_name = op_doc.get("name")
            operator_email = op_doc.get("email")

    doc = {
        "name": wh_in.name.strip(),
        "code": code_upper,
        "location": wh_in.location.strip(),
        "capacity_kg": float(wh_in.capacity_kg),
        "current_utilization_kg": 0.0,
        "temperature_range_c": wh_in.temperature_range_c,
        "humidity_range_pct": wh_in.humidity_range_pct,
        "created_by_user_id": str(caller["_id"]) if caller else "admin",
        "created_by_name": caller.get("name", "Retail Manager") if caller else "Administrator",
        "assigned_operator_id": operator_id,
        "assigned_operator_name": operator_name,
        "assigned_operator_email": operator_email,
        "created_at": datetime.utcnow()
    }

    res = await db.warehouses.insert_one(doc)
    doc["_id"] = res.inserted_id

    # If operator was assigned, update that operator's user record in MongoDB
    if operator_id:
        try:
            await db.users.update_one(
                {"_id": ObjectId(operator_id)},
                {"$set": {"warehouse_id": code_upper, "warehouse_name": wh_in.name.strip()}}
            )
        except Exception:
            await db.users.update_one(
                {"_id": operator_id},
                {"$set": {"warehouse_id": code_upper, "warehouse_name": wh_in.name.strip()}}
            )

    # Initialize a storage zone for real-time telemetry if not existing
    zone_doc = {
        "zone_id": f"ZONE-{code_upper}-A",
        "zone_name": f"{wh_in.name.strip()} — Main Vault",
        "warehouse_id": code_upper,
        "warehouse_name": wh_in.name.strip(),
        "temperature_celsius": 3.0,
        "humidity_percent": 88.0,
        "airflow_cfm": 400.0,
        "light_lux": 15.0,
        "target_temp_c": 3.0,
        "target_humidity_pct": 88.0,
        "compliance_status": "Compliant",
        "active_alerts_count": 0,
        "last_updated": datetime.utcnow().isoformat()
    }
    await db.storage_zones.update_one(
        {"zone_id": zone_doc["zone_id"]},
        {"$setOnInsert": zone_doc},
        upsert=True
    )

    return format_warehouse(doc)

@router.post("/{warehouse_id}/assign-operator", response_model=WarehouseResponse)
async def assign_operator_to_hub(
    warehouse_id: str,
    req: AssignOperatorRequest,
    authorization: str = Header(None)
):
    """
    Retail Manager assigns a Warehouse Operator to manage an active Warehouse Hub.
    Workflow: Retail Manager -> Assigns Warehouse Operator -> Operator operates the hub.
    """
    db = get_database()
    query = {"$or": [{"code": warehouse_id.upper()}]}
    try:
        query["$or"].append({"_id": ObjectId(warehouse_id)})
    except Exception:
        pass

    wh = await db.warehouses.find_one(query)
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse hub not found.")

    # Find operator in users
    op_query = {}
    try:
        op_query = {"_id": ObjectId(req.operator_id)}
    except Exception:
        op_query = {"_id": req.operator_id}

    op_user = await db.users.find_one(op_query)
    if not op_user:
        raise HTTPException(status_code=404, detail="Warehouse Operator user account not found.")

    op_name = op_user.get("name", req.operator_name or "Assigned Operator")
    op_email = op_user.get("email", req.operator_email or "")

    # Update warehouse with assigned operator
    await db.warehouses.update_one(
        {"_id": wh["_id"]},
        {
            "$set": {
                "assigned_operator_id": str(op_user["_id"]),
                "assigned_operator_name": op_name,
                "assigned_operator_email": op_email
            }
        }
    )

    # Update the user profile so the operator is bound to this warehouse hub
    await db.users.update_one(
        {"_id": op_user["_id"]},
        {
            "$set": {
                "warehouse_id": wh["code"],
                "warehouse_name": wh["name"]
            }
        }
    )

    updated_wh = await db.warehouses.find_one({"_id": wh["_id"]})
    return format_warehouse(updated_wh)

@router.delete("/{warehouse_id}")
async def delete_warehouse(warehouse_id: str, authorization: str = Header(None)):
    """
    Deletes a warehouse hub (admin or creating retail manager).
    """
    db = get_database()
    query = {"$or": [{"code": warehouse_id.upper()}]}
    try:
        query["$or"].append({"_id": ObjectId(warehouse_id)})
    except Exception:
        pass

    wh = await db.warehouses.find_one(query)
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse hub not found.")

    await db.warehouses.delete_one({"_id": wh["_id"]})
    return {"message": f"Warehouse hub '{wh['name']}' deleted successfully."}
