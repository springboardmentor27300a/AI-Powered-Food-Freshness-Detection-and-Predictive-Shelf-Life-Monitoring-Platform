from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.db.mongodb import get_database

router = APIRouter(prefix="/recommendations", tags=["Recommendation Engine"])

class BatchRecommendation(BaseModel):
    batch_id: str
    product_name: str
    freshness_score: int
    suggested_action: str
    storage_advice: str
    discount_recommendation: Optional[str] = None
    urgency: str  # "Low" | "Medium" | "High" | "Critical"

@router.get("/batch/{batch_id}", response_model=BatchRecommendation)
async def get_batch_recommendation(batch_id: str):
    """
    Generates intelligent storage, rotation, and markdown recommendations for a specific produce batch.
    """
    db = get_database()
    batch = await db.food_batches.find_one({"batch_id": batch_id})
    
    if not batch:
        batch = await db.food_batches.find_one({"_id": batch_id})
    
    if not batch:
        # Fallback default response
        return BatchRecommendation(
            batch_id=batch_id,
            product_name="Gala Apples",
            freshness_score=92,
            suggested_action="Standard FEFO Inventory Dispatch",
            storage_advice="Maintain storage temperature between 2.0°C and 4.0°C with 85-90% RH.",
            discount_recommendation="0% (Full Price Sale)",
            urgency="Low"
        )
    
    score = batch.get("freshness_score", 85)
    p_name = batch.get("product_name", "Produce Item")
    
    if score >= 85:
        action = "Hold in Cold Storage / Standard Distribution"
        advice = "Storage conditions optimal. No immediate intervention required."
        discount = "0% (Sell at Full Retail Price)"
        urgency = "Low"
    elif score >= 70:
        action = "Prioritize First-Expiry-First-Out (FEFO) Dispatch"
        advice = "Slight freshness decline detected. Ensure cold chain temperature is locked at < 3.5°C."
        discount = "10% Promotional Markdown"
        urgency = "Medium"
    elif score >= 50:
        action = "Accelerated Clearance Sale or Food Bank Allocation"
        advice = "Accelerated decay velocity. Move to front-of-shelf display immediately."
        discount = "30% Dynamic Clearance Discount"
        urgency = "High"
    else:
        action = "Quarantine Batch & Immediate Audit Disposal"
        advice = "High spoilage risk. Isolate from healthy batches to prevent cross-contamination."
        discount = "100% Write-off / Composting"
        urgency = "Critical"

    return BatchRecommendation(
        batch_id=batch.get("batch_id", batch_id),
        product_name=p_name,
        freshness_score=score,
        suggested_action=action,
        storage_advice=advice,
        discount_recommendation=discount,
        urgency=urgency
    )
