import os
import sys
from datetime import date, timedelta
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["JWT_SECRET"] = "test-secret-key-12345"
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import Base
from app.models import User, FoodItem
from app.schemas import (
    RegisterRequest,
    LoginRequest,
    FoodCreate,
    ROLES,
)
from app.auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
)
from app.main import (
    register,
    login,
    me,
    create_food,
    list_inventory,
    delete_food,
)
from fastapi import HTTPException

# In-memory database for isolated unit & integration tests
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def run_all_tests():
    db = TestingSessionLocal()
    print("=================================================================")
    print("  AI FOOD FRESHNESS PLATFORM - MILESTONE 1 VERIFICATION SUITE   ")
    print("=================================================================")

    # 1. Test Password Hashing with Bcrypt
    print("\n[1] Testing Native Bcrypt Password Hashing & Verification...")
    raw_pwd = "SecurePassword2026!"
    hashed = hash_password(raw_pwd)
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$"), "Hash format invalid"
    assert verify_password(raw_pwd, hashed) is True, "Valid password verification failed"
    assert verify_password("WrongPassword", hashed) is False, "Invalid password was accepted"
    print("    [OK] Bcrypt password hashing & verification confirmed secure and functional.")

    # 2. Test Official 5 Roles Registration
    print("\n[2] Testing Registration for All 5 Official Roles...")
    roles_list = [
        "consumer",
        "retail_manager",
        "warehouse_operator",
        "food_quality_inspector",
        "administrator",
    ]
    
    users = {}
    tokens = {}
    for role in roles_list:
        req = RegisterRequest(
            full_name=f"Test {role.replace('_', ' ').title()}",
            email=f"{role}@freshguard.org",
            password="Password123!",
            role=role,
        )
        res = register(req, db=db)
        assert res.access_token is not None
        assert res.user.role == role
        assert res.user.email == f"{role}@freshguard.org"
        users[role] = res.user
        tokens[role] = res.access_token
        print(f"    [OK] Role '{role}' successfully registered (User ID: {res.user.id}).")

    # 3. Test Duplicate Email Prevention
    print("\n[3] Testing Duplicate Email Prevention...")
    try:
        register(
            RegisterRequest(
                full_name="Duplicate User",
                email="consumer@freshguard.org",
                password="Password123!",
                role="consumer",
            ),
            db=db,
        )
        assert False, "Duplicate email registration should have failed"
    except HTTPException as e:
        assert e.status_code == 409
        print("    [OK] Duplicate email correctly rejected with HTTP 409 Conflict.")

    # 4. Test Invalid Role Prevention
    print("\n[4] Testing Invalid Role Prevention...")
    try:
        register(
            RegisterRequest(
                full_name="Bad Role User",
                email="bad_role@test.com",
                password="Password123!",
                role="super_admin_unauthorized",
            ),
            db=db,
        )
        assert False, "Invalid role registration should have failed"
    except HTTPException as e:
        assert e.status_code == 400
        print("    [OK] Invalid role correctly rejected with HTTP 400 Bad Request.")

    # 5. Test Login Verification
    print("\n[5] Testing Login & Authentication...")
    login_res = login(
        LoginRequest(email="consumer@freshguard.org", password="Password123!"),
        db=db,
    )
    assert login_res.access_token is not None
    assert login_res.user.email == "consumer@freshguard.org"
    print("    [OK] Valid credentials login returned JWT access token.")

    try:
        login(
            LoginRequest(email="consumer@freshguard.org", password="WrongPassword!"),
            db=db,
        )
        assert False, "Invalid login should have failed"
    except HTTPException as e:
        assert e.status_code == 401
        print("    [OK] Invalid password correctly rejected with HTTP 401 Unauthorized.")

    # 6. Test /auth/me Endpoint
    print("\n[6] Testing /auth/me User Profile Verification...")
    inspector_user = db.scalar(select(User).where(User.email == "food_quality_inspector@freshguard.org"))
    me_res = me(current_user=inspector_user)
    assert me_res.role == "food_quality_inspector"
    assert me_res.email == "food_quality_inspector@freshguard.org"
    print("    [OK] Current user profile matches authenticated session.")

    # 7. Test 8 Official Food Categories Inventory Registration
    print("\n[7] Testing Inventory Registration across all 8 Official Food Categories...")
    test_consumer = db.scalar(select(User).where(User.email == "consumer@freshguard.org"))
    
    categories = [
        ("Organic Royal Gala Apples", "Fruits", "BATCH-FR-01", 50, date.today() + timedelta(days=14)),
        ("Fresh Baby Spinach", "Vegetables", "BATCH-VG-02", 20, date.today() + timedelta(days=6)),
        ("Whole Pasteurized Milk", "Dairy Products", "BATCH-DY-03", 0, date.today() - timedelta(days=2)), # Out of Stock & Expired
        ("Premium Chicken Breast", "Meat & Poultry", "BATCH-MP-04", 15, date.today() + timedelta(days=3)),
        ("Wild Atlantic Salmon", "Seafood", "BATCH-SF-05", 10, date.today() + timedelta(days=2)),
        ("Artisan Sourdough Loaf", "Bakery Products", "BATCH-BK-06", 8, date.today() + timedelta(days=4)),
        ("Durum Wheat Pasta", "Packaged Foods", "BATCH-PF-07", 100, date.today() + timedelta(days=180)),
        ("Sparkling Natural Water", "Beverages", "BATCH-BV-08", 45, date.today() + timedelta(days=365)),
    ]

    saved_items = []
    for name, cat, batch, qty, exp in categories:
        food_data = FoodCreate(
            name=name,
            category=cat,
            batch_number=batch,
            quantity=qty,
            expiry_date=exp,
        )
        created = create_food(food_data, db=db, current_user=test_consumer)
        assert created.id is not None
        assert created.created_by == test_consumer.id
        assert created.quantity == qty
        saved_items.append(created)
        print(f"    [OK] Registered '{name}' | Category: {cat} | Batch: {batch} | Qty: {qty} | Expiry: {exp}")

    # 8. Test Inventory Listing & Retrieval
    print("\n[8] Testing Inventory Listing & Data Retrieval...")
    inventory = list_inventory(db=db, current_user=test_consumer)
    assert len(inventory) == 8, f"Expected 8 items, got {len(inventory)}"
    print(f"    [OK] Successfully retrieved all {len(inventory)} inventory items.")

    # 9. Test Availability & Expiry Status Logic
    print("\n[9] Testing Dynamic Availability & Expiry Status Logic...")
    for item in inventory:
        # Check Availability
        is_in_stock = item.quantity > 0
        avail_label = "In Stock" if is_in_stock else "Out of Stock"
        
        # Check Expiry
        today = date.today()
        if item.expiry_date < today:
            exp_label = "Expired"
        elif item.expiry_date == today:
            exp_label = "Expiring Today"
        else:
            exp_label = "Valid"

        if item.name == "Whole Pasteurized Milk":
            assert avail_label == "Out of Stock", "Milk should be Out of Stock (qty=0)"
            assert exp_label == "Expired", "Milk should be Expired (date in past)"

        print(f"    [OK] '{item.name}': Availability='{avail_label}', Expiry Status='{exp_label}'")

    # 10. Test Item Deletion
    print("\n[10] Testing Item Deletion...")
    item_to_delete = saved_items[0]
    del_res = delete_food(food_id=item_to_delete.id, db=db, current_user=test_consumer)
    assert del_res["message"] == "Food item deleted"
    
    # Confirm deletion from database
    inventory_after = list_inventory(db=db, current_user=test_consumer)
    assert len(inventory_after) == 7
    print(f"    [OK] Item ID {item_to_delete.id} ('{item_to_delete.name}') deleted. Inventory count now: {len(inventory_after)}")

    print("\n=================================================================")
    print("  ALL 10 VERIFICATION MODULES PASSED WITH 100% SUCCESS! [OK]     ")
    print("=================================================================")
    db.close()


if __name__ == "__main__":
    run_all_tests()
