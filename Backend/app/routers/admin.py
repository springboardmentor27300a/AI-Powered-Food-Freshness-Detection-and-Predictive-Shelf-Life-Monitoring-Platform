from fastapi import APIRouter, HTTPException, status, Header, Depends
from app.models.schemas import AdminUserResponse, AdminCreateRetailManager, AdminApprovalToggle, UserResponse
from app.core.security import get_password_hash
from app.core.config import settings
from app.db.mongodb import get_database
from jose import jwt, JWTError
from datetime import datetime
from bson import ObjectId
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/admin", tags=["Administrator Console & User Approvals"])

def format_admin_user(doc) -> AdminUserResponse:
    created = doc.get("created_at")
    created_str = created.isoformat() if isinstance(created, datetime) else str(created)
    return AdminUserResponse(
        id=str(doc["_id"]),
        name=doc.get("name", "Unnamed User"),
        email=doc.get("email", ""),
        role=doc.get("role", "Consumer"),
        organization=doc.get("organization"),
        warehouse_id=doc.get("warehouse_id"),
        warehouse_name=doc.get("warehouse_name"),
        is_approved=doc.get("is_approved", True if doc.get("role") != "Retail Manager" else doc.get("is_approved", True)),
        created_at=created_str
    )

@router.get("/users", response_model=List[AdminUserResponse])
async def list_all_users():
    """
    Returns all registered users in MongoDB Atlas for Administrator governance & approval.
    """
    db = get_database()
    cursor = db.users.find({}).sort("created_at", -1)
    users = await cursor.to_list(200)
    return [format_admin_user(u) for u in users]

@router.post("/users/{user_id}/approve")
async def approve_retail_manager(user_id: str):
    """
    Administrator action: Approves a Retail Manager, enabling them to create and manage Warehouse Hubs.
    """
    db = get_database()
    query = {}
    try:
        query = {"_id": ObjectId(user_id)}
    except Exception:
        query = {"_id": user_id}

    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.users.update_one(query, {"$set": {"is_approved": True}})
    updated = await db.users.find_one(query)
    return {
        "message": f"Retail Manager '{user.get('name')}' approved successfully.",
        "user": format_admin_user(updated)
    }

@router.post("/users/{user_id}/revoke")
async def revoke_retail_manager_approval(user_id: str):
    """
    Administrator action: Revokes approval for a Retail Manager.
    """
    db = get_database()
    query = {}
    try:
        query = {"_id": ObjectId(user_id)}
    except Exception:
        query = {"_id": user_id}

    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.users.update_one(query, {"$set": {"is_approved": False}})
    updated = await db.users.find_one(query)
    return {
        "message": f"Approval revoked for Retail Manager '{user.get('name')}'.",
        "user": format_admin_user(updated)
    }

@router.post("/create-retail-manager", response_model=AdminUserResponse)
async def create_retail_manager(req: AdminCreateRetailManager):
    """
    Administrator action: Directly creates an already approved Retail Manager account.
    Workflow: Administrator -> Creates/approves Retail Manager.
    """
    db = get_database()
    email_clean = req.email.lower().strip()

    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An account with email '{email_clean}' already exists."
        )

    user_doc = {
        "name": req.name.strip(),
        "email": email_clean,
        "email_verified": True,
        "password_hash": get_password_hash(req.password),
        "role": "Retail Manager",
        "organization": req.organization.strip() if req.organization else "FreshMart Superstores",
        "phone": req.phone,
        "is_approved": True,  # Directly approved because created by Administrator
        "created_at": datetime.utcnow()
    }

    res = await db.users.insert_one(user_doc)
    user_doc["_id"] = res.inserted_id
    return format_admin_user(user_doc)

@router.get("/hierarchy")
async def get_system_hierarchy():
    """
    Returns the full architectural hierarchy:
    Administrator -> Retail Managers -> Warehouse Hubs -> Assigned Warehouse Operators -> Active Batches.
    """
    db = get_database()
    
    # 1. Retail Managers
    retail_managers = await db.users.find({"role": "Retail Manager"}).to_list(100)
    
    # 2. Warehouses
    warehouses = await db.warehouses.find({}).to_list(100)
    
    # 3. Warehouse Operators
    operators = await db.users.find({"role": "Warehouse Operator"}).to_list(100)
    
    # 4. Batches
    batches = await db.food_batches.find({"status": "Available"}).to_list(200)

    # Build structured tree
    wh_map = {str(w["_id"]): w for w in warehouses}
    wh_by_code = {w.get("code"): w for w in warehouses}

    hierarchy = []
    for rm in retail_managers:
        rm_id = str(rm["_id"])
        rm_warehouses = [
            w for w in warehouses
            if w.get("created_by_user_id") == rm_id or w.get("created_by_name") == rm.get("name")
        ]

        hubs_data = []
        for h in rm_warehouses:
            h_code = h.get("code")
            h_batches = [b for b in batches if b.get("warehouse_id") == h_code]
            hubs_data.append({
                "hub_id": str(h["_id"]),
                "hub_name": h.get("name"),
                "hub_code": h_code,
                "location": h.get("location"),
                "capacity_kg": h.get("capacity_kg"),
                "current_utilization_kg": h.get("current_utilization_kg", 0.0),
                "temperature_range": h.get("temperature_range_c"),
                "humidity_range": h.get("humidity_range_pct"),
                "assigned_operator": {
                    "id": h.get("assigned_operator_id"),
                    "name": h.get("assigned_operator_name", "Unassigned"),
                    "email": h.get("assigned_operator_email", "")
                },
                "active_batch_count": len(h_batches)
            })

        hierarchy.append({
            "retail_manager_id": rm_id,
            "name": rm.get("name"),
            "email": rm.get("email"),
            "organization": rm.get("organization"),
            "is_approved": rm.get("is_approved", True),
            "warehouse_hubs": hubs_data
        })

    return {
        "administrator": "Platform Administrator",
        "hierarchy": hierarchy,
        "total_retail_managers": len(retail_managers),
        "total_warehouse_hubs": len(warehouses),
        "total_warehouse_operators": len(operators)
    }
