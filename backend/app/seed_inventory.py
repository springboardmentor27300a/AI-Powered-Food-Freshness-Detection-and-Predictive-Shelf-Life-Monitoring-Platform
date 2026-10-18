"""
Repeatable Food Inventory Seeding Script
Food Freshness Monitoring Platform

Populates realistic demonstration food inventory data for:
- Apples, Bananas, Oranges, Strawberries
- Tomatoes, Potatoes, Onions, Carrots, Cucumbers, Spinach, Capsicum
- Milk, Yogurt, Cheese, Eggs, Heavy Cream
- Sourdough Bread, Rice, Salmon, Chicken Breast
"""

import sys
from datetime import datetime, timezone, date, timedelta
from bson import ObjectId

from backend.app.database import connect_to_mongo, get_users_collection, get_inventory_collection
from backend.app.models.inventory_model import FoodCategory, StorageType, FreshnessStatus
from backend.app.services.inventory_service import InventoryService


def seed_inventory_for_accounts(target_emails=None, clean_existing=False):
    """
    Safely seeds realistic demonstration food inventory into MongoDB Atlas.
    """
    print("=" * 70)
    print(" [SEEDER] FreshGuard Platform - Repeatable Inventory Seeding Script")
    print("=" * 70)

    if not connect_to_mongo():
        print("[ERROR] Failed to connect to MongoDB. Aborting.")
        sys.exit(1)

    users_col = get_users_collection()
    inv_col = get_inventory_collection()

    if target_emails is None:
        target_emails = ["demo@foodfresh.com", "consumer@foodfresh.com", "admin@foodfresh.com"]

    for email in target_emails:
        user = users_col.find_one({"email": email})
        if not user:
            print(f"[WARN] User '{email}' not found in database. Skipping.")
            continue

        user_id = user["_id"]
        print(f"\n[USER] Seeding inventory for: {user.get('name', 'User')} ({email}) [ID: {user_id}]")

        if clean_existing:
            del_result = inv_col.delete_many({"user_id": {"$in": [user_id, str(user_id)]}})
            print(f"   [CLEAN] Cleared {del_result.deleted_count} previous inventory items.")

        catalog = InventoryService.get_dataset_catalog(user_id)
        inserted_count = 0
        updated_count = 0

        for item in catalog:
            query = {
                "user_id": user_id,
                "food_name": item["food_name"],
                "batch_number": item["batch_number"],
            }
            existing = inv_col.find_one(query)
            if existing:
                inv_col.update_one({"_id": existing["_id"]}, {"$set": item})
                updated_count += 1
            else:
                inv_col.insert_one(item)
                inserted_count += 1

        total_count = inv_col.count_documents({"user_id": {"$in": [user_id, str(user_id)]}})
        print(f"   [OK] {inserted_count} new items inserted, {updated_count} updated. Total active items: {total_count}")

    print("\n" + "=" * 70)
    print(" [DONE] Inventory Seeding Completed Successfully!")
    print("=" * 70)


if __name__ == "__main__":
    clean = "--clean" in sys.argv
    seed_inventory_for_accounts(clean_existing=clean)
