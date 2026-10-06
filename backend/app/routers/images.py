"""
/api/images — Milestone 2 upload + analysis endpoints.
"""
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.batch import Batch
from app.models.food_image import FoodImage
from app.models.user import User, UserRole
from app.schemas.analysis import AnalyzeImageResponse, CNNPredictionOut, VisualAnalysisOut
from app.schemas.image import FoodImageOut
from app.services import cnn_service, image_service, visual_service

router = APIRouter(prefix="/api/images", tags=["images"])

INSPECTOR_ROLES = (UserRole.QUALITY_INSPECTOR, UserRole.ADMINISTRATOR)


@router.get("/model-status")
def cnn_model_status(current_user: User = Depends(get_current_user)):
    """Reports whether the trained CNN is available, unavailable, or errored.
    Never returns a fabricated status — reads the real model file state."""
    return cnn_service.model_status()


@router.post("/upload", response_model=FoodImageOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    batch_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(*INSPECTOR_ROLES)),
    db: Session = Depends(get_db),
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return await image_service.save_upload(db, file, batch_id, current_user.id)


@router.post("/{image_id}/analyze", response_model=AnalyzeImageResponse)
def analyze_image(
    image_id: uuid.UUID,
    current_user: User = Depends(require_role(*INSPECTOR_ROLES)),
    db: Session = Depends(get_db),
):
    image = db.query(FoodImage).filter(FoodImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    cnn_prediction = cnn_service.run_cnn_prediction(db, image)
    try:
        visual = visual_service.run_visual_analysis(db, image)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return AnalyzeImageResponse(
        image=FoodImageOut.model_validate(image),
        cnn_prediction=CNNPredictionOut.model_validate(cnn_prediction),
        visual_analysis=VisualAnalysisOut.model_validate(visual),
    )


@router.get("/batch/{batch_id}", response_model=list[FoodImageOut])
def list_images_for_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(FoodImage).filter(FoodImage.batch_id == batch_id).order_by(
        FoodImage.uploaded_at.desc()
    ).all()


@router.get("/{image_id}", response_model=FoodImageOut)
def get_image(
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    image = db.query(FoodImage).filter(FoodImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return image
