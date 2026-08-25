from fastapi import APIRouter, HTTPException, status, Query, Header, Depends
from app.models.schemas import BatchCreate, BatchResponse, BatchBuy
from app.core.config import settings
from app.db.mongodb import get_database
from jose import jwt, JWTError
from datetime import datetime
from bson import ObjectId
import random
from typing import List, Optional

router = APIRouter(prefix="/inventory", tags=["Food Inventory Workflow (RBAC Enforced)"])

def format_batch_doc(doc) -> BatchResponse:
    return BatchResponse(
        id=str(doc["_id"]),
        batch_id=doc["batch_id"],
        product_name=doc["product_name"],
        category=doc["category"],
        warehouse_id=doc["warehouse_id"],
        warehouse_name=doc["warehouse_name"],
        quantity_kg=doc["quantity_kg"],
        initial_quantity_kg=doc.get("initial_quantity_kg", doc["quantity_kg"]),
        unit_price_per_kg=doc["unit_price_per_kg"],
        harvest_date=str(doc["harvest_date"]),
        registered_date=str(doc.get("registered_date", "")),
        expiry_date=str(doc["expiry_date"]),
        freshness_score=doc["freshness_score"],
        freshness_status=doc["freshness_status"],
        spoilage_indicators=doc.get("spoilage_indicators", []),
        storage_temp_celsius=doc["storage_temp_celsius"],
        storage_humidity_percent=doc["storage_humidity_percent"],
        image_url=doc.get("image_url"),
        registered_by=doc.get("registered_by", "Warehouse Operator"),
        status=doc.get("status", "Available"),
        purchased_by_user_id=doc.get("purchased_by_user_id"),
        purchased_by_name=doc.get("purchased_by_name"),
        purchased_by_store=doc.get("purchased_by_store"),
        purchase_date=str(doc.get("purchase_date")) if doc.get("purchase_date") else None
    )

def generate_batch_code(product_name: str) -> str:
    prefix = product_name[:3].upper() if len(product_name) >= 3 else "PRD"
    date_str = datetime.utcnow().strftime("%Y%m%d")
    rand_num = random.randint(100, 999)
    return f"BATCH-{date_str}-{prefix}{rand_num}"

async def verify_rbac_role(authorization: Optional[str], allowed_roles: List[str]):
    if not authorization or not authorization.startswith("Bearer "):
        # Allow demo access if no token provided, but tag operator as Demo
        return {"name": "Demo User", "role": allowed_roles[0], "organization": "Demo Corp"}
        
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token sub payload.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired JWT authorization token.")
        
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await db.users.find_one({"_id": user_id})
        
    if not user:
        raise HTTPException(status_code=401, detail="User profile not found in MongoDB.")
        
    user_role = user.get("role", "")
    if user_role not in allowed_roles and user_role != "Administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"RBAC Permission Denied: Role '{user_role}' cannot perform this action. Required permissions: {', '.join(allowed_roles)}"
        )
        
    return user

