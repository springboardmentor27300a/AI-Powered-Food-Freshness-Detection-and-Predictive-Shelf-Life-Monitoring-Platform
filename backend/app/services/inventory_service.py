from datetime import datetime, timezone, date, timedelta
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from backend.app.database import get_inventory_collection
from backend.app.models.user_model import UserRole
from backend.app.models.inventory_model import (
    inventory_helper,
    FreshnessStatus,
    StorageType,
    FoodCategory,
)
from backend.app.schemas.inventory_schema import (
    InventoryCreateRequest,
    InventoryUpdateRequest,
    DashboardStatsResponse,
)


class InventoryService:
    @staticmethod
    def get_dataset_catalog(user_oid: Any) -> List[Dict[str, Any]]:
        """
        Curated realistic food items derived directly from the platform datasets:
        1. Fruit Freshness & Rotten Fruit Dataset (fresh/rotten apples, bananas, oranges, strawberries)
        2. Multi-Class Vegetable Freshness & Spoilage Dataset (capsicum, tomato, potato, cucumber, spinach)
        3. Food Quality & Spoilage Benchmark (Dairy, Meat, Seafood, Bakery, and Grains)
        """
        now = datetime.now(timezone.utc)
        today = date.today()

        raw_items = [
            # 1. Fruits Freshness Dataset (datasets/fruits/ & datasets/fresh|spoiled/)
            {
                "food_name": "Crisp Fuji Apples",
                "category": FoodCategory.FRUITS.value,
                "quantity": 2.5,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=12)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 4.0,
                "storage_humidity": 65.0,
                "location": "Refrigerator Crisper Drawer",
                "batch_number": "DS-FRT-APL01",
                "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 96.5,
            },
            {
                "food_name": "Cavendish Bananas",
                "category": FoodCategory.FRUITS.value,
                "quantity": 1.5,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 21.0,
                "storage_humidity": 60.0,
                "location": "Kitchen Countertop Bowl",
                "batch_number": "DS-FRT-BAN02",
                "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 68.0,
            },
            {
                "food_name": "Valencia Oranges",
                "category": FoodCategory.FRUITS.value,
                "quantity": 3.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 4.5,
                "storage_humidity": 70.0,
                "location": "Fruit Chiller Shelf",
                "batch_number": "DS-FRT-ORG03",
                "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 93.0,
            },
            {
                "food_name": "Rotten Overripe Apples",
                "category": FoodCategory.FRUITS.value,
                "quantity": 1.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=18)).strftime("%Y-%m-%d"),
                "expiry_date": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 24.0,
                "storage_humidity": 55.0,
                "location": "Quarantine Compost Bin",
                "batch_number": "DS-FRT-APL04",
                "image_url": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
                "freshness_status": FreshnessStatus.SPOILED.value,
                "freshness_score": 14.0,
            },
            {
                "food_name": "Blackened Rotten Bananas",
                "category": FoodCategory.FRUITS.value,
                "quantity": 0.8,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=12)).strftime("%Y-%m-%d"),
                "expiry_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 23.0,
                "storage_humidity": 65.0,
                "location": "Disposal Bin",
                "batch_number": "DS-FRT-BAN05",
                "image_url": "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=400&q=80",
                "freshness_status": FreshnessStatus.SPOILED.value,
                "freshness_score": 11.5,
            },
            {
                "food_name": "Farm Fresh Strawberries",
                "category": FoodCategory.FRUITS.value,
                "quantity": 500,
                "unit": "g",
                "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 3.0,
                "storage_humidity": 85.0,
                "location": "Refrigerator Top Shelf",
                "batch_number": "DS-FRT-STR06",
                "image_url": "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 64.0,
            },

            # 2. Multi-Class Vegetable Freshness Dataset (datasets/vegetables/)
            {
                "food_name": "Green Bell Capsicum",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 1.2,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=9)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 8.0,
                "storage_humidity": 90.0,
                "location": "Vegetable Crisper Bin",
                "batch_number": "DS-VEG-CAP01",
                "image_url": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 95.0,
            },
            {
                "food_name": "Soft Moldy Capsicum",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 0.4,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=16)).strftime("%Y-%m-%d"),
                "expiry_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 25.0,
                "storage_humidity": 75.0,
                "location": "Quarantine Bin",
                "batch_number": "DS-VEG-CAP02",
                "image_url": "https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=400&q=80",
                "freshness_status": FreshnessStatus.SPOILED.value,
                "freshness_score": 15.0,
            },
            {
                "food_name": "Vine-Ripened Fresh Tomatoes",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 1.5,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 18.0,
                "storage_humidity": 65.0,
                "location": "Counter Produce Basket",
                "batch_number": "DS-VEG-TOM03",
                "image_url": "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 66.0,
            },
            {
                "food_name": "Rotten Bacterial Tomatoes",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 0.6,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=14)).strftime("%Y-%m-%d"),
                "expiry_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 26.0,
                "storage_humidity": 80.0,
                "location": "Waste Bin",
                "batch_number": "DS-VEG-TOM04",
                "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=80",
                "freshness_status": FreshnessStatus.SPOILED.value,
                "freshness_score": 9.0,
            },
            {
                "food_name": "Russet Baking Potatoes",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 4.5,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=35)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 12.0,
                "storage_humidity": 80.0,
                "location": "Dark Ventilated Pantry Bin",
                "batch_number": "DS-VEG-POT05",
                "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 92.0,
            },
            {
                "food_name": "Yellow Cooking Onions",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 3.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=6)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 15.0,
                "storage_humidity": 65.0,
                "location": "Ventilated Mesh Bin in Dry Pantry",
                "batch_number": "DS-VEG-ONI08",
                "image_url": "https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 94.0,
            },
            {
                "food_name": "Sweet Nantes Carrots",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 1.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=25)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 3.0,
                "storage_humidity": 95.0,
                "location": "High-Humidity Refrigerator Crisper",
                "batch_number": "DS-VEG-CAR09",
                "image_url": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 95.0,
            },
            {
                "food_name": "English Crisp Cucumbers",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 1.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 10.0,
                "storage_humidity": 90.0,
                "location": "Door Shelf",
                "batch_number": "DS-VEG-CUC06",
                "image_url": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 89.0,
            },
            {
                "food_name": "Organic Baby Spinach",
                "category": FoodCategory.VEGETABLES.value,
                "quantity": 300,
                "unit": "g",
                "purchase_date": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 2.0,
                "storage_humidity": 95.0,
                "location": "Upper Chiller Drawer",
                "batch_number": "DS-VEG-SPN07",
                "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 58.0,
            },

            # 3. Kaggle Food Quality & Spoilage Benchmark (Dairy, Meat, Seafood, Bakery, Grains)
            {
                "food_name": "Farm Fresh Whole Milk",
                "category": FoodCategory.DAIRY.value,
                "quantity": 2.0,
                "unit": "liters",
                "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 3.0,
                "storage_humidity": 70.0,
                "location": "Middle Refrigerator Shelf",
                "batch_number": "DS-DRY-MLK01",
                "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 90.0,
            },
            {
                "food_name": "Greek Style Plain Yogurt",
                "category": FoodCategory.DAIRY.value,
                "quantity": 500,
                "unit": "g",
                "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=12)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 4.0,
                "storage_humidity": 65.0,
                "location": "Dairy Compartment",
                "batch_number": "DS-DRY-YGT02",
                "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 92.0,
            },
            {
                "food_name": "Curdled Heavy Cream",
                "category": FoodCategory.DAIRY.value,
                "quantity": 250,
                "unit": "ml",
                "purchase_date": (today - timedelta(days=15)).strftime("%Y-%m-%d"),
                "expiry_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 7.0,
                "storage_humidity": 70.0,
                "location": "Refrigerator Door Shelf",
                "batch_number": "DS-DRY-CRM03",
                "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80",
                "freshness_status": FreshnessStatus.SPOILED.value,
                "freshness_score": 10.0,
            },
            {
                "food_name": "Aged Sharp Cheddar Block",
                "category": FoodCategory.DAIRY.value,
                "quantity": 400,
                "unit": "g",
                "purchase_date": (today - timedelta(days=10)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 4.0,
                "storage_humidity": 70.0,
                "location": "Cheese Keeper Bin",
                "batch_number": "DS-DRY-CHD04",
                "image_url": "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 88.0,
            },
            {
                "food_name": "Farm Fresh Grade A Eggs",
                "category": FoodCategory.DAIRY.value,
                "quantity": 12,
                "unit": "items",
                "purchase_date": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=25)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 4.0,
                "storage_humidity": 70.0,
                "location": "Middle Refrigerator Shelf in Carton",
                "batch_number": "DS-DRY-EGG05",
                "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 95.0,
            },
            {
                "food_name": "Wild Atlantic Salmon Fillet",
                "category": FoodCategory.FISH.value,
                "quantity": 800,
                "unit": "g",
                "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.COLD_STORAGE.value,
                "storage_temperature": 1.0,
                "storage_humidity": 90.0,
                "location": "Cold Meat & Fish Chiller",
                "batch_number": "DS-FSH-SLM01",
                "image_url": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 62.0,
            },
            {
                "food_name": "Free-Range Chicken Breast",
                "category": FoodCategory.MEAT.value,
                "quantity": 1.5,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=4)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 1.5,
                "storage_humidity": 75.0,
                "location": "Bottom Chiller Shelf",
                "batch_number": "DS-MEA-CHK01",
                "image_url": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 94.0,
            },
            {
                "food_name": "Artisan Sourdough Loaf",
                "category": FoodCategory.BAKERY.value,
                "quantity": 1.0,
                "unit": "items",
                "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 20.0,
                "storage_humidity": 50.0,
                "location": "Kitchen Breadbox",
                "batch_number": "DS-BKR-SRD01",
                "image_url": "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 60.0,
            },
            {
                "food_name": "Molded Sliced White Bread",
                "category": FoodCategory.BAKERY.value,
                "quantity": 1.0,
                "unit": "items",
                "purchase_date": (today - timedelta(days=9)).strftime("%Y-%m-%d"),
                "expiry_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 22.0,
                "storage_humidity": 60.0,
                "location": "Pantry Scrap Bin",
                "batch_number": "DS-BKR-BRD02",
                "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
                "freshness_status": FreshnessStatus.SPOILED.value,
                "freshness_score": 8.0,
            },
            {
                "food_name": "Organic Brown Basmati Rice",
                "category": FoodCategory.GRAINS.value,
                "quantity": 5.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=10)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=180)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 20.0,
                "storage_humidity": 45.0,
                "location": "Airtight Dry Grain Container",
                "batch_number": "DS-GRN-RIC01",
                "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 98.0,
            },
            # Additional realistic benchmark items (Fruits, Dairy, Seafood, Meat, Bakery, Grains, Pantry)
            {
                "food_name": "Sweet Seedless Red Grapes",
                "category": FoodCategory.FRUITS.value,
                "quantity": 1.2,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=9)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 2.0,
                "storage_humidity": 85.0,
                "location": "Chiller Bin 2",
                "batch_number": "DS-FRT-GRP07",
                "image_url": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 94.0,
            },
            {
                "food_name": "Salted European Creamery Butter",
                "category": FoodCategory.DAIRY.value,
                "quantity": 500,
                "unit": "g",
                "purchase_date": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 3.0,
                "storage_humidity": 60.0,
                "location": "Dairy Compartment Door",
                "batch_number": "DS-DRY-BTR06",
                "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 95.0,
            },
            {
                "food_name": "Fresh Atlantic Cod Fillet",
                "category": FoodCategory.FISH.value,
                "quantity": 800,
                "unit": "g",
                "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 1.0,
                "storage_humidity": 80.0,
                "location": "Meat & Fish Chill Box",
                "batch_number": "DS-FSH-COD02",
                "image_url": "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 93.0,
            },
            {
                "food_name": "Lean Free-Range Ground Beef",
                "category": FoodCategory.MEAT.value,
                "quantity": 1.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.REFRIGERATED.value,
                "storage_temperature": 2.0,
                "storage_humidity": 75.0,
                "location": "Lower Meat Tray",
                "batch_number": "DS-MEA-BEEF02",
                "image_url": "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&q=80",
                "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
                "freshness_score": 65.0,
            },
            {
                "food_name": "Vanilla Bean Sponge Pound Cake",
                "category": FoodCategory.BAKERY.value,
                "quantity": 1.0,
                "unit": "items",
                "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.ROOM_TEMPERATURE.value,
                "storage_temperature": 20.0,
                "storage_humidity": 50.0,
                "location": "Pantry Cake Dome",
                "batch_number": "DS-BKR-CKE03",
                "image_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 92.0,
            },
            {
                "food_name": "Stone Ground Whole Wheat Flour",
                "category": FoodCategory.GRAINS.value,
                "quantity": 2.0,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=8)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=120)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 18.0,
                "storage_humidity": 45.0,
                "location": "Pantry Baking Shelf",
                "batch_number": "DS-GRN-FLR02",
                "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 97.0,
            },
            {
                "food_name": "Dry Red Kidney Beans",
                "category": FoodCategory.GRAINS.value,
                "quantity": 1.5,
                "unit": "kg",
                "purchase_date": (today - timedelta(days=12)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=240)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 19.0,
                "storage_humidity": 40.0,
                "location": "Pantry Legumes Bin",
                "batch_number": "DS-GRN-BNS03",
                "image_url": "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 99.0,
            },
            {
                "food_name": "Cold Pressed Extra Virgin Olive Oil",
                "category": FoodCategory.OTHER.value,
                "quantity": 1.0,
                "unit": "liters",
                "purchase_date": (today - timedelta(days=15)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=300)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 19.0,
                "storage_humidity": 50.0,
                "location": "Dark Oil Cabinet",
                "batch_number": "DS-OTH-OIL01",
                "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 99.0,
            },
            {
                "food_name": "Organic Roasted Peanut Butter",
                "category": FoodCategory.OTHER.value,
                "quantity": 500,
                "unit": "g",
                "purchase_date": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
                "expiry_date": (today + timedelta(days=150)).strftime("%Y-%m-%d"),
                "storage_type": StorageType.PANTRY.value,
                "storage_temperature": 20.0,
                "storage_humidity": 45.0,
                "location": "Pantry Spread Shelf",
                "batch_number": "DS-OTH-PNT02",
                "image_url": "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400&q=80",
                "freshness_status": FreshnessStatus.FRESH.value,
                "freshness_score": 98.0,
            },
        ]

        docs = []
        for item in raw_items:
            food_n = item["food_name"]
            docs.append({
                **item,
                "food_name": food_n,
                "name": food_n,
                "user_id": user_oid,
                "created_at": now,
                "updated_at": now,
            })
        return docs

    @staticmethod
    def seed_dataset_items_for_user(user_id: Any) -> Dict[str, Any]:
        """
        Populate standard dataset items for a user.
        Prevents duplicates by checking existing items by user_id and batch_number or food_name.
        Does not overwrite user-created or edited items.
        Returns a dict with inserted count, skipped count, and total count.
        """
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable. Cannot load dataset items."
            )

        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        items = InventoryService.get_dataset_catalog(user_oid)
        if not items:
            return {"inserted": 0, "skipped": 0, "total": 0}

        user_ids = [user_oid, str(user_oid)]
        existing_items = list(inv_col.find(
            {"user_id": {"$in": user_ids}},
            {"batch_number": 1, "food_name": 1, "name": 1}
        ))
        existing_batches = {doc.get("batch_number") for doc in existing_items if doc.get("batch_number")}
        existing_names = {
            (doc.get("food_name") or doc.get("name") or "").strip().lower()
            for doc in existing_items
        }

        to_insert = []
        skipped_count = 0

        for item in items:
            batch = item.get("batch_number")
            item_name = item.get("food_name", "").strip().lower()
            if (batch and batch in existing_batches) or (item_name in existing_names):
                skipped_count += 1
            else:
                to_insert.append(item)

        inserted_count = 0
        if to_insert:
            result = inv_col.insert_many(to_insert)
            inserted_count = len(result.inserted_ids)

        return {
            "inserted": inserted_count,
            "skipped": skipped_count,
            "total": len(items),
        }

    @staticmethod
    def _is_authorized(item: Dict[str, Any], current_user: Dict[str, Any]) -> bool:
        """Admins and platform managers can view/manage across accounts; others only their own."""
        user_role = current_user.get("role")
        if user_role in [UserRole.ADMIN.value, UserRole.WAREHOUSE_MANAGER.value, UserRole.SUPPLY_CHAIN_OPERATOR.value]:
            return True
        return str(item.get("user_id")) == str(current_user.get("id"))

    @staticmethod
    def create_inventory_item(data: InventoryCreateRequest, current_user: Dict[str, Any]) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable. Please ensure MongoDB is running."
            )

        now = datetime.now(timezone.utc)
        food_n = (data.food_name or data.name or "").strip()
        item_doc = {
            "user_id": ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"],
            "food_name": food_n,
            "name": food_n,
            "category": data.category,
            "quantity": float(data.quantity),
            "unit": data.unit.strip(),
            "purchase_date": data.purchase_date,
            "expiry_date": data.expiry_date,
            "storage_type": data.storage_type,
            "storage_temperature": data.storage_temperature,
            "storage_humidity": data.storage_humidity,
            "location": data.location.strip() if data.location else "Main Storage",
            "batch_number": data.batch_number.strip() if data.batch_number else None,
            "image_url": data.image_url,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        }

        result = inv_col.insert_one(item_doc)
        created_item = inv_col.find_one({"_id": result.inserted_id})
        return inventory_helper(created_item)

    @staticmethod
    def list_inventory(
        current_user: Dict[str, Any],
        search: Optional[str] = None,
        category: Optional[str] = None,
        expiry_status: Optional[str] = None,
        storage_type: Optional[str] = None,
        sort_by: str = "expiry_date",
        sort_order: str = "asc",
    ) -> List[Dict[str, Any]]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        query: Dict[str, Any] = {}
        user_role = current_user.get("role")

        # Role scoping
        if user_role not in [
            UserRole.ADMIN.value,
            UserRole.WAREHOUSE_MANAGER.value,
            UserRole.WAREHOUSE_OPERATOR.value,
            UserRole.SUPPLY_CHAIN_OPERATOR.value,
        ]:
            user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
            user_ids = [user_oid, str(user_oid)]
            query["user_id"] = {"$in": user_ids}

        # Category filter
        if category and category.lower() != "all":
            query["category"] = category

        # Storage type filter
        if storage_type and storage_type.lower() != "all":
            query["storage_type"] = storage_type

        # Search filter (food_name, name, location, or batch_number)
        if search and search.strip():
            regex = {"$regex": search.strip(), "$options": "i"}
            query["$or"] = [
                {"food_name": regex},
                {"name": regex},
                {"location": regex},
                {"batch_number": regex},
            ]

        # Expiry status filter
        today_str = date.today().strftime("%Y-%m-%d")
        soon_str = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")

        if expiry_status == "expiring_soon":
            query["expiry_date"] = {"$gte": today_str, "$lte": soon_str}
        elif expiry_status == "expired":
            query["expiry_date"] = {"$lt": today_str}
        elif expiry_status == "fresh":
            query["expiry_date"] = {"$gt": soon_str}

        # Sorting
        sort_direction = 1 if sort_order.lower() == "asc" else -1
        allowed_sort_fields = ["expiry_date", "purchase_date", "food_name", "quantity", "created_at"]
        effective_sort_by = "food_name" if sort_by in ["name", "food_name"] else (sort_by if sort_by in allowed_sort_fields else "expiry_date")

        items = inv_col.find(query).sort(effective_sort_by, sort_direction)
        return [inventory_helper(item) for item in items]

    @staticmethod
    def get_inventory_item(item_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        try:
            item = inv_col.find_one({"_id": ObjectId(item_id)})
        except Exception:
            item = inv_col.find_one({"_id": item_id})

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food item with ID '{item_id}' not found."
            )

        if not InventoryService._is_authorized(item, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not have permission to view this food item."
            )

        return inventory_helper(item)

    @staticmethod
    def update_inventory_item(
        item_id: str,
        data: InventoryUpdateRequest,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food item with ID '{item_id}' not found."
            )

        if not InventoryService._is_authorized(item, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not have permission to update this food item."
            )

        update_fields: Dict[str, Any] = {}
        dumped = data.model_dump(exclude_unset=True)
        for key, value in dumped.items():
            if value is not None:
                update_fields[key] = value

        if not update_fields:
            return inventory_helper(item)

        update_fields["updated_at"] = datetime.now(timezone.utc)
        inv_col.update_one({"_id": item["_id"]}, {"$set": update_fields})

        updated_item = inv_col.find_one({"_id": item["_id"]})
        return inventory_helper(updated_item)

    @staticmethod
    def delete_inventory_item(item_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        try:
            oid = ObjectId(item_id)
            item = inv_col.find_one({"_id": oid})
        except Exception:
            oid = item_id
            item = inv_col.find_one({"_id": oid})

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food item with ID '{item_id}' not found."
            )

        if not InventoryService._is_authorized(item, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not have permission to delete this food item."
            )

        inv_col.delete_one({"_id": item["_id"]})
        return {
            "success": True,
            "message": f"Food item '{item.get('food_name')}' deleted successfully.",
            "id": str(item["_id"])
        }

    @staticmethod
    def get_dashboard_stats(current_user: Dict[str, Any]) -> DashboardStatsResponse:
        inv_col = get_inventory_collection()
        if inv_col is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable."
            )

        user_role = current_user.get("role")
        query: Dict[str, Any] = {}
        if user_role not in [
            UserRole.ADMIN.value,
            UserRole.WAREHOUSE_MANAGER.value,
            UserRole.WAREHOUSE_OPERATOR.value,
            UserRole.SUPPLY_CHAIN_OPERATOR.value,
        ]:
            user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
            user_ids = [user_oid, str(user_oid)]
            query["user_id"] = {"$in": user_ids}

            # Auto-seed dataset items if user currently has zero inventory items
            if inv_col.count_documents({"user_id": {"$in": user_ids}}) == 0:
                InventoryService.seed_dataset_items_for_user(user_oid)

        items = list(inv_col.find(query))

        today_str = date.today().strftime("%Y-%m-%d")
        soon_str = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")

        total_items = len(items)
        total_quantity = sum(float(i.get("quantity", 0)) for i in items)
        expiring_soon = 0
        pending_analysis = 0
        spoiled_items = 0
        storage_alerts = 0
        category_counts: Dict[str, int] = {}
        storage_counts: Dict[str, int] = {}

        for item in items:
            cat = item.get("category", "Other")
            category_counts[cat] = category_counts.get(cat, 0) + 1

            st = item.get("storage_type", "Refrigerated")
            storage_counts[st] = storage_counts.get(st, 0) + 1

            status = item.get("freshness_status")
            if status == FreshnessStatus.NOT_ANALYZED.value or not status:
                pending_analysis += 1

            exp = item.get("expiry_date", "")
            if exp:
                if exp < today_str or status == FreshnessStatus.SPOILED.value:
                    spoiled_items += 1
                elif today_str <= exp <= soon_str:
                    expiring_soon += 1

            # Storage conditions anomaly check
            temp = item.get("storage_temperature")
            humidity = item.get("storage_humidity")

            if st == StorageType.REFRIGERATED.value:
                if temp is not None and (temp < 0 or temp > 6):
                    storage_alerts += 1
            elif st == StorageType.FROZEN.value:
                if temp is not None and temp > -15:
                    storage_alerts += 1
            elif st == StorageType.ROOM_TEMPERATURE.value:
                if temp is not None and temp > 28:
                    storage_alerts += 1

            if humidity is not None and (humidity > 85 or humidity < 30):
                storage_alerts += 1

        return DashboardStatsResponse(
            total_food_items=total_items,
            total_quantity=round(total_quantity, 2),
            items_expiring_soon=expiring_soon,
            freshness_analysis_pending=pending_analysis,
            spoiled_items=spoiled_items,
            storage_alerts=storage_alerts,
            category_distribution=category_counts,
            storage_distribution=storage_counts,
        )
