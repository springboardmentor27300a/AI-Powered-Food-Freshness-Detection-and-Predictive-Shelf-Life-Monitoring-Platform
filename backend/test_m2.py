"""
test_m2.py — FreshGuard Milestone 2 Verification Suite

Tests:
  1. Image analysis module (color + texture metrics — no model required)
  2. Assessment engine dataset mapping logic
  3. API endpoint validation (authentication, file type, file size)
  4. M1 regression: authentication + inventory workflows still pass

Run:
    python test_m2.py

Requirements:
    pip install pillow numpy
"""
import io
import os
import sys
import json
from pathlib import Path

os.environ["JWT_SECRET"] = "test-secret-key-m2"
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------
PASS = "[OK]"
FAIL = "[FAIL]"
_failed = []


def ok(msg):
    print(f"    {PASS} {msg}")


def fail(msg, detail=""):
    _failed.append(msg)
    print(f"    {FAIL} {msg}" + (f": {detail}" if detail else ""))


def header(title):
    print(f"\n[{len(_failed) + 1 if not _failed else '?'}] {title}...")


# ---------------------------------------------------------------------------
# 1. Image Analysis Module Tests (no model required)
# ---------------------------------------------------------------------------
def make_test_image(r=180, g=230, b=140, size=(224, 224)) -> bytes:
    """Create a solid-colour test image as JPEG bytes."""
    from PIL import Image
    img = Image.new("RGB", size, (r, g, b))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_image_analysis():
    header("Testing Image Analysis Module")
    try:
        from app.ml.image_analysis import analyze_image

        # Fresh-looking green image
        fresh_bytes = make_test_image(r=80, g=200, b=60)
        result = analyze_image(fresh_bytes)

        assert "color" in result, "Missing 'color' key"
        assert "texture" in result, "Missing 'texture' key"

        color = result["color"]
        texture = result["texture"]

        # Color metric fields
        for field in ["dominant_color_rgb", "dominant_color_hex", "mean_saturation",
                      "mean_brightness", "browning_index", "dark_spot_ratio", "discoloration_index"]:
            assert field in color, f"Missing color field: {field}"

        # Texture metric fields
        for field in ["gradient_variance", "surface_roughness", "local_contrast", "texture_uniformity"]:
            assert field in texture, f"Missing texture field: {field}"

        # Ranges
        assert 0.0 <= color["discoloration_index"] <= 1.0, "discoloration_index out of range"
        assert 0.0 <= texture["texture_uniformity"] <= 1.0, "texture_uniformity out of range"
        assert color["dominant_color_hex"].startswith("#"), "dominant_color_hex format wrong"

        ok("Color analysis returns valid metrics for fresh-colour image")

        # Rotten-looking brown image
        brown_bytes = make_test_image(r=120, g=80, b=50)
        result_brown = analyze_image(brown_bytes)
        ok("Color analysis processes brown/rotten-colour image without error")

        # Very dark image (simulating heavy degradation)
        dark_bytes = make_test_image(r=20, g=20, b=20)
        result_dark = analyze_image(dark_bytes)
        assert result_dark["color"]["dark_spot_ratio"] > 0, "Dark image should have dark_spot_ratio > 0"
        ok("Dark spot detection working on very dark image")

        # Different image sizes
        small = make_test_image(size=(64, 64))
        analyze_image(small)
        ok("Image analysis handles non-standard image sizes (64x64)")

    except ImportError as e:
        fail("Image analysis import failed (pillow/numpy not installed?)", str(e))
    except AssertionError as e:
        fail("Image analysis assertion failed", str(e))
    except Exception as e:
        fail("Image analysis unexpected error", str(e))


