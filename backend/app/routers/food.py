from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import Food
from app.schemas.food import FoodCreate, FoodResponse


router = APIRouter(
    prefix="/foods",
    tags=["Food"],
)


# ============================================================
# GET ALL FOODS
# ============================================================

@router.get(
    "",
    response_model=list[FoodResponse],
)
def get_my_foods(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(Food)
        .filter(
            Food.user_id == current_user.id
        )
        .order_by(
            Food.created_at.desc()
        )
        .all()
    )


# ============================================================
# ADD FOOD
# ============================================================

@router.post(
    "",
    response_model=FoodResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_food(
    food: FoodCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    new_food = Food(
        user_id=current_user.id,

        food_name=food.food_name,

        # ====================================================
        # EXISTING FOOD INFORMATION
        # ====================================================

        category=food.category,

        freshness_status=food.freshness_status,

        freshness_score=food.freshness_score,

        image_path=food.image_path,

        manufacturing_date=food.manufacturing_date,

        expiry_date=food.expiry_date,

        storage_condition=food.storage_condition,

        # ====================================================
        # MILESTONE 3 - STORAGE INTELLIGENCE INPUTS
        # ====================================================

        storage_temperature=food.storage_temperature,

        storage_humidity=food.storage_humidity,

        packaging_type=food.packaging_type,

        storage_duration=food.storage_duration,

        air_circulation=food.air_circulation,

        light_exposure=food.light_exposure,

        # ====================================================
        # MILESTONE 3 OUTPUTS
        #
        # These are initially empty.
        # They will be populated by the shelf-life /
        # storage intelligence prediction workflow.
        # ====================================================

        remaining_shelf_life=None,

        shelf_life_confidence=None,

        shelf_life_risk=None,

        storage_compliance_score=None,

        overall_health_score=None,
    )

    db.add(new_food)

    db.commit()

    db.refresh(new_food)

    return new_food


# ============================================================
# GET SINGLE FOOD
# ============================================================

@router.get(
    "/{food_id}",
    response_model=FoodResponse,
)
def get_food(
    food_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    food = (
        db.query(Food)
        .filter(
            Food.id == food_id,
            Food.user_id == current_user.id,
        )
        .first()
    )

    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food not found",
        )

    return food


# ============================================================
# DELETE FOOD
# ============================================================

@router.delete(
    "/{food_id}",
)
def delete_food(
    food_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    food = (
        db.query(Food)
        .filter(
            Food.id == food_id,
            Food.user_id == current_user.id,
        )
        .first()
    )

    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food not found",
        )

    db.delete(food)

    db.commit()

    return {
        "message": "Food deleted successfully",
        "food_id": food_id,
    }