"""
Shared inventory between Retail Manager and Warehouse Operator.
Run from the backend folder:  python -m pytest tests -v
"""
import io
import uuid
from datetime import timedelta, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.database import Base, engine
from app.main import app

client = TestClient(app)
TODAY = datetime.now(timezone.utc).date()


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def make_user(role):
    email, pw = f"{uuid.uuid4().hex[:8]}@example.com", "Passw0rdTest1"
    r = client.post("/api/auth/register", json={
        "full_name": "Test User", "email": email, "phone": "+911234567890",
        "password": pw, "confirm_password": pw, "role": role})
    assert r.status_code == 201, r.text
    t = client.post("/api/auth/login", json={"email": email, "password": pw}).json()
    return {"Authorization": f"Bearer {t['access_token']}"}


def add_item(h, name="Apple"):
    r = client.post("/api/inventory", headers=h, json={
        "food_name": name, "category": "fruits", "batch_number": "apl-002", "quantity": 5,
        "purchase_date": str(TODAY - timedelta(days=2)),
        "expiry_date": str(TODAY + timedelta(days=20)), "storage_location": "fridge"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 40, 40)).save(b, "JPEG")
    return b.getvalue()


def test_warehouse_sees_retail_inventory_without_duplicates():
    ret, wh = make_user("retail_manager"), make_user("warehouse_operator")
    add_item(ret, "Apple"); add_item(ret, "Milk")
    names = sorted(i["food_name"] for i in client.get("/api/inventory", headers=wh).json())
    assert names == ["Apple", "Milk"]
    assert len(client.get("/api/inventory", headers=ret).json()) == 2


def test_consumer_stays_isolated():
    ret, con = make_user("retail_manager"), make_user("consumer")
    iid = add_item(ret)
    assert client.get("/api/inventory", headers=con).json() == []
    for path in ("", "/analysis", "/freshness", "/storage-conditions"):
        assert client.get(f"/api/inventory/{iid}{path}", headers=con).status_code == 404
    r = client.post(f"/api/inventory/{iid}/freshness", headers=con,
                    files={"file": ("a.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 404


def test_warehouse_cannot_edit_or_delete_retail_items():
    ret, wh = make_user("retail_manager"), make_user("warehouse_operator")
    iid = add_item(ret)
    assert client.patch(f"/api/inventory/{iid}", headers=wh, json={"quantity": 1}).status_code == 404
    assert client.delete(f"/api/inventory/{iid}", headers=wh).status_code == 404
    assert len(client.get("/api/inventory", headers=ret).json()) == 1


def test_warehouse_can_analyze_record_storage_and_retail_sees_it():
    ret, wh = make_user("retail_manager"), make_user("warehouse_operator")
    iid = add_item(ret)
    assert client.get(f"/api/inventory/{iid}/analysis", headers=wh).status_code == 200
    assert client.post(f"/api/inventory/{iid}/storage-conditions", headers=wh,
                       json={"temperature_celsius": 4, "humidity_percent": 85}).status_code == 201
    r = client.post(f"/api/inventory/{iid}/freshness", headers=wh,
                    files={"file": ("a.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    assert client.get(f"/api/inventory/{iid}/freshness", headers=ret).json()["total_assessments"] == 1
    assert len(client.get(f"/api/inventory/{iid}/storage-conditions", headers=ret).json()) == 1
    assert client.get("/api/alerts", headers=wh).status_code == 200
    # only the author may delete the report
    aid = r.json()["id"]
    assert client.delete(f"/api/freshness/{aid}", headers=ret).status_code == 404
    assert client.delete(f"/api/freshness/{aid}", headers=wh).status_code == 204


def test_unauthenticated_rejected():
    assert client.get("/api/inventory").status_code in (401, 403)
