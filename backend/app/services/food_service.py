"""
Business logic for food item CRUD, search, and category filtering.
"""
import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.food_item import FoodItem
from app.schemas.food_item import FoodItemCreate, FoodItemUpdate


def create_food_item(db: Session, data: FoodItemCreate, created_by: uuid.UUID) -> FoodItem:
    item = FoodItem(**data.model_dump(), created_by=created_by)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_food_items(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    search: str | None = None,
):
    query = db.query(FoodItem)
    if category:
        query = query.filter(FoodItem.category == category)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(FoodItem.name.ilike(like), FoodItem.description.ilike(like)))

    total = query.count()
    items = (
        query.order_by(FoodItem.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_food_item(db: Session, food_item_id: uuid.UUID) -> FoodItem | None:
    return db.query(FoodItem).filter(FoodItem.id == food_item_id).first()


def update_food_item(db: Session, item: FoodItem, data: FoodItemUpdate) -> FoodItem:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete_food_item(db: Session, item: FoodItem) -> None:
    from app.models.batch import Batch
    from app.models.recommendation import Recommendation
    from app.models.shelf_life import ShelfLifePrediction
    from app.models.food_image import FoodImage
    from app.models.storage import StorageReading
    from app.models.report import FreshnessReport

    # Find all batches belonging to this food item
    batches = db.query(Batch).filter(
        Batch.food_item_id == item.id
    ).all()

    for batch in batches:

        # Delete freshness reports first because they reference
        # images, CNN predictions, visual analysis and shelf-life records.
        db.query(FreshnessReport).filter(
            FreshnessReport.batch_id == batch.id
        ).delete(synchronize_session=False)

        # Delete recommendations
        db.query(Recommendation).filter(
            Recommendation.batch_id == batch.id
        ).delete(synchronize_session=False)

        # Delete shelf-life predictions
        db.query(ShelfLifePrediction).filter(
            ShelfLifePrediction.batch_id == batch.id
        ).delete(synchronize_session=False)

        # Delete storage readings linked to this batch
        db.query(StorageReading).filter(
            StorageReading.batch_id == batch.id
        ).delete(synchronize_session=False)

        # Delete food images.
        # CNN and visual-analysis records are removed through
        # FoodImage's cascade relationships.
        images = db.query(FoodImage).filter(
            FoodImage.batch_id == batch.id
        ).all()

        for image in images:
            db.delete(image)

        # Delete the batch
        db.delete(batch)

    # Finally delete the food item
    db.delete(item)
    db.commit()