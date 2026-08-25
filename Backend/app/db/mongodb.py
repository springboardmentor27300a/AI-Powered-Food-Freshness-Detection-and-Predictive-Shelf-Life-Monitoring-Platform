import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger("uvicorn")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    logger.info("Connecting to Cloud MongoDB Atlas...")
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    logger.info(f"Connected to Cloud MongoDB Database: {settings.DATABASE_NAME}")
    
    # Initialize Seed Data if database is empty
    await seed_database_if_empty()

async def close_mongo_connection():
    if db_instance.client:
        logger.info("Closing MongoDB Connection...")
        db_instance.client.close()
        logger.info("MongoDB Connection Closed.")

def get_database():
    return db_instance.db

async def seed_database_if_empty():
    db = db_instance.db
    
    # 1. Warehouses
    wh_count = await db.warehouses.count_documents({})
    if wh_count == 0:
        logger.info("Seeding initial Warehouses...")
        warehouses_data = [
            {
                "name": "GreenValley Central Cold Storage",
                "code": "WH-CENTRAL-01",
                "location": "Agri Hub Sector 4, California, USA",
                "capacity_kg": 50000,
                "current_utilization_kg": 12400,
                "temperature_range_c": "2°C - 4°C",
                "humidity_range_pct": "85% - 90%",
                "created_at": datetime.utcnow()
            },
            {
                "name": "Pacific Fresh Logistics Center",
                "code": "WH-PACIFIC-02",
                "location": "Port Bay Pier 12, Washington, USA",
                "capacity_kg": 75000,
                "current_utilization_kg": 28900,
                "temperature_range_c": "1°C - 3°C",
                "humidity_range_pct": "88% - 92%",
                "created_at": datetime.utcnow()
            },
            {
                "name": "Sunshine Valley Produce Hub",
                "code": "WH-SUNSHINE-03",
                "location": "Central Valley Highway 99, Texas, USA",
                "capacity_kg": 40000,
                "current_utilization_kg": 8500,
                "temperature_range_c": "3°C - 6°C",
                "humidity_range_pct": "80% - 85%",
                "created_at": datetime.utcnow()
            }
        ]
        await db.warehouses.insert_many(warehouses_data)

    # 2. Categories
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
        logger.info("Seeding initial Product Categories...")
        categories_data = [
            {"name": "Fruits", "code": "CAT-FRUITS", "icon": "🍎", "description": "Fresh apples, citrus, berries, and tropical fruits"},
            {"name": "Vegetables", "code": "CAT-VEG", "icon": "🥬", "description": "Leafy greens, root vegetables, tomatoes, and nightshades"},
            {"name": "Dairy Products", "code": "CAT-DAIRY", "icon": "🥛", "description": "Milk, artisan cheeses, yogurts, and butter"},
            {"name": "Meat & Poultry", "code": "CAT-MEAT", "icon": "🥩", "description": "Fresh poultry, grass-fed beef, and pork cuts"},
            {"name": "Seafood", "code": "CAT-SEAFOOD", "icon": "🐟", "description": "Ocean salmon, shrimp, cod, and fresh catches"},
            {"name": "Bakery Products", "code": "CAT-BAKERY", "icon": "🍞", "description": "Artisan bread, rolls, and baked goods"},
            {"name": "Packaged Foods", "code": "CAT-PACKAGED", "icon": "📦", "description": "Pre-packaged salads, cut fruits, and ready items"},
            {"name": "Beverages", "code": "CAT-BEV", "icon": "🧃", "description": "Cold-pressed juices, smoothies, and natural drinks"}
        ]
        await db.categories.insert_many(categories_data)

    # 3. Initial Food Batches
    batch_count = await db.food_batches.count_documents({})
    if batch_count == 0:
        logger.info("Seeding sample Food Batches...")
        batches_data = [
            {
                "batch_id": "BATCH-20260825-APL01",
                "product_name": "Organic Royal Gala Apples",
                "category": "Fruits",
                "warehouse_id": "WH-CENTRAL-01",
                "warehouse_name": "GreenValley Central Cold Storage",
                "quantity_kg": 500.0,
                "initial_quantity_kg": 500.0,
                "unit_price_per_kg": 2.40,
                "harvest_date": "2026-08-20",
                "registered_date": datetime.utcnow().isoformat(),
                "expiry_date": "2026-09-20",
                "freshness_score": 94,
                "freshness_status": "Fresh",
                "spoilage_indicators": ["Surface Integrity 100%", "No Bruises Detected"],
                "storage_temp_celsius": 3.2,
                "storage_humidity_percent": 87.5,
                "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80",
                "registered_by": "Operator John (WH-01)",
                "status": "Available",
                "purchased_by_user_id": None,
                "purchased_by_name": None,
                "purchased_by_store": None,
                "purchase_date": None
            },
            {
                "batch_id": "BATCH-20260825-APL02",
                "product_name": "Crisp Honeycrisp Apples",
                "category": "Fruits",
                "warehouse_id": "WH-PACIFIC-02",
                "warehouse_name": "Pacific Fresh Logistics Center",
                "quantity_kg": 750.0,
                "initial_quantity_kg": 750.0,
                "unit_price_per_kg": 2.80,
                "harvest_date": "2026-08-22",
                "registered_date": datetime.utcnow().isoformat(),
                "expiry_date": "2026-09-25",
                "freshness_score": 96,
                "freshness_status": "Fresh",
                "spoilage_indicators": ["High Firmness", "Optimal Coloration"],
                "storage_temp_celsius": 2.5,
                "storage_humidity_percent": 89.0,
                "image_url": "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&w=600&q=80",
                "registered_by": "Operator Sarah (WH-02)",
                "status": "Available",
                "purchased_by_user_id": None,
                "purchased_by_name": None,
                "purchased_by_store": None,
                "purchase_date": None
            },
            {
                "batch_id": "BATCH-20260824-SPN01",
                "product_name": "Hydroponic Baby Spinach",
                "category": "Vegetables",
                "warehouse_id": "WH-CENTRAL-01",
                "warehouse_name": "GreenValley Central Cold Storage",
                "quantity_kg": 150.0,
                "initial_quantity_kg": 150.0,
                "unit_price_per_kg": 4.50,
                "harvest_date": "2026-08-23",
                "registered_date": datetime.utcnow().isoformat(),
                "expiry_date": "2026-09-05",
                "freshness_score": 88,
                "freshness_status": "Good",
                "spoilage_indicators": ["Minor Wilting <2%", "Vibrant Green Index"],
                "storage_temp_celsius": 3.8,
                "storage_humidity_percent": 91.0,
                "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80",
                "registered_by": "Operator John (WH-01)",
                "status": "Available",
                "purchased_by_user_id": None,
                "purchased_by_name": None,
                "purchased_by_store": None,
                "purchase_date": None
            },
            {
                "batch_id": "BATCH-20260820-TMT01",
                "product_name": "Vine-Ripened Cluster Tomatoes",
                "category": "Vegetables",
                "warehouse_id": "WH-SUNSHINE-03",
                "warehouse_name": "Sunshine Valley Produce Hub",
                "quantity_kg": 300.0,
                "initial_quantity_kg": 300.0,
                "unit_price_per_kg": 1.90,
                "harvest_date": "2026-08-18",
                "registered_date": datetime.utcnow().isoformat(),
                "expiry_date": "2026-08-30",
                "freshness_score": 75,
                "freshness_status": "Acceptable",
                "spoilage_indicators": ["Softening Detected 5%", "Slight Surface Blemish"],
                "storage_temp_celsius": 5.1,
                "storage_humidity_percent": 82.0,
                "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80",
                "registered_by": "Operator Mark (WH-03)",
                "status": "Sold",
                "purchased_by_user_id": "demo_retailer_01",
                "purchased_by_name": "Retailer Alex",
                "purchased_by_store": "FreshMart Hypermarket #104",
                "purchase_date": datetime.utcnow().isoformat()
            }
        ]
        await db.food_batches.insert_many(batches_data)
