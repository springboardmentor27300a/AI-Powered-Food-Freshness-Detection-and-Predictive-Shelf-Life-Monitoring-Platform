import sys
import time
import json
import urllib.request
import urllib.error
import threading
import uvicorn
from main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="warning")

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
time.sleep(2)  # Wait for server to bind

BASE_URL = "http://127.0.0.1:8001"
results = []

def test_endpoint(name, method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = None
    if data:
        headers["Content-Type"] = "application/json"
        encoded_data = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            body = response.read().decode("utf-8")
            try:
                parsed = json.loads(body)
            except:
                parsed = body[:100]
            print(f"[PASS] {name}: {method} {path} -> HTTP {status}")
            results.append((name, True, status, parsed))
            return status, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[FAIL] {name}: {method} {path} -> HTTP {e.code} ({err_body[:100]})")
        results.append((name, False, e.code, err_body))
        return e.code, err_body
    except Exception as e:
        print(f"[ERROR] {name}: {method} {path} -> {e}")
        results.append((name, False, 0, str(e)))
        return 0, str(e)

print("--- TESTING LIVE FASTAPI ENDPOINTS ---")
# 1. Root
test_endpoint("Root API", "GET", "/")

# 2. Health check (tests DB connectivity)
test_endpoint("Health Check (Database)", "GET", "/api/health")

# 3. OpenAPI docs
test_endpoint("OpenAPI Docs (/docs)", "GET", "/docs")
test_endpoint("OpenAPI Spec (/openapi.json)", "GET", "/openapi.json")

# 4. Auth - Login
# Let's check user 1 or user 2 or user 6
# Let's create or login a test user to get a token
from database import SessionLocal
from models import User
from auth import hash_password, create_access_token

db = SessionLocal()
admin_user = db.query(User).filter(User.role == "Administrator").first()
if not admin_user:
    # fallback to any user
    admin_user = db.query(User).first()

token = create_access_token(data={"sub": str(admin_user.id), "role": admin_user.role})
print(f"Generated test token for User ID {admin_user.id} ({admin_user.email}, Role: {admin_user.role})")
db.close()

# 5. Auth /me
test_endpoint("Current User (/auth/me)", "GET", "/auth/me", token=token)

# 6. Inventory: Food Items
test_endpoint("Inventory Food Items", "GET", "/inventory/food-items", token=token)

# 7. Inventory: Batches
test_endpoint("Inventory Batches", "GET", "/inventory/batches", token=token)

# 8. Analysis Reports
test_endpoint("All Analysis Reports", "GET", "/analysis/reports", token=token)
test_endpoint("My Analysis Reports", "GET", "/analysis/my-reports", token=token)

# 9. Shelf Life Prediction
test_endpoint("Shelf Life Prediction", "POST", "/shelf-life/predict?category=Fruits&freshness_score=85.0", token=token)

# 10. Storage Units
test_endpoint("List Storage Units", "GET", "/storage/units", token=token)

# 11. Recommendations
test_endpoint("Recommendations", "GET", "/recommendations", token=token)

# 12. Waste Records
test_endpoint("Waste Records", "GET", "/waste/records", token=token)

# 13. Notifications
test_endpoint("Notifications", "GET", "/notifications", token=token)
test_endpoint("Unread Notifications Count", "GET", "/notifications/unread-count", token=token)

print("\n--- TEST SUMMARY ---")
passed = sum(1 for r in results if r[1])
total = len(results)
print(f"Passed: {passed}/{total}")
if passed == total:
    print("ALL ENDPOINT TESTS PASSED SUCCESSFULLY!")
else:
    print("SOME ENDPOINTS FAILED!")
    sys.exit(1)
