from fastapi import APIRouter, Query
from database import SessionLocal
from models.batch import Batch
from models.food_item import FoodItem
from models.storage_reading import StorageReading
from datetime import date

router = APIRouter(prefix="/alerts", tags=["Notifications & Alerts"])

ROLE_ALERT_TYPES = {
    "consumer": {"freshness","shelf_life","spoilage","storage"},
    "retail manager": {"freshness","shelf_life","spoilage","inventory","storage"},
    "warehouse operator": {"freshness","shelf_life","spoilage","inventory","storage"},
    "food quality inspector": {"freshness","shelf_life","spoilage","storage"},
    "administrator": {"freshness","shelf_life","spoilage","inventory","storage","platform"},
}
ROLE_ALIASES={"retail":"retail manager","warehouse":"warehouse operator","inspector":"food quality inspector","admin":"administrator"}


def _add(alerts, type_, severity, title, message, action, batch_id=None, food_name=None):
    alerts.append({"type":type_,"severity":severity,"title":title,"message":message,"action":action,"batch_id":batch_id,"food_name":food_name})


@router.get("")
def get_alerts(role: str = Query(default="administrator")):
    db=SessionLocal()
    try:
        role_key=ROLE_ALIASES.get(role.strip().lower(),role.strip().lower())
        allowed=ROLE_ALERT_TYPES.get(role_key,{"freshness","shelf_life","spoilage"})
        batches=db.query(Batch).all(); foods=db.query(FoodItem).all(); food_map={f.id:f.name for f in foods}; today=date.today(); alerts=[]
        for b in batches:
            food=food_map.get(b.food_item_id,"Unknown Food"); effective=min(b.expiry_date,b.predicted_expiry_date) if b.predicted_expiry_date else b.expiry_date; days=(effective-today).days
            if "inventory" in allowed and b.quantity<=0:
                _add(alerts,"inventory","high","Out of Stock",f"{food} - Batch #{b.id} is out of stock.","Replenish inventory or confirm this batch is intentionally closed.",b.id,food)
            if "shelf_life" in allowed:
                if days<0: _add(alerts,"shelf_life","critical","Expired Batch",f"{food} - Batch #{b.id} expired {abs(days)} day(s) ago.","Remove from usable inventory immediately. Do not sell or consume.",b.id,food)
                elif days<=2: _add(alerts,"shelf_life","high","Shelf-Life Warning",f"{food} - Batch #{b.id} expires in {days} day(s).","Use this batch first using FEFO rotation.",b.id,food)
                elif days<=7: _add(alerts,"shelf_life","medium","Near Expiry",f"{food} - Batch #{b.id} expires in {days} day(s).","Plan consumption or sale before later-expiring stock.",b.id,food)
            if "freshness" in allowed and b.freshness_score is not None:
                if b.freshness_score<40: _add(alerts,"freshness","critical","Very Low Freshness",f"{food} - Batch #{b.id} freshness is {b.freshness_score:.2f}%.","Do not consume. Remove from usable inventory immediately.",b.id,food)
                elif b.freshness_score<65: _add(alerts,"freshness","medium","Freshness Declining",f"{food} - Batch #{b.id} freshness is {b.freshness_score:.2f}%.","Reassess storage and prioritize this batch.",b.id,food)
            if "spoilage" in allowed and b.spoilage_risk:
                risk=b.spoilage_risk.strip().lower()
                if risk in {"high","very high"}: _add(alerts,"spoilage","critical","High Spoilage Risk",f"{food} - Batch #{b.id} has {b.spoilage_risk} spoilage risk.","Isolate the batch and remove it from usable inventory.",b.id,food)
                elif risk=="medium": _add(alerts,"spoilage","medium","Moderate Spoilage Risk",f"{food} - Batch #{b.id} has medium spoilage risk.","Monitor storage and freshness closely.",b.id,food)

        if "storage" in allowed:
            readings=db.query(StorageReading).order_by(StorageReading.recorded_at.desc()).all(); latest={}
            for r in readings:
                key=r.batch_id if r.batch_id is not None else f"u-{r.id}"
                if key not in latest: latest[key]=r
            for r in latest.values():
                if r.compliance_score<75:
                    sev="critical" if r.compliance_score<50 else "high"
                    label=f"Batch #{r.batch_id}" if r.batch_id else r.food_type
                    bad=[]
                    if r.temperature_status!="Optimal": bad.append("temperature")
                    if r.humidity_status!="Optimal": bad.append("humidity")
                    if r.air_status!="Suitable": bad.append("air circulation")
                    if r.light_status!="Suitable": bad.append("light exposure")
                    _add(alerts,"storage",sev,"Storage Compliance Alert",f"{label} storage compliance is {r.compliance_score:.0f}%. Issues: {', '.join(bad) or 'environmental conditions'}.","Correct the flagged storage conditions and record a new reading.",r.batch_id,r.food_type)
        if "platform" in allowed and not batches:
            _add(alerts,"platform","medium","No Inventory Data","No batches are currently available for monitoring.","Add inventory batches to enable platform analytics.")

        order={"critical":0,"high":1,"medium":2,"low":3}; alerts.sort(key=lambda a:(order.get(a["severity"],4),a["type"],a.get("batch_id") or 0))
        return {"role":role_key,"summary":{"total_alerts":len(alerts),"critical":sum(a["severity"]=="critical" for a in alerts),"high":sum(a["severity"]=="high" for a in alerts),"medium":sum(a["severity"]=="medium" for a in alerts),"inventory":sum(a["type"]=="inventory" for a in alerts),"shelf_life":sum(a["type"]=="shelf_life" for a in alerts),"freshness":sum(a["type"]=="freshness" for a in alerts),"spoilage":sum(a["type"]=="spoilage" for a in alerts),"storage":sum(a["type"]=="storage" for a in alerts)},"alerts":alerts}
    finally: db.close()
