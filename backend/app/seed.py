"""
Database Seeding Script for Food Freshness Monitoring Platform.
Populates initial roles, verified sample accounts, and diverse food inventory items.
"""

from datetime import datetime, timezone, date, timedelta
from backend.app.database import (
    connect_to_mongo,
    get_database,
    get_users_collection,
    get_inventory_collection,
    get_alerts_collection,
    get_notifications_collection,
    get_food_inspections_collection,
    get_storage_rules_collection,
    get_system_config_collection,
    get_audit_logs_collection,
)

from backend.app.models.user_model import UserRole
from backend.app.models.inventory_model import FoodCategory, StorageType, FreshnessStatus
from backend.app.utils.security import hash_password


def seed_database():
    print("Connecting to MongoDB for seeding...")
    connected = connect_to_mongo()
    if not connected:
        print("Error: Could not connect to MongoDB. Aborting seed.")
        return

    users_col = get_users_collection()
    inv_col = get_inventory_collection()

    now = datetime.now(timezone.utc)

    # 1. Seed Accounts across distinct roles
    sample_users = [
        {
            "name": "Platform Administrator",
            "email": "admin@foodfresh.com",
            "password": "AdminPass123!",
            "role": UserRole.ADMIN.value,
        },
        {
            "name": "Demo User",
            "email": "demo@foodfresh.com",
            "password": "DemoPass123!",
            "role": UserRole.CONSUMER.value,
        },
        {
            "name": "Sarah Consumer",
            "email": "consumer@foodfresh.com",
            "password": "ConsumerPass123!",
            "role": UserRole.CONSUMER.value,
        },
        {
            "name": "FreshMart Retail Store",
            "email": "retailer@foodfresh.com",
            "password": "RetailerPass123!",
            "role": UserRole.RETAILER.value,
        },
        {
            "name": "Metro Central Cold Hub",
            "email": "warehouse@foodfresh.com",
            "password": "WarehousePass123!",
            "role": UserRole.WAREHOUSE_MANAGER.value,
        },
        {
            "name": "Nature Foods Processing",
            "email": "manufacturer@foodfresh.com",
            "password": "ManufacturerPass123!",
            "role": UserRole.FOOD_MANUFACTURER.value,
        },
        {
            "name": "Swift Cold Logistics",
            "email": "logistics@foodfresh.com",
            "password": "LogisticsPass123!",
            "role": UserRole.SUPPLY_CHAIN_OPERATOR.value,
        },
        {
            "name": "Dr. Marcus Vance (Lead QA Inspector)",
            "email": "inspector@foodfresh.com",
            "password": "InspectorPass123!",
            "role": UserRole.FOOD_QUALITY_INSPECTOR.value,
        },
    ]

    user_map = {}
    for user_info in sample_users:
        existing = users_col.find_one({"email": user_info["email"]})
        if not existing:
            hashed = hash_password(user_info["password"])
            doc = {
                "name": user_info["name"],
                "email": user_info["email"],
                "password_hash": hashed,
                "role": user_info["role"],
                "status": "active",
                "is_active": True,
                "auth_provider": "local",
                "last_login": now,
                "created_at": now,
                "updated_at": now,
            }
            res = users_col.insert_one(doc)
            user_map[user_info["email"]] = res.inserted_id
            print(f"Created user: {user_info['email']} ({user_info['role']})")
        else:
            user_map[user_info["email"]] = existing["_id"]
            # Ensure existing users have status and is_active populated
            users_col.update_one(
                {"_id": existing["_id"]},
                {"$set": {"status": existing.get("status", "active"), "is_active": existing.get("is_active", True), "auth_provider": existing.get("auth_provider", "local")}}
            )
            print(f"User already exists: {user_info['email']}")


    # 2. Seed Sample Food Items
    consumer_id = user_map.get("consumer@foodfresh.com")
    retailer_id = user_map.get("retailer@foodfresh.com")

    today = date.today()

    sample_items = [
        {
            "user_id": consumer_id,
            "food_name": "Crisp Fuji Apples",
            "category": FoodCategory.FRUITS.value,
            "quantity": 3.5,
            "unit": "kg",
            "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=12)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 4.0,
            "storage_humidity": 65.0,
            "location": "Refrigerator Crisper Drawer",
            "batch_number": "BATCH-APL-2026-01",
            "image_url": None,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": consumer_id,
            "food_name": "Organic Baby Spinach",
            "category": FoodCategory.VEGETABLES.value,
            "quantity": 250,
            "unit": "g",
            "purchase_date": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),  # Expiring soon!
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 3.5,
            "storage_humidity": 75.0,
            "location": "Upper Shelf Refrigerator",
            "batch_number": "BATCH-SPN-884",
            "image_url": None,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": consumer_id,
            "food_name": "Artisan Sourdough Loaf",
            "category": FoodCategory.BAKERY.value,
            "quantity": 1,
            "unit": "items",
            "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=1)).strftime("%Y-%m-%d"),  # Expiring soon!
            "storage_type": StorageType.ROOM_TEMPERATURE.value,
            "storage_temperature": 21.0,
            "storage_humidity": 45.0,
            "location": "Kitchen Counter Breadbox",
            "batch_number": "BKR-SRD-102",
            "image_url": None,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": consumer_id,
            "food_name": "Greek Style Whole Milk Yogurt",
            "category": FoodCategory.DAIRY.value,
            "quantity": 500,
            "unit": "g",
            "purchase_date": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 4.0,
            "storage_humidity": 50.0,
            "location": "Door Shelf",
            "batch_number": "DRY-YGT-44",
            "image_url": None,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Premium Atlantic Salmon Fillet",
            "category": FoodCategory.FISH.value,
            "quantity": 8.0,
            "unit": "kg",
            "purchase_date": (today - timedelta(days=7)).strftime("%Y-%m-%d"),
            "expiry_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),  # Expired / Spoiled!
            "storage_type": StorageType.COLD_STORAGE.value,
            "storage_temperature": 2.0,
            "storage_humidity": 80.0,
            "location": "Cold Display Case B",
            "batch_number": "FSH-SLM-991",
            "image_url": None,
            "freshness_status": FreshnessStatus.SPOILED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Farm Fresh Strawberries",
            "category": FoodCategory.FRUITS.value,
            "quantity": 12,
            "unit": "packs",
            "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),  # Expiring soon!
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 4.5,
            "storage_humidity": 70.0,
            "location": "Produce Aisle 1",
            "batch_number": "FRT-STR-303",
            "image_url": None,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Free-Range Chicken Breast",
            "category": FoodCategory.MEAT.value,
            "quantity": 25.0,
            "unit": "kg",
            "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.FROZEN.value,
            "storage_temperature": -18.0,
            "storage_humidity": 40.0,
            "location": "Walk-in Freezer 2",
            "batch_number": "MT-CHK-771",
            "image_url": None,
            "freshness_status": FreshnessStatus.NOT_ANALYZED.value,
            "freshness_score": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Organic Whole Milk 1L",
            "category": FoodCategory.DAIRY.value,
            "quantity": 42.0,
            "unit": "bottles",
            "low_stock_threshold": 50.0,
            "shelf_life_days": 5.0,
            "purchase_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 3.0,
            "storage_humidity": 60.0,
            "location": "Dairy Chiller Wall A",
            "batch_number": "MLK-ORG-2026",
            "image_url": None,
            "freshness_status": FreshnessStatus.FRESH.value,
            "freshness_score": 94.0,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Artisan Sourdough Loaf",
            "category": FoodCategory.BAKERY.value,
            "quantity": 6.0,
            "unit": "loaves",
            "low_stock_threshold": 15.0,
            "shelf_life_days": 1.0,
            "purchase_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.ROOM_TEMPERATURE.value,
            "storage_temperature": 21.0,
            "storage_humidity": 45.0,
            "location": "Bakery Display Counter 1",
            "batch_number": "BKR-SRD-502",
            "image_url": None,
            "freshness_status": FreshnessStatus.EXPIRING_SOON.value,
            "freshness_score": 62.0,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Hydroponic Crisp Lettuce",
            "category": FoodCategory.VEGETABLES.value,
            "quantity": 38.0,
            "unit": "heads",
            "low_stock_threshold": 20.0,
            "shelf_life_days": 4.0,
            "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=4)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 4.0,
            "storage_humidity": 92.0,
            "location": "Produce Mist Rack 2",
            "batch_number": "VEG-LET-108",
            "image_url": None,
            "freshness_status": FreshnessStatus.FRESH.value,
            "freshness_score": 91.0,
            "created_at": now,
            "updated_at": now,
        },
        {
            "user_id": retailer_id,
            "food_name": "Cold-Pressed Valencia Orange Juice",
            "category": FoodCategory.PACKAGED_FOOD.value,
            "quantity": 80.0,
            "unit": "bottles",
            "low_stock_threshold": 25.0,
            "shelf_life_days": 12.0,
            "purchase_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=14)).strftime("%Y-%m-%d"),
            "storage_type": StorageType.REFRIGERATED.value,
            "storage_temperature": 3.5,
            "storage_humidity": 50.0,
            "location": "Beverage Cooler 4",
            "batch_number": "BEV-OJ-901",
            "image_url": None,
            "freshness_status": FreshnessStatus.FRESH.value,
            "freshness_score": 95.0,
            "created_at": now,
            "updated_at": now,
        },
    ]

    for item in sample_items:
        existing_item = inv_col.find_one({
            "food_name": item["food_name"],
            "batch_number": item["batch_number"]
        })
        if not existing_item:
            inv_col.insert_one(item)
            print(f"Inserted inventory item: {item['food_name']}")
        else:
            print(f"Item already exists: {item['food_name']}")

    # 2b. Seed Dataset Catalog Items for demo user
    demo_id = user_map.get("demo@foodfresh.com")
    if demo_id:
        from backend.app.services.inventory_service import InventoryService
        if inv_col.count_documents({"user_id": demo_id}) == 0:
            count = InventoryService.seed_dataset_items_for_user(demo_id)
            print(f"Seeded {count} dataset items for demo@foodfresh.com")

    # 3. Seed Sample Alerts for Retailer
    alerts_col = get_alerts_collection()
    if alerts_col is not None and retailer_id:
        sample_alerts = [
            {
                "user_id": retailer_id,
                "item_name": "Premium Atlantic Salmon Fillet",
                "alert_type": "spoiled",
                "severity": "critical",
                "message": "Product has reached SPOILED status past expiry date. Urgent removal required.",
                "status": "active",
                "created_at": now,
            },
            {
                "user_id": retailer_id,
                "item_name": "Artisan Sourdough Loaf",
                "alert_type": "approaching_expiry",
                "severity": "warning",
                "message": "Shelf life expiring within 24 hours. Apply 30% FEFO discount.",
                "status": "active",
                "created_at": now,
            },
            {
                "user_id": retailer_id,
                "item_name": "Cold Display Case B",
                "alert_type": "temperature_violation",
                "severity": "high",
                "message": "Chiller temperature recorded at +4.5°C; exceeds maximum recommended threshold for fresh fish (+2.0°C).",
                "status": "active",
                "created_at": now,
            },
        ]
        for alert in sample_alerts:
            existing_alert = alerts_col.find_one({
                "user_id": alert["user_id"],
                "item_name": alert["item_name"],
                "alert_type": alert["alert_type"]
            })
            if not existing_alert:
                alerts_col.insert_one(alert)
                print(f"Inserted alert: {alert['message']}")

    # 4. Seed Sample Notifications for Retailer
    notifs_col = get_notifications_collection()
    if notifs_col is not None and retailer_id:
        sample_notifications = [
            {
                "user_id": retailer_id,
                "title": "Critical Spoilage Alert",
                "message": "Premium Atlantic Salmon Fillet flagged as SPOILED. Inspect and remove from display case immediately.",
                "severity": "critical",
                "category": "spoilage",
                "is_read": False,
                "created_at": now,
            },
            {
                "user_id": retailer_id,
                "title": "Low Stock Threshold Warning",
                "message": "Organic Whole Milk 1L count has fallen below safe replenishment threshold (42 / 50 bottles).",
                "severity": "warning",
                "category": "inventory",
                "is_read": False,
                "created_at": now,
            },
            {
                "user_id": retailer_id,
                "title": "AI Freshness Diagnostic Completed",
                "message": "Freshness score for Hydroponic Crisp Lettuce evaluated at 91.0% (FRESH).",
                "severity": "info",
                "category": "ai_analysis",
                "is_read": False,
                "created_at": now,
            },
        ]
        for notif in sample_notifications:
            existing_notif = notifs_col.find_one({
                "user_id": notif["user_id"],
                "title": notif["title"]
            })
            if not existing_notif:
                notifs_col.insert_one(notif)
                print(f"Inserted notification: {notif['title']}")

    # 5. Seed Sample Food Inspections for Food Quality Inspector
    insp_col = get_food_inspections_collection()
    inspector_id = user_map.get("inspector@foodfresh.com")

    if insp_col is not None and inspector_id:
        sample_inspections = [
            {
                "inspection_id": "INS-20261017-APL1",
                "inspector_id": inspector_id,
                "inspector_name": "Dr. Marcus Vance (Lead QA Inspector)",
                "inspector_email": "inspector@foodfresh.com",
                "product_name": "Crisp Fuji Apples",
                "category": FoodCategory.FRUITS.value,
                "batch_number": "BATCH-APL-2026-01",
                "inventory_id": None,
                "image_reference": "/uploads/food_sample_apple.jpg",
                "storage_review": {
                    "current_temperature": 4.0,
                    "current_humidity": 88.0,
                    "recommended_temperature": 4.0,
                    "permitted_temp_min": 1.0,
                    "permitted_temp_max": 6.0,
                    "recommended_humidity": 90.0,
                    "permitted_humidity_min": 80.0,
                    "permitted_humidity_max": 95.0,
                    "storage_location": "Produce Cold Bay A",
                    "status": "Normal",
                    "notes": "Optimal produce humidity and temperature maintained.",
                },
                "ai_result": {
                    "classification": "Fresh",
                    "confidence": 0.94,
                    "quality_score": 93.5,
                    "spoilage_risk": "Low",
                    "spoilage_probability": 0.06,
                    "estimated_shelf_life_days": 12.0,
                    "detected_defects": ["Optimal Visual Quality — No Significant Defects"],
                    "mold_detected": False,
                    "mold_coverage_pct": 0.0,
                    "bruising_detected": False,
                    "physical_damage_detected": False,
                    "browning_index": 8.2,
                    "roughness_index": 5.4,
                    "color_score": 96.0,
                    "texture_score": 91.0,
                    "analyzed_at": (now - timedelta(hours=3)).isoformat(),
                },
                "inspector_review": {
                    "decision": "Confirmed",
                    "reason": "Meets Grade-A cellular and organoleptic quality benchmarks.",
                    "comments": "Fruit exhibits pristine peel integrity and vibrant pigmentation. Approved for retail display.",
                    "issue_type": "None",
                    "severity": "None",
                    "reviewed_at": (now - timedelta(hours=2)).isoformat(),
                    "inspector_id": str(inspector_id),
                    "inspector_name": "Dr. Marcus Vance",
                    "inspector_adjusted_shelf_life": None,
                },
                "status": "Confirmed",
                "created_at": now - timedelta(hours=3),
                "updated_at": now - timedelta(hours=2),
            },
            {
                "inspection_id": "INS-20261017-SLM2",
                "inspector_id": inspector_id,
                "inspector_name": "Dr. Marcus Vance (Lead QA Inspector)",
                "inspector_email": "inspector@foodfresh.com",
                "product_name": "Premium Atlantic Salmon Fillet",
                "category": FoodCategory.FISH.value,
                "batch_number": "FSH-SLM-991",
                "inventory_id": None,
                "image_reference": "/uploads/food_sample_salmon.jpg",
                "storage_review": {
                    "current_temperature": 5.2,
                    "current_humidity": 82.0,
                    "recommended_temperature": 0.5,
                    "permitted_temp_min": -1.0,
                    "permitted_temp_max": 2.0,
                    "recommended_humidity": 80.0,
                    "permitted_humidity_min": 70.0,
                    "permitted_humidity_max": 90.0,
                    "storage_location": "Chilled Display Case B",
                    "status": "Temperature Violation",
                    "notes": "Chiller temperature (+5.2°C) significantly violates max fish storage (+2.0°C).",
                },
                "ai_result": {
                    "classification": "Spoiled",
                    "confidence": 0.96,
                    "quality_score": 22.0,
                    "spoilage_risk": "Critical",
                    "spoilage_probability": 0.88,
                    "estimated_shelf_life_days": 0.0,
                    "detected_defects": ["Severe Surface Browning", "Mycelial Mold / Slime Layer (6.4%)"],
                    "mold_detected": True,
                    "mold_coverage_pct": 6.4,
                    "bruising_detected": True,
                    "physical_damage_detected": False,
                    "browning_index": 48.6,
                    "roughness_index": 38.2,
                    "color_score": 18.0,
                    "texture_score": 24.0,
                    "analyzed_at": (now - timedelta(hours=5)).isoformat(),
                },
                "inspector_review": {
                    "decision": "Flagged",
                    "reason": "Microbial slime proliferation and elevated temperature exposure.",
                    "comments": "Severe organoleptic decomposition observed. Immediate quarantine and condemnation mandated.",
                    "issue_type": "Spoilage Suspected",
                    "severity": "Critical",
                    "reviewed_at": (now - timedelta(hours=4)).isoformat(),
                    "inspector_id": str(inspector_id),
                    "inspector_name": "Dr. Marcus Vance",
                    "inspector_adjusted_shelf_life": 0.0,
                },
                "status": "Flagged",
                "created_at": now - timedelta(hours=5),
                "updated_at": now - timedelta(hours=4),
            },
            {
                "inspection_id": "INS-20261017-MLK3",
                "inspector_id": inspector_id,
                "inspector_name": "Dr. Marcus Vance (Lead QA Inspector)",
                "inspector_email": "inspector@foodfresh.com",
                "product_name": "Organic Whole Milk 1L",
                "category": FoodCategory.DAIRY.value,
                "batch_number": "MLK-ORG-2026",
                "inventory_id": None,
                "image_reference": "/uploads/food_sample_milk.jpg",
                "storage_review": {
                    "current_temperature": 7.5,
                    "current_humidity": 65.0,
                    "recommended_temperature": 3.0,
                    "permitted_temp_min": 0.0,
                    "permitted_temp_max": 4.0,
                    "recommended_humidity": 60.0,
                    "permitted_humidity_min": 40.0,
                    "permitted_humidity_max": 70.0,
                    "storage_location": "Delivery Intake Bay 3",
                    "status": "Temperature Violation",
                    "notes": "Uncooled transit loading dock temperature exceeds dairy limits (+7.5°C vs +4.0°C).",
                },
                "ai_result": {
                    "classification": "Fresh",
                    "confidence": 0.89,
                    "quality_score": 84.0,
                    "spoilage_risk": "Medium",
                    "spoilage_probability": 0.16,
                    "estimated_shelf_life_days": 3.2,
                    "detected_defects": ["Temperature-Accelerated Kinetic Degradation Risk"],
                    "mold_detected": False,
                    "mold_coverage_pct": 0.0,
                    "bruising_detected": False,
                    "physical_damage_detected": False,
                    "browning_index": 2.1,
                    "roughness_index": 3.0,
                    "color_score": 92.0,
                    "texture_score": 86.0,
                    "analyzed_at": (now - timedelta(hours=1)).isoformat(),
                },
                "inspector_review": {
                    "decision": "Pending",
                    "reason": "Transit dock temperature violation requires titration testing before clearance.",
                    "comments": "Packaging sealed; hold shipment for lab titration assay.",
                    "issue_type": "Storage Violation",
                    "severity": "High",
                    "reviewed_at": None,
                    "inspector_id": str(inspector_id),
                    "inspector_name": "Dr. Marcus Vance",
                    "inspector_adjusted_shelf_life": None,
                },
                "status": "Under Review",
                "created_at": now - timedelta(hours=1),
                "updated_at": now - timedelta(hours=1),
            },
            {
                "inspection_id": "INS-20261017-LET4",
                "inspector_id": inspector_id,
                "inspector_name": "Dr. Marcus Vance (Lead QA Inspector)",
                "inspector_email": "inspector@foodfresh.com",
                "product_name": "Hydroponic Crisp Lettuce",
                "category": FoodCategory.VEGETABLES.value,
                "batch_number": "VEG-LET-108",
                "inventory_id": None,
                "image_reference": "/uploads/food_sample_lettuce.jpg",
                "storage_review": {
                    "current_temperature": 3.8,
                    "current_humidity": 92.0,
                    "recommended_temperature": 4.0,
                    "permitted_temp_min": 1.0,
                    "permitted_temp_max": 6.0,
                    "recommended_humidity": 92.0,
                    "permitted_humidity_min": 85.0,
                    "permitted_humidity_max": 98.0,
                    "storage_location": "Hydroponics Cold Bay",
                    "status": "Normal",
                    "notes": "Optimal relative humidity and misting cycle.",
                },
                "ai_result": {
                    "classification": "Fresh",
                    "confidence": 0.95,
                    "quality_score": 91.0,
                    "spoilage_risk": "Low",
                    "spoilage_probability": 0.09,
                    "estimated_shelf_life_days": 5.0,
                    "detected_defects": ["Optimal Visual Quality — No Significant Defects"],
                    "mold_detected": False,
                    "mold_coverage_pct": 0.0,
                    "bruising_detected": False,
                    "physical_damage_detected": False,
                    "browning_index": 4.5,
                    "roughness_index": 6.2,
                    "color_score": 94.0,
                    "texture_score": 90.0,
                    "analyzed_at": (now - timedelta(days=1)).isoformat(),
                },
                "inspector_review": {
                    "decision": "Confirmed",
                    "reason": "Zero vascular discoloration or moisture necrosis.",
                    "comments": "Crisp foliage texture and vibrant green chloroplast distribution.",
                    "issue_type": "None",
                    "severity": "None",
                    "reviewed_at": (now - timedelta(days=1)).isoformat(),
                    "inspector_id": str(inspector_id),
                    "inspector_name": "Dr. Marcus Vance",
                    "inspector_adjusted_shelf_life": None,
                },
                "status": "Confirmed",
                "created_at": now - timedelta(days=1),
                "updated_at": now - timedelta(days=1),
            },
            {
                "inspection_id": "INS-20261017-SRD5",
                "inspector_id": inspector_id,
                "inspector_name": "Dr. Marcus Vance (Lead QA Inspector)",
                "inspector_email": "inspector@foodfresh.com",
                "product_name": "Artisan Sourdough Loaf",
                "category": FoodCategory.BAKERY.value,
                "batch_number": "BKR-SRD-502",
                "inventory_id": None,
                "image_reference": "/uploads/food_sample_bread.jpg",
                "storage_review": {
                    "current_temperature": 21.0,
                    "current_humidity": 52.0,
                    "recommended_temperature": 20.0,
                    "permitted_temp_min": 18.0,
                    "permitted_temp_max": 24.0,
                    "recommended_humidity": 48.0,
                    "permitted_humidity_min": 35.0,
                    "permitted_humidity_max": 60.0,
                    "storage_location": "Bakery Ambient Rack 1",
                    "status": "Normal",
                    "notes": "Standard ambient bakery display condition.",
                },
                "ai_result": {
                    "classification": "Moderately Fresh",
                    "confidence": 0.88,
                    "quality_score": 62.0,
                    "spoilage_risk": "Medium",
                    "spoilage_probability": 0.38,
                    "estimated_shelf_life_days": 1.2,
                    "detected_defects": ["Surface Dehydration / Staling Initiated"],
                    "mold_detected": False,
                    "mold_coverage_pct": 0.0,
                    "bruising_detected": False,
                    "physical_damage_detected": False,
                    "browning_index": 22.0,
                    "roughness_index": 19.5,
                    "color_score": 68.0,
                    "texture_score": 58.0,
                    "analyzed_at": (now - timedelta(hours=6)).isoformat(),
                },
                "inspector_review": {
                    "decision": "Requires Further Inspection",
                    "reason": "Crust retrogradation detected; verify crumb water activity.",
                    "comments": "Recommend clearance markdown or kitchen bread pudding repurposing within 24 hours.",
                    "issue_type": "Short Remaining Shelf Life",
                    "severity": "Medium",
                    "reviewed_at": (now - timedelta(hours=5)).isoformat(),
                    "inspector_id": str(inspector_id),
                    "inspector_name": "Dr. Marcus Vance",
                    "inspector_adjusted_shelf_life": 1.0,
                },
                "status": "Requires Further Inspection",
                "created_at": now - timedelta(hours=6),
                "updated_at": now - timedelta(hours=5),
            },
        ]

        for insp in sample_inspections:
            existing = insp_col.find_one({"inspection_id": insp["inspection_id"]})
            if not existing:
                insp_col.insert_one(insp)
                print(f"Inserted inspection: {insp['inspection_id']} ({insp['product_name']})")
            else:
                print(f"Inspection already exists: {insp['inspection_id']}")

        # Seed Quality Alerts for Inspector
        if alerts_col is not None:
            inspector_alerts = [
                {
                    "user_id": inspector_id,
                    "item_name": "Premium Atlantic Salmon Fillet",
                    "inspection_id": "INS-20261017-SLM2",
                    "alert_type": "spoilage_suspected",
                    "severity": "critical",
                    "message": "[CRITICAL] Spoilage Suspected: Microbial slime proliferation and elevated temperature exposure.",
                    "status": "active",
                    "created_at": now - timedelta(hours=5),
                },
                {
                    "user_id": inspector_id,
                    "item_name": "Organic Whole Milk 1L",
                    "inspection_id": "INS-20261017-MLK3",
                    "alert_type": "temperature_violation",
                    "severity": "high",
                    "message": "[HIGH] Storage Violation: Delivery Intake Bay 3 recorded at +7.5°C; exceeds max dairy tolerance (+4.0°C).",
                    "status": "active",
                    "created_at": now - timedelta(hours=1),
                },
            ]
            for al in inspector_alerts:
                existing_al = alerts_col.find_one({
                    "user_id": al["user_id"],
                    "inspection_id": al["inspection_id"]
                })
                if not existing_al:
                    alerts_col.insert_one(al)
                    print(f"Inserted inspector alert: {al['message']}")

    # 5. Seed Storage Rules
    rules_col = get_storage_rules_collection()
    if rules_col is not None and rules_col.count_documents({}) == 0:
        from backend.app.services.admin_service import DEFAULT_STORAGE_RULES
        for rule in DEFAULT_STORAGE_RULES:
            rules_col.insert_one({**rule, "created_at": now, "updated_at": now})
        print("Seeded global storage condition rules.")

    # 6. Seed System Configuration
    cfg_col = get_system_config_collection()
    if cfg_col is not None and cfg_col.count_documents({}) == 0:
        from backend.app.services.admin_service import DEFAULT_SYSTEM_CONFIG
        cfg_col.insert_one({**DEFAULT_SYSTEM_CONFIG, "created_at": now, "updated_at": now})
        print("Seeded platform system configuration.")

    # 7. Seed Initial Audit Logs
    audit_col = get_audit_logs_collection()
    if audit_col is not None and audit_col.count_documents({}) == 0:
        admin_id = user_map.get("admin@foodfresh.com")
        initial_audits = [
            {
                "timestamp": now - timedelta(hours=48),
                "actor_id": admin_id,
                "actor_email": "admin@foodfresh.com",
                "actor_role": "Admin",
                "action": "SYSTEM_INITIALIZATION",
                "target_resource": "system",
                "status": "success",
                "metadata": {"version": "4.0.0", "environment": "production"},
            },
            {
                "timestamp": now - timedelta(hours=24),
                "actor_id": admin_id,
                "actor_email": "admin@foodfresh.com",
                "actor_role": "Admin",
                "action": "STORAGE_RULE_CREATE",
                "target_resource": "storage_rules",
                "new_value": {"category": "Dairy", "min_temp": 1.0, "max_temp": 4.0},
                "status": "success",
            },
            {
                "timestamp": now - timedelta(hours=12),
                "actor_id": user_map.get("inspector@foodfresh.com"),
                "actor_email": "inspector@foodfresh.com",
                "actor_role": "Food Quality Inspector",
                "action": "QUALITY_INSPECTION_RUN",
                "target_resource": "food_inspections",
                "status": "success",
            },
        ]
        audit_col.insert_many(initial_audits)
        print("Seeded initial platform audit log events.")

    # 8. Seed Warehouse Zones, Temperature Rules & Initial Telemetry
    from backend.app.services.warehouse_service import WarehouseService
    WarehouseService.ensure_defaults()
    print("Seeded warehouse cold-chain zones, authoritative temperature rules, and baseline telemetry.")

    print("\nDatabase seeded successfully!")
    print("Default demo accounts available:")
    print("  - Admin: admin@foodfresh.com / AdminPass123!")
    print("  - Consumer: consumer@foodfresh.com / ConsumerPass123!")
    print("  - Retailer: retailer@foodfresh.com / RetailerPass123!")
    print("  - Quality Inspector: inspector@foodfresh.com / InspectorPass123!")
    print("  - Warehouse Manager: warehouse@foodfresh.com / WarehousePass123!")



if __name__ == "__main__":
    seed_database()
