import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
# Certificate validation is ON by default. Only an explicit, development-only
# opt-out disables it (MONGO_TLS_ALLOW_INVALID=1).
_allow_invalid = os.getenv("MONGO_TLS_ALLOW_INVALID", "0") == "1"
if _allow_invalid:
    client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
else:
    client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())

database = client.get_database("food_freshness")

# --- persistent collections (single source of truth for the whole app) ---
user_collection = database.get_collection("users")
food_item_collection = database.get_collection("food_items")
batch_collection = database.get_collection("batches")
storage_readings_collection = database.get_collection("storage_readings")
analysis_collection = database.get_collection("analysis_results")
prediction_collection = database.get_collection("shelf_life_predictions")
recommendation_collection = database.get_collection("recommendations")
alert_collection = database.get_collection("alerts")
report_collection = database.get_collection("reports")
lifecycle_events_collection = database.get_collection("lifecycle_events")

# Helpful indexes (idempotent; invoked from the FastAPI startup event)
async def ensure_indexes():
    await food_item_collection.create_index("created_by")
    await food_item_collection.create_index("batch_number")
    await batch_collection.create_index("item_id")
    await storage_readings_collection.create_index([("item_id", 1), ("recorded_at", -1)])
    await storage_readings_collection.create_index([("zone", 1), ("recorded_at", -1)])
    await analysis_collection.create_index([("item_id", 1), ("scanned_at", -1)])
    await prediction_collection.create_index([("item_id", 1), ("predicted_at", -1)])
    await recommendation_collection.create_index([("item_id", 1), ("created_at", -1)])
    await alert_collection.create_index([("recipient_id", 1), ("created_at", -1)])
    await report_collection.create_index([("item_id", 1), ("created_at", -1)])
    await lifecycle_events_collection.create_index([("item_id", 1), ("created_at", -1)])
