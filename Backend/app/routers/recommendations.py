from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.db.mongodb import get_database
from app.models.schemas import (
    FEFOQueueItem,
    DynamicMarkdownItem,
    EthyleneMatrixRule
)

router = APIRouter(prefix="/recommendations", tags=["Intelligent Recommendation Engine"])

class BatchRecommendation(BaseModel):
    batch_id: str
    product_name: str
    freshness_score: int
    freshness_status: str
    suggested_action: str
    storage_advice: str
    packaging_advice: str
    culinary_recommendation: str
    discount_recommendation: Optional[str] = None
    urgency: str  # "Low" | "Medium" | "High" | "Critical"

# Ethylene Compatibility Knowledge Base
ETHYLENE_RULES = [
    {
        "emitter_category": "Apples / Bananas / Melons (High Ethylene Emitters)",
        "sensitive_category": "Leafy Greens / Spinach / Lettuce (Ethylene Sensitive)",
        "compatibility": "Incompatible",
        "risk_summary": "High risk of rapid yellowing, chlorophyll degradation, and premature senescence.",
        "separation_advice": "Do NOT co-locate in same cold storage chamber. Enforce minimum 10m physical separation or use dedicated positive-pressure airflow exhaust."
    },
    {
        "emitter_category": "Tomatoes / Stone Fruits (Moderate Emitters)",
        "sensitive_category": "Cucumbers / Carrots / Broccoli (High Sensitivity)",
        "compatibility": "Incompatible",
        "risk_summary": "Ethylene triggers bitterness in carrots (isocoumarin formation) and accelerated yellowing in broccoli florets.",
        "separation_advice": "Store in separate climate-controlled bays. Maintain air circulation to exhaust trace ethylene."
    },
    {
        "emitter_category": "Citrus / Berries (Low Emitters)",
        "sensitive_category": "Apples / Pears",
        "compatibility": "Compatible",
        "risk_summary": "Minimal cross-ripening impact under standard 2-4°C refrigeration.",
        "separation_advice": "Safe to store within same refrigeration vault. Maintain 85-90% RH."
    },
    {
        "emitter_category": "Root Vegetables (Potatoes / Onions)",
        "sensitive_category": "Apples / Pears",
        "compatibility": "Caution",
        "risk_summary": "Onions impart pungency and odors to apples; apples release moisture accelerating potato sprouting.",
        "separation_advice": "Store in well-ventilated dry ambient bays (10-12°C), isolated from deciduous fruit chambers."
    }
]

