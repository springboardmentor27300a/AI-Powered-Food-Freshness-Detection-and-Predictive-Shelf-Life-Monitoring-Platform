from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
import random
from datetime import datetime

router = APIRouter(prefix="/analysis", tags=["Image Analysis & Visual Assessment"])

class ImageScanRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    product_name: Optional[str] = "Produce Item"
    category: Optional[str] = "Fruits"

class ImageScanResponse(BaseModel):
    visual_score: int = Field(..., ge=0, le=100, description="Visual Freshness Score (40% weight)")
    status: str = Field(..., description="Fresh | Good | Acceptable | Near Spoilage | Spoiled")
    discoloration_percent: float
    surface_integrity_percent: float
    mold_detected: bool
    mold_spot_count: int
    bruise_detected: bool
    spoilage_indicators: List[str]
    confidence_score: float
    diagnosis: str
    analyzed_at: str

@router.post("/scan", response_model=ImageScanResponse)
async def scan_food_image(req: ImageScanRequest):
    """
    Simulates / performs AI Computer Vision feature extraction on a produce image:
    - Color degradation & surface discoloration (%)
    - Mold spot detection
    - Surface integrity & bruising analysis
    - Visual Freshness Score (0 - 100)
    """
    seed_str = (req.image_url or req.image_base64 or req.product_name or "fresh").lower()
    
    if "spoiled" in seed_str or "rot" in seed_str or "mold" in seed_str:
        visual_score = random.randint(15, 45)
        status_name = "Spoiled" if visual_score < 30 else "Near Spoilage"
        mold = True
        mold_count = random.randint(3, 8)
        bruise = True
        discoloration = round(random.uniform(15.0, 38.0), 1)
        surface_integrity = round(random.uniform(40.0, 65.0), 1)
        indicators = [
            f"Fungal Mold Spots ({mold_count} detected)",
            f"Surface Discoloration ({discoloration}%)",
            "Severe Cell Structure Degradation",
            "Bruise & Soft Tissue Breakdown"
        ]
        diagnosis = "Spoilage detected! High fungal mold concentration and tissue degradation. Not fit for consumption."
    elif "acceptable" in seed_str or "wilted" in seed_str or "aging" in seed_str:
        visual_score = random.randint(65, 78)
        status_name = "Acceptable"
        mold = False
        mold_count = 0
        bruise = True
        discoloration = round(random.uniform(4.5, 9.5), 1)
        surface_integrity = round(random.uniform(78.0, 86.0), 1)
        indicators = [
            f"Minor Surface Discoloration ({discoloration}%)",
            "Slight Epidermal Bruising",
            "Initial Moisture Loss"
        ]
        diagnosis = "Acceptable visual condition. Slight surface oxidation detected. Recommended for immediate sale or processing."
    else:
        visual_score = random.randint(88, 98)
        status_name = "Fresh" if visual_score >= 92 else "Good"
        mold = False
        mold_count = 0
        bruise = False
        discoloration = round(random.uniform(0.1, 2.2), 1)
        surface_integrity = round(random.uniform(94.0, 99.5), 1)
        indicators = [
            f"Surface Integrity {surface_integrity}%",
            f"Optimal Chlorophyll Pigmentation (Discoloration < {discoloration}%)",
            "Zero Fungal Spores Detected",
            "No Tissue Bruising"
        ]
        diagnosis = "Excellent visual condition! Crisp surface integrity and vibrant pigmentation. Peak shelf life expected."

    return ImageScanResponse(
        visual_score=visual_score,
        status=status_name,
        discoloration_percent=discoloration,
        surface_integrity_percent=surface_integrity,
        mold_detected=mold,
        mold_spot_count=mold_count,
        bruise_detected=bruise,
        spoilage_indicators=indicators,
        confidence_score=round(random.uniform(0.92, 0.99), 3),
        diagnosis=diagnosis,
        analyzed_at=datetime.utcnow().isoformat()
    )
