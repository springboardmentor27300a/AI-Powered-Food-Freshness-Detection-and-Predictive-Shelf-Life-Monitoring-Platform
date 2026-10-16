"""
Food Image Analysis & Freshness Assessment API endpoints (Milestone 2).

Every endpoint here requires a valid JWT (via the existing
get_current_user dependency, same as app/api/inventory.py) and only
ever operates on inventory items that belong to the authenticated
user. An inventory item's ownership is always checked against
FoodInventory.user_id before any analysis is created or history is
returned - the frontend can never supply a user_id, and one user can
never see another user's inventory or freshness data.

The analysis itself is heuristic computer-vision (OpenCV/Pillow),
NOT a trained machine learning model - see app/core/image_processing.py
for details.
"""
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.access import inventory_scope, record_scope
from app.core.deps import get_current_user
from app.core.freshness_scoring import calculate_freshness, determine_trend_direction
from app.core.image_processing import (
    InvalidImageError,
    analysis_results_to_dicts,
    run_full_analysis,
)
from app.database import get_db
from app.models.freshness_assessment import FreshnessAssessment
from app.models.inventory import FoodInventory
from app.models.user import User
from app.schemas.freshness_assessment import (
    FreshnessAssessmentResponse,
    FreshnessTrendResponse,
)
from app.utils.file_storage import (
    MEDIA_ROOT,
    UploadValidationError,
    save_uploaded_image,
    validate_upload,
)

router = APIRouter(tags=["Freshness Analysis"])


def _get_owned_inventory_item_or_404(
    db: Session, inventory_id: uuid.UUID, current_user: User
) -> FoodInventory:
    """
    Same ownership pattern as app/api/inventory.py: look up the item
    scoped to the authenticated user, and return 404 (not 403) whether
    the item doesn't exist or belongs to someone else - this avoids
    revealing whether an item id exists for another user.
    """
    item = (
        db.query(FoodInventory)
        .filter(FoodInventory.id == inventory_id, inventory_scope(current_user))
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    return item


def _get_owned_assessment_or_404(
    db: Session, assessment_id: uuid.UUID, current_user: User, owner_only: bool = False
) -> FreshnessAssessment:
    assessment = (
        db.query(FreshnessAssessment)
        .filter(
            FreshnessAssessment.id == assessment_id,
            (FreshnessAssessment.user_id == current_user.id)
            if owner_only
            else record_scope(FreshnessAssessment.user_id, current_user),
        )
        .first()
    )
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freshness assessment not found",
        )
    return assessment


@router.post(
    "/api/inventory/{inventory_id}/freshness",
    response_model=FreshnessAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a food photo and run heuristic freshness analysis on it",
)
async def analyze_freshness(
    inventory_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Confirm the inventory item belongs to the authenticated user.
    #    user_id is NEVER taken from the request - only from the JWT.
    item = _get_owned_inventory_item_or_404(db, inventory_id, current_user)

    # 2. Read and validate the uploaded file (type + size).
    file_bytes = await file.read()
    try:
        validate_upload(file.content_type or "", len(file_bytes))
    except UploadValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )

    # 3. Run the heuristic computer-vision analysis. Any decoding
    #    problem (corrupt file, unsupported format) becomes a clean
    #    422 - never a raw stack trace back to the client.
    try:
        color, texture, spoilage = run_full_analysis(file_bytes)
    except InvalidImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )

    # 4. Combine the CV results into a score/category/probability.
    scoring = calculate_freshness(color, texture, spoilage)
    color_dict, texture_dict = analysis_results_to_dicts(color, texture)

    # 5. Save the image to disk (not into PostgreSQL) and persist the report.
    image_path = save_uploaded_image(file_bytes, file.filename or "upload.jpg")

    assessment = FreshnessAssessment(
        inventory_item_id=item.id,
        user_id=current_user.id,
        image_path=image_path,
        freshness_score=scoring.freshness_score,
        freshness_category=scoring.freshness_category,
        spoilage_probability=scoring.spoilage_probability,
        color_analysis=color_dict,
        texture_analysis=texture_dict,
        mold_detected=spoilage.mold_detected,
        bruising_detected=spoilage.bruising_detected,
        physical_damage_detected=spoilage.physical_damage_detected,
        quality_assessment=scoring.quality_assessment,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return assessment


@router.get(
    "/api/inventory/{inventory_id}/freshness",
    response_model=FreshnessTrendResponse,
    summary="Get freshness assessment history and trend for one inventory item",
)
def get_freshness_history(
    inventory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Confirms ownership before returning anything.
    _get_owned_inventory_item_or_404(db, inventory_id, current_user)

    assessments: List[FreshnessAssessment] = (
        db.query(FreshnessAssessment)
        .filter(
            FreshnessAssessment.inventory_item_id == inventory_id,
            record_scope(FreshnessAssessment.user_id, current_user),
        )
        .order_by(FreshnessAssessment.created_at.desc())
        .all()
    )

    scores_newest_first = [a.freshness_score for a in assessments]
    trend_direction = determine_trend_direction(scores_newest_first)

    return FreshnessTrendResponse(
        inventory_item_id=inventory_id,
        total_assessments=len(assessments),
        assessments=assessments,
        trend_direction=trend_direction,
    )


@router.get(
    "/api/freshness/{assessment_id}",
    response_model=FreshnessAssessmentResponse,
    summary="Get one specific freshness assessment report",
)
def get_single_assessment(
    assessment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_assessment_or_404(db, assessment_id, current_user)


@router.delete(
    "/api/freshness/{assessment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a freshness assessment report",
)
def delete_assessment(
    assessment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_owned_assessment_or_404(db, assessment_id, current_user, owner_only=True)
    db.delete(assessment)
    db.commit()
    return None


@router.get(
    "/api/freshness/{assessment_id}/image",
    summary="Get the actual uploaded food photo for one freshness assessment",
)
def get_assessment_image(
    assessment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Serves the real image bytes for a freshness assessment, so the
    frontend (including the downloadable report) can display the
    actual uploaded photo rather than a placeholder.

    Ownership is checked the same way as every other endpoint here.
    No filesystem path is ever included in the JSON response - the
    client only ever gets image bytes back from this endpoint.
    """
    assessment = _get_owned_assessment_or_404(db, assessment_id, current_user)

    full_path = MEDIA_ROOT / assessment.image_path
    if not full_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file for this assessment could not be found",
        )

    extension = Path(assessment.image_path).suffix.lower()
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(extension, "application/octet-stream")

    return FileResponse(path=str(full_path), media_type=media_type)