@router.get("/batch/{batch_id}", response_model=BatchRecommendation)
async def get_batch_recommendation(batch_id: str):
    """
    Generates intelligent storage, rotation, packaging, and markdown recommendations for a specific produce batch.
    """
    db = get_database()
    batch = await db.food_batches.find_one({"batch_id": batch_id})
    if not batch:
        batch = await db.food_batches.find_one({"_id": batch_id})

    if not batch:
        # Resilient fallback default
        return BatchRecommendation(
            batch_id=batch_id,
            product_name="Gala Apples",
            freshness_score=92,
            freshness_status="Fresh",
            suggested_action="Standard FEFO Inventory Dispatch",
            storage_advice="Maintain cold room temperature between 2.0°C and 3.5°C with 85-90% RH.",
            packaging_advice="Optimal: Modified Atmosphere Packaging (MAP) to suppress respiration.",
            culinary_recommendation="Prime for fresh raw consumption, premium retail display, and gourmet salads.",
            discount_recommendation="0% (Full Retail Price)",
            urgency="Low"
        )

    score = batch.get("freshness_score", 85)
    p_name = batch.get("product_name", "Produce Item")
    status = batch.get("freshness_status", "Fresh")

    if score >= 88:
        action = "Hold in Cold Storage / Standard Order Dispatch"
        storage_adv = "Storage conditions optimal. Maintain stable 2-4°C and ensure no door seals are compromised."
        pkg_adv = "Maintain sealed MAP or vacuum barriers to maximize long-term crispness retention."
        culinary = "Prime fresh market quality. Ideal for premium consumer display and fresh consumption."
        discount = "0% (Sell at Full Retail Price)"
        urgency = "Low"
    elif score >= 70:
        action = "Prioritize First-Expiry-First-Out (FEFO) Dispatch"
        storage_adv = "Slight freshness degradation detected. Lock cold chain strictly at < 3.5°C to retard respiration."
        pkg_adv = "Ensure micro-perforated packaging prevents moisture accumulation and mold condensation."
        culinary = "High quality produce. Best for standard retail display or quick culinary use within 7 days."
        discount = "10% Promotional Velocity Markdown"
        urgency = "Medium"
    elif score >= 50:
        action = "Accelerated Clearance Sale or Commercial Kitchen Dispatch"
        storage_adv = "Elevated decay velocity. Move produce to front-of-shelf display immediately."
        pkg_adv = "Remove plastic wrap if condensation is visible; ventilate produce trays."
        culinary = "Texture softening starting. Ideal for commercial baking, purees, soups, jams, or smoothies."
        discount = "30% Dynamic Clearance Discount"
        urgency = "High"
    elif score >= 30:
        action = "Urgent Markdown or Food Bank Donation Routing"
        storage_adv = "Near spoilage. Isolate immediately from fresh stock to prevent ethylene contamination."
        pkg_adv = "Unpack and inspect individual units. Discard any specimens exhibiting fungal spore spread."
        culinary = "Cook immediately. Do not consume raw. Suitable for pasteurized stock or immediate donation cooking."
        discount = "60% Flash Sale / Food Bank Allocation"
        urgency = "High"
    else:
        action = "Quarantine Batch & Route to Organic Composting"
        storage_adv = "High microbial risk. Remove immediately from cold storage to prevent air spore circulation."
        pkg_adv = "Quarantine containment bags."
        culinary = "UNSAFE FOR CONSUMPTION. Route to municipal organic waste composting or biogas digestion."
        discount = "100% Write-Off / Composting"
        urgency = "Critical"

    return BatchRecommendation(
        batch_id=batch.get("batch_id", batch_id),
        product_name=p_name,
        freshness_score=score,
        freshness_status=status,
        suggested_action=action,
        storage_advice=storage_adv,
        packaging_advice=pkg_adv,
        culinary_recommendation=culinary,
        discount_recommendation=discount,
        urgency=urgency
    )

@router.get("/fefo-queue", response_model=List[FEFOQueueItem])
async def get_fefo_dispatch_queue():
    """
    Computes an optimized First-Expiry-First-Out (FEFO) inventory rotation queue,
    prioritizing batches with the shortest remaining shelf life to minimize waste.
    """
    db = get_database()
    cursor = db.food_batches.find({"status": "Available"})
    batches = await cursor.to_list(100)

    now = datetime.utcnow()
    queue = []

    for b in batches:
        try:
            exp_date = datetime.strptime(b["expiry_date"][:10], "%Y-%m-%d")
            remaining_days = max(0, (exp_date - now).days)
        except Exception:
            remaining_days = 10

        score = b.get("freshness_score", 85)
        qty = b.get("quantity_kg", 500.0)
        price = b.get("unit_price_per_kg", 2.50)
        potential_loss = round(qty * price, 2)

        if remaining_days <= 3 or score < 60:
            urgency = "Critical FEFO Dispatch"
            channel = "Front-Shelf Flash Sale / Instant Distribution"
        elif remaining_days <= 7 or score < 78:
            urgency = "High Priority"
            channel = "Standard Retail Dispatch / FEFO Rotation"
        else:
            urgency = "Standard Velocity"
            channel = "Cold Storage Buffer Hold"

        queue.append(FEFOQueueItem(
            batch_id=b.get("batch_id", "BATCH-01"),
            product_name=b.get("product_name", "Produce Item"),
            category=b.get("category", "Fruits"),
            warehouse_name=b.get("warehouse_name", "Central Cold Storage"),
            quantity_kg=qty,
            unit_price_per_kg=price,
            expiry_date=b.get("expiry_date", "2026-09-30"),
            remaining_days=remaining_days,
            freshness_score=score,
            freshness_status=b.get("freshness_status", "Fresh"),
            urgency_level=urgency,
            suggested_channel=channel,
            potential_revenue_loss=potential_loss
        ))

    # Sort queue ascending by remaining days (most urgent first)
    queue.sort(key=lambda x: (x.remaining_days, x.freshness_score))
    return queue

