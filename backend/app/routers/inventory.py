from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.inventory import FoodItem, FoodBatch
from app.schemas import FoodItemIn, FoodItemOut, BatchIn
from datetime import date

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

EDITORS = ("retail_manager","warehouse_operator","quality_inspector")

def batch_dict(b, item):
    return {
        "id": b.id, "food_item_id": b.food_item_id, "batch_code": b.batch_code,
        "quantity": b.quantity, "received_date": b.received_date,
        "expiry_date": b.expiry_date, "temperature": b.temperature,
        "humidity": b.humidity, "packaging": b.packaging,
        "storage_area": b.storage_area, "status": b.status,
        "created_at": b.created_at, "food_name": item.name if item else "",
        "category": item.category if item else ""
    }

@router.get("/items", response_model=list[FoodItemOut])
def items(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(FoodItem).order_by(FoodItem.name).all()

@router.post("/items", response_model=FoodItemOut)
def create_item(data: FoodItemIn, db: Session = Depends(get_db), user=Depends(require_roles(*EDITORS))):
    item = FoodItem(**data.model_dump()); db.add(item); db.commit(); db.refresh(item); return item

@router.get("/batches")
def batches(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(FoodBatch, FoodItem).join(FoodItem, FoodItem.id == FoodBatch.food_item_id).order_by(FoodBatch.created_at.desc()).all()
    return [batch_dict(b,i) for b,i in rows]

@router.post("/batches")
def create_batch(data: BatchIn, db: Session = Depends(get_db), user=Depends(require_roles(*EDITORS))):
    if not db.get(FoodItem, data.food_item_id):
        raise HTTPException(404, "Food item not found")
    if data.expiry_date < data.received_date:
        raise HTTPException(400, "Expiry date cannot be before received date")
    if db.query(FoodBatch).filter(FoodBatch.batch_code == data.batch_code).first():
        raise HTTPException(400, "Batch code already exists")
    b = FoodBatch(**data.model_dump()); db.add(b); db.commit(); db.refresh(b)
    return batch_dict(b, db.get(FoodItem, b.food_item_id))

@router.put("/batches/{batch_id}")
def update_batch(batch_id: int, data: BatchIn, db: Session = Depends(get_db), user=Depends(require_roles(*EDITORS))):
    b = db.get(FoodBatch, batch_id)
    if not b: raise HTTPException(404, "Batch not found")
    for k,v in data.model_dump().items(): setattr(b,k,v)
    db.commit(); db.refresh(b)
    return batch_dict(b, db.get(FoodItem, b.food_item_id))

@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db), user=Depends(require_roles(*EDITORS))):
    b = db.get(FoodBatch, batch_id)
    if not b: raise HTTPException(404, "Batch not found")
    db.delete(b); db.commit()
    return {"message":"Batch deleted"}
