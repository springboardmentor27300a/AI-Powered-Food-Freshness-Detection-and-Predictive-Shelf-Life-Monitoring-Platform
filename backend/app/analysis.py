import io
import json
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .ml.assessment import assess_freshness, is_model_ready
from .models import FreshnessAnalysis, User
from .reports import generate_freshness_pdf_report
from .schemas import AnalysisHistoryItem, AnalysisTrendsResponse, FreshnessPredictionResponse

router = APIRouter(prefix="/analysis", tags=["analysis"])

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_IMAGE_DIMENSION = 4096
_MAX_IMAGE_PIXELS = 4_000_000


@router.post(
    "/predict",
    response_model=FreshnessPredictionResponse,
    status_code=status.HTTP_200_OK,
)
async def predict(
    file: UploadFile = File(...),
    item_name: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, WebP, and BMP images are supported",
        )

    image_bytes = await file.read(_MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must not exceed 10 MB",
        )

    try:
        with Image.open(io.BytesIO(image_bytes)) as uploaded_image:
            width, height = uploaded_image.size
            if width <= 0 or height <= 0 or width > _MAX_IMAGE_DIMENSION or height > _MAX_IMAGE_DIMENSION:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Image dimensions exceed allowed limits",
                )
            if width * height > _MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Image pixel count exceeds allowed limits",
                )
            uploaded_image.verify()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded image is malformed",
        ) from exc

    if not is_model_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Freshness model is not available",
        )

    try:
        result = assess_freshness(image_bytes)
    except (FileNotFoundError, ModuleNotFoundError, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Freshness model is not available",
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image analysis failed",
        )

    model_prediction = result["model_prediction"]
    visual_analysis = result["visual_analysis"]
    analysis = FreshnessAnalysis(
        user_id=current_user.id,
        item_name=item_name.strip() if item_name and item_name.strip() else model_prediction["food_item"],
        classification=result["classification"],
        confidence=result["confidence"],
        quality_score=result["quality_score"],
        spoilage_probability=result["spoilage_probability"],
        predicted_class=model_prediction["predicted_class"],
        color_metrics=json.dumps(visual_analysis["color"], default=float),
        texture_metrics=json.dumps(visual_analysis["texture"], default=float),

    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    result["id"] = analysis.id
    return result


@router.get("/history", response_model=list[AnalysisHistoryItem])
def history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list(
        db.scalars(
            select(FreshnessAnalysis)
            .where(FreshnessAnalysis.user_id == current_user.id)
            .order_by(FreshnessAnalysis.created_at.desc())
        )
    )


@router.get("/trends", response_model=AnalysisTrendsResponse)
def analysis_trends(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return daily freshness metrics for the current user's recent assessments."""
    since = datetime.utcnow() - timedelta(days=days)
    analyses = list(
        db.scalars(
            select(FreshnessAnalysis)
            .where(
                FreshnessAnalysis.user_id == current_user.id,
                FreshnessAnalysis.created_at >= since,
            )
            .order_by(FreshnessAnalysis.created_at.asc())
        )
    )

    daily = defaultdict(lambda: {"count": 0, "quality_total": 0, "spoilage_total": 0.0})
    for analysis in analyses:
        day = analysis.created_at.date()
        bucket = daily[day]
        bucket["count"] += 1
        bucket["quality_total"] += analysis.quality_score
        bucket["spoilage_total"] += analysis.spoilage_probability

    points = [
        {
            "date": day,
            "assessment_count": values["count"],
            "average_quality_score": round(values["quality_total"] / values["count"], 2),
            "average_spoilage_probability": round(values["spoilage_total"] / values["count"], 4),
        }
        for day, values in sorted(daily.items())
    ]
    return {
        "days": days,
        "assessment_count": len(analyses),
        "points": points,
    }


@router.get("/{analysis_id}/report")
def get_analysis_report(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if analysis_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Analysis ID must be a positive integer",
        )

    analysis = db.get(FreshnessAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis record not found",
        )

    # Authorization logic: owner OR administrator/food_quality_inspector role
    is_owner = analysis.user_id == current_user.id
    is_authorized_role = current_user.role in {"administrator", "food_quality_inspector"}
    if not (is_owner or is_authorized_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to download this analysis report",
        )

    try:
        pdf_bytes = generate_freshness_pdf_report(analysis, current_user)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report PDF: {exc}",
        ) from exc

    filename = f"FreshGuard_Report_{analysis_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
