# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# MILESTONE 3 - SAFE FOOD TABLE MIGRATION
# ============================================================

from sqlalchemy import inspect, text

from app.core.database import engine


# ============================================================
# COLUMNS TO ADD
# ============================================================

NEW_COLUMNS = {
    "storage_temperature": "FLOAT",
    "storage_humidity": "FLOAT",
    "packaging_type": "VARCHAR(100)",
    "storage_duration": "FLOAT",
    "air_circulation": "VARCHAR(50)",
    "light_exposure": "VARCHAR(50)",
    "remaining_shelf_life": "FLOAT",
    "shelf_life_confidence": "FLOAT",
    "shelf_life_risk": "VARCHAR(50)",
    "storage_compliance_score": "FLOAT",
    "overall_health_score": "FLOAT",
}


# ============================================================
# MIGRATION
# ============================================================

def migrate_food_table():

    print("=" * 60)
    print("FOOD FRESHNESS PLATFORM")
    print("MILESTONE 3 DATABASE MIGRATION")
    print("=" * 60)

    inspector = inspect(engine)

    if not inspector.has_table("foods"):
        raise RuntimeError(
            "The 'foods' table does not exist. "
            "Start the backend once before running this migration."
        )

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("foods")
    }

    print("\nExisting food table detected.")
    print(f"Existing columns: {len(existing_columns)}")

    added_columns = []
    skipped_columns = []

    # --------------------------------------------------------
    # ADD ONLY MISSING COLUMNS
    # --------------------------------------------------------

    with engine.begin() as connection:

        for column_name, column_type in NEW_COLUMNS.items():

            if column_name in existing_columns:

                skipped_columns.append(column_name)

                print(
                    f"[SKIP] {column_name} "
                    f"already exists."
                )

                continue

            sql = text(
                f'ALTER TABLE foods '
                f'ADD COLUMN "{column_name}" {column_type}'
            )

            connection.execute(sql)

            added_columns.append(column_name)

            print(
                f"[ADD]  {column_name} "
                f"({column_type})"
            )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETED")
    print("=" * 60)

    print(
        f"Columns added : {len(added_columns)}"
    )

    print(
        f"Columns skipped: {len(skipped_columns)}"
    )

    if added_columns:
        print("\nAdded columns:")

        for column in added_columns:
            print(f"  + {column}")

    if skipped_columns:
        print("\nAlready existing:")

        for column in skipped_columns:
            print(f"  - {column}")

    print("\nExisting food records were NOT deleted.")
    print("Existing database data was NOT reset.")
    print("=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    migrate_food_table()