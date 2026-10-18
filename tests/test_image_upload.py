import pytest
import io
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_consumer_headers():
    res = client.post("/api/auth/login", json={
        "email": "consumer@foodfresh.com",
        "password": "ConsumerPass123!"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_image_upload_valid():
    headers = get_consumer_headers()
    # Create small valid JPEG in memory
    from PIL import Image
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = {"file": ("test_apple.jpg", buf, "image/jpeg")}
    res = client.post("/api/inventory/upload-image", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "image_url" in data
    assert data["image_url"].startswith("/uploads/")


def test_image_upload_unsupported_format():
    headers = get_consumer_headers()
    fake_txt = io.BytesIO(b"Hello world, not an image")
    files = {"file": ("test.txt", fake_txt, "text/plain")}
    res = client.post("/api/inventory/upload-image", files=files, headers=headers)
    assert res.status_code == 400
    assert "invalid image format" in res.json()["detail"].lower()
