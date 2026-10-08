from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.inventory import FoodBatch, FoodItem
from app.services import recommendation_engine
router=APIRouter(prefix="/api/storage",tags=["Storage Monitoring"])
@router.get("/overview")
def overview(db:Session=Depends(get_db),user=Depends(get_current_user)):
    rows=db.query(FoodBatch,FoodItem).join(FoodItem,FoodItem.id==FoodBatch.food_item_id).order_by(FoodBatch.expiry_date.asc()).all(); result=[]
    for b,item in rows:
        r=recommendation_engine(b,item); result.append({"batch_id":b.id,"batch_code":b.batch_code,"food_name":item.name,"category":item.category,"temperature":b.temperature,"humidity":b.humidity,"min_temp":item.min_temp,"max_temp":item.max_temp,"min_humidity":item.min_humidity,"max_humidity":item.max_humidity,"expiry_date":b.expiry_date,"remaining_days":max((b.expiry_date-date.today()).days,0),"status":r["status"],"priority":r["priority"],"storage_message":r["storage_message"],"recommendations":r["recommendations"]})
    return {"batches":result,"compliant":sum(x["status"]=="Compliant" for x in result),"attention":sum(x["status"]=="Attention" for x in result),"high_priority":sum(x["priority"]=="High" for x in result)}
