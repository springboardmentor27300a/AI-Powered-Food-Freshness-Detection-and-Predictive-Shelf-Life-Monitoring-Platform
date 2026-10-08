"""
Freshness / expiry status helpers.

Business rules (computed dynamically from the expiry date):
    Expired        - expiry date is before today
    Expiring Soon  - expiry date is within the next EXPIRING_SOON_WINDOW_DAYS (3) days
    Fresh          - expiry date is more than 3 days away

Milestone 2 also maps an image-analysis score (0-100) to one of the five
application-level freshness categories consumed by the whole platform:
    Fresh / Good / Acceptable / Near Spoilage / Spoiled
"""
from datetime import date

from app.constants import EXPIRING_SOON_WINDOW_DAYS, FRESHNESS_STATUS_THRESHOLDS
from app.ml.config import FRESHNESS_THRESHOLDS


def days_to_expiry(expiry_date: date, today: date | None = None) -> int:
    """Signed day difference: positive = days left, zero = expires today, negative = already expired."""
    reference = today or date.today()
    return (expiry_date - reference).days


def freshness_status(expiry_date: date, today: date | None = None) -> str:
    """Return one of: 'Expired', 'Expiring Soon', 'Fresh'."""
    remaining = days_to_expiry(expiry_date, today)
    if remaining < 0:
        return "Expired"
    if remaining <= EXPIRING_SOON_WINDOW_DAYS:
        return "Expiring Soon"
    return "Fresh"


def annotate_batch_fields(batch):
    """Return (status, days_left) for a FoodBatch ORM instance."""
    return freshness_status(batch.expiry_date), days_to_expiry(batch.expiry_date)


# Granular, dynamically computed expiry labels (never hardcoded).
EXPIRY_PRIORITY_STATUSES = (
    "EXPIRED",
    "EXPIRING TODAY",
    "EXPIRING WITHIN 3 DAYS",
    "EXPIRING WITHIN 7 DAYS",
    "SAFE",
)


def expiry_priority(expiry_date: date, today: date | None = None) -> str:
    """Granular expiry label computed from the actual expiry date:
    EXPIRED | EXPIRING TODAY | EXPIRING WITHIN 3 DAYS | EXPIRING WITHIN 7 DAYS | SAFE."""
    remaining = days_to_expiry(expiry_date, today)
    if remaining < 0:
        return "EXPIRED"
    if remaining == 0:
        return "EXPIRING TODAY"
    if remaining <= 3:
        return "EXPIRING WITHIN 3 DAYS"
    if remaining <= 7:
        return "EXPIRING WITHIN 7 DAYS"
    return "SAFE"


def expiry_priority_level(expiry_date: date, today: date | None = None) -> str:
    """Combined inventory priority (expiry + freshness window):
    CRITICAL | HIGH | MEDIUM | LOW."""
    remaining = days_to_expiry(expiry_date, today)
    if remaining < 0:
        return "CRITICAL"
    if remaining <= 1:
        return "HIGH"
    if remaining <= 7:
        return "MEDIUM"
    return "LOW"


def get_freshness_category(score: float) -> str:
    """
    Map a 0-100 freshness score to one application-level category.

    The single source of truth for the five-tier mapping used by the scoring
    engine, the API responses, the report generator and the frontend:
        [90-100] Fresh | [75-90) Good | [50-75) Acceptable |
        [25-50) Near Spoilage | [0-25) Spoiled
    """
    for threshold, label in FRESHNESS_THRESHOLDS:
        if score >= threshold:
            return label
    return "Spoiled"


def get_freshness_status(score: float) -> str:
    """
    Map a 0-100 OVERALL freshness score to an application status:
        [80-100] Fresh | [60-80) Acceptable |
        [40-60) Needs Attention | [0-40) Spoiled

    Thresholds are configurable (app.constants.FRESHNESS_STATUS_THRESHOLDS).
    These labels are application classifications, not food-safety certification.
    """
    for threshold, label in FRESHNESS_STATUS_THRESHOLDS:
        if score >= threshold:
            return label
    return "Spoiled"