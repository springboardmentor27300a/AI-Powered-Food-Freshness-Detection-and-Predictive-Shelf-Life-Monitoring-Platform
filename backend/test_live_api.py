def test_api_and_inventory_workflow(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    register_payload = {
        "full_name": "Integration Test Inspector",
        "email": "integration-inspector@example.com",
        "password": "SecurePassword2026!",
        "role": "food_quality_inspector",
    }
    registered = client.post("/auth/register", json=register_payload)
    assert registered.status_code == 201, registered.text

    login = client.post(
        "/auth/login",
        json={"email": register_payload["email"], "password": register_payload["password"]},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    current_user = client.get("/auth/me", headers=headers)
    assert current_user.status_code == 200
    assert current_user.json()["role"] == "food_quality_inspector"

    inventory = [
        {
            "name": "Organic Strawberries",
            "category": "Fruits",
            "batch_number": "BATCH-FR-881",
            "quantity": 24,
            "expiry_date": "2026-09-15",
        },
        {
            "name": "Pasteurized Whole Milk",
            "category": "Dairy Products",
            "batch_number": "BATCH-DY-009",
            "quantity": 0,
            "expiry_date": "2026-08-15",
        },
    ]
    for item in inventory:
        created = client.post("/inventory", json=item, headers=headers)
        assert created.status_code == 201, created.text

    listed = client.get("/inventory", headers=headers)
    assert listed.status_code == 200
    assert {item["name"] for item in listed.json()} == {
        "Organic Strawberries",
        "Pasteurized Whole Milk",
    }
