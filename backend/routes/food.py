from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
from sqlalchemy.orm import Session
from database import SessionLocal
from models.food_item import FoodItem
from models.batch import Batch

router = APIRouter()

class FoodItemCreate(BaseModel):
    name: str
    category: Literal[
    "Fruits",
    "Vegetables",
    "Dairy Products",
    "Meat & Poultry",
    "Seafood",
    "Bakery Products",
    "Packaged Foods",
    "Beverages"
]

@router.post("/food-items")
def create_food_item(food: FoodItemCreate):
    db = SessionLocal()

    new_food = FoodItem(
        name=food.name,
        category=food.category
    )

    db.add(new_food)
    db.commit()
    db.refresh(new_food)
    db.close()

    return {
        "message": "Food item added successfully",
        "id": new_food.id,
        "name": new_food.name,
        "category": new_food.category
    }
@router.get("/food-items")
def get_food_items():
    db = SessionLocal()

    food_items = db.query(FoodItem).all()

    result = []

    for food in food_items:
        result.append({
            "id": food.id,
            "name": food.name,
            "category": food.category
        })

    db.close()

    return result

@router.put("/food-items/{food_id}")
def update_food_item(food_id: int, food: FoodItemCreate):
    db = SessionLocal()

    item = db.query(FoodItem).filter(FoodItem.id == food_id).first()

    if not item:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Food item not found"
        )

    item.name = food.name
    item.category = food.category

    db.commit()
    db.refresh(item)

    result = {
        "message": "Food item updated successfully",
        "id": item.id,
        "name": item.name,
        "category": item.category
    }

    db.close()
    return result


@router.delete("/food-items/{food_id}")
def delete_food_item(food_id: int):
    db = SessionLocal()

    item = db.query(FoodItem).filter(FoodItem.id == food_id).first()

    if not item:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Food item not found"
        )

    existing_batch = db.query(Batch).filter(
        Batch.food_item_id == food_id
    ).first()

    if existing_batch:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this food item because batches already exist for it."
        )

    db.delete(item)
    db.commit()
    db.close()

    return {
        "message": "Food item deleted successfully"
    }
