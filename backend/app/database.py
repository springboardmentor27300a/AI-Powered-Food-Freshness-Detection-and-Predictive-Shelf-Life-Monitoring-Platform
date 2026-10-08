"""
SQLAlchemy database setup: engine, session factory and declarative base.

The connection string comes from the DATABASE_URL environment variable so the
same code runs against local PostgreSQL in development and managed PostgreSQL
in production.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# Production uses PostgreSQL (see .env.example). The sqlite branch exists so
# contributors can boot a throwaway local database for quick tests/demos.
_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

# pool_pre_ping avoids "connection closed" errors after PostgreSQL restarts/idle timeouts.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


def get_db():
    """
    FastAPI dependency that yields a database session per request
    and always closes it afterwards.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
