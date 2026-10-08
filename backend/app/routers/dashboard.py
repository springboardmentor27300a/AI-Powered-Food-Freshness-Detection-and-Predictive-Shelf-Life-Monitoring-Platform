from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.inventory import FoodBatch, FoodItem
from app.models.freshness import FreshnessAssessment
from app.models.alert import Alert

router=APIRouter(prefix="/api/dashboard",tags=["Dashboard"])

@router.get("/summary")
def summary(db:Session=Depends(get_db), user=Depends(get_current_user)):
    batches=db.query(FoodBatch).count()
    assessments=db.query(FreshnessAssessment).count()
    unread=db.query(Alert).filter(Alert.user_id==user.id,Alert.is_read==False).count()
    avg=db.query(func.avg(FreshnessAssessment.score)).scalar() or 0
    categories={}
    rows=db.query(FreshnessAssessment.category,func.count(FreshnessAssessment.id)).group_by(FreshnessAssessment.category).all()
    for c,n in rows: categories[c]=n
    return {"batches":batches,"assessments":assessments,"unread_alerts":unread,"average_score":round(float(avg),1),"categories":categories}

@router.get("/trends")
def trends(db:Session=Depends(get_db), user=Depends(get_current_user)):
    rows=db.query(FreshnessAssessment).order_by(FreshnessAssessment.created_at.asc()).limit(30).all()
    return [{"date":r.created_at.strftime("%d %b"),"score":r.score,"category":r.category} for r in rows]
