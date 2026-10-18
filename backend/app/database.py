
"""MongoDB Atlas connection and collection helpers."""

import logging
import time
from typing import Optional

import certifi
from pymongo import ASCENDING, MongoClient
from pymongo.errors import PyMongoError

from backend.app.config import settings

logger = logging.getLogger(__name__)

client: Optional[MongoClient] = None
db = None


def connect_to_mongo() -> bool:
    """Connect to MongoDB Atlas and initialize database indexes."""
    global client, db

    mongo_uri = settings.MONGO_URI
    database_name = settings.DATABASE_NAME
    new_client = None

    if not mongo_uri:
        logger.error("MONGO_URI is not configured.")
        return False

    if not database_name:
        logger.error("DATABASE_NAME is not configured.")
        return False

    try:
        logger.info(
            "Connecting to MongoDB database: %s",
            database_name,
        )

        new_client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=15000,
            connectTimeoutMS=15000,
            tlsCAFile=certifi.where(),
        )

        # Retry the initial ping up to five times.
        for attempt in range(1, 6):
            try:
                new_client.admin.command("ping")
                break
            except PyMongoError:
                if attempt == 5:
                    raise
                logger.warning(
                    "MongoDB ping attempt %s/5 failed.",
                    attempt,
                )
                time.sleep(0.5 * attempt)

        # Make the verified connection available to the application.
        client = new_client
        db = client[database_name]

        try:
            init_indexes()
        except Exception:
            logger.exception(
                "MongoDB connected, but index initialization failed."
            )

        logger.info("MongoDB connected successfully.")
        return True

    except Exception:
        logger.exception("MongoDB connection failed.")

        if new_client is not None:
            try:
                new_client.close()
            except Exception:
                logger.exception("Failed to close MongoDB client.")

        client = None
        db = None
        return False


def close_mongo_connection() -> None:
    """Close the MongoDB connection during application shutdown."""
    global client, db

    if client is not None:
        try:
            client.close()
            logger.info("MongoDB connection closed.")
        except Exception:
            logger.exception("Error closing MongoDB connection.")
        finally:
            client = None
            db = None


def get_database():
    """Return the connected database, connecting if necessary."""
    global db

    if db is None:
        if not connect_to_mongo():
            raise RuntimeError(
                "MongoDB is not connected. Check the application logs."
            )

    return db


def init_indexes() -> None:
    """Create indexes used by existing application collections."""
    database = get_database()

    index_definitions = {
        "users": [
            ([("email", ASCENDING)], {"unique": True}),
            ([("role", ASCENDING)], {}),
            ([("status", ASCENDING)], {}),
            ([("is_active", ASCENDING)], {}),
            ([("google_id", ASCENDING)], {"sparse": True}),
        ],
        "inventory": [
            ([("user_id", ASCENDING)], {}),
            ([("category", ASCENDING)], {}),
            ([("expiry_date", ASCENDING)], {}),
        ],
        "freshness_records": [
            ([("inventory_id", ASCENDING)], {}),
        ],
        "storage_conditions": [
            ([("inventory_id", ASCENDING)], {}),
        ],
        "alerts": [
            ([("user_id", ASCENDING)], {}),
            ([("inventory_id", ASCENDING)], {}),
            ([("status", ASCENDING)], {}),
        ],
        "notifications": [
            ([("user_id", ASCENDING)], {}),
            ([("is_read", ASCENDING)], {}),
        ],
        "food_inspections": [
            ([("inspector_id", ASCENDING)], {}),
            ([("inspection_id", ASCENDING)], {"unique": True}),
            ([("status", ASCENDING)], {}),
            ([("category", ASCENDING)], {}),
            ([("created_at", ASCENDING)], {}),
        ],
        "audit_logs": [
            ([("timestamp", ASCENDING)], {}),
            ([("action", ASCENDING)], {}),
            ([("actor_id", ASCENDING)], {}),
            ([("target_id", ASCENDING)], {}),
        ],
        "storage_rules": [
            ([("category", ASCENDING)], {"unique": True}),
        ],
        "storage_zones": [
            ([("zone_id", ASCENDING)], {"unique": True}),
            ([("category", ASCENDING)], {}),
            ([("status", ASCENDING)], {}),
        ],
        "storage_readings": [
            ([("zone_id", ASCENDING), ("recorded_at", ASCENDING)], {}),
            ([("recorded_at", ASCENDING)], {}),
        ],
        "temperature_rules": [
            ([("rule_id", ASCENDING)], {"unique": True}),
            ([("category", ASCENDING), ("product_name", ASCENDING)], {}),
        ],
        "temperature_commands": [
            ([("command_id", ASCENDING)], {"unique": True}),
            ([("zone_id", ASCENDING), ("created_at", ASCENDING)], {}),
            ([("status", ASCENDING)], {}),
        ],
    }

    for collection_name, indexes in index_definitions.items():
        collection = database[collection_name]

        for keys, options in indexes:
            try:
                collection.create_index(keys, **options)
            except PyMongoError:
                logger.exception(
                    "Failed to create index for collection '%s', keys=%s",
                    collection_name,
                    keys,
                )
                raise

    logger.info("MongoDB indexes initialized successfully.")


def get_users_collection():
    return get_database()["users"]


def get_inventory_collection():
    return get_database()["inventory"]


def get_freshness_records_collection():
    return get_database()["freshness_records"]


def get_storage_conditions_collection():
    return get_database()["storage_conditions"]


def get_alerts_collection():
    return get_database()["alerts"]


def get_notifications_collection():
    return get_database()["notifications"]


def get_food_inspections_collection():
    return get_database()["food_inspections"]


def get_audit_logs_collection():
    return get_database()["audit_logs"]


def get_storage_rules_collection():
    return get_database()["storage_rules"]


def get_system_config_collection():
    return get_database()["system_config"]


def get_storage_zones_collection():
    return get_database()["storage_zones"]


def get_storage_readings_collection():
    return get_database()["storage_readings"]


def get_temperature_rules_collection():
    return get_database()["temperature_rules"]


def get_temperature_commands_collection():
    return get_database()["temperature_commands"]
