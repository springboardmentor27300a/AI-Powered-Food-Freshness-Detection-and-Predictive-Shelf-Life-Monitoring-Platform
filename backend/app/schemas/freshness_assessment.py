"""
Pydantic schemas for the Food Image Analysis & Freshness Assessment
module (Milestone 2).

There is no "create" request schema here the way there is for
inventory — a freshness assessment isn't built from JSON fields typed
by the user, it's produced by uploading an image (multipart/form-data)
and running heuristic computer-vision analysis on it server-side.
"""
import uuid
from datetime import datetime
from typing import Dict, Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.freshness_assessment import FreshnessCategory


class ColorAnalysisResult(BaseModel):
    """Sub-scores from the heuristic color analysis step (0-100 each)."""
    color_score: float = Field(..., description="0-100, higher = fresher color profile")
    degradation_level: str = Field(
        ..., description="Human-readable label: none / mild / moderate / severe"
    )
    dominant_hue_shift: float = Field(
        ..., description="Measured shift away from the expected fresh hue band"
    )


class TextureAnalysisResult(BaseModel):
    """Sub-scores from the heuristic texture analysis step (0-100 each)."""
    texture_score: float = Field(..., description="0-100, higher = smoother/expected texture")
    surface_roughness: float = Field(..., description="Relative roughness measurement")
    texture_change_level: str = Field(
        ..., description="Human-readable label: none / mild / moderate / severe"
    )


class FreshnessAssessmentResponse(BaseModel):
    """
    Full freshness report returned after analyzing an uploaded image,
    and the shape returned in list form for freshness trend history.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    inventory_item_id: uuid.UUID
    user_id: uuid.UUID
    image_path: str

    freshness_score: int = Field(..., ge=0, le=100)
    freshness_category: FreshnessCategory
    spoilage_probability: float = Field(..., ge=0.0, le=1.0)

    color_analysis: Dict[str, Any]
    texture_analysis: Dict[str, Any]

    mold_detected: bool
    bruising_detected: bool
    physical_damage_detected: bool

    quality_assessment: str
    created_at: datetime


class FreshnessTrendResponse(BaseModel):
    """
    Freshness trend analysis for one inventory item, built ONLY from
    that item's real stored assessment history — never fabricated.
    """
    inventory_item_id: uuid.UUID
    total_assessments: int
    assessments: list[FreshnessAssessmentResponse]
    trend_direction: str = Field(
        ...,
        description=(
            "improving / declining / stable / insufficient_data — "
            "derived by comparing the two most recent scores. "
            "'insufficient_data' when fewer than 2 assessments exist."
        ),
    )
