
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


# ============================================================
# CONFIGURATION
# ============================================================

CONNECTION_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1
SERVER_SELECTION_TIMEOUT_MS = 3000
CONNECT_TIMEOUT_MS = 3000
SOCKET_TIMEOUT_MS = 5000


# ============================================================
# MONGODB CONNECTION
# ============================================================

def connect_to_mongo() -> bool:
    """Connect to MongoDB using the configured application settings."""
    global client, db

    mongo_uri = getattr(settings, "MONGO_URI", None)
    database_name = getattr(settings, "DATABASE_NAME", None)

    if not mongo_uri or not str(mongo_uri).strip():
        logger.error("MONGO_URI is not configured.")
        return False

    if not database_name or not str(database_name).strip():
        logger.error("DATABASE_NAME is not configured.")
        return False

    mongo_uri = str(mongo_uri).strip()
    database_name = str(database_name).strip()

    # Reuse an existing healthy connection.
    if client is not None and db is not None:
        try:
            client.admin.command("ping")
            logger.debug("Existing MongoDB connection is healthy.")
            return True
        except PyMongoError:
            logger.warning(
                "Existing MongoDB connection is unavailable. Reconnecting."
            )
            try:
                client.close()
            except Exception:
                logger.debug(
                    "Error while closing stale MongoDB client.",
                    exc_info=True,
                )
            finally:
                client = None
                db = None

    new_client = None

    try:
        logger.info(
            "Connecting to configured MongoDB database: %s",
            database_name,
        )

        # Connection attempts: standard certifi first, then resilient TLS fallback if SSL handshake fails
        last_error = None
        connected = False

        tls_modes = [(True, False)]
        if "mongodb+srv://" in mongo_uri or "tls=true" in mongo_uri.lower() or "ssl=true" in mongo_uri.lower():
            tls_modes.append((False, True))

        for mode_idx, (use_certifi, allow_invalid) in enumerate(tls_modes):
            try:
                client_kwargs = {
                    "serverSelectionTimeoutMS": SERVER_SELECTION_TIMEOUT_MS,
                    "connectTimeoutMS": CONNECT_TIMEOUT_MS,
                    "socketTimeoutMS": SOCKET_TIMEOUT_MS,
                    "retryWrites": True,
                    "appname": "FoodFreshnessMonitoringPlatform",
                }
                if use_certifi:
                    try:
                        client_kwargs["tlsCAFile"] = certifi.where()
                    except Exception:
                        pass
                if allow_invalid:
                    client_kwargs["tlsAllowInvalidCertificates"] = True
                    logger.warning(
                        "Retrying MongoDB connection using resilient TLS fallback (tlsAllowInvalidCertificates)..."
                    )

                new_client = MongoClient(mongo_uri, **client_kwargs)

                for attempt in range(1, CONNECTION_ATTEMPTS + 1):
                    try:
                        new_client.admin.command("ping")
                        connected = True
                        last_error = None
                        break
                    except PyMongoError as exc:
                        last_error = exc
                        if attempt < CONNECTION_ATTEMPTS:
                            time.sleep(RETRY_DELAY_SECONDS)

                if connected:
                    break
                else:
                    try:
                        new_client.close()
                    except Exception:
                        pass
                    new_client = None
            except Exception as exc:
                last_error = exc
                if new_client is not None:
                    try:
                        new_client.close()
                    except Exception:
                        pass
                    new_client = None

        if not connected or last_error is not None:
            raise last_error

        # Connection verified: expose the client and selected database.
        client = new_client
        db = client[database_name]

        logger.info(
            "Connected successfully to MongoDB database: %s",
            database_name,
        )

        # Index errors should be reported separately from connection errors.
        try:
            init_indexes()
        except Exception:
            logger.exception(
                "MongoDB is connected, but index initialization failed. "
                "Review the index definitions and existing database indexes."
            )

        return True

    except Exception as exc:
        err_msg = str(exc)
        logger.error(
            "Could not connect to the configured MongoDB database. Error type: %s: %s",
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        if "TLSV1_ALERT_INTERNAL_ERROR" in err_msg or "SSL handshake failed" in err_msg:
            logger.error(
                "\n========================================================================\n"
                "  MONGODB ATLAS NETWORK ACCESS NOTICE:\n"
                "  An SSL/TLS handshake alert (TLSV1_ALERT_INTERNAL_ERROR) occurred.\n"
                "  In MongoDB Atlas, this error almost always means your current public IP\n"
                "  is not whitelisted in Atlas Network Access.\n\n"
                "  TO RESOLVE THIS IN MONGODB ATLAS:\n"
                "  1. Log into your MongoDB Atlas account (https://cloud.mongodb.com)\n"
                "  2. In the left navigation, click 'Network Access' under 'Security'\n"
                "  3. Click 'Add IP Address' -> 'Add Current IP Address' (or 0.0.0.0/0)\n"
                "  4. Click 'Confirm' and wait ~1 minute for Atlas to activate the rule.\n"
                "========================================================================"
            )

        if new_client is not None:
            try:
                new_client.close()
            except Exception:
                logger.debug(
                    "Error while closing failed MongoDB client.",
                    exc_info=True,
                )

        # Fallback gracefully to local MongoDB instance if remote Atlas is unreachable
        if "127.0.0.1" not in mongo_uri and "localhost" not in mongo_uri:
            try:
                logger.warning("Attempting automatic fallback to local MongoDB instance (127.0.0.1:27017)...")
                local_client = MongoClient(
                    "mongodb://127.0.0.1:27017",
                    serverSelectionTimeoutMS=3000,
                    connectTimeoutMS=3000,
                    appname="FoodFreshnessMonitoringPlatform_LocalFallback",
                )
                local_client.admin.command("ping")
                client = local_client
                db = local_client[database_name]
                logger.info("Connected successfully to fallback local MongoDB database: %s", database_name)
                try:
                    init_indexes()
                except Exception:
                    pass
                return True
            except Exception as local_exc:
                logger.error("Local MongoDB fallback also failed: %s", local_exc)

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
    """Return the configured database, connecting if necessary."""
    global db

    if db is not None:
        return db

    if not connect_to_mongo():
        raise RuntimeError(
            "MongoDB is unavailable. Check the application configuration, "
            "Atlas network access, DNS, TLS connectivity, and application logs."
        )

    if db is None:
        raise RuntimeError(
            "MongoDB connection succeeded, but the database was not initialized."
        )

    return db


# ============================================================
# INDEX INITIALIZATION
# ============================================================

def init_indexes() -> None:
    """Create required indexes and validate existing index options."""
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

        try:
            existing_indexes = collection.index_information()
        except PyMongoError:
            logger.exception(
                "Could not read indexes for collection '%s'.",
                collection_name,
            )
            raise

        for keys, options in indexes:
            expected_keys = list(keys)
            expected_unique = options.get("unique", False)
            expected_sparse = options.get("sparse", False)

            # PyMongo returns index key specifications as a list of pairs.
            existing = next(
                (
                    index_info
                    for index_info in existing_indexes.values()
                    if list(index_info.get("key", [])) == expected_keys
                ),
                None,
            )

            if existing is not None:
                existing_unique = existing.get("unique", False)
                existing_sparse = existing.get("sparse", False)

                if (
                    existing_unique != expected_unique
                    or existing_sparse != expected_sparse
                ):
                    raise RuntimeError(
                        f"Index configuration conflict in collection "
                        f"'{collection_name}' for keys {expected_keys}. "
                        f"Existing unique={existing_unique}, "
                        f"expected unique={expected_unique}; "
                        f"existing sparse={existing_sparse}, "
                        f"expected sparse={expected_sparse}. "
                        "Review the existing index before changing it."
                    )

                logger.debug(
                    "Index already exists for '%s': %s",
                    collection_name,
                    expected_keys,
                )
                continue

            try:
                collection.create_index(keys, **options)
                logger.info(
                    "Created index for '%s': %s",
                    collection_name,
                    expected_keys,
                )
            except PyMongoError:
                logger.exception(
                    "Failed to create index for collection '%s', keys=%s",
                    collection_name,
                    expected_keys,
                )
                raise

    logger.info("MongoDB indexes initialized successfully.")


# ============================================================
# COLLECTION HELPERS
# ============================================================

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
