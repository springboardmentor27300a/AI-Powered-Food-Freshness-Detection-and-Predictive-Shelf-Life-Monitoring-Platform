"""
conftest.py — Shared pytest fixtures for FreshGuard integration tests.

Provides isolated in-memory SQLite database, test client, and helper fixtures
for all test modules. Each test function gets a fresh database via the
`db` fixture (function-scoped), ensuring no shared state between tests.
"""

import os
import sys
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Set test environment before importing app
os.environ["JWT_SECRET"] = "test-secret-key-integration"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["CORS_ORIGINS"] = (
    "https://freshguard-frontend-qq1l.onrender.com,http://localhost:5173"
)

from app.database import Base, get_db
from app.main import app
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, Notification
from app.auth import hash_password, create_token


# ============================================================
# Database Engine (in-memory, shared across all tests in session)
# ============================================================

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture(autouse=True)
def setup_db():
    """Create fresh tables before each test, drop after each test."""
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def db():
    """Provide a database session for direct DB operations in tests."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """Provide a FastAPI TestClient."""
    return TestClient(app)


def _unique_email(prefix="test"):
    """Generate a unique email address for test isolation."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.com"


@pytest.fixture
def consumer_user(db):
    """Create and return a consumer user."""
    user = User(
        full_name="Test Consumer",
        email=_unique_email("consumer"),
        password_hash=hash_password("password123"),
        role="consumer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def consumer_headers(consumer_user):
    """Return auth headers for the consumer user."""
    token = create_token(consumer_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def retail_manager_user(db):
    """Create and return a retail manager user."""
    user = User(
        full_name="Test Retail Manager",
        email=_unique_email("retail"),
        password_hash=hash_password("password123"),
        role="retail_manager",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def retail_manager_headers(retail_manager_user):
    """Return auth headers for the retail manager user."""
    token = create_token(retail_manager_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def warehouse_operator_user(db):
    """Create and return a warehouse operator user."""
    user = User(
        full_name="Test Warehouse Operator",
        email=_unique_email("warehouse"),
        password_hash=hash_password("password123"),
        role="warehouse_operator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def warehouse_operator_headers(warehouse_operator_user):
    """Return auth headers for the warehouse operator user."""
    token = create_token(warehouse_operator_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(db):
    """Create and return an administrator user."""
    user = User(
        full_name="Test Admin",
        email=_unique_email("admin"),
        password_hash=hash_password("password123"),
        role="administrator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_headers(admin_user):
    """Return auth headers for the admin user."""
    token = create_token(admin_user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def inspector_user(db):
    """Create and return a food quality inspector user."""
    user = User(
        full_name="Test Inspector",
        email=_unique_email("inspector"),
        password_hash=hash_password("password123"),
        role="food_quality_inspector",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def inspector_headers(inspector_user):
    """Return auth headers for the inspector user."""
    token = create_token(inspector_user)
    return {"Authorization": f"Bearer {token}"}


# ============================================================
# Helper Fixtures
# ============================================================

@pytest.fixture
def sample_food_item(db, consumer_user):
    """Create a sample food item for the consumer user."""
    item = FoodItem(
        name="Test Apple",
        category="Fruits",
        batch_number="BATCH-001",
        quantity=10,
        expiry_date=date.today() + timedelta(days=7),
        created_by=consumer_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def sample_analysis(db, consumer_user):
    """Create a sample freshness analysis for the consumer user."""
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
    db.refresh(analysis)
    return analysis


@pytest.fixture
def sample_prediction(db, consumer_user):
    """Create a sample shelf-life prediction for the consumer user."""
    pred = ShelfLifePrediction(
        user_id=consumer_user.id,
        food_type="tomato",
        remaining_shelf_life_days=5,
        predicted_expiry_date=date.today() + timedelta(days=5),
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
    db.refresh(pred)
    return pred


@pytest.fixture
def sample_storage_condition(db, consumer_user):
    """Create a sample storage condition for the consumer user."""
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
    db.refresh(sc)
    return sc