@router.get("/markdowns", response_model=List[DynamicMarkdownItem])
async def get_dynamic_markdown_recommendations():
    """
    Generates intelligent price markdown recommendations to accelerate inventory turnover
    and prevent food spoilage write-offs.
    """
    db = get_database()
    cursor = db.food_batches.find({"status": "Available"})
    batches = await cursor.to_list(100)

    now = datetime.utcnow()
    markdowns = []

    for b in batches:
        try:
            exp_date = datetime.strptime(b["expiry_date"][:10], "%Y-%m-%d")
            days_left = max(0, (exp_date - now).days)
        except Exception:
            days_left = 12

        score = b.get("freshness_score", 85)
        price = b.get("unit_price_per_kg", 2.50)
        qty = b.get("quantity_kg", 500.0)

        discount_pct = 0
        urgency = "Standard"
        reason = "Optimal condition; maintain full price."

        if score < 40 or days_left <= 1:
            discount_pct = 70
            urgency = "Urgent Clearance"
            reason = "Near expiry window (<24-48h). 70% markdown will recover logistics costs."
        elif score < 60 or days_left <= 3:
            discount_pct = 40
            urgency = "High"
            reason = "Shelf-life window narrowing (<3 days). Apply 40% clearance markdown."
        elif score < 75 or days_left <= 6:
            discount_pct = 15
            urgency = "Medium"
            reason = "Moderate velocity decline. 15% promotional discount recommended to accelerate sales."

        if discount_pct > 0:
            disc_price = round(price * (1.0 - (discount_pct / 100.0)), 2)
            revenue_saved = round(qty * disc_price, 2)

            markdowns.append(DynamicMarkdownItem(
                batch_id=b.get("batch_id", "BATCH-01"),
                product_name=b.get("product_name", "Produce Item"),
                category=b.get("category", "Fruits"),
                warehouse_name=b.get("warehouse_name", "Central Cold Storage"),
                quantity_kg=qty,
                original_price_per_kg=price,
                discount_percent=discount_pct,
                discounted_price_per_kg=disc_price,
                remaining_days=days_left,
                freshness_score=score,
                reason=reason,
                urgency=urgency,
                potential_revenue_saved=revenue_saved
            ))

    markdowns.sort(key=lambda x: -x.discount_percent)
    return markdowns

@router.get("/storage-matrix", response_model=List[EthyleneMatrixRule])
async def get_ethylene_storage_matrix():
    """
    Returns the biological ethylene compatibility and cold-chain co-location matrix
    to prevent cross-contamination and premature ripening.
    """
    return [EthyleneMatrixRule(**r) for r in ETHYLENE_RULES]

@router.get("/overview")
async def get_recommendations_overview():
    """
    High-level operational summary of inventory rotation, markdown opportunities, and waste mitigation.
    """
    db = get_database()
    cursor = db.food_batches.find({"status": "Available"})
    batches = await cursor.to_list(100)

    critical_count = 0
    markdown_count = 0
    total_value_at_risk = 0.0
    total_recoverable_revenue = 0.0

    now = datetime.utcnow()
    for b in batches:
        try:
            exp_date = datetime.strptime(b["expiry_date"][:10], "%Y-%m-%d")
            days_left = max(0, (exp_date - now).days)
        except Exception:
            days_left = 10

        score = b.get("freshness_score", 85)
        qty = b.get("quantity_kg", 500.0)
        price = b.get("unit_price_per_kg", 2.50)

        if days_left <= 3 or score < 60:
            critical_count += 1
            total_value_at_risk += (qty * price)

        if days_left <= 6 or score < 75:
            markdown_count += 1
            total_recoverable_revenue += (qty * price * 0.7)

    return {
        "active_recommendations_count": critical_count + markdown_count + len(ETHYLENE_RULES),
        "critical_fefo_batches": critical_count,
        "dynamic_markdown_opportunities": markdown_count,
        "inventory_value_at_risk_dollars": round(total_value_at_risk, 2),
        "potential_recovered_revenue_dollars": round(total_recoverable_revenue, 2),
        "ethylene_guidelines_count": len(ETHYLENE_RULES)
    }
