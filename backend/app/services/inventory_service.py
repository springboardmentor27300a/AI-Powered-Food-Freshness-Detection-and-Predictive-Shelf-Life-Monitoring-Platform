"""
Aggregation logic for the basic (non-AI) dashboard summary.
"""
from sqlalchemy.orm import Session

from app.models.batch import Batch, BatchStatus
from app.models.food_item import FoodItem

def get_inventory_summary(db: Session) -> dict:
    batches = db.query(Batch).all()

    # Recompute status for every batch so the summary is always accurate,
    # even if a batch expired since it was last touched.
    changed = False
    for b in batches:
        new_status = b.compute_status()
        if new_status != b.status:
            b.status = new_status
            changed = True
    if changed:
        db.commit()

    total_food_items = db.query(FoodItem).count()
    total_batches = len(batches)
    total_available_quantity = sum(b.quantity for b in batches if b.status != BatchStatus.EXPIRED)
    low_stock_count = sum(1 for b in batches if b.status == BatchStatus.LOW_STOCK)
    near_expiry_count = sum(1 for b in batches if b.status == BatchStatus.NEAR_EXPIRY)
    expired_count = sum(1 for b in batches if b.status == BatchStatus.EXPIRED)

    category_summary: dict[str, int] = {}
    food_items = db.query(FoodItem).all()
    for item in food_items:
        category_summary[item.category.value] = category_summary.get(item.category.value, 0) + 1

    return {
        "total_food_items": total_food_items,
        "total_batches": total_batches,
        "total_available_quantity": total_available_quantity,
        "low_stock_count": low_stock_count,
        "near_expiry_count": near_expiry_count,
        "expired_count": expired_count,
        "category_summary": category_summary,
    }
