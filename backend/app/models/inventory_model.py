from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class FoodCategory(str, Enum):
    FRUITS = "Fruits"
    VEGETABLES = "Vegetables"
    DAIRY = "Dairy"
    DAIRY_PRODUCTS = "Dairy Products"
    MEAT = "Meat"
    MEAT_POULTRY = "Meat & Poultry"
    FISH = "Fish"
    SEAFOOD = "Seafood"
    BAKERY = "Bakery"
    BAKERY_PRODUCTS = "Bakery Products"
    PACKAGED_FOOD = "Packaged Food"
    PACKAGED_FOODS = "Packaged Foods"
    BEVERAGES = "Beverages"
    GRAINS = "Grains"
    OTHER = "Other"

    @classmethod
    def list(cls):
        return [cat.value for cat in cls]

    @classmethod
    def standard_categories(cls):
        """The 8 core specification categories from Infosys Springboard requirements."""
        return [
            cls.FRUITS.value,
            cls.VEGETABLES.value,
            cls.DAIRY_PRODUCTS.value,
            cls.MEAT_POULTRY.value,
            cls.SEAFOOD.value,
            cls.BAKERY_PRODUCTS.value,
            cls.PACKAGED_FOODS.value,
            cls.BEVERAGES.value,
        ]


def normalize_food_category(cat_str: Optional[str], use_official_spec: bool = True) -> str:
    """Normalize input category strings into standard system categories."""
    if not cat_str:
        return FoodCategory.FRUITS.value
    c = cat_str.strip().lower()
    if "fruit" in c:
        return FoodCategory.FRUITS.value
    if "veg" in c:
        return FoodCategory.VEGETABLES.value
    if "dairy" in c or "milk" in c or "cheese" in c or "yogurt" in c or "butter" in c:
        return FoodCategory.DAIRY_PRODUCTS.value if use_official_spec else FoodCategory.DAIRY.value
    if "meat" in c or "poultry" in c or "chicken" in c or "beef" in c:
        return FoodCategory.MEAT_POULTRY.value if use_official_spec else FoodCategory.MEAT.value
    if "fish" in c or "seafood" in c or "salmon" in c:
        return FoodCategory.SEAFOOD.value if use_official_spec else FoodCategory.FISH.value
    if "baker" in c or "bread" in c:
        return FoodCategory.BAKERY_PRODUCTS.value if use_official_spec else FoodCategory.BAKERY.value
    if "pack" in c or "canned" in c:
        return FoodCategory.PACKAGED_FOODS.value if use_official_spec else FoodCategory.PACKAGED_FOOD.value
    if "bever" in c or "juice" in c or "drink" in c:
        return FoodCategory.BEVERAGES.value
    if "grain" in c or "cereal" in c or "rice" in c or "flour" in c:
        return FoodCategory.GRAINS.value
    return FoodCategory.OTHER.value


class StorageType(str, Enum):
    REFRIGERATED = "Refrigerated"
    FROZEN = "Frozen"
    ROOM_TEMPERATURE = "Room Temperature"
    PANTRY = "Pantry"
    DRY_STORAGE = "Dry Storage"
    COLD_STORAGE = "Cold Storage"
    CONTROLLED_ATMOSPHERE = "Controlled Atmosphere"

    @classmethod
    def list(cls):
        return [st.value for st in cls]


class FreshnessStatus(str, Enum):
    NOT_ANALYZED = "Not Analyzed"
    FRESH = "Fresh"
    GOOD = "Good"
    ACCEPTABLE = "Acceptable"
    NEAR_SPOILAGE = "Near Spoilage"
    EXPIRING_SOON = "Expiring Soon"
    SPOILED = "Spoiled"



def inventory_helper(item: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to convert MongoDB inventory document into a serializable dict."""
    if not item:
        return {}
    name = item.get("food_name") or item.get("name") or "Food Item"
    return {
        "id": str(item.get("_id")),
        "user_id": str(item.get("user_id")),
        "food_name": name,
        "name": name,
        "category": item.get("category"),
        "quantity": item.get("quantity"),
        "unit": item.get("unit"),
        "purchase_date": item.get("purchase_date"),
        "expiry_date": item.get("expiry_date"),
        "storage_type": item.get("storage_type"),
        "storage_temperature": item.get("storage_temperature"),
        "storage_humidity": item.get("storage_humidity"),
        "location": item.get("location"),
        "batch_number": item.get("batch_number"),
        "image_url": item.get("image_url"),
        "freshness_status": item.get("freshness_status", FreshnessStatus.NOT_ANALYZED.value),
        "freshness_score": item.get("freshness_score"),
        "shelf_life_days": item.get("shelf_life_days"),
        "is_archived": bool(item.get("is_archived", False)),
        "low_stock_threshold": float(item.get("low_stock_threshold", 5.0)),
        "stock_history": item.get("stock_history", []),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def freshness_record_helper(record: Dict[str, Any]) -> Dict[str, Any]:
    """Helper for future AI freshness_records collection."""
    if not record:
        return {}
    return {
        "id": str(record.get("_id")),
        "inventory_id": str(record.get("inventory_id")),
        "image_url": record.get("image_url"),
        "freshness_score": record.get("freshness_score"),
        "freshness_label": record.get("freshness_label"),
        "spoilage_probability": record.get("spoilage_probability"),
        "predicted_shelf_life": record.get("predicted_shelf_life"),
        "analysis_date": record.get("analysis_date"),
    }


def storage_condition_helper(record: Dict[str, Any]) -> Dict[str, Any]:
    """Helper for future storage_conditions collection."""
    if not record:
        return {}
    return {
        "id": str(record.get("_id")),
        "inventory_id": str(record.get("inventory_id")),
        "temperature": record.get("temperature"),
        "humidity": record.get("humidity"),
        "storage_location": record.get("storage_location"),
        "recorded_at": record.get("recorded_at"),
    }
