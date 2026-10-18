"""
test_report.py — FreshGuard Freshness Report API Verification Suite

Tests:
  1. PDF Report Generation & Formatting (ReportLab generator unit test)
  2. GET /analysis/{analysis_id}/report — Successful PDF download for owner (HTTP 200)
  3. GET /analysis/{analysis_id}/report — Unauthenticated access rejected (HTTP 401)
  4. GET /analysis/{analysis_id}/report — Unauthorized cross-user access rejected (HTTP 403)
  5. GET /analysis/{analysis_id}/report — Role-based override allowed for inspector/admin (HTTP 200)
  6. GET /analysis/{analysis_id}/report — Missing analysis ID (HTTP 404)
  7. GET /analysis/{analysis_id}/report — Invalid analysis ID <= 0 (HTTP 422)

Run:
    python test_report.py
"""

import json
import os
import sys

os.environ["JWT_SECRET"] = "test-secret-key-reports"
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import create_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models import FreshnessAnalysis, User
from app.reports import generate_freshness_pdf_report

PASS = "[OK]"
FAIL = "[FAIL]"
_failed = []


def ok(msg: str):
    print(f"    {PASS} {msg}")


def fail(msg: str, detail: str = ""):
    _failed.append(msg)
    print(f"    {FAIL} {msg}" + (f": {detail}" if detail else ""))


def header(title: str):
    print(f"\n[{len(_failed) + 1 if not _failed else '?'}] {title}...")


def setup_test_db():
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
    return TestingSessionLocal, TestClient(app)


def test_pdf_report_generator_unit():
    header("Testing PDF Report Generator Module (ReportLab)")
    try:
        user = User(
            id=1,
            full_name="Quality Inspector Jane",
            email="jane@freshguard.org",
            role="food_quality_inspector",
        )
        analysis = FreshnessAnalysis(
            id=42,
            user_id=1,
            item_name="Fresh Apple",
            classification="Fresh",
            confidence=0.96,
            quality_score=92,
            spoilage_probability=0.04,
            predicted_class="freshapples",
            color_metrics=json.dumps({
                "dominant_color_hex": "#43a047",
                "mean_saturation": 0.65,
                "mean_brightness": 180.0,
                "browning_index": 0.05,
                "dark_spot_ratio": 0.01,
                "discoloration_index": 0.04,
            }),
            texture_metrics=json.dumps({
                "surface_roughness": 12.4,
                "local_contrast": 8.2,
                "texture_uniformity": 0.88,
            }),
        )

        pdf_bytes = generate_freshness_pdf_report(analysis, user)
        assert isinstance(pdf_bytes, bytes), "Expected bytes output"
        assert len(pdf_bytes) > 500, f"PDF content too small: {len(pdf_bytes)} bytes"
        assert pdf_bytes.startswith(b"%PDF-"), "PDF header magic bytes missing"

        ok(f"ReportLab successfully generated PDF report ({len(pdf_bytes)} bytes, starts with %PDF-)")
    except Exception as e:
        fail("PDF report generator unit test failed", str(e))
        raise


def test_report_endpoint_integration():
    header("Testing GET /analysis/{analysis_id}/report Endpoint & Security Matrix")
    original_overrides = app.dependency_overrides.copy()
    TestingSessionLocal, client = setup_test_db()
    db = TestingSessionLocal()

    try:
        # Create User A (Consumer) and User B (Consumer) and User C (Inspector)
        user_a = User(full_name="User A", email="usera@test.com", password_hash=hash_password("pass123"), role="consumer")
        user_b = User(full_name="User B", email="userb@test.com", password_hash=hash_password("pass123"), role="consumer")
        user_c = User(full_name="Inspector C", email="inspectorc@test.com", password_hash=hash_password("pass123"), role="food_quality_inspector")
        db.add_all([user_a, user_b, user_c])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        db.refresh(user_c)

        token_a = create_token(user_a)
        token_b = create_token(user_b)
        token_c = create_token(user_c)

        # Create analysis record belonging to User A
        analysis_a = FreshnessAnalysis(
            user_id=user_a.id,
            item_name="Banana",
            classification="Good",
            confidence=0.88,
            quality_score=85,
            spoilage_probability=0.12,
            predicted_class="freshbanana",
            color_metrics=json.dumps({"dominant_color_hex": "#fbc02d", "browning_index": 0.1, "discoloration_index": 0.08}),
            texture_metrics=json.dumps({"texture_uniformity": 0.80, "surface_roughness": 15.0}),
        )
        db.add(analysis_a)
        db.commit()
        db.refresh(analysis_a)
        analysis_id = analysis_a.id

        # 1. Successful download by owner (User A)
        res_a = client.get(
            f"/analysis/{analysis_id}/report",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_a.status_code == 200, f"Expected 200, got {res_a.status_code}"
        assert res_a.headers["content-type"] == "application/pdf"
        assert f"FreshGuard_Report_{analysis_id}.pdf" in res_a.headers["content-disposition"]
        assert res_a.content.startswith(b"%PDF-")
        ok(f"User A successfully downloaded own report (ID {analysis_id}) with correct headers & PDF bytes")

        # 2. Unauthenticated request rejected (HTTP 401)
        res_unauth = client.get(f"/analysis/{analysis_id}/report")
        assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"
        ok("Unauthenticated request correctly rejected with HTTP 401")

        # 3. Unauthorized cross-user access rejected (User B trying to access User A's report -> HTTP 403)
        res_b = client.get(
            f"/analysis/{analysis_id}/report",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res_b.status_code == 403, f"Expected 403, got {res_b.status_code}"
        assert "not authorized" in res_b.json()["detail"].lower()
        ok("User B access to User A's report correctly forbidden with HTTP 403")

        # 4. Role-based override allowed (Food Quality Inspector C accessing User A's report -> HTTP 200)
        res_c = client.get(
            f"/analysis/{analysis_id}/report",
            headers={"Authorization": f"Bearer {token_c}"}
        )
        assert res_c.status_code == 200, f"Expected 200 for inspector, got {res_c.status_code}"
        assert res_c.content.startswith(b"%PDF-")
        ok("Food Quality Inspector (User C) successfully downloaded User A's report via role authorization")

        # 5. Non-existent analysis ID -> HTTP 404
        res_404 = client.get(
            "/analysis/99999/report",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_404.status_code == 404, f"Expected 404, got {res_404.status_code}"
        ok("Non-existent analysis ID correctly returned HTTP 404 Not Found")

        # 6. Invalid analysis ID <= 0 -> HTTP 422
        res_422 = client.get(
            "/analysis/0/report",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_422.status_code == 422, f"Expected 422, got {res_422.status_code}"
        ok("Invalid analysis ID (0) correctly returned HTTP 422 Unprocessable Entity")

    except AssertionError as e:
        fail("Report API endpoint assertion failed", str(e))
        raise
    except Exception as e:
        fail("Report API endpoint test error", str(e))
        raise
    finally:
        db.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)


def run_all_tests():
    print("=" * 65)
    print("  FRESHGUARD — FRESHNESS REPORT VERIFICATION SUITE")
    print("=" * 65)

    test_pdf_report_generator_unit()
    test_report_endpoint_integration()

    print("\n" + "=" * 65)
    if _failed:
        print(f"  {len(_failed)} TEST(S) FAILED:")
        for f in _failed:
            print(f"    - {f}")
        print("=" * 65)
        sys.exit(1)
    else:
        print("  ALL FRESHNESS REPORT TESTS PASSED WITH 100% SUCCESS! [OK]")
        print("=" * 65)


if __name__ == "__main__":
    run_all_tests()