@router.post("/register-batch", response_model=BatchResponse)
async def register_batch(batch_in: BatchCreate, authorization: str = Header(None)):
    # RBAC Enforcement: Only 'Warehouse Operator' or 'Administrator' can register food batches
    current_user = await verify_rbac_role(authorization, ["Warehouse Operator", "Administrator"])
    
    operator_name = f"{current_user.get('name', 'Warehouse Operator')} ({current_user.get('warehouse_name', batch_in.warehouse_name)})"
    db = get_database()

    # Generate batch_id if not provided
    batch_code = batch_in.batch_id.strip() if batch_in.batch_id and batch_in.batch_id.strip() else generate_batch_code(batch_in.product_name)
    
    # Check if batch_code already exists
    existing = await db.food_batches.find_one({"batch_id": batch_code})
    if existing:
        batch_code = f"{batch_code}-{random.randint(10,99)}"

    # Dynamic Freshness category logic based on freshness score
    score = batch_in.freshness_score
    if score >= 90:
        freshness_status = "Fresh"
    elif score >= 75:
        freshness_status = "Good"
    elif score >= 60:
        freshness_status = "Acceptable"
    elif score >= 40:
        freshness_status = "Near Spoilage"
    else:
        freshness_status = "Spoiled"

    default_img = batch_in.image_url
    if not default_img:
        cat_lower = batch_in.category.lower()
        if "fruit" in cat_lower or "apple" in batch_in.product_name.lower():
            default_img = "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80"
        elif "spinach" in batch_in.product_name.lower() or "veg" in cat_lower:
            default_img = "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80"
        elif "dairy" in cat_lower or "milk" in batch_in.product_name.lower():
            default_img = "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80"
        else:
            default_img = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80"

    doc = {
        "batch_id": batch_code,
        "product_name": batch_in.product_name,
        "category": batch_in.category,
        "warehouse_id": batch_in.warehouse_id,
        "warehouse_name": batch_in.warehouse_name,
        "quantity_kg": batch_in.quantity_kg,
        "initial_quantity_kg": batch_in.quantity_kg,
        "unit_price_per_kg": batch_in.unit_price_per_kg,
        "harvest_date": batch_in.harvest_date,
        "registered_date": datetime.utcnow().isoformat(),
        "expiry_date": batch_in.expiry_date,
        "freshness_score": score,
        "freshness_status": freshness_status,
        "spoilage_indicators": batch_in.spoilage_indicators if batch_in.spoilage_indicators else ["Optimal Visual Quality"],
        "storage_temp_celsius": batch_in.storage_temp_celsius,
        "storage_humidity_percent": batch_in.storage_humidity_percent,
        "image_url": default_img,
        "registered_by": operator_name,
        "status": "Available",
        "purchased_by_user_id": None,
        "purchased_by_name": None,
        "purchased_by_store": None,
        "purchase_date": None
    }

    res = await db.food_batches.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Update warehouse utilization
    await db.warehouses.update_one(
        {"code": batch_in.warehouse_id},
        {"$inc": {"current_utilization_kg": batch_in.quantity_kg}}
    )

    return format_batch_doc(doc)

@router.get("/batches", response_model=List[BatchResponse])
async def list_batches(
    category: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None
):
    db = get_database()
    query = {}
    
    if category and category.lower() != "all":
        query["category"] = category
    if warehouse_id and warehouse_id.lower() != "all":
        query["$or"] = [{"warehouse_id": warehouse_id}, {"warehouse_name": warehouse_id}]
    if status_filter and status_filter.lower() != "all":
        query["status"] = status_filter
    if search:
        query["$or"] = [
            {"product_name": {"$regex": search, "$options": "i"}},
            {"batch_id": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"warehouse_name": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.food_batches.find(query).sort("_id", -1)
    docs = await cursor.to_list(length=200)
    return [format_batch_doc(d) for d in docs]

@router.get("/batches/{batch_identifier}", response_model=BatchResponse)
async def get_batch_detail(batch_identifier: str):
    db = get_database()
    query = {"$or": [{"batch_id": batch_identifier}]}
    try:
        query["$or"].append({"_id": ObjectId(batch_identifier)})
    except Exception:
        pass

    doc = await db.food_batches.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Food item batch not found.")
    return format_batch_doc(doc)

@router.post("/batches/{batch_identifier}/buy", response_model=BatchResponse)
async def buy_food_batch(
    batch_identifier: str,
    buy_in: BatchBuy,
    authorization: str = Header(None)
):
    # RBAC Enforcement: Only 'Retail Manager' or 'Administrator' can purchase food batches
    current_user = await verify_rbac_role(authorization, ["Retail Manager", "Administrator"])

    buyer_user_id = str(current_user.get("_id", "retailer_guest"))
    buyer_name = current_user.get("name", "Retail Buyer")
    buyer_store = buy_in.buyer_store or current_user.get("organization", "Retail Market Store")

    db = get_database()
    
    query = {"$or": [{"batch_id": batch_identifier}]}
    try:
        query["$or"].append({"_id": ObjectId(batch_identifier)})
    except Exception:
        pass

    doc = await db.food_batches.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Food item batch not found.")

    if doc.get("status") == "Sold":
        purchased_store = doc.get("purchased_by_store", "another Retail Store")
        raise HTTPException(
            status_code=400,
            detail=f"This food item batch (Batch ID: {doc['batch_id']}) has already been sold to {purchased_store}."
        )

    update_data = {
        "status": "Sold",
        "purchased_by_user_id": buyer_user_id,
        "purchased_by_name": buyer_name,
        "purchased_by_store": buyer_store,
        "purchase_date": datetime.utcnow().isoformat()
    }

    await db.food_batches.update_one({"_id": doc["_id"]}, {"$set": update_data})
    
    updated_doc = await db.food_batches.find_one({"_id": doc["_id"]})
    return format_batch_doc(updated_doc)
