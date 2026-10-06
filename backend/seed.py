"""
Development seed script.

Creates one test user per role, plus a handful of sample food items and
batches so the app isn't empty on first run.

Run with:  python seed.py
(from inside backend/, with the venv active and .env configured)

⚠️  These are DEVELOPMENT credentials only. Change or remove them before
    any real/production deployment.
"""
import sys
from datetime import date, timedelta

from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.batch import Batch, BatchUnit
from app.models.food_item import FoodCategory, FoodItem
from app.models.user import User, UserRole

DEV_USERS = [
    {"username": "admin", "email": "admin@freshness.dev", "full_name": "Admin User",
     "password": "Admin@123", "role": UserRole.ADMINISTRATOR},
    {"username": "retail_manager", "email": "retail_manager@freshness.dev", "full_name": "Rita Retail",
     "password": "Retail@123", "role": UserRole.RETAIL_MANAGER},
    {"username": "warehouse_operator", "email": "warehouse_operator@freshness.dev", "full_name": "Walt Warehouse",
     "password": "Warehouse@123", "role": UserRole.WAREHOUSE_OPERATOR},
    {"username": "quality_inspector", "email": "quality_inspector@freshness.dev", "full_name": "Ivy Inspector",
     "password": "Inspector@123", "role": UserRole.QUALITY_INSPECTOR},
    {"username": "consumer", "email": "consumer@freshness.dev", "full_name": "Chris Consumer",
     "password": "Consumer@123", "role": UserRole.CONSUMER},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already has users — skipping seed to avoid duplicates.")
            print("(Delete the tables or drop the DB if you want a clean reseed.)")
            sys.exit(0)

        created_users = {}
        for u in DEV_USERS:
            user = User(
                username=u["username"],
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
            )
            db.add(user)
            db.flush()
            created_users[u["username"]] = user
        db.commit()
        print(f"Created {len(DEV_USERS)} development users.")

        admin_user = created_users["admin"]
        wh_user = created_users["warehouse_operator"]

        sample_items = [
            {"name": "Fuji Apples", "category": FoodCategory.FRUITS, "storage_location": "Cold Room A"},
            {"name": "Whole Milk 1L", "category": FoodCategory.DAIRY_PRODUCTS, "storage_location": "Chiller 2"},
            {"name": "Chicken Breast", "category": FoodCategory.MEAT_POULTRY, "storage_location": "Freezer 1"},
            {"name": "Wheat Bread Loaf", "category": FoodCategory.BAKERY_PRODUCTS, "storage_location": "Shelf B3"},
            {"name": "Fresh Tomatoes", "category": FoodCategory.VEGETABLES, "storage_location": "Cold Room A"},
        ]

        food_items = []
        for item_data in sample_items:
            item = FoodItem(**item_data, is_available=True, created_by=admin_user.id)
            db.add(item)
            db.flush()
            food_items.append(item)
        db.commit()
        print(f"Created {len(food_items)} sample food items.")

        today = date.today()
        sample_batches = [
            {"food_item": food_items[0], "quantity": 50, "unit": BatchUnit.KG, "expiry_offset": 20},
            {"food_item": food_items[1], "quantity": 8, "unit": BatchUnit.PACKS, "expiry_offset": 2},
            {"food_item": food_items[2], "quantity": 30, "unit": BatchUnit.KG, "expiry_offset": 15},
            {"food_item": food_items[3], "quantity": 0, "unit": BatchUnit.PIECES, "expiry_offset": 5},
            {"food_item": food_items[4], "quantity": 25, "unit": BatchUnit.KG, "expiry_offset": -1},
        ]

        for idx, b in enumerate(sample_batches, start=1):
            batch = Batch(
                batch_code=f"BATCH-{today.year}-{idx:05d}",
                food_item_id=b["food_item"].id,
                quantity=b["quantity"],
                unit=b["unit"],
                received_date=today - timedelta(days=5),
                manufacturing_date=today - timedelta(days=10),
                expiry_date=today + timedelta(days=b["expiry_offset"]),
                storage_location=b["food_item"].storage_location,
                created_by=wh_user.id,
            )
            batch.status = batch.compute_status()
            db.add(batch)
        db.commit()
        print(f"Created {len(sample_batches)} sample batches.")

        print("\nSeed complete. Development login credentials:")
        for u in DEV_USERS:
            print(f"  {u['role'].value:<20} username={u['username']:<20} password={u['password']}")
        print("\n⚠️  Change these before any real deployment.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
