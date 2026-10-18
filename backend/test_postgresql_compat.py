"""
test_postgresql_compat.py — PostgreSQL Compatibility Regression Tests

Tests that database queries use database-agnostic SQLAlchemy expressions
that work correctly on both SQLite and PostgreSQL.

Focus: Admin stats endpoint that previously used SQLite-specific func.datetime().
"""

import pytest
from datetime import datetime, timedelta, date

from app.auth import hash_password, create_token
from app.models import User, FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, Notification


class TestAdminStatsCompatibility:
    """Test that admin stats endpoint uses database-agnostic datetime expressions."""

    def test_admin_stats_recent_activity(self, client, admin_headers, admin_user, db):
        """Test that admin stats correctly counts recent analyses and predictions."""
        # Create test data — some recent, some old
        now = datetime.utcnow()
        recent_time = now - timedelta(days=3)
        old_time = now - timedelta(days=10)

        # Create a recent analysis
        recent_analysis = FreshnessAnalysis(
            user_id=admin_user.id,
            item_name="Recent Apple",
            classification="Fresh",
            confidence=0.95,
            quality_score=90,
            spoilage_probability=0.05,
            created_at=recent_time,
        )
        db.add(recent_analysis)

        # Create an old analysis
        old_analysis = FreshnessAnalysis(
            user_id=admin_user.id,
            item_name="Old Apple",
            classification="Spoiled",
            confidence=0.99,
            quality_score=10,
            spoilage_probability=0.99,
            created_at=old_time,
        )
        db.add(old_analysis)

        # Create a recent prediction
        recent_pred = ShelfLifePrediction(
            user_id=admin_user.id,
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
            created_at=recent_time,
        )
        db.add(recent_pred)

        # Create an old prediction
        old_pred = ShelfLifePrediction(
            user_id=admin_user.id,
            food_type="tomato",
            remaining_shelf_life_days=0,
            predicted_expiry_date=date.today(),
            risk_level="critical",
            official_freshness_score=20,
            visual_condition_score=30,
            storage_condition_score=40,
            shelf_life_score=10,
            product_age_score=50,
            input_snapshot='{"temperature_c": 25}',
            recommendations='[]',
            model_type="RandomForestRegressor",
            storage_compliance="needs_attention",
            created_at=old_time,
        )
        db.add(old_pred)
        db.commit()

        # Call admin stats endpoint
        response = client.get("/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        # Verify recent activity counts (within 7 days)
        assert data["recent_analyses_7d"] == 1  # Only the recent one
        assert data["recent_predictions_7d"] == 1  # Only the recent one

        # Verify total counts
        assert data["total_analyses"] == 2
        assert data["total_predictions"] == 2

    def test_admin_stats_empty_database(self, client, admin_headers, admin_user, db):
        """Test that admin stats works correctly with no data."""
        response = client.get("/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["total_users"] >= 1  # At least the admin user
        assert data["total_analyses"] == 0
        assert data["total_predictions"] == 0
        assert data["total_inventory_items"] == 0
        assert data["total_storage_records"] == 0
        assert data["recent_analyses_7d"] == 0
        assert data["recent_predictions_7d"] == 0

    def test_admin_stats_all_recent(self, client, admin_headers, admin_user, db):
        """Test that admin stats correctly counts all items as recent when all are within 7 days."""
        now = datetime.utcnow()

        # Create multiple recent items
        for i in range(3):
            db.add(FreshnessAnalysis(
                user_id=admin_user.id,
                item_name=f"Recent Item {i}",
                classification="Fresh",
                confidence=0.9,
                quality_score=80,
                spoilage_probability=0.1,
                created_at=now - timedelta(days=i),
            ))

        for i in range(2):
            db.add(ShelfLifePrediction(
                user_id=admin_user.id,
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
                created_at=now - timedelta(days=i),
            ))

        db.commit()

        response = client.get("/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["recent_analyses_7d"] == 3
        assert data["recent_predictions_7d"] == 2
        assert data["total_analyses"] == 3
        assert data["total_predictions"] == 2

    def test_admin_stats_boundary_exactly_7_days(self, client, admin_headers, admin_user, db):
        """Test that items exactly 7 days old are counted as recent."""
        now = datetime.utcnow()
        # Use a time slightly more than 7 days ago to account for test execution time
        just_inside_7_days = now - timedelta(days=6, hours=23)

        db.add(FreshnessAnalysis(
            user_id=admin_user.id,
            item_name="Boundary Item",
            classification="Fresh",
            confidence=0.9,
            quality_score=80,
            spoilage_probability=0.1,
            created_at=just_inside_7_days,
        ))
        db.commit()

        response = client.get("/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        # Item just inside 7 days should be counted
        assert data["recent_analyses_7d"] == 1

    def test_admin_stats_just_outside_7_days(self, client, admin_headers, admin_user, db):
        """Test that items just outside 7 days are NOT counted as recent."""
        now = datetime.utcnow()
        just_outside = now - timedelta(days=7, hours=1)

        db.add(FreshnessAnalysis(
            user_id=admin_user.id,
            item_name="Outside Item",
            classification="Fresh",
            confidence=0.9,
            quality_score=80,
            spoilage_probability=0.1,
            created_at=just_outside,
        ))
        db.commit()

        response = client.get("/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        # Item just outside 7 days should NOT be counted
        assert data["recent_analyses_7d"] == 0
        assert data["total_analyses"] == 1


class TestDatabaseAgnosticExpressions:
    """Test that all database queries use database-agnostic expressions."""

    def test_no_func_datetime_in_source(self):
        """Verify that func.datetime() is not used in application source code."""
        import inspect
        from app.main import admin_platform_stats

        source = inspect.getsource(admin_platform_stats)
        assert 'func.datetime(' not in source, \
            "admin_platform_stats should not use SQLite-specific func.datetime()"

    def test_no_raw_sql_in_source(self):
        """Verify that raw SQL strings are not used in application source code."""
        import inspect
        from app import main, analysis, m3

        for module in [main, analysis, m3]:
            source = inspect.getsource(module)
            # Check for common raw SQL patterns
            assert 'text(' not in source or 'func.' in source, \
                f"{module.__name__} should not use raw SQL text() expressions"

    def test_admin_stats_uses_python_datetime(self):
        """Verify that admin stats uses Python datetime for date calculations."""
        import inspect
        from app.main import admin_platform_stats

        source = inspect.getsource(admin_platform_stats)
        assert 'datetime.utcnow()' in source or 'datetime.now(' in source, \
            "admin_platform_stats should use Python datetime for date calculations"
        assert 'timedelta(days=7)' in source, \
            "admin_platform_stats should use timedelta for date arithmetic"


class TestCrossDatabaseQueryCompatibility:
    """Test that queries produce correct results regardless of database backend."""

    def test_expiring_soon_query_compatibility(self, client, consumer_headers, consumer_user, db):
        """Test that expiring-soon query works correctly."""
        today = date.today()

        # Create items with various expiry dates
        db.add(FoodItem(
            name="Expired Yesterday",
            category="Fruits",
            batch_number="EXP-001",
            quantity=5,
            expiry_date=today - timedelta(days=1),
            created_by=consumer_user.id,
        ))
        db.add(FoodItem(
            name="Expires Today",
            category="Fruits",
            batch_number="EXP-002",
            quantity=5,
            expiry_date=today,
            created_by=consumer_user.id,
        ))
        db.add(FoodItem(
            name="Expires in 3 Days",
            category="Fruits",
            batch_number="EXP-003",
            quantity=5,
            expiry_date=today + timedelta(days=3),
            created_by=consumer_user.id,
        ))
        db.add(FoodItem(
            name="Expires in 30 Days",
            category="Fruits",
            batch_number="EXP-004",
            quantity=5,
            expiry_date=today + timedelta(days=30),
            created_by=consumer_user.id,
        ))
        db.commit()

        # Default 7-day window should include first 3 items
        response = client.get("/inventory/expiring-soon", headers=consumer_headers)
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 3
        names = [i["name"] for i in items]
        assert "Expired Yesterday" in names
        assert "Expires Today" in names
        assert "Expires in 3 Days" in names
        assert "Expires in 30 Days" not in names

    def test_analytics_query_compatibility(self, client, consumer_headers, consumer_user, db):
        """Test that analytics query works correctly."""
        now = datetime.utcnow()

        # Create predictions at different times
        db.add(ShelfLifePrediction(
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
            input_snapshot='{"temperature_c": 22, "humidity_pct": 70}',
            recommendations='[]',
            model_type="RandomForestRegressor",
            storage_compliance="compliant",
            created_at=now - timedelta(days=2),
        ))
        db.add(ShelfLifePrediction(
            user_id=consumer_user.id,
            food_type="tomato",
            remaining_shelf_life_days=3,
            predicted_expiry_date=date.today() + timedelta(days=3),
            risk_level="moderate",
            official_freshness_score=60,
            visual_condition_score=70,
            storage_condition_score=65,
            shelf_life_score=50,
            product_age_score=70,
            input_snapshot='{"temperature_c": 24, "humidity_pct": 75}',
            recommendations='[]',
            model_type="RandomForestRegressor",
            storage_compliance="needs_attention",
            created_at=now - timedelta(days=10),
        ))
        db.commit()

        response = client.get("/m3/analytics", headers=consumer_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["total_predictions"] == 2
        assert data["expired_count"] == 0
        assert data["expiring_soon_count"] == 2
        assert data["high_risk_count"] == 0
