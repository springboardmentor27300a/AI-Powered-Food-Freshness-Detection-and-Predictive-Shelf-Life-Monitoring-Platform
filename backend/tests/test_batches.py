from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.models.user import UserRole


client = TestClient(app)


def test_list_batches_requires_authentication():
    response = client.get("/api/batches")

    assert response.status_code == 401


def test_get_batch_requires_authentication():
    batch_id = uuid4()

    response = client.get(f"/api/batches/{batch_id}")

    assert response.status_code == 401


def test_get_nonexistent_batch():
    batch_id = uuid4()

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.role = UserRole.ADMINISTRATOR

    with patch(
        "app.routers.batches.batch_service.get_batch",
        return_value=None,
    ):
        from app.dependencies.auth import get_current_user

        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            response = client.get(f"/api/batches/{batch_id}")
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Batch not found"