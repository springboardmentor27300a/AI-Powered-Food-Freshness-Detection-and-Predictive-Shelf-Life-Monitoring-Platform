import time
import random
import requests
import threading

BASE_URL = "http://127.0.0.1:8000"

def simulate_sensor(food_id, headers):
    print(f"Starting simulation for food item {food_id}...")
    while True:
        temperature = round(random.uniform(1.0, 10.0), 1)
        humidity = round(random.uniform(30.0, 70.0), 1)
        payload = {
            "temperature": temperature,
            "humidity": humidity,
            "air_circulation": "Good",
            "light_exposure": "Low"
        }
        try:
            res = requests.post(f"{BASE_URL}/food/{food_id}/storage-log", json=payload, headers=headers)
            if res.status_code == 200:
                print(f"[Sensor] Logged for item {food_id}: Temp {temperature}C, Hum {humidity}%")
        except:
            pass
        time.sleep(30) # log every 30 seconds for simulation

if __name__ == "__main__":
    print("Virtual IoT Simulator Started. Fetching food items...")
    email = "iot_sim@example.com"
    password = "simpassword"
    
    try:
        requests.post(f"{BASE_URL}/register", json={
            "name": "IoT Simulator",
            "email": email,
            "password": password,
            "role": "consumer"
        })
    except:
        pass
        
    login_res = requests.post(f"{BASE_URL}/login", json={
        "email": email,
        "password": password
    })
    
    if login_res.status_code != 200:
        print("Failed to login.")
        exit(1)
        
    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        food_res = requests.get(f"{BASE_URL}/food", headers=headers)
        if food_res.status_code == 200:
            food_items = food_res.json()
            if not food_items:
                print("No food items found. Please add items to begin simulating.")
            for item in food_items:
                t = threading.Thread(target=simulate_sensor, args=(item["id"], headers), daemon=True)
                t.start()
                
            while True:
                time.sleep(1)
        else:
            print("Failed to fetch food items.")
    except Exception as e:
        print(f"Error connecting: {e}")
