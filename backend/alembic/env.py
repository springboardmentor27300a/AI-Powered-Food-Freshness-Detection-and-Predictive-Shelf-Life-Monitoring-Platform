"""
alembic/env.py — FreshGuard migration environment
Wired to FreshGuard's database URL and SQLAlchemy Base so
`alembic revision --autogenerate` correctly diffs all ORM models.
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# ---------------------------------------------------------------------------
# Make the `app` package importable when Alembic is invoked from the
# `backend/` directory (i.e.  alembic -c alembic.ini upgrade head).
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import FreshGuard ORM models so Alembic autogenerate can see them.
from app.database import Base, DATABASE_URL   # noqa: E402
import app.models  # noqa: E402, F401 — registers all mapped classes on Base
import app.m2_models  # noqa: E402, F401 — registers isolated M2 v2 history

# ---------------------------------------------------------------------------
# Alembic Config object
# ---------------------------------------------------------------------------
config = context.config

# Override the sqlalchemy.url in alembic.ini with the value from database.py
# so SQLite dev URL and PostgreSQL prod URL are both handled automatically.
# ConfigParser treats percent-encoded credentials (for example, %40) as
# interpolation tokens. Escape them here; Config.get_main_option restores the
# original URL before SQLAlchemy receives it.
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline mode — emit SQL to stdout (no DB connection needed)
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (SQL emitted to stdout)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode — connect to the DB and apply migrations
# ---------------------------------------------------------------------------

def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to the database)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
