"""
Automatic unique batch ID generation.

Format: <first 3 letters of food name>-<received date YYYYMMDD>-<sequence 001>
Examples:
    Apple received 21 Aug 2026 -> APP-20260821-001
    Second Apple batch same day -> APP-20260821-002
    Apple next day             -> APP-20260822-001

The sequence restarts for each food-prefix + received-date combination.
Uniqueness is guaranteed by a UNIQUE constraint on food_batches.batch_id and a
retry loop in the router when two concurrent requests race for the same number.
"""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FoodBatch

MAX_SEQUENCE_ATTEMPTS = 5


def build_prefix(food_name: str) -> str:
    """
    First three alphabetic characters of the food name, uppercased.
    Non-alphabetic characters are ignored ("Ice Cream" -> "ICE").
    Names shorter than three letters are padded with 'X' ("Go" -> "GOX").
    """
    letters = re.sub(r"[^A-Za-z]", "", food_name).upper()
    return (letters[:3] + "XXX")[:3]


def generate_batch_id(db: Session, food_name: str, received_date) -> str:
    """Compute the next free sequence number for this prefix+date combination."""
    base = f"{build_prefix(food_name)}-{received_date.strftime('%Y%m%d')}-"

    # Collect existing IDs like APP-20260821-* and parse their numeric suffixes,
    # e.g. APP-20260821-007 -> 7, so the next candidate is APP-20260821-008.
    existing_ids = db.scalars(
        select(FoodBatch.batch_id).where(FoodBatch.batch_id.like(f"{base}%"))
    ).all()

    next_seq = 1
    for existing_id in existing_ids:
        suffix = existing_id.rsplit("-", 1)[-1]
        if suffix.isdigit():
            next_seq = max(next_seq, int(suffix) + 1)

    return f"{base}{next_seq:03d}"
