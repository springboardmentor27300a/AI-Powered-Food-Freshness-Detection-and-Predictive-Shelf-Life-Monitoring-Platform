"""Additive, abstention-first M2 v2 endpoint.

No existing M2 route, M3 module, model artifact, or database record is used or
modified here.  This first slice only validates inputs and reports whether an
approved M2 v2 model exists for the selected category.
"""

from __future__ import annotations

import io
import json
import warnings
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .ml.image_analysis import analyze_image
from .ml.m2_registry import M2RegistryError, category_capability, load_registry
from .ml.m2_types import CAPABILITY_UNCERTAIN, CategoryCapability, normalize_category
from .ml.m2_inference import assess_approved_freshness
from .ml.m2_legacy_candidate import inspect_legacy_fruit_candidate
from .ml.m2_research_fruit import assess_research_fruit, normalize_legacy_fruit_subtype
from .ml.m2_types import CANONICAL_CATEGORIES
from .models import User
from .m2_models import M2Analysis
from .schemas_m2 import (
    M2CategoryResult,
    M2DefectResult,
    M2FreshnessResult,
    M2V2PredictionResponse,
    M2CapabilitiesResponse,
    M2DefectCapability,
    M2ResearchFruitResponse,
)


router = APIRouter(prefix="/analysis/v2", tags=["analysis-v2"])
SUPPORTED_DEFECT_TYPES = {"mold", "bruising", "physical_damage"}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "BMP"}
CONTENT_TYPE_TO_FORMAT = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
    "image/bmp": "BMP",
}
SUPPORTED_IMAGE_MODES = {"RGB"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
MAX_IMAGE_PIXELS = 4_000_000

DEFECT_CAPABILITIES = (
    M2DefectCapability(
        defect_type="mold",
        capability_status="not_yet_supported",
        reason="No approved mold detector or commercially verified labeled mold dataset is available.",
        capture_guidance="For future validation, capture a focused microscope image and a matching RGB context image.",
    ),
    M2DefectCapability(
        defect_type="bruising",
        capability_status="not_yet_supported",
        reason="No approved bruising detector or calibrated RGB bruise dataset is available.",
        capture_guidance="Capture evenly lit images from multiple angles and retain item/capture-session identifiers.",
    ),
    M2DefectCapability(
        defect_type="physical_damage",
        capability_status="not_yet_supported",
        reason="No approved physical-damage detector or labeled defect dataset is available.",
        capture_guidance="Capture close and context views of cuts, punctures, tears, cracks, or crush damage for annotation.",
    ),
)


def _filename_matches_image_format(filename: str | None, image_format: str) -> bool:
    if not filename:
        return True
    suffix = filename.rsplit(".", 1)[-1].lower()
    extension_map = {
        "jpg": "JPEG",
        "jpeg": "JPEG",
        "png": "PNG",
        "webp": "WEBP",
        "bmp": "BMP",
    }
    expected = extension_map.get(suffix)
    return expected is None or expected == image_format


async def _validated_image(file: UploadFile) -> tuple[bytes, str, int, int]:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported image format")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image file is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image file exceeds 10 MB limit")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as decoded:
                image_format = decoded.format
                decoded_mode = decoded.mode
                decoded.verify()
            with Image.open(io.BytesIO(content)) as decoded:
                width, height = decoded.size
                if decoded.mode != decoded_mode:
                    decoded_mode = decoded.mode
                if decoded_mode not in SUPPORTED_IMAGE_MODES:
                    raise ValueError("Unsupported image channels")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image could not be decoded safely")

    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported decoded image format")
    expected_format = CONTENT_TYPE_TO_FORMAT.get(file.content_type)
    if expected_format is None or expected_format != image_format:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Image MIME type does not match decoded image format")
    if not _filename_matches_image_format(file.filename, image_format):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Image filename extension does not match decoded image format")
    if width <= 0 or height <= 0 or width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image dimensions exceed allowed limits")
    if width * height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image pixel count exceeds allowed limits")
    return content, image_format, width, height


def _unavailable_capability(category: str) -> CategoryCapability:
    return CategoryCapability(
        category=category,
        status=CAPABILITY_UNCERTAIN,
        reason="The M2 model registry is unavailable or invalid; no assessment was performed.",
    )


