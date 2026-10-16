import os
from sqlalchemy import text
from database import engine

migration_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migration.sql")
with open(migration_file, "r", encoding="utf-8") as f:
    sql_script = f.read()

print("Applying migration.sql to database...")
with engine.begin() as connection:
    # Execute the migration script
    # Split by semicolon or execute as text block
    connection.execute(text(sql_script))

print("SUCCESS: migration.sql applied successfully!")
