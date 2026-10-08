from __future__ import annotations
from datetime import date

def clamp(v, lo, hi): return max(lo, min(hi, v))

def storage_status(batch, item):
    temp_ok = item.min_temp <= batch.temperature <= item.max_temp
    humidity_ok = item.min_humidity <= batch.humidity <= item.max_humidity
    if temp_ok and humidity_ok: return "Compliant", "Storage temperature and humidity are within the product's recommended range."
    problems=[]
    if not temp_ok: problems.append(f"temperature is {'below' if batch.temperature < item.min_temp else 'above'} the recommended range")
    if not humidity_ok: problems.append(f"humidity is {'below' if batch.humidity < item.min_humidity else 'above'} the recommended range")
    return "Attention", " and ".join(problems).capitalize()+"."

def recommendation_engine(batch,item,remaining_days=None,score=None):
    remaining=(batch.expiry_date-date.today()).days if remaining_days is None else remaining_days
    recs=[]; status,msg=storage_status(batch,item)
    if batch.temperature < item.min_temp: recs.append(f"Raise storage temperature into {item.min_temp:g}–{item.max_temp:g}°C range.")
    elif batch.temperature > item.max_temp: recs.append(f"Move batch to cooler storage within {item.min_temp:g}–{item.max_temp:g}°C.")
    if batch.humidity < item.min_humidity: recs.append(f"Increase humidity toward {item.min_humidity:g}–{item.max_humidity:g}%.")
    elif batch.humidity > item.max_humidity: recs.append(f"Reduce humidity toward {item.min_humidity:g}–{item.max_humidity:g}% and improve ventilation.")
    if remaining <= 0: recs.append("Batch is at or past expiry: isolate and inspect before use.")
    elif remaining <= 3: recs.append("Prioritize this batch for FIFO/FEFO rotation and consumption.")
    elif remaining <= 7: recs.append("Plan near-term sale or consumption and monitor freshness daily.")
    else: recs.append("Continue routine monitoring and follow FIFO/FEFO rotation.")
    if str(batch.packaging).lower() in {"open","damaged","unsealed"}: recs.append("Replace damaged/open packaging where food-safety procedures permit.")
    if score is not None and score < 50: recs.append("Quality score is low: perform a manual quality inspection before use.")
    return {"status":status,"storage_message":msg,"recommendations":recs,"priority":"High" if remaining<=3 or (score is not None and score<40) else ("Medium" if remaining<=7 or status=="Attention" else "Low")}

def image_visual_score(path):
    if not path: return 82.0,["No image supplied; visual component uses baseline confidence"]
    try:
        from PIL import Image, ImageStat
        img=Image.open(path).convert("RGB").resize((128,128)); stat=ImageStat.Stat(img)
        mean=sum(stat.mean)/3; std=sum(stat.stddev)/3; brightness=mean/255.0; score=88.0; indicators=[]
        if brightness<.18: score-=15; indicators.append("Very dark image; visual evidence is limited")
        elif brightness>.92: score-=8; indicators.append("Very bright image; visual evidence is limited")
        if std<18: score-=4; indicators.append("Low texture contrast detected")
        if std>85: score-=6; indicators.append("High surface/color variation detected")
        if not indicators: indicators.append("Image brightness and texture are within a normal visual range")
        return clamp(score,20,95),indicators
    except Exception: return 75.0,["Image could not be processed; storage and shelf-life signals were used"]
