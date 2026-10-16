import os
import requests
import json
from ml.quality_scoring import calculate_quality_score

BASE = "http://localhost:8000"
TEST_IMAGE = os.path.join(os.path.dirname(__file__), "test_images", "fresh_apple.jpg")


def get_token():
    """Authenticate against the live API (Milestone 4 requires a Bearer token)."""
    username = os.getenv("TEST_USERNAME", "qc_test")
    password = os.getenv("TEST_PASSWORD", "pass123")
    r = requests.post(f"{BASE}/api/auth/login", json={"username": username, "password": password}, timeout=30)
    if r.status_code == 404 or (r.status_code == 401 and r.json().get("detail") == "Incorrect username or password"):
        return None
    if r.status_code != 200:
        return None
    return r.json()["access_token"]


def ensure_user():
    token = get_token()
    if token:
        return token
    requests.post(f"{BASE}/api/auth/signup", json={
        "username": "qc_test", "password": "pass123", "role": "Consumer",
        "email": "qc_test@example.com"}, timeout=30)
    return get_token()

def test_unit_logic():
    """Unit test calculate_quality_score using dummy data."""
    print("="*50)
    print("1. UNIT TEST: DUMMY CV DATA")
    print("="*50)

    dummy_cv = {
        "color_analysis": {"brown_pixel_ratio": 20.0, "dark_pixel_ratio": 10.0},
        "texture_analysis": {"texture_variance": 500, "edge_density": 15.0},
        "degradation_analysis": {"discoloration_ratio": 30.0, "surface_irregularity": 5.0}
    }
    
    print("\n--- Test A: Fresh Status ---")
    result_fresh = calculate_quality_score("Fresh", 0.95, 95.0, dummy_cv)
    print(json.dumps(result_fresh, indent=4))
    
    print("\n--- Test B: Rotten Status ---")
    result_rotten = calculate_quality_score("Rotten", 0.95, 95.0, dummy_cv)
    print(json.dumps(result_rotten, indent=4))

def test_end_to_end():
    """End-to-End test by hitting the FastAPI server."""
    print("\n" + "="*50)
    print("2. END-TO-END TEST: ACTUAL FASTAPI ENDPOINT")
    print("="*50)
    
    test_image_path = TEST_IMAGE

    if not os.path.exists(test_image_path):
        print(f"Error: Could not find image at {test_image_path}")
        return

    url = f"{BASE}/api/ml/predict"
    token = ensure_user()
    if not token:
        print("Error: could not authenticate with the API")
        return
    headers = {"Authorization": f"Bearer {token}"}

    print(f"Sending POST to {url}...")

    try:
        with open(test_image_path, "rb") as f:
            files = {"file": f}
            response = requests.post(url, files=files, headers=headers, timeout=120)
            
        if response.status_code == 200:
            data = response.json()
            
            print("\n--- FINAL END-TO-END OUTPUT ---")
            print(f"Food Type: {data.get('food_type')}")
            print(f"ML Status: {data.get('status')} (Confidence: {data.get('confidence')})")
            
            qa = data.get("quality_assessment", {})
            print(f"\nFinal Quality Score: {qa.get('quality_score')} / 100")
            print(f"Quality Category: {qa.get('quality_category')}")
            
            breakdown = qa.get("score_breakdown", {})
            print("\n--- EXACT INTERMEDIATE SCORES ---")
            print(f"ML Freshness Score:   {breakdown.get('ml_freshness_score')}")
            print(f"Color Score:          {breakdown.get('color_score')}")
            print(f"Texture Score:        {breakdown.get('texture_score')}")
            print(f"Surface Score:        {breakdown.get('surface_score')}")
            print(f"Weighted Score:       {breakdown.get('weighted_score_before_penalty')}")
            if breakdown.get('rotten_penalty_applied'):
                print(f"Rotten Penalty:       APPLIED (* 0.6)")
            else:
                print(f"Rotten Penalty:       NOT APPLIED")
                
            spoilage = qa.get("spoilage_assessment", {})
            print("\n--- SPOILAGE RISK ---")
            print(f"Detected: {spoilage.get('detected')} | Risk Level: {spoilage.get('risk_level')}")

            ok = (data.get("status") in ("Fresh", "Rotten")
                  and isinstance(qa.get("quality_score"), (int, float))
                  and 0 <= qa.get("quality_score") <= 100)
            print("\nRESULT: " + ("PASS - quality score valid end-to-end" if ok else "FAIL - invalid output"))
        else:
            print(f"API Error: {response.status_code} - {response.text}")
            print("\nRESULT: FAIL - endpoint error")
    except Exception as e:
        print(f"Failed to connect to FastAPI: {e}")

if __name__ == "__main__":
    test_unit_logic()
    test_end_to_end()
