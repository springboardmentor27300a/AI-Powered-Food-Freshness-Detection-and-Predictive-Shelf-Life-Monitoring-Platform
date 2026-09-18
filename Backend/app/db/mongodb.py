import logging
import uuid
import re
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger("uvicorn")

class MockCursor:
    def __init__(self, items):
        self._items = items

    def sort(self, field, direction=1):
        reverse = direction == -1
        self._items = sorted(self._items, key=lambda x: str(x.get(field, "")), reverse=reverse)
        return self

    def limit(self, n):
        self._items = self._items[:n]
        return self

    async def to_list(self, length=None):
        if length is not None:
            return self._items[:length]
        return self._items

class MockUpdateResult:
    def __init__(self, modified_count, matched_count, upserted_id=None):
        self.modified_count = modified_count
        self.matched_count = matched_count
        self.upserted_id = upserted_id

class MockInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []

    def _match(self, doc, query):
        if not query: return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._match(doc, sub) for sub in v): return False
            elif isinstance(v, dict):
                if "$in" in v:
                    if doc.get(k) not in v["$in"]: return False
                if "$gt" in v and not (doc.get(k, 0) > v["$gt"]): return False
            elif doc.get(k) != v:
                return False
        return True

    async def count_documents(self, query=None):
        return len([d for d in self.docs if self._match(d, query)])

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d: d["_id"] = uuid.uuid4().hex
        self.docs.append(d)
        return MockInsertResult(d["_id"])

    async def insert_many(self, docs):
        ids = []
        for doc in docs:
            d = dict(doc)
            if "_id" not in d: d["_id"] = uuid.uuid4().hex
            self.docs.append(d)
            ids.append(d["_id"])
        return ids

    def find(self, query=None):
        if not query:
            return MockCursor(list(self.docs))
        
        results = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or":
                    or_match = any(
                        all(d.get(sub_k) == sub_v for sub_k, sub_v in sub_q.items())
                        for sub_q in v
                    )
                    if not or_match:
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(d)
        return MockCursor(results)

    async def find_one(self, query=None):
        cursor = self.find(query)
        items = await cursor.to_list(1)
        return items[0] if items else None

    async def delete_one(self, query):
        initial_len = len(self.docs)
        self.docs = [
            d for d in self.docs 
            if not any(
                (k == "$or" and any(d.get(sub_k) == sub_v for sub_q in v for sub_k, sub_v in sub_q.items())) or (d.get(k) == v)
                for k, v in query.items()
            )
        ]
        return MockDeleteResult(initial_len - len(self.docs))

class MockDatabase:
    def __init__(self):
        self.collections = {}

    def __getattr__(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection(name)
        return self.collections[name]

    def __getitem__(self, name):
        return getattr(self, name)

class Database:
    client: AsyncIOMotorClient = None
    db = None
    is_mock = False

db_instance = Database()

async def connect_to_mongo():
    logger.info("Connecting to Cloud MongoDB Atlas...")
    try:
        # Connect with short 3-second timeout to check Atlas connectivity
        client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=3000,
            tlsAllowInvalidCertificates=True
        )
        # Probe connection
        test_db = client[settings.DATABASE_NAME]
        await test_db.warehouses.count_documents({})
        db_instance.client = client
        db_instance.db = test_db
        db_instance.is_mock = False
        logger.info(f"Connected to Cloud MongoDB Database: {settings.DATABASE_NAME}")
    except Exception as e:
        logger.warning(f"MongoDB Atlas unreachable ({e}). Initializing resilient in-memory datastore fallback.")
        db_instance.client = None
        db_instance.db = MockDatabase()
        db_instance.is_mock = True

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

    # 4. Storage Zones Telemetry
    zone_count = await db.storage_zones.count_documents({})
    if zone_count == 0:
        logger.info("Seeding initial Cold Storage Zones...")
        zones_data = [
            {
                "zone_id": "ZONE-WH01-A",
                "zone_name": "Cold Room A — Chilled Fresh Produce",
                "warehouse_id": "WH-CENTRAL-01",
                "warehouse_name": "GreenValley Central Cold Storage",
                "temperature_celsius": 3.4,
                "humidity_percent": 88.5,
                "airflow_cfm": 420.0,
                "light_lux": 15.0,
                "target_temp_c": 3.0,
                "target_humidity_pct": 88.0,
                "compliance_status": "Compliant",
                "active_alerts_count": 0,
                "last_updated": datetime.utcnow().isoformat()
            },
            {
                "zone_id": "ZONE-WH01-B",
                "zone_name": "Zone B — Controlled Atmosphere (CA) Vault",
                "warehouse_id": "WH-CENTRAL-01",
                "warehouse_name": "GreenValley Central Cold Storage",
                "temperature_celsius": 2.2,
                "humidity_percent": 91.0,
                "airflow_cfm": 380.0,
                "light_lux": 5.0,
                "target_temp_c": 2.0,
                "target_humidity_pct": 90.0,
                "compliance_status": "Compliant",
                "active_alerts_count": 0,
                "last_updated": datetime.utcnow().isoformat()
            },
            {
                "zone_id": "ZONE-WH02-A",
                "zone_name": "Zone Alpha — Coastal High-Humidity Chiller",
                "warehouse_id": "WH-PACIFIC-02",
                "warehouse_name": "Pacific Fresh Logistics Center",
                "temperature_celsius": 5.8,
                "humidity_percent": 74.0,
                "airflow_cfm": 210.0,
                "light_lux": 45.0,
                "target_temp_c": 2.5,
                "target_humidity_pct": 88.0,
                "compliance_status": "Minor Excursion",
                "active_alerts_count": 1,
                "last_updated": datetime.utcnow().isoformat()
            },
            {
                "zone_id": "ZONE-WH03-A",
                "zone_name": "Bay 1 — Sunshine Produce Deep Chill",
                "warehouse_id": "WH-SUNSHINE-03",
                "warehouse_name": "Sunshine Valley Produce Hub",
                "temperature_celsius": 4.1,
                "humidity_percent": 83.5,
                "airflow_cfm": 350.0,
                "light_lux": 20.0,
                "target_temp_c": 4.0,
                "target_humidity_pct": 85.0,
                "compliance_status": "Compliant",
                "active_alerts_count": 0,
                "last_updated": datetime.utcnow().isoformat()
            }
        ]
        await db.storage_zones.insert_many(zones_data)

    # 5. Storage Excursion Alerts
    alert_count = await db.storage_alerts.count_documents({})
    if alert_count == 0:
        logger.info("Seeding initial Cold Storage Alerts...")
        alerts_data = [
            {
                "alert_id": "ALT-20260910-01",
                "zone_id": "ZONE-WH02-A",
                "zone_name": "Zone Alpha — Coastal High-Humidity Chiller",
                "warehouse_name": "Pacific Fresh Logistics Center",
                "parameter": "Temperature",
                "current_value": 5.8,
                "threshold_value": 3.5,
                "severity": "Moderate",
                "duration_minutes": 45,
                "root_cause": "Loading dock door seal integrity compromise during morning wholesale dispatch.",
                "corrective_action": "Reseal dock bay door #3, engage secondary auxiliary chiller unit, and verify cold air circulation.",
                "is_resolved": False,
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
        await db.storage_alerts.insert_many(alerts_data)

