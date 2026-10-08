"""
Seed script - sample users + food batches for testing Milestone 1.

Run from the backend/ folder (with your virtualenv active):
    python seed.py

Creates one demo account per role (password shown next to each) and a set of
batches whose expiry dates are relative to *today*, so Fresh / Expiring Soon /
Expired states are always visible in the UI.
"""
from datetime import date, timedelta

from app.constants import ROLE_LABELS
from app.database import Base, SessionLocal, engine
from app.models import FoodBatch, User
from app.security import hash_password

# email -> (full name, role, plain password used only for this demo seed)
DEMO_USERS = [
    ("admin@freshtrack.com",    "Priya Sharma",   "administrator",     "Admin@1234"),
    ("manager@freshtrack.com",  "Rahul Verma",    "retail_manager",    "Manager@1234"),
    ("warehouse@freshtrack.com","Anita Desai",    "warehouse_operator","Warehouse@1234"),
    ("inspector@freshtrack.com","Karan Malhotra", "quality_inspector", "Inspector@1234"),
    ("consumer@freshtrack.com", "Sneha Iyer",     "consumer",          "Consumer@1234"),
]

# (owner_email, food_name, category, qty, available, unit,
#  received offset days, expiry offset days, storage, packaging, notes)
DEMO_BATCHES = [
    ("manager@freshtrack.com", "Apple",           "Fruits",           50.0, 42.5, "kg",      -6,  8, "Cold Storage A - Shelf 1", "Crates",        "Organic produce from Shimano farms"),
    ("manager@freshtrack.com", "Banana",          "Fruits",           30.0, 30.0, "kg",      -2,  2, "Cold Storage A - Shelf 2", "Boxes",         "Ripening room batch"),
    ("manager@freshtrack.com", "Spinach",          "Vegetables",       12.0,  9.0, "kg",      -3,  1, "Cold Storage B - Shelf 1", "Loose",         "High humidity drawer"),
    ("manager@freshtrack.com", "Milk",             "Dairy Products",   60.0, 55.0, "litres",  -1,  3, "Chiller Unit 2",           "Bottled",       "Toned milk, 500 ml bottles"),
    ("manager@freshtrack.com", "Yoghurt",          "Dairy Products",   24.0, 20.0, "pieces",  -7, -2, "Chiller Unit 2",           "Sealed Cups",   "Blueberry flavour"),
    ("manager@freshtrack.com", "Whole Wheat Bread","Bakery Products",  40.0, 35.0, "packets", -4, -1, "Dry Store Rack 3",         "Poly Wrapped",  "Daily bakery supply"),
    ("manager@freshtrack.com", "Chicken Breast",   "Meat & Poultry",   18.0, 18.0, "kg",      -1,  2, "Freezer Unit 1",           "Vacuum Packed", "-18 C storage required"),
    ("manager@freshtrack.com", "Salmon Fillet",    "Seafood",          10.0,  7.5, "kg",      -2,  0, "Freezer Unit 2",           "Vacuum Packed", "Expires today - prioritise"),
    ("manager@freshtrack.com", "Orange Juice",     "Beverages",        48.0, 48.0, "litres", -10, 45, "Dry Store Rack 1",         "Cartons",       "No added sugar variant"),
    ("manager@freshtrack.com", "Basmati Rice",     "Packaged Foods",  200.0,180.0, "kg",     -20,300, "Dry Store Rack 5",         "Sacks",         "Long grain premium"),
    ("warehouse@freshtrack.com", "Potato",         "Vegetables",      150.0,140.0, "kg",      -5, 25, "Warehouse Zone D",         "Mesh Sacks",    "Bulk stock"),
    ("warehouse@freshtrack.com", "Tomato",         "Vegetables",       80.0, 65.0, "kg",      -2,  3, "Cold Storage C",           "Crates",        "Grade A quality"),
    ("consumer@freshtrack.com",  "Eggs",           "Packaged Foods",   30.0, 24.0, "pieces",  -6, 12, "Home Fridge",              "Trays",         "Family weekly supply"),
    ("consumer@freshtrack.com",  "Paneer",         "Dairy Products",    1.0,  0.6, "kg",      -3,  2, "Home Fridge",              "Wrapped Block", "Open after Diwali dinner"),
]


def run_seed() -> None:
    # Create tables if they do not exist yet (mirrors app startup behaviour).
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == DEMO_USERS[0][0]).first():
            print("Seed data already present - skipping. (Delete the tables or DB rows to re-seed.)")
            return

        users = {}
        for email, full_name, role, password in DEMO_USERS:
            user = User(full_name=full_name, email=email,
                        password_hash=hash_password(password), role=role)
            db.add(user)
            users[email] = user
        db.commit()

        today = date.today()
        from app.utils.batch_ids import generate_batch_id

        count = 0
        for owner_email, name, category, qty, avail, unit, recv_off, exp_off, loc, pack, notes in DEMO_BATCHES:
            received = today + timedelta(days=recv_off)
            batch = FoodBatch(
                batch_id=None,
                user_id=users[owner_email].id,
                food_name=name,
                category=category,
                quantity=qty,
                available_quantity=avail,
                unit=unit,
                received_date=received,
                expiry_date=today + timedelta(days=exp_off),
                storage_location=loc,
                packaging_type=pack,
                notes=notes,
            )
            # Use the exact same ID generator as the API so seeded data follows
            # the documented <FOOD>-<YYYYMMDD>-<seq> convention.
            batch.batch_id = generate_batch_id(db, name, received)
            db.add(batch)
            db.flush()  # make this row visible to the next ID-generation query
            count += 1
        db.commit()

        print(f"Seeded {len(users)} users and {count} food batches:")
        for email, _, role, password in DEMO_USERS:
            print(f"  {ROLE_LABELS[role]:<24} {email:<28} password: {password}")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
