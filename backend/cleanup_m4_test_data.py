"""One-off cleanup: remove M4 test accounts and their records from MongoDB.

Keeps the real demo users: demo, demo1, manager, inspector, operator, administrator.
Safe to run repeatedly (idempotent).
"""
import os
import re
import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

load_dotenv()

KEEP = {"demo", "demo1", "manager", "inspector", "operator", "administrator"}
TEST_NAME = re.compile(r"^(lc_)?(admin|cons|cons2|retail|ware|insp)_[0-9]{9,}$")


def is_test_username(u: str) -> bool:
    return u.startswith("m4_") or u == "qc_test" or bool(TEST_NAME.match(u))


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client["food_freshness"]

    users = await db.users.find({}, {"username": 1}).to_list(1000)
    test_users = [u for u in users if is_test_username(u["username"])]
    usernames = [u["username"] for u in test_users]
    ids = [u["_id"] for u in test_users]
    id_strs = [str(i) for i in ids]
    print(f"test users ({len(usernames)}): {', '.join(usernames)}")

    # Food items owned by test users
    items = await db.food_items.find(
        {"$or": [{"created_by": {"$in": ids}}, {"created_by": {"$in": id_strs}}]},
        {"_id": 1},
    ).to_list(1000)
    item_ids = [i["_id"] for i in items]
    item_strs = [str(i) for i in item_ids]
    print(f"food items to remove: {len(item_ids)}")

    async def drop(coll, query):
        res = await db[coll].delete_many(query)
        if res.deleted_count:
            print(f"  {coll}: deleted {res.deleted_count}")
        return res.deleted_count

    total = 0
    # alerts: private recipient, item-linked, or platform notif mentioning a test user
    name_clauses = [{"recipient_username": {"$in": usernames}}]
    for un in usernames:
        name_clauses.append({"message": {"$regex": re.escape(un)}})
    total += await drop("alerts", {"$or": [
        {"recipient_id": {"$in": ids}},
        {"recipient_id": {"$in": id_strs}},
        {"item_id": {"$in": item_strs + item_ids}},
        *name_clauses,
    ]})
    total += await drop("reports", {"$or": [
        {"created_by": {"$in": ids}},
        {"created_by": {"$in": id_strs}},
        {"created_by_username": {"$in": usernames}},
        {"item_id": {"$in": item_strs + item_ids}},
    ]})
    total += await drop("analysis_results", {"$or": [
        {"scanned_by": {"$in": id_strs}},
        {"scanned_by": {"$in": ids}},
        {"owner_id": {"$in": id_strs}},
        {"owner_id": {"$in": ids}},
    ]})
    total += await drop("shelf_life_predictions", {"$or": [
        {"requested_by": {"$in": ids}},
        {"requested_by": {"$in": id_strs}},
        {"requested_by_username": {"$in": usernames}},
        {"item_id": {"$in": item_strs + item_ids}},
    ]})
    total += await drop("recommendations", {"$or": [
        {"generated_by": {"$in": ids}},
        {"generated_by": {"$in": id_strs}},
        {"item_id": {"$in": item_strs + item_ids}},
    ]})
    total += await drop("lifecycle_events", {"$or": [
        {"performed_by": {"$in": ids}},
        {"performed_by": {"$in": id_strs}},
        {"performed_by_username": {"$in": usernames}},
        {"item_id": {"$in": item_strs + item_ids}},
    ]})
    total += await drop("batches", {"$or": [
        {"created_by": {"$in": ids}},
        {"created_by": {"$in": id_strs}},
        {"item_id": {"$in": item_strs + item_ids}},
    ]})
    total += await drop("food_items", {"_id": {"$in": item_ids}})
    total += await drop("users", {"_id": {"$in": ids}})

    print(f"total documents deleted: {total}")
    remaining = await db.users.count_documents({}, {"username": 1})
    names = [u["username"] for u in await db.users.find({}, {"username": 1}).to_list(100)]
    print(f"users remaining ({remaining}): {', '.join(names)}")
    print(f"alerts remaining: {await db.alerts.count_documents({})}")
    print(f"reports remaining: {await db.reports.count_documents({})}")
    client.close()


asyncio.run(main())
