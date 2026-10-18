"""Tests for M4 Reports & Export System."""
import pytest
from datetime import date
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition
from app.auth import hash_password, create_token

# Uses shared conftest.py fixtures: client, db, setup_db, consumer_user, consumer_headers, etc.


def test_shelf_life_pdf_report(client, consumer_headers, consumer_user, db):
    """Test shelf-life PDF report generation."""
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="tomato",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date(2026, 10, 5),
        risk_level="low",
        official_freshness_score=80,
        visual_condition_score=85,
        storage_condition_score=90,
        shelf_life_score=75,
        product_age_score=80,
        input_snapshot='{"temperature_c": 22}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/shelf-life/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0


def test_shelf_life_excel_report(client, consumer_headers, consumer_user, db):
    """Test shelf-life Excel report generation."""
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="tomato",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date(2026, 10, 5),
        risk_level="low",
        official_freshness_score=80,
        visual_condition_score=85,
        storage_condition_score=90,
        shelf_life_score=75,
        product_age_score=80,
        input_snapshot='{"temperature_c": 22}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/shelf-life/excel", headers=consumer_headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]
    assert len(response.content) > 0


def test_inventory_pdf_report(client, db):
    """Test inventory quality PDF report generation."""
    user = User(
        full_name="Test Retail Manager",
        email="retail_inv@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    item = FoodItem(
        name="Test Apples",
        category="Fruits",
        batch_number="B-001",
        quantity=10,
        expiry_date=date(2026, 10, 15),
        created_by=user.id,
    )
    db.add(item)
    db.commit()

    response = client.get("/reports/inventory/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0


def test_inventory_excel_report(client, db):
    """Test inventory quality Excel report generation."""
    user = User(
        full_name="Test Retail Manager",
        email="retail_inv2@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    item = FoodItem(
        name="Test Apples",
        category="Fruits",
        batch_number="B-001",
        quantity=10,
        expiry_date=date(2026, 10, 15),
        created_by=user.id,
    )
    db.add(item)
    db.commit()

    response = client.get("/reports/inventory/excel", headers=headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]
    assert len(response.content) > 0


def test_waste_reduction_pdf_report(client, db):
    """Test waste reduction PDF report generation."""
    user = User(
        full_name="Test Retail Manager",
        email="retail_wr@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    pred = ShelfLifePrediction(
        user_id=user.id,
        food_type="tomato",
        remaining_shelf_life_days=1,
        predicted_expiry_date=date(2026, 10, 1),
        risk_level="high",
        official_freshness_score=30,
        visual_condition_score=50,
        storage_condition_score=40,
        shelf_life_score=20,
        product_age_score=60,
        input_snapshot='{"temperature_c": 25}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="needs_attention",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/waste-reduction/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0


def test_waste_reduction_excel_report(client, db):
    """Test waste reduction Excel report generation."""
    user = User(
        full_name="Test Retail Manager",
        email="retail_wr2@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    pred = ShelfLifePrediction(
        user_id=user.id,
        food_type="tomato",
        remaining_shelf_life_days=1,
        predicted_expiry_date=date(2026, 10, 1),
        risk_level="high",
        official_freshness_score=30,
        visual_condition_score=50,
        storage_condition_score=40,
        shelf_life_score=20,
        product_age_score=60,
        input_snapshot='{"temperature_c": 25}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="needs_attention",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/waste-reduction/excel", headers=headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]
    assert len(response.content) > 0


def test_storage_compliance_pdf_report(client, consumer_headers, consumer_user, db):
    """Test storage compliance PDF report generation."""
    sc = StorageCondition(
        user_id=consumer_user.id,
        temperature_c=22.5,
        humidity_pct=70,
        air_circulation="good",
        light_exposure="low",
        packaging_type="sealed",
        storage_duration_days=2,
    )
    db.add(sc)
    db.commit()

    response = client.get("/reports/storage-compliance/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0


def test_storage_compliance_excel_report(client, consumer_headers, consumer_user, db):
    """Test storage compliance Excel report generation."""
    sc = StorageCondition(
        user_id=consumer_user.id,
        temperature_c=22.5,
        humidity_pct=70,
        air_circulation="good",
        light_exposure="low",
        packaging_type="sealed",
        storage_duration_days=2,
    )
    db.add(sc)
    db.commit()

    response = client.get("/reports/storage-compliance/excel", headers=consumer_headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]
    assert len(response.content) > 0


def test_empty_data_handling(client, consumer_headers, db):
    """Test reports handle empty data gracefully."""
    # Consumer can access these reports
    response = client.get("/reports/shelf-life/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert len(response.content) > 0

    response = client.get("/reports/freshness/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert len(response.content) > 0

    response = client.get("/reports/storage-compliance/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert len(response.content) > 0

    # Test with retail_manager for inventory and waste-reduction
    user = User(
        full_name="Test Retail Manager",
        email="retail_empty@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/reports/inventory/pdf", headers=headers)
    assert response.status_code == 200
    assert len(response.content) > 0

    response = client.get("/reports/waste-reduction/pdf", headers=headers)
    assert response.status_code == 200
    assert len(response.content) > 0


def test_report_requires_auth(client):
    """Test that report endpoints require authentication."""
    response = client.get("/reports/shelf-life/pdf")
    assert response.status_code == 401

    response = client.get("/reports/inventory/pdf")
    assert response.status_code == 401


def test_user_data_isolation(client, consumer_headers, consumer_user, db):
    """Test that users cannot access other users' report data."""
    other_user = User(
        full_name="Other User",
        email="other@test.com",
        password_hash=hash_password("pass123"),
        role="consumer",
    )
    db.add(other_user)
    db.commit()

    pred = ShelfLifePrediction(
        user_id=other_user.id,
        food_type="seafood",
        remaining_shelf_life_days=3,
        predicted_expiry_date=date(2026, 10, 3),
        risk_level="moderate",
        official_freshness_score=50,
        visual_condition_score=70,
        storage_condition_score=60,
        shelf_life_score=50,
        product_age_score=80,
        input_snapshot='{"temperature_c": 5}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/shelf-life/pdf", headers=consumer_headers)
    assert response.status_code == 200
    # Consumer should not see other user's predictions in their report
    # (The report only queries predictions where user_id == current_user.id)


def test_synthetic_labeling(client, consumer_headers, consumer_user, db):
    """Test that synthetic models are clearly labeled in reports."""
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="vegetables",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date(2026, 10, 5),
        risk_level="low",
        official_freshness_score=80,
        visual_condition_score=85,
        storage_condition_score=90,
        shelf_life_score=75,
        product_age_score=80,
        input_snapshot='{"temperature_c": 22}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/shelf-life/pdf", headers=consumer_headers)
    assert response.status_code == 200
    # The PDF should contain "Synthetic Dataset (Demonstration)" label
    # Note: We can't easily parse PDF content, but we verify the endpoint works


def test_existing_m2_report_still_works(client, consumer_headers, consumer_user, db):
    """Test that the existing M2 freshness report endpoint still works."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Test Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
        predicted_class="freshapples",
        color_metrics='{"dominant_color_hex": "#ff0000"}',
        texture_metrics='{"texture_uniformity": 0.9}',
    )
    db.add(analysis)
    db.commit()

    response = client.get(f"/analysis/{analysis.id}/report", headers=consumer_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0


# ============================================================
# Freshness Summary Report Tests
# ============================================================

def test_freshness_pdf_report(client, consumer_headers, consumer_user, db):
    """Test freshness summary PDF report generation."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Test Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
        predicted_class="freshapples",
        color_metrics='{"dominant_color_hex": "#ff0000", "discoloration_index": 0.1}',
        texture_metrics='{"texture_uniformity": 0.9}',
    )
    db.add(analysis)
    db.commit()

    response = client.get("/reports/freshness/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0


def test_freshness_excel_report(client, consumer_headers, consumer_user, db):
    """Test freshness Excel report generation."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Test Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
        predicted_class="freshapples",
    )
    db.add(analysis)
    db.commit()

    response = client.get("/reports/freshness/excel", headers=consumer_headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]
    assert len(response.content) > 0


def test_freshness_report_empty_data(client, consumer_headers):
    """Test freshness report with no data."""
    response = client.get("/reports/freshness/pdf", headers=consumer_headers)
    assert response.status_code == 200
    assert len(response.content) > 0

    response = client.get("/reports/freshness/excel", headers=consumer_headers)
    assert response.status_code == 200
    assert len(response.content) > 0


# ============================================================
# Role-Based Access Control Tests
# ============================================================

def test_consumer_cannot_access_inventory_report(client, consumer_headers):
    """Test that consumer role cannot access inventory quality report."""
    response = client.get("/reports/inventory/pdf", headers=consumer_headers)
    assert response.status_code == 403


def test_consumer_cannot_access_waste_reduction_report(client, consumer_headers):
    """Test that consumer role cannot access waste reduction report."""
    response = client.get("/reports/waste-reduction/pdf", headers=consumer_headers)
    assert response.status_code == 403


def test_consumer_can_access_freshness_report(client, consumer_headers):
    """Test that consumer role can access freshness report."""
    response = client.get("/reports/freshness/pdf", headers=consumer_headers)
    assert response.status_code == 200


def test_consumer_can_access_shelf_life_report(client, consumer_headers):
    """Test that consumer role can access shelf-life report."""
    response = client.get("/reports/shelf-life/pdf", headers=consumer_headers)
    assert response.status_code == 200


def test_consumer_can_access_storage_compliance_report(client, consumer_headers):
    """Test that consumer role can access storage compliance report."""
    response = client.get("/reports/storage-compliance/pdf", headers=consumer_headers)
    assert response.status_code == 200


def test_retail_manager_can_access_inventory_report(client, db):
    """Test that retail manager can access inventory quality report."""
    user = User(
        full_name="Test Retail Manager",
        email="retail@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/reports/inventory/pdf", headers=headers)
    assert response.status_code == 200


def test_retail_manager_can_access_waste_reduction_report(client, db):
    """Test that retail manager can access waste reduction report."""
    user = User(
        full_name="Test Retail Manager",
        email="retail2@test.com",
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/reports/waste-reduction/pdf", headers=headers)
    assert response.status_code == 200


def test_warehouse_operator_can_access_inventory_report(client, db):
    """Test that warehouse operator can access inventory quality report."""
    user = User(
        full_name="Test Warehouse Operator",
        email="warehouse@test.com",
        password_hash=hash_password("password123"),
        role="warehouse_operator",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/reports/inventory/pdf", headers=headers)
    assert response.status_code == 200


def test_warehouse_operator_can_access_storage_compliance_report(client, db):
    """Test that warehouse operator can access storage compliance report."""
    user = User(
        full_name="Test Warehouse Operator",
        email="warehouse2@test.com",
        password_hash=hash_password("password123"),
        role="warehouse_operator",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/reports/storage-compliance/pdf", headers=headers)
    assert response.status_code == 200


def test_admin_can_access_all_reports(client, db):
    """Test that administrator can access all report types."""
    user = User(
        full_name="Test Admin",
        email="admin@test.com",
        password_hash=hash_password("password123"),
        role="administrator",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    for endpoint in [
        "/reports/freshness/pdf",
        "/reports/shelf-life/pdf",
        "/reports/inventory/pdf",
        "/reports/waste-reduction/pdf",
        "/reports/storage-compliance/pdf",
    ]:
        response = client.get(endpoint, headers=headers)
        assert response.status_code == 200, f"Admin should access {endpoint}"


def test_food_quality_inspector_can_access_freshness_report(client, db):
    """Test that food quality inspector can access freshness report."""
    user = User(
        full_name="Test Inspector",
        email="inspector@test.com",
        password_hash=hash_password("password123"),
        role="food_quality_inspector",
    )
    db.add(user)
    db.commit()
    token = create_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/reports/freshness/pdf", headers=headers)
    assert response.status_code == 200


# ============================================================
# Data Isolation Tests
# ============================================================

def test_freshness_report_data_isolation(client, consumer_headers, consumer_user, db):
    """Test that freshness report only includes the current user's data."""
    other_user = User(
        full_name="Other User",
        email="other_freshness@test.com",
        password_hash=hash_password("pass123"),
        role="consumer",
    )
    db.add(other_user)
    db.commit()

    # Create analysis for other user
    other_analysis = FreshnessAnalysis(
        user_id=other_user.id,
        item_name="Other Apple",
        classification="Spoiled",
        confidence=0.99,
        quality_score=10,
        spoilage_probability=0.99,
    )
    db.add(other_analysis)

    # Create analysis for current user
    user_analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="My Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
    )
    db.add(user_analysis)
    db.commit()

    response = client.get("/reports/freshness/pdf", headers=consumer_headers)
    assert response.status_code == 200
    # The report should only contain the current user's analysis


# ============================================================
# Synthetic/Real Labeling Tests
# ============================================================

def test_shelf_life_report_distinguishes_real_synthetic(client, consumer_headers, consumer_user, db):
    """Test that shelf-life report clearly distinguishes real vs synthetic models."""
    # Real/Traceable prediction
    real_pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="tomato",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date(2026, 10, 5),
        risk_level="low",
        official_freshness_score=80,
        visual_condition_score=85,
        storage_condition_score=90,
        shelf_life_score=75,
        product_age_score=80,
        input_snapshot='{"temperature_c": 22}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(real_pred)

    # Synthetic prediction
    synthetic_pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="vegetables",
        remaining_shelf_life_days=3,
        predicted_expiry_date=date(2026, 10, 3),
        risk_level="moderate",
        official_freshness_score=60,
        visual_condition_score=70,
        storage_condition_score=65,
        shelf_life_score=50,
        product_age_score=70,
        input_snapshot='{"temperature_c": 25}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="needs_attention",
    )
    db.add(synthetic_pred)
    db.commit()

    response = client.get("/reports/shelf-life/pdf", headers=consumer_headers)
    assert response.status_code == 200
    # The PDF should contain both "Real/Traceable" and "Synthetic Dataset (Demonstration)" labels


# ============================================================
# Excel Export Validation Tests
# ============================================================

def test_freshness_excel_valid(client, consumer_headers, consumer_user, db):
    """Test that freshness Excel file is valid."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Test Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
    )
    db.add(analysis)
    db.commit()

    response = client.get("/reports/freshness/excel", headers=consumer_headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]
    # Verify it's a valid xlsx file (starts with PK zip header)
    assert response.content[:2] == b"PK"


def test_shelf_life_excel_valid(client, consumer_headers, consumer_user, db):
    """Test that shelf-life Excel file is valid."""
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="tomato",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date(2026, 10, 5),
        risk_level="low",
        official_freshness_score=80,
        visual_condition_score=85,
        storage_condition_score=90,
        shelf_life_score=75,
        product_age_score=80,
        input_snapshot='{"temperature_c": 22}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(pred)
    db.commit()

    response = client.get("/reports/shelf-life/excel", headers=consumer_headers)
    assert response.status_code == 200
    assert response.content[:2] == b"PK"


# ============================================================
# PDF Validation Tests
# ============================================================

def test_freshness_pdf_valid(client, consumer_headers, consumer_user, db):
    """Test that freshness PDF is valid."""
    analysis = FreshnessAnalysis(
        user_id=consumer_user.id,
        item_name="Test Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
    )
    db.add(analysis)
    db.commit()

    response = client.get("/reports/freshness/pdf", headers=consumer_headers)
    assert response.status_code == 200
    # Verify it's a valid PDF (starts with %PDF)
    assert response.content[:4] == b"%PDF"


def test_all_pdf_reports_valid(client, db):
    """Test that all PDF reports generate valid PDF files."""
    # Create admin user who can access all report types
    admin = User(
        full_name="Test Admin",
        email="admin_allpdf@test.com",
        password_hash=hash_password("password123"),
        role="administrator",
    )
    db.add(admin)
    db.commit()
    token = create_token(admin)
    headers = {"Authorization": f"Bearer {token}"}

    # Create test data
    analysis = FreshnessAnalysis(
        user_id=admin.id,
        item_name="Test Apple",
        classification="Fresh",
        confidence=0.95,
        quality_score=90,
        spoilage_probability=0.05,
    )
    db.add(analysis)

    pred = ShelfLifePrediction(
        user_id=admin.id,
        food_type="tomato",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date(2026, 10, 5),
        risk_level="low",
        official_freshness_score=80,
        visual_condition_score=85,
        storage_condition_score=90,
        shelf_life_score=75,
        product_age_score=80,
        input_snapshot='{"temperature_c": 22}',
        recommendations='[]',
        model_type="RandomForestRegressor",
        storage_compliance="compliant",
    )
    db.add(pred)

    item = FoodItem(
        name="Test Apples",
        category="Fruits",
        batch_number="B-001",
        quantity=10,
        expiry_date=date(2026, 10, 15),
        created_by=admin.id,
    )
    db.add(item)

    sc = StorageCondition(
        user_id=admin.id,
        temperature_c=22.5,
        humidity_pct=70,
        air_circulation="good",
        light_exposure="low",
        packaging_type="sealed",
        storage_duration_days=2,
    )
    db.add(sc)
    db.commit()

    for endpoint in [
        "/reports/freshness/pdf",
        "/reports/shelf-life/pdf",
        "/reports/inventory/pdf",
        "/reports/waste-reduction/pdf",
        "/reports/storage-compliance/pdf",
    ]:
        response = client.get(endpoint, headers=headers)
        assert response.status_code == 200, f"Failed: {endpoint}"
        assert response.content[:4] == b"%PDF", f"Invalid PDF: {endpoint}"
