import os
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DEFAULT_SQLITE_URL = "sqlite:///./freshness.db"


def normalize_database_url(url: str) -> str:
    """Use the installed Psycopg 3 driver for PostgreSQL URLs."""
    return re.sub(
        r"^postgres(?:ql)?(?:\+psycopg2)?://",
        "postgresql+psycopg://",
        url,
        count=1,
        flags=re.IGNORECASE,
    )


DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL") or DEFAULT_SQLITE_URL)

engine_kwargs = {"pool_pre_ping": False}
if DATABASE_URL.startswith("postgresql"):
    engine_kwargs.update({"pool_size": 5, "max_overflow": 10})
elif DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
