from sqlalchemy import create_engine, text

from app.core.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)


with engine.connect() as connection:

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
print("foods.category column is ready.")