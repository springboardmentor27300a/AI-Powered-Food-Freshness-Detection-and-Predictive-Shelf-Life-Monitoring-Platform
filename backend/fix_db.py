from sqlalchemy import create_engine, text

from app.core.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)


with engine.connect() as connection:
    # Existing users table fix
    connection.execute(
        text(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role
            VARCHAR(50)
            NOT NULL
            DEFAULT 'consumer';
            """
        )
    )

    # Add category to existing foods table
    connection.execute(
        text(
            """
            ALTER TABLE foods
            ADD COLUMN IF NOT EXISTS category
            VARCHAR(50)
            NOT NULL
            DEFAULT 'Other';
            """
        )
    )

    connection.commit()


print("Database fixed successfully.")
print("users.role column is ready.")
print("foods.category column is ready.")