from fastapi import APIRouter
from database import SessionLocal
from models.batch import Batch
from services.analytics_service import generate_inventory_analytics

router = APIRouter(
    prefix="/analytics",
    tags=["Freshness Analytics"]
)


@router.get("/dashboard")
def get_analytics_dashboard():

    db = SessionLocal()

    try:
        batches = (
    db.query(Batch)
    .filter(Batch.quantity > 0)
    .all()
)

        analytics = generate_inventory_analytics(
            batches
        )

        return analytics

    finally:
        db.close()