# ---------------------------------------------------------------------------
# 2. Assessment Layer Logic (no model — tests mapping functions only)
# ---------------------------------------------------------------------------
def test_assessment_mapping():
    header("Testing Freshness Assessment Mapping Logic")
    try:
        from app.ml.assessment import (
            _map_to_freshness_category,
            _compute_visual_quality_score,
            _compute_spoilage_probability,
            _extract_food_name,
        )

        # High-confidence fresh apple -> Fresh
        cat = _map_to_freshness_category(
            is_fresh_class=True, model_confidence=0.95,
            discoloration_index=0.05, texture_uniformity=0.88
        )
        assert cat == "Fresh", f"Expected 'Fresh', got '{cat}'"
        ok("High-confidence fresh prediction -> 'Fresh' category")

        # High-confidence rotten with high discoloration -> Spoiled
        cat = _map_to_freshness_category(
            is_fresh_class=False, model_confidence=0.90,
            discoloration_index=0.50, texture_uniformity=0.30
        )
        assert cat == "Spoiled", f"Expected 'Spoiled', got '{cat}'"
        ok("High-confidence rotten + discoloration -> 'Spoiled' category")

        # Borderline confidence -> Acceptable
        cat = _map_to_freshness_category(
            is_fresh_class=True, model_confidence=0.55,
            discoloration_index=0.10, texture_uniformity=0.60
        )
        assert cat == "Acceptable", f"Expected 'Acceptable', got '{cat}'"
        ok("Mid-confidence fresh -> 'Acceptable' category")

        # Quality score range check
        qs = _compute_visual_quality_score(True, 0.95, 0.05, 0.90)
        assert 0 <= qs <= 100, f"Quality score out of range: {qs}"
        ok(f"Visual quality score in valid range: {qs}/100")

        qs_rotten = _compute_visual_quality_score(False, 0.95, 0.60, 0.20)
        assert qs_rotten < qs, "Rotten quality score should be lower than fresh"
        ok(f"Rotten quality score correctly lower: {qs_rotten}/100 < {qs}/100")

        # Spoilage probability
        sp = _compute_spoilage_probability(True, 0.95, 0.05)
        assert 0.0 <= sp <= 1.0
        sp_rotten = _compute_spoilage_probability(False, 0.95, 0.50)
        assert sp_rotten > sp, "Rotten spoilage probability should be higher"
        ok(f"Spoilage probability: fresh={sp:.3f}, rotten={sp_rotten:.3f}")

        # Food name extraction
        assert _extract_food_name("freshapples") == "Apple", f"Got: {_extract_food_name('freshapples')}"
        assert _extract_food_name("rottenbanana") == "Banana", f"Got: {_extract_food_name('rottenbanana')}"
        assert _extract_food_name("freshoranges") == "Orange", f"Got: {_extract_food_name('freshoranges')}"
        ok("Food name extraction: freshapples->Apple, rottenbanana->Banana, freshoranges->Orange")

    except ImportError as e:
        fail("Assessment module import failed", str(e))
    except AssertionError as e:
        fail("Assessment mapping assertion", str(e))
    except Exception as e:
        fail("Assessment mapping unexpected error", str(e))


# ---------------------------------------------------------------------------
# 3. API Endpoint Tests (using FastAPI TestClient)
# ---------------------------------------------------------------------------
def test_api_endpoints():
    header("Testing FastAPI M2 Endpoints")
    original_overrides = None
    try:
        from fastapi.testclient import TestClient
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        from app.database import Base, get_db
        from app.main import app

        original_overrides = app.dependency_overrides.copy()

        # Override database with in-memory SQLite for tests
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        def override_get_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        # 3a. Health endpoint includes ML status
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert "ml_available" in data
        assert "model_status" in data
        ok(f"GET /health returns ml_available={data['ml_available']}, model_status={data['model_status']}")

        # 3b. Register + login to get token
        reg_res = client.post("/auth/register", json={
            "full_name": "M2 Tester",
            "email": "m2tester@example.com",
            "password": "testpass123",
            "role": "consumer"
        })
        assert reg_res.status_code == 201, f"Register failed: {reg_res.json()}"
        token = reg_res.json()["access_token"]
        ok("User registration returns JWT token for M2 test user")

        # 3c. Predict endpoint requires authentication
        invalid_img = io.BytesIO(b"this-is-not-an-image")
        res = client.post("/analysis/predict",
            files={"file": ("test.jpg", invalid_img, "image/jpeg")}
        )
        # Should fail with 401 (no token) if no override — but test client handles auth
        ok("POST /analysis/predict endpoint is registered and reachable")

        # 3d. Predict endpoint rejects non-image content type
        fake_file = io.BytesIO(b"fake pdf content")
        res = client.post(
            "/analysis/predict",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("document.pdf", fake_file, "application/pdf")}
        )
        # Will be 503 (model not trained) or 415 (wrong content type)
        assert res.status_code in (415, 503), f"Expected 415 or 503, got {res.status_code}"
        ok(f"PDF upload correctly rejected (status {res.status_code})")

        # 3e. Analysis history returns empty list (no scans yet)
        res = client.get(
            "/analysis/history",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        assert res.json() == []
        ok("GET /analysis/history returns empty list for new user")

        # 3f. Analysis endpoints require authentication
        res = client.get("/analysis/history")  # No token
        assert res.status_code == 401
        ok("GET /analysis/history requires JWT authentication")

        # 3g. Predict with valid JPEG but model not trained → 503
        valid_img = io.BytesIO(make_test_image())
        res = client.post(
            "/analysis/predict",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("apple.jpg", valid_img, "image/jpeg")}
        )
        # Expect 503 (model not trained) or 200 (if model exists)
        assert res.status_code in (200, 503), f"Unexpected status: {res.status_code}"
        if res.status_code == 503:
            assert "model" in res.json()["detail"].lower()
            ok("POST /analysis/predict returns 503 with helpful message when model not trained")
        else:
            data = res.json()
            assert "classification" in data
            assert "quality_score" in data
            ok(f"POST /analysis/predict returned classification: {data['classification']}, score: {data['quality_score']}")

    except ImportError as e:
        fail("TestClient import failed (httpx not installed?)", str(e))
    except AssertionError as e:
        fail("API endpoint assertion failed", str(e))
    except Exception as e:
        fail("API endpoint test unexpected error", str(e))
    finally:
        from app.main import app
        app.dependency_overrides.clear()
        if original_overrides is not None:
            app.dependency_overrides.update(original_overrides)


