import os,json
from datetime import date
from uuid import uuid4
from fastapi import APIRouter,Depends,File,Form,HTTPException,UploadFile
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user,require_roles
from app.models.inventory import FoodItem,FoodBatch
from app.models.freshness import FreshnessAssessment
from app.models.alert import Alert
from app.schemas import AssessmentOut
from app.services import clamp,image_visual_score,recommendation_engine
router=APIRouter(prefix="/api/freshness",tags=["Freshness"]); UPLOAD_DIR=os.path.join(os.path.dirname(os.path.dirname(__file__)),"uploads"); os.makedirs(UPLOAD_DIR,exist_ok=True); EDITORS=("retail_manager","warehouse_operator","quality_inspector")
def calculate(batch,item,image_path=None):
    today=date.today(); total_days=max((batch.expiry_date-batch.received_date).days,1); remaining=(batch.expiry_date-today).days
    shelf_score=clamp((remaining/total_days)*100,0,100); age_score=clamp(100-max((today-batch.received_date).days,0)/total_days*100,0,100)
    temp_mid=(item.min_temp+item.max_temp)/2; storage_score=clamp(100-abs(batch.temperature-temp_mid)/max(item.max_temp-item.min_temp,1)*40,0,100)
    hum_mid=(item.min_humidity+item.max_humidity)/2; storage_score=clamp(storage_score-abs(batch.humidity-hum_mid)/max(item.max_humidity-item.min_humidity,1)*25,0,100)
    visual_score,visual_indicators=image_visual_score(image_path); score=round(visual_score*.40+storage_score*.25+shelf_score*.20+age_score*.15,1); spoilage=round(1-score/100,3)
    if score>=80: category="Fresh"; base="Suitable for normal storage and sale. Continue monitoring."
    elif score>=65: category="Good"; base="Good condition. Maintain recommended storage conditions."
    elif score>=50: category="Acceptable"; base="Use or sell soon and monitor temperature/humidity."
    elif score>=30: category="Near Spoilage"; base="Prioritize this batch and inspect before use."
    else: category="Spoiled"; base="Do not use without quality inspection; isolate the batch."
    indicators=list(visual_indicators)
    if batch.temperature<item.min_temp or batch.temperature>item.max_temp: indicators.append("Temperature outside recommended range")
    if batch.humidity<item.min_humidity or batch.humidity>item.max_humidity: indicators.append("Humidity outside recommended range")
    if remaining<=3: indicators.append("Very short remaining shelf life")
    rec=recommendation_engine(batch,item,max(remaining,0),score)
    return dict(score=score,spoilage_probability=spoilage,visual_score=round(visual_score,1),storage_score=round(storage_score,1),shelf_score=round(shelf_score,1),age_score=round(age_score,1),remaining_days=max(remaining,0),confidence=.90 if image_path else .82,category=category,indicators=json.dumps(indicators),recommendation=base+" "+" ".join(rec["recommendations"][:2]))
@router.post("/analyze",response_model=AssessmentOut)
async def analyze(batch_id:int=Form(...),image:UploadFile|None=File(None),db:Session=Depends(get_db),user=Depends(require_roles(*EDITORS))):
    batch=db.get(FoodBatch,batch_id)
    if not batch: raise HTTPException(404,"Batch not found")
    item=db.get(FoodItem,batch.food_item_id)
    if not item: raise HTTPException(404,"Food item not found")
    image_name=""; image_path=None
    if image and image.filename:
        ext=os.path.splitext(image.filename)[1].lower()[:10] or ".jpg"; image_name=f"{uuid4().hex}{ext}"; image_path=os.path.join(UPLOAD_DIR,image_name)
        with open(image_path,"wb") as f: f.write(await image.read())
    result=calculate(batch,item,image_path); a=FreshnessAssessment(batch_id=batch.id,user_id=user.id,image_name=image_name,**result); db.add(a)
    if result["score"]<60: db.add(Alert(user_id=user.id,batch_id=batch.id,severity="high" if result["score"]<40 else "medium",alert_type="freshness",title=f"Freshness alert: {result['category']}",message=result["recommendation"]))
    db.commit(); db.refresh(a); return a
@router.get("/assessments",response_model=list[AssessmentOut])
def assessments(db:Session=Depends(get_db),user=Depends(get_current_user)): return db.query(FreshnessAssessment).order_by(FreshnessAssessment.created_at.desc()).limit(100).all()
@router.get("/latest/{batch_id}")
def latest(batch_id:int,db:Session=Depends(get_db),user=Depends(get_current_user)): return db.query(FreshnessAssessment).filter(FreshnessAssessment.batch_id==batch_id).order_by(FreshnessAssessment.created_at.desc()).first() or {}
