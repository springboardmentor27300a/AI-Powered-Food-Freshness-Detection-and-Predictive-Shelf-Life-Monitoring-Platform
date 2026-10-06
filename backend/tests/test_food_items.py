from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.models.user import UserRole


client = TestClient(app)


def test_list_food_items_requires_authentication():
    response = client.get("/api/food")

    assert response.status_code == 401


def test_get_food_item_requires_authentication():
    food_item_id = uuid4()

    response = client.get(f"/api/food/{food_item_id}")

    assert response.status_code == 401


def test_get_nonexistent_food_item():
    food_item_id = uuid4()

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.role = UserRole.ADMINISTRATOR

    with patch(
        "app.routers.food.food_service.get_food_item",
        return_value=None,
    ):
        app.dependency_overrides[
            __import__(
                "app.dependencies.auth",
                fromlist=["get_current_user"],
            ).get_current_user
        ] = lambda: mock_user

        try:
            response = client.get(f"/api/food/{food_item_id}")
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Food item not found"