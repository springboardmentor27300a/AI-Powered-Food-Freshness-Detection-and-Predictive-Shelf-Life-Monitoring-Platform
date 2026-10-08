from datetime import date
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.alert import Alert
from app.models.inventory import FoodBatch,FoodItem
from app.models.freshness import FreshnessAssessment
from app.services import storage_status
router=APIRouter(prefix="/api/alerts",tags=["Alerts"])
def refresh_generated(db,user):
    for b,item in db.query(FoodBatch,FoodItem).join(FoodItem,FoodItem.id==FoodBatch.food_item_id).all():
        rem=(b.expiry_date-date.today()).days; storage,msg=storage_status(b,item); checks=[]
        if rem<=0: checks.append(("high","Spoilage / Expired","Batch is at or past its expiry date.","freshness"))
        elif rem<=3: checks.append(("high","Shelf-life warning",f"Only {rem} day(s) remain before expiry.","shelf_life"))
        elif rem<=7: checks.append(("medium","Shelf-life warning",f"Only {rem} day(s) remain before expiry.","shelf_life"))
        if storage=="Attention": checks.append(("high","Storage condition alert",msg,"storage"))
        a=db.query(FreshnessAssessment).filter(FreshnessAssessment.batch_id==b.id).order_by(FreshnessAssessment.created_at.desc()).first()
        if a and a.score<60: checks.append(("high" if a.score<40 else "medium",f"Freshness alert: {a.category}",a.recommendation,"freshness"))
        for sev,title,message,typ in checks:
            if not db.query(Alert).filter(Alert.user_id==user.id,Alert.batch_id==b.id,Alert.title==title,Alert.is_read==False).first(): db.add(Alert(user_id=user.id,batch_id=b.id,severity=sev,alert_type=typ,title=title,message=message))
    db.commit()
@router.get("")
def alerts(db:Session=Depends(get_db),user=Depends(get_current_user)):
    refresh_generated(db,user); rows=db.query(Alert).filter(Alert.user_id==user.id).order_by(Alert.created_at.desc()).limit(100).all()
    return [{"id":a.id,"batch_id":a.batch_id,"severity":a.severity,"title":a.title,"message":a.message,"is_read":a.is_read,"alert_type":getattr(a,"alert_type","platform"),"created_at":a.created_at} for a in rows]
@router.patch("/{alert_id}/read")
def mark_read(alert_id:int,db:Session=Depends(get_db),user=Depends(get_current_user)):
    a=db.query(Alert).filter(Alert.id==alert_id,Alert.user_id==user.id).first()
    if not a: raise HTTPException(404,"Alert not found")
    a.is_read=True; db.commit(); return {"message":"Marked as read"}
@router.patch("/read-all")
def mark_all(db:Session=Depends(get_db),user=Depends(get_current_user)): db.query(Alert).filter(Alert.user_id==user.id,Alert.is_read==False).update({"is_read":True}); db.commit(); return {"message":"All alerts marked as read"}
