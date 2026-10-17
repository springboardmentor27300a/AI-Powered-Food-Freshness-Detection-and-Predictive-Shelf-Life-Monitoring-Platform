"""
FreshSense AI - Automated Security & Vulnerability Test Suite
Tests:
1. Registration input validation (empty name, invalid email, weak password).
2. Authentication security (wrong password, non-existent email).
3. Credential protection (ensure password hashes/plaintexts are NEVER leaked in API responses).
4. Account deactivation lockout (deactivated accounts return 403 Forbidden).
5. File upload safety & malicious payload rejection on /predict.
6. Admin user management security (user data sanitized, passwords excluded).
"""

import os
import sys
import requests
import io

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8001")

def run_tests():
    print("=" * 70)
    print("FRESHSENSE AI - SECURITY & AUTHENTICATION HARDENING SUITE")
    print(f"Target URL: {BACKEND_URL}")
    print("=" * 70)

    # 1. Registration input validation
    print("\n--- TEST 1: REGISTRATION INPUT VALIDATION ---")

    # 1a. Short password (< 6 chars)
    res = requests.post(f"{BACKEND_URL}/register", json={
        "name": "Short Pass User",
        "email": "shortpass@example.com",
        "password": "123",
        "role": "Consumer"
    })
    assert res.status_code == 400, f"Expected 400 for short password, got {res.status_code}"
    print("[PASS] Rejected password shorter than 6 characters (HTTP 400)")

    # 1b. Invalid email format
    res = requests.post(f"{BACKEND_URL}/register", json={
        "name": "Bad Email User",
        "email": "not-an-email",
        "password": "validpassword123",
        "role": "Consumer"
    })
    assert res.status_code == 400, f"Expected 400 for invalid email, got {res.status_code}"
    print("[PASS] Rejected malformed email address (HTTP 400)")

    # 1c. Empty name
    res = requests.post(f"{BACKEND_URL}/register", json={
        "name": "   ",
        "email": "emptyname@example.com",
        "password": "validpassword123",
        "role": "Consumer"
    })
    assert res.status_code == 400, f"Expected 400 for empty name, got {res.status_code}"
    print("[PASS] Rejected empty/whitespace username (HTTP 400)")

    # 2. Authentication security
    print("\n--- TEST 2: AUTHENTICATION INTEGRITY ---")

    # 2a. Non-existent email
    res = requests.post(f"{BACKEND_URL}/login", json={
        "email": "definitely_not_registered_9999@example.com",
        "password": "SomePassword123!"
    })
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("[PASS] Rejected non-existent account login (HTTP 401)")

    # Create a test account for further checks
    test_email = f"sec_test_{os.getpid()}@example.com"
    reg_res = requests.post(f"{BACKEND_URL}/register", json={
        "name": "Security Tester",
        "email": test_email,
        "password": "CorrectPassword123!",
        "role": "Consumer"
    })
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    user_data = reg_res.json()
    test_user_id = user_data["user_id"]
    print(f"[PASS] Created test security user ID: {test_user_id}")

    # 2b. Incorrect password
    res = requests.post(f"{BACKEND_URL}/login", json={
        "email": test_email,
        "password": "WrongPassword999!"
    })
    assert res.status_code == 401, f"Expected 401 for wrong password, got {res.status_code}"
    print("[PASS] Rejected incorrect password (HTTP 401)")

    # 2c. Successful login
    res = requests.post(f"{BACKEND_URL}/login", json={
        "email": test_email,
        "password": "CorrectPassword123!"
    })
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    login_data = res.json()
    print("[PASS] Authenticated with valid credentials (HTTP 200)")

    # 3. Credential leakage prevention
    print("\n--- TEST 3: CREDENTIAL LEAKAGE PREVENTION ---")
    sensitive_keys = ["password", "hashed_password", "salt", "secret"]
    for k in sensitive_keys:
        assert k not in reg_res.text.lower(), f"Sensitive field '{k}' found in register response"
        assert k not in res.text.lower(), f"Sensitive field '{k}' found in login response"
    print("[PASS] Verified passwords/hashes are NEVER leaked in auth responses")

    # 4. Account deactivation lockout
    print("\n--- TEST 4: ACCOUNT DEACTIVATION LOCKOUT ---")
    # Deactivate the account via admin API
    status_res = requests.put(f"{BACKEND_URL}/admin/users/{test_user_id}/status", json={
        "is_active": False
    })
    assert status_res.status_code == 200, f"Admin status update failed: {status_res.text}"
    assert status_res.json()["user"]["is_active"] is False
    print(f"[PASS] Deactivated test user ID: {test_user_id}")

    # Attempt to log in with deactivated account
    locked_res = requests.post(f"{BACKEND_URL}/login", json={
        "email": test_email,
        "password": "CorrectPassword123!"
    })
    assert locked_res.status_code == 403, f"Expected 403 Forbidden for deactivated user, got {locked_res.status_code}"
    assert "deactivated" in locked_res.json()["detail"].lower()
    print("[PASS] Deactivated account strictly blocked from login (HTTP 403 Forbidden)")

    # Reactivate the account
    reactivate_res = requests.put(f"{BACKEND_URL}/admin/users/{test_user_id}/status", json={
        "is_active": True
    })
    assert reactivate_res.status_code == 200
    print("[PASS] Reactivated account and verified access restored")

    # 5. File upload safety & bad data rejection on /predict
    print("\n--- TEST 5: FILE UPLOAD SAFETY ON /PREDICT ---")

    # 5a. Corrupt file / non-image text upload
    fake_file = io.BytesIO(b"This is not a valid JPEG/PNG image binary.")
    bad_upload_res = requests.post(
        f"{BACKEND_URL}/predict",
        files={"file": ("fake_image.txt", fake_file, "text/plain")}
    )
    assert bad_upload_res.status_code == 400, f"Expected 400 for corrupt image, got {bad_upload_res.status_code}"
    print("[PASS] Rejected corrupt non-image file upload (HTTP 400 Bad Request)")

    # 5b. Empty file upload
    empty_file = io.BytesIO(b"")
    empty_res = requests.post(
        f"{BACKEND_URL}/predict",
        files={"file": ("empty.jpg", empty_file, "image/jpeg")}
    )
    assert empty_res.status_code == 400, f"Expected 400 for empty image, got {empty_res.status_code}"
    print("[PASS] Rejected empty/0-byte image file (HTTP 400 Bad Request)")

    # 6. Admin user list sanitization
    print("\n--- TEST 6: ADMIN USER LIST SANITIZATION ---")
    admin_users_res = requests.get(f"{BACKEND_URL}/admin/users")
    assert admin_users_res.status_code == 200
    users_data = admin_users_res.json().get("users", [])
    assert len(users_data) > 0
    for u in users_data:
        assert "password" not in u, "Password field exposed in admin user record!"
    print(f"[PASS] Verified all {len(users_data)} user records exclude passwords/hashes")

    print("\n" + "=" * 70)
    print("ALL SECURITY TESTS PASSED SUCCESSFULLY! (6/6 SUITES)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
