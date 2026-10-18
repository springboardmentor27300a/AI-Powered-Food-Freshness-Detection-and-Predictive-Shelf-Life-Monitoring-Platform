import urllib.request
import json

try:
    r = urllib.request.urlopen('http://127.0.0.1:8000/health')
    data = json.loads(r.read().decode())
    print("Backend health:", json.dumps(data, indent=2))
except Exception as e:
    print(f"Backend health check failed: {e}")
