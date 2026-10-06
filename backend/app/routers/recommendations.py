"""
/api/recommendations — Milestone 3.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.batch import Batch
from app.models.shelf_life import ShelfLifePrediction
from app.models.user import User, UserRole
from app.schemas.recommendation import RecommendationListResponse, RecommendationOut
from app.services import recommendation_service

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

GENERATOR_ROLES = (UserRole.RETAIL_MANAGER, UserRole.WAREHOUSE_OPERATOR,
                    UserRole.QUALITY_INSPECTOR, UserRole.ADMINISTRATOR)


@router.get("/batch/{batch_id}", response_model=RecommendationListResponse)
def list_recommendations(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = recommendation_service.list_for_batch(db, batch_id)
    return RecommendationListResponse(items=items, total=total)


@router.post("/batch/{batch_id}/generate", response_model=list[RecommendationOut])
def generate_recommendations(
    batch_id: uuid.UUID,
    current_user: User = Depends(require_role(*GENERATOR_ROLES)),
    db: Session = Depends(get_db),
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    latest_sl = (
        db.query(ShelfLifePrediction)
        .filter(ShelfLifePrediction.batch_id == batch_id)
        .order_by(ShelfLifePrediction.created_at.desc())
        .first()
    )
    return recommendation_service.generate_for_batch(db, batch, latest_sl, None)
