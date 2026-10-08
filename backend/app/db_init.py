from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.schema import CreateColumn

from app.core.database import Base, engine
from app.models import User, FoodItem, FoodBatch, FreshnessAssessment, Alert


MODEL_TABLES = [User, FoodItem, FoodBatch, FreshnessAssessment, Alert]


def _column_sql(column) -> str:
    # Compile a SQLAlchemy column definition for the current MySQL dialect.
    compiled = CreateColumn(column).compile(dialect=engine.dialect)
    return str(compiled)


def ensure_schema() -> None:
    """Create missing tables and add missing columns without deleting user data."""
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        # Add any model columns that are absent from an older Milestone schema.
        for model in MODEL_TABLES:
            table = model.__table__
            if table.name not in existing_tables:
                continue

            existing_columns = {
                c["name"] for c in inspector.get_columns(table.name)
            }

            for column in table.columns:
                if column.name in existing_columns:
                    continue

                # Add missing columns as nullable first so an existing table
                # containing rows can be upgraded safely.
                definition = _column_sql(column)
                definition = definition.replace(" NOT NULL", "", 1)
                conn.execute(
                    text(
                        f"ALTER TABLE `{table.name}` "
                        f"ADD COLUMN {definition}"
                    )
                )

        # Re-read the schema after adding columns.
        inspector = inspect(engine)

        # Existing batches from older milestones may not have a food item.
        # Attach them to the first seeded food item so the application can
        # continue without deleting the user's inventory.
        if "food_batches" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("food_batches")}
            if "food_item_id" in cols and "food_items" in existing_tables:
                conn.execute(
                    text(
                        "UPDATE food_batches SET food_item_id = "
                        "(SELECT MIN(id) FROM food_items) "
                        "WHERE food_item_id IS NULL"
                    )
                )

        # Existing assessments from older milestones may not have an owner.
        # Assign them to the first user when one exists.
        if "freshness_assessments" in existing_tables:
            cols = {
                c["name"] for c in inspector.get_columns("freshness_assessments")
            }
            if "user_id" in cols and "users" in existing_tables:
                conn.execute(
                    text(
                        "UPDATE freshness_assessments SET user_id = "
                        "(SELECT MIN(id) FROM users) "
                        "WHERE user_id IS NULL"
                    )
                )

        # Add the important foreign keys if an older schema does not have them.
        _ensure_fk(conn, "food_batches", "food_item_id", "food_items", "id", "fk_food_batches_food_item")
        _ensure_fk(conn, "freshness_assessments", "batch_id", "food_batches", "id", "fk_assessments_batch")
        _ensure_fk(conn, "freshness_assessments", "user_id", "users", "id", "fk_assessments_user")
        _ensure_fk(conn, "alerts", "user_id", "users", "id", "fk_alerts_user")
        _ensure_fk(conn, "alerts", "batch_id", "food_batches", "id", "fk_alerts_batch")


def _ensure_fk(conn, table: str, column: str, ref_table: str, ref_column: str, name: str) -> None:
    inspector = inspect(conn)
    if table not in inspector.get_table_names() or ref_table not in inspector.get_table_names():
        return

    columns = {c["name"] for c in inspector.get_columns(table)}
    if column not in columns:
        return

    for fk in inspector.get_foreign_keys(table):
        if (
            fk.get("referred_table") == ref_table
            and fk.get("constrained_columns") == [column]
            and fk.get("referred_columns") == [ref_column]
        ):
            return

    # Existing rows can contain legacy/null values. A nullable legacy column
    # is intentionally accepted; new application records always provide IDs.
    try:
        conn.execute(
            text(
                f"ALTER TABLE `{table}` ADD CONSTRAINT `{name}` "
                f"FOREIGN KEY (`{column}`) REFERENCES `{ref_table}`(`{ref_column}`)"
            )
        )
    except Exception:
        # Do not prevent the application from starting because an old database
        # contains a legacy value that cannot satisfy a new FK constraint.
        pass
