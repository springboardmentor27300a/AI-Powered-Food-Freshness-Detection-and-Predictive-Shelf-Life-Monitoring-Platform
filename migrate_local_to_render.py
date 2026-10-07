import os
from pathlib import Path

import psycopg2
from dotenv import dotenv_values


# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# Local PostgreSQL -> Render PostgreSQL Migration
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent
ENV_FILE = PROJECT_ROOT / "backend" / ".env"


def get_local_database_url():
    if not ENV_FILE.exists():
        raise FileNotFoundError(
            f"Local environment file not found: {ENV_FILE}"
        )

    values = dotenv_values(ENV_FILE)
    database_url = values.get("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL not found in backend/.env"
        )

    return database_url


def get_render_database_url():
    database_url = os.environ.get("RENDER_DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "RENDER_DATABASE_URL is not set in the current PowerShell session."
        )

    return database_url


def main():
    print("=" * 70)
    print("FOOD FRESHNESS MONITORING PLATFORM")
    print("LOCAL -> RENDER DATABASE MIGRATION")
    print("=" * 70)

    local_url = get_local_database_url()
    render_url = get_render_database_url()

    print("\nConnecting to local database...")
    local_conn = psycopg2.connect(local_url)

    print("Connecting to Render database...")
    render_conn = psycopg2.connect(render_url)

    local_conn.autocommit = False
    render_conn.autocommit = False

    try:
        # ----------------------------------------------------
        # 1. Read local users
        # ----------------------------------------------------
        with local_conn.cursor() as local_cursor:
            local_cursor.execute(
                """
                SELECT
                    id,
                    name,
                    email,
                    password_hash,
                    role,
                    is_active,
                    created_at
                FROM users
                ORDER BY id
                """
            )

            local_users = local_cursor.fetchall()

        print(f"\nLocal users found: {len(local_users)}")

        if not local_users:
            raise RuntimeError("No local users found. Migration stopped.")

        # ----------------------------------------------------
        # 2. Read local foods
        # ----------------------------------------------------
        with local_conn.cursor() as local_cursor:
            local_cursor.execute(
                """
                SELECT
                    id,
                    user_id,
                    food_name,
                    category,
                    freshness_status,
                    freshness_score,
                    image_path,
                    manufacturing_date,
                    expiry_date,
                    storage_condition,
                    storage_temperature,
                    storage_humidity,
                    packaging_type,
                    storage_duration,
                    air_circulation,
                    light_exposure,
                    remaining_shelf_life,
                    shelf_life_confidence,
                    shelf_life_risk,
                    storage_compliance_score,
                    overall_health_score,
                    created_at
                FROM foods
                ORDER BY id
                """
            )

            local_foods = local_cursor.fetchall()

        print(f"Local foods found: {len(local_foods)}")

        # ----------------------------------------------------
        # 3. Start Render transaction
        # ----------------------------------------------------
        with render_conn.cursor() as render_cursor:

            # ------------------------------------------------
            # 4. Read existing production users
            # ------------------------------------------------
            render_cursor.execute(
                """
                SELECT id, email
                FROM users
                ORDER BY id
                """
            )

            existing_users = render_cursor.fetchall()

            existing_email_map = {
                email.lower(): user_id
                for user_id, email in existing_users
            }

            print(
                f"Existing Render users before migration: "
                f"{len(existing_users)}"
            )

            # ------------------------------------------------
            # 5. Check duplicate emails BEFORE changing data
            # ------------------------------------------------
            duplicate_emails = []

            for (
                local_id,
                name,
                email,
                password_hash,
                role,
                is_active,
                created_at,
            ) in local_users:

                if email.lower() in existing_email_map:
                    duplicate_emails.append(email)

            if duplicate_emails:
                print("\nMigration stopped.")
                print("These local email(s) already exist in Render:")

                for email in duplicate_emails:
                    print(f"  - {email}")

                print(
                    "\nNo production data was changed."
                )

                render_conn.rollback()
                return

            # ------------------------------------------------
            # 6. Insert users and create ID mapping
            # ------------------------------------------------
            user_id_map = {}

            print("\nMigrating users...")

            for (
                local_id,
                name,
                email,
                password_hash,
                role,
                is_active,
                created_at,
            ) in local_users:

                render_cursor.execute(
                    """
                    INSERT INTO users (
                        name,
                        email,
                        password_hash,
                        role,
                        is_active,
                        created_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    RETURNING id
                    """,
                    (
                        name,
                        email,
                        password_hash,
                        role,
                        is_active,
                        created_at,
                    ),
                )

                new_user_id = render_cursor.fetchone()[0]

                user_id_map[local_id] = new_user_id

                print(
                    f"  Local user {local_id} "
                    f"-> Render user {new_user_id} "
                    f"({email})"
                )

            # ------------------------------------------------
            # 7. Insert foods with remapped user IDs
            # ------------------------------------------------
            print("\nMigrating foods...")

            migrated_foods = 0

            for food in local_foods:
                (
                    local_food_id,
                    local_user_id,
                    food_name,
                    category,
                    freshness_status,
                    freshness_score,
                    image_path,
                    manufacturing_date,
                    expiry_date,
                    storage_condition,
                    storage_temperature,
                    storage_humidity,
                    packaging_type,
                    storage_duration,
                    air_circulation,
                    light_exposure,
                    remaining_shelf_life,
                    shelf_life_confidence,
                    shelf_life_risk,
                    storage_compliance_score,
                    overall_health_score,
                    created_at,
                ) = food

                if local_user_id not in user_id_map:
                    raise RuntimeError(
                        f"Food ID {local_food_id} belongs to "
                        f"local user ID {local_user_id}, "
                        f"but that user was not migrated."
                    )

                new_user_id = user_id_map[local_user_id]

                render_cursor.execute(
                    """
                    INSERT INTO foods (
                        user_id,
                        food_name,
                        category,
                        freshness_status,
                        freshness_score,
                        image_path,
                        manufacturing_date,
                        expiry_date,
                        storage_condition,
                        storage_temperature,
                        storage_humidity,
                        packaging_type,
                        storage_duration,
                        air_circulation,
                        light_exposure,
                        remaining_shelf_life,
                        shelf_life_confidence,
                        shelf_life_risk,
                        storage_compliance_score,
                        overall_health_score,
                        created_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    RETURNING id
                    """,
                    (
                        new_user_id,
                        food_name,
                        category,
                        freshness_status,
                        freshness_score,
                        image_path,
                        manufacturing_date,
                        expiry_date,
                        storage_condition,
                        storage_temperature,
                        storage_humidity,
                        packaging_type,
                        storage_duration,
                        air_circulation,
                        light_exposure,
                        remaining_shelf_life,
                        shelf_life_confidence,
                        shelf_life_risk,
                        storage_compliance_score,
                        overall_health_score,
                        created_at,
                    ),
                )

                new_food_id = render_cursor.fetchone()[0]

                migrated_foods += 1

                print(
                    f"  Local food {local_food_id} "
                    f"-> Render food {new_food_id} "
                    f"({food_name})"
                )

            # ------------------------------------------------
            # 8. Verify counts inside transaction
            # ------------------------------------------------
            render_cursor.execute(
                "SELECT COUNT(*) FROM users"
            )
            final_user_count = render_cursor.fetchone()[0]

            render_cursor.execute(
                "SELECT COUNT(*) FROM foods"
            )
            final_food_count = render_cursor.fetchone()[0]

            expected_user_count = len(existing_users) + len(local_users)
            expected_food_count = len(local_foods)

            print("\nVerification before commit:")
            print(
                f"  Render users: {final_user_count} "
                f"(expected {expected_user_count})"
            )
            print(
                f"  Render foods: {final_food_count} "
                f"(expected {expected_food_count})"
            )

            if final_user_count != expected_user_count:
                raise RuntimeError(
                    "User count verification failed. "
                    "Migration will be rolled back."
                )

            if final_food_count != expected_food_count:
                raise RuntimeError(
                    "Food count verification failed. "
                    "Migration will be rolled back."
                )

        # ----------------------------------------------------
        # 9. Commit only after all verification succeeds
        # ----------------------------------------------------
        render_conn.commit()

        print("\n" + "=" * 70)
        print("MIGRATION SUCCESSFUL")
        print("=" * 70)
        print(f"Users migrated : {len(local_users)}")
        print(f"Foods migrated : {migrated_foods}")
        print(f"Render users   : {final_user_count}")
        print(f"Render foods   : {final_food_count}")
        print("\nExisting Render user was preserved.")
        print("Production transaction committed successfully.")

    except Exception as error:
        render_conn.rollback()

        print("\n" + "=" * 70)
        print("MIGRATION FAILED")
        print("=" * 70)
        print(f"Reason: {error}")
        print("\nRender database transaction was rolled back.")
        print("No partial migration was committed.")

        raise

    finally:
        local_conn.close()
        render_conn.close()


if __name__ == "__main__":
    main()