@router.get("/capabilities", response_model=M2CapabilitiesResponse)
def capabilities_v2(
    current_user: User = Depends(get_current_user),
    _db: Session = Depends(get_db),
):
    """Expose capability and candidate status without running a model."""

    del current_user, _db
    try:
        registry = load_registry()
        capabilities = [category_capability(category, registry) for category in CANONICAL_CATEGORIES]
    except M2RegistryError:
        capabilities = [_unavailable_capability(category) for category in CANONICAL_CATEGORIES]
    return M2CapabilitiesResponse(
        categories=[
            M2CategoryResult(
                declared_category=entry.category,
                canonical_category=entry.category,
                capability_status=entry.status,
                reason=entry.reason,
                model_id=entry.model_id,
            )
            for entry in capabilities
        ],
        legacy_fruit_candidate=inspect_legacy_fruit_candidate(),
        defect_capabilities=list(DEFECT_CAPABILITIES),
    )


@router.post("/defects/{defect_type}/predict")
async def assess_defect(
    defect_type: str,
    file: UploadFile = File(...),
    declared_category: str = Form(...),
    target_surface: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    _db: Session = Depends(get_db),
):
    """Validate defect capture inputs and explicitly abstain without an approved detector."""
    del current_user, _db
    if defect_type not in SUPPORTED_DEFECT_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported defect type")
    canonical_category = normalize_category(declared_category)
    if canonical_category is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported food category")
    if defect_type == "physical_damage":
        if target_surface not in {"package", "food_surface"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="target_surface must be package or food_surface",
            )
    image_bytes, image_format, width, height = await _validated_image(file)
    del image_bytes
    capability = next(item for item in DEFECT_CAPABILITIES if item.defect_type == defect_type)
    result = {
        "defect_type": defect_type,
        "status": "not_assessed",
        "reason": capability.reason,
        "capture_guidance": capability.capture_guidance,
        "declared_category": canonical_category,
        "image_format": image_format,
        "image_width": width,
        "image_height": height,
    }
    if defect_type == "physical_damage":
        result["target_surface"] = target_surface
        if target_surface == "package":
            result["capture_guidance"] = (
                "Capture package damage separately from the food surface; this workflow does not assess food condition."
            )
        else:
            result["capture_guidance"] = (
                "Capture the food surface close-up; packaging damage is a separate assessment."
            )
    return result


@router.post("/research/fruit/predict", response_model=M2ResearchFruitResponse)
async def research_fruit_predict(
    file: UploadFile = File(...),
    food_subtype: str = Form(...),
    current_user: User = Depends(get_current_user),
    _db: Session = Depends(get_db),
):
    """Run the legacy checkpoint for development evaluation only.

    This route has no database persistence and is deliberately separate from
    production M2 v2 inference. It does not alter the legacy API contract.
    """

    del current_user, _db
    subtype = normalize_legacy_fruit_subtype(food_subtype)
    if subtype is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="food_subtype must be apple, banana, or orange for legacy research evaluation",
        )
    image_bytes, _, _, _ = await _validated_image(file)
    try:
        assessment = assess_research_fruit(image_bytes, subtype)
    except (FileNotFoundError, ModuleNotFoundError, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Legacy research model is not available",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Legacy research assessment failed",
        )
    return M2ResearchFruitResponse(declared_food_subtype=subtype, **assessment)