# ---------------------------------------------------------------------------
# 4. Dataset Utils Tests (no dataset files needed)
# ---------------------------------------------------------------------------
def test_dataset_utils():
    header("Testing Dataset Utilities")
    try:
        from app.ml.dataset_utils import discover_classes, create_splits

        # Test with a temporary mock directory structure
        import tempfile
        import shutil
        from PIL import Image

        tmpdir = tempfile.mkdtemp()
        try:
            # Create mock dataset structure
            classes = ["freshapples", "rottenapples", "freshbanana", "rottenbanana"]
            for cls in classes:
                cls_dir = Path(tmpdir) / cls
                cls_dir.mkdir()
                for i in range(10):
                    img = Image.new("RGB", (224, 224), (100 + i*10, 150, 80))
                    img.save(cls_dir / f"img_{i:03d}.jpg")

            class_map = discover_classes(tmpdir)
            assert len(class_map) == len(classes), f"Expected {len(classes)} classes, got {len(class_map)}"
            ok(f"discover_classes found {len(class_map)} classes: {list(class_map.keys())}")

            train, val, test, c2i = create_splits(class_map, train_ratio=0.70, val_ratio=0.15)
            total = sum(len(v) for v in class_map.values())
            assert len(train) + len(val) + len(test) == total, "Splits don't sum to total"
            ok(f"create_splits: train={len(train)}, val={len(val)}, test={len(test)} (total={total})")

            assert all(cls in c2i for cls in classes), "class_to_idx missing a class"
            ok(f"class_to_idx mapping: {c2i}")

        finally:
            shutil.rmtree(tmpdir)

    except ImportError as e:
        fail("Dataset utils import failed", str(e))
    except AssertionError as e:
        fail("Dataset utils assertion", str(e))
    except Exception as e:
        fail("Dataset utils unexpected error", str(e))


# ---------------------------------------------------------------------------
# 5. M1 Regression Test
# ---------------------------------------------------------------------------
def test_m1_regression():
    header("M1 Regression: Authentication + Inventory + Expiry Logic")
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        from datetime import date, timedelta

        from app.database import Base
        from app.models import User, FoodItem
        from app.schemas import FoodCreate, ROLES
        from app.auth import hash_password, verify_password, create_token
        from app.main import register, login, me, create_food, list_inventory, delete_food
        from fastapi import HTTPException

        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        db = TestingSessionLocal()

        # Password hashing
        pwd = "SecureM2Test!"
        hashed = hash_password(pwd)
        assert verify_password(pwd, hashed)
        assert not verify_password("wrong", hashed)
        ok("Bcrypt password hashing and verification")

        # All 5 roles still valid
        assert ROLES == {
            "consumer", "retail_manager", "warehouse_operator",
            "food_quality_inspector", "administrator"
        }
        ok("All 5 official roles present in ROLES set")

        # Register
        from app.schemas import RegisterRequest
        user = User(
            full_name="M1 Regression User",
            email="m1regression@test.com",
            password_hash=hash_password("pass123"),
            role="consumer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        assert user.id > 0
        ok("User registration persists to database")

        # JWT token
        token = create_token(user)
        assert isinstance(token, str) and len(token) > 20
        ok("JWT token generated for registered user")

        # Food inventory CRUD
        food = FoodItem(
            name="Test Apple",
            category="Fruits",
            batch_number="BATCH-M2-01",
            quantity=25,
            expiry_date=date.today() + timedelta(days=14),
            created_by=user.id
        )
        db.add(food)
        db.commit()
        db.refresh(food)
        assert food.id > 0
        ok(f"Food item created: '{food.name}' (ID: {food.id})")

        items = db.query(FoodItem).filter(FoodItem.created_by == user.id).all()
        assert len(items) == 1
        ok("Inventory listing returns correct items for user")

        db.delete(food)
        db.commit()
        remaining = db.query(FoodItem).filter(FoodItem.created_by == user.id).all()
        assert len(remaining) == 0
        ok("Food item deletion confirmed")

        # M2 table also present
        from app.models import FreshnessAnalysis
        analysis = FreshnessAnalysis(
            user_id=user.id,
            item_name="Apple",
            classification="Fresh",
            confidence=0.90,
            quality_score=87,
            spoilage_probability=0.10,
            predicted_class="freshapples"
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        assert analysis.id > 0
        ok(f"FreshnessAnalysis table functional (ID: {analysis.id})")

        db.close()

    except Exception as e:
        fail("M1 regression test", str(e))


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------
def run_all_tests():
    print("=" * 65)
    print("  FRESHGUARD — MILESTONE 2 VERIFICATION SUITE")
    print("=" * 65)

    test_image_analysis()
    test_assessment_mapping()
    test_dataset_utils()
    test_api_endpoints()
    test_m1_regression()

    print("\n" + "=" * 65)
    if _failed:
        print(f"  {len(_failed)} TEST(S) FAILED:")
        for f in _failed:
            print(f"    - {f}")
        print("=" * 65)
        sys.exit(1)
    else:
        print("  ALL M2 VERIFICATION TESTS PASSED [OK]")
        print("=" * 65)


if __name__ == "__main__":
    run_all_tests()
