from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models.batch import Batch
from services.inventory_rotation import generate_rotation_plan


router = APIRouter(
    prefix="/inventory",
    tags=["Inventory Intelligence"]
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get("/rotation-plan")
def get_inventory_rotation_plan(
    db: Session = Depends(get_db)
):
    all_batches = (
        db.query(Batch)
        .filter(Batch.quantity > 0)
        .all()
    )

    today = date.today()

    batches = []

    for batch in all_batches:
        effective_expiry = (
            min(batch.expiry_date, batch.predicted_expiry_date)
            if batch.predicted_expiry_date
            else batch.expiry_date
        )

        is_spoiled = (
            batch.freshness_score is not None
            and batch.freshness_score < 40
        )

        if effective_expiry >= today and not is_spoiled:
            batches.append(batch)

    if not batches:
        return {
            "message": "No available batches found.",
            "total_batches": 0,
            "rotation_plan": []
        }

    rotation_plan = generate_rotation_plan(batches)

    return {
        "rotation_method": "FEFO - First Expired, First Out",
        "total_batches": len(rotation_plan),
        "rotation_plan": rotation_plan
    }