@router.post("/predict", response_model=M2V2PredictionResponse)
async def predict_v2(
    file: UploadFile = File(...),
    declared_category: str = Form(...),
    food_subtype: str | None = Form(default=None),
    item_name: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate and persist an image assessment, abstaining without an approved model."""
    canonical_category = normalize_category(declared_category)
    if canonical_category is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="declared_category must be one of the eight official FreshGuard categories",
        )

    image_bytes, image_format, image_width, image_height = await _validated_image(file)
    visual_analysis = analyze_image(image_bytes)
    try:
        registry = load_registry()
        capability = category_capability(canonical_category, registry, food_subtype)
    except M2RegistryError:
        capability = _unavailable_capability(canonical_category)
        registry = None

    reason = capability.reason
    inference = (
        assess_approved_freshness(image_bytes=image_bytes, category=canonical_category, food_subtype=food_subtype, registry=registry)
        if capability.status == "supported" and registry is not None
        else None
    )
    assessment_status = inference.status if inference is not None else "not_assessed"
    freshness_reason = inference.reason if inference is not None else reason
    defects = [
        M2DefectResult(defect_type="mold", reason=reason),
        M2DefectResult(defect_type="bruising", reason=reason),
        M2DefectResult(defect_type="physical_damage", reason=reason),
    ]
    response = M2V2PredictionResponse(
        item_name=item_name.strip() if item_name and item_name.strip() else None,
        assessment_status=assessment_status,
        image_format=image_format,
        image_width=image_width,
        image_height=image_height,
        category=M2CategoryResult(
            declared_category=declared_category,
            canonical_category=canonical_category,
            declared_food_subtype=food_subtype.strip() if food_subtype and food_subtype.strip() else None,
            capability_status=capability.status,
            reason=reason,
            model_id=capability.model_id,
        ),
        freshness=M2FreshnessResult(
            status=assessment_status,
            reason=freshness_reason,
            classification=inference.classification if inference is not None else None,
            confidence=inference.confidence if inference is not None else None,
        ),
        visual_analysis=visual_analysis,
        defects=defects,
        limitations=[
            "No production-approved M2 v2 model was used for this request.",
            "This image result does not establish whether food is safe to eat.",
        ],
        safety_notice="Use applicable food-safety procedures and qualified inspection for safety decisions.",
    )
    record = M2Analysis(
        user_id=current_user.id,
        item_name=response.item_name,
        declared_category=declared_category,
        category=canonical_category,
        food_subtype=response.category.declared_food_subtype,
        capability_status=capability.status,
        assessment_status=assessment_status,
        reason=freshness_reason,
        model_id=inference.model_id if inference is not None else capability.model_id,
        classification=response.freshness.classification,
        confidence=response.freshness.confidence,
        quality_score=response.freshness.quality_score,
        spoilage_probability=response.freshness.spoilage_probability,
        image_format=image_format,
        image_width=image_width,
        image_height=image_height,
        visual_analysis_json=json.dumps(visual_analysis),
        defects_json=json.dumps([item.model_dump() for item in defects]),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    response.id = record.id
    return response


@router.get("/history")
def m2_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
):
    records = db.scalars(
        select(M2Analysis)
        .where(M2Analysis.user_id == current_user.id)
        .order_by(M2Analysis.created_at.desc(), M2Analysis.id.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": row.id,
            "item_name": row.item_name,
            "declared_category": row.declared_category,
            "category": row.category,
            "assessment_status": row.assessment_status,
            "classification": row.classification,
            "confidence": row.confidence,
            "quality_score": row.quality_score,
            "spoilage_probability": row.spoilage_probability,
            "created_at": row.created_at,
        }
        for row in records
    ]


@router.get("/trends")
def m2_trends(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    records = db.scalars(
        select(M2Analysis)
        .where(M2Analysis.user_id == current_user.id, M2Analysis.created_at >= cutoff)
        .order_by(M2Analysis.created_at.asc())
    ).all()
    buckets: dict[str, list[M2Analysis]] = defaultdict(list)
    for row in records:
        buckets[row.created_at.date().isoformat()].append(row)
    points = []
    for day, rows in sorted(buckets.items()):
        assessed = [row for row in rows if row.assessment_status == "assessed"]
        points.append({
            "date": day,
            "assessment_count": len(rows),
            "average_quality_score": (
                sum(row.quality_score for row in assessed if row.quality_score is not None)
                / sum(row.quality_score is not None for row in assessed)
                if any(row.quality_score is not None for row in assessed) else None
            ),
            "average_spoilage_probability": (
                sum(row.spoilage_probability for row in assessed if row.spoilage_probability is not None)
                / sum(row.spoilage_probability is not None for row in assessed)
                if any(row.spoilage_probability is not None for row in assessed) else None
            ),
        })
    return {
        "days": days,
        "assessment_count": len(records),
        "assessed_count": sum(row.assessment_status == "assessed" for row in records),
        "points": points,
    }


@router.get("/{analysis_id}/report")
def m2_report(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.scalar(select(M2Analysis).where(
        M2Analysis.id == analysis_id,
        M2Analysis.user_id == current_user.id,
    ))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="M2 analysis not found")

    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from fastapi.responses import Response

    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=letter)
    pdf.setTitle("FreshGuard M2 Assessment Report")
    pdf.drawString(72, 740, "FreshGuard M2 Assessment Report")
    pdf.drawString(72, 710, f"Item: {record.item_name or 'Unspecified'}")
    pdf.drawString(72, 690, f"Category: {record.category}")
    pdf.drawString(72, 670, f"Assessment status: {record.assessment_status}")
    pdf.drawString(72, 650, f"Reason: {record.reason[:100]}")
    pdf.drawString(72, 620, "This assessment does not establish food safety.")
    pdf.save()
    return Response(
        content=output.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=FreshGuard_M2_{record.id}.pdf"},
    )

