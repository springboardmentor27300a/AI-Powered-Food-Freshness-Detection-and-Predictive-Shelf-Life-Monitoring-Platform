"""Response schemas for the additive M2 v2 API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


CapabilityStatus = Literal["supported", "not_yet_supported", "uncertain"]
AssessmentStatus = Literal["assessed", "not_assessed"]
DefectType = Literal["mold", "bruising", "physical_damage"]


class M2CategoryResult(BaseModel):
    declared_category: str
    canonical_category: str
    declared_food_subtype: str | None = None
    capability_status: CapabilityStatus
    reason: str
    model_id: str | None = None


class M2FreshnessResult(BaseModel):
    status: AssessmentStatus = "not_assessed"
    reason: str
    classification: str | None = None
    confidence: float | None = None
    quality_score: int | None = None
    spoilage_probability: float | None = None


class M2DefectResult(BaseModel):
    defect_type: DefectType
    status: Literal["not_assessed"] = "not_assessed"
    reason: str


class M2V2PredictionResponse(BaseModel):
    id: int | None = None
    item_name: str | None = None
    assessment_status: AssessmentStatus = "not_assessed"
    image_format: str
    image_width: int = Field(gt=0)
    image_height: int = Field(gt=0)
    category: M2CategoryResult
    freshness: M2FreshnessResult
    visual_analysis: dict[str, dict]
    defects: list[M2DefectResult]
    limitations: list[str]
    safety_notice: str


class M2DefectCapability(BaseModel):
    defect_type: DefectType
    capability_status: Literal["not_yet_supported", "uncertain"]
    reason: str
    capture_guidance: str


class M2CapabilitiesResponse(BaseModel):
    categories: list[M2CategoryResult]
    legacy_fruit_candidate: dict
    defect_capabilities: list[M2DefectCapability]


class M2ResearchFruitResponse(BaseModel):
    assessment_status: Literal["research_assessed", "not_assessed"]
    declared_food_subtype: str
    reason: str
    result: dict | None = None

