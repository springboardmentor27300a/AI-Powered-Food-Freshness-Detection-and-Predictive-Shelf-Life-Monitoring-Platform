"""
DB session dependency — yields a SQLAlchemy session per request and
always closes it afterward, even on error.
"""
from typing import Generator

from app.database import SessionLocal


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
