"""
Storage condition compliance evaluation (Milestone 3).

IMPORTANT: This is a transparent, hand-written rule table based on
general food-storage guidance, NOT a certified food-safety standard
and NOT a trained model. It categorizes food into three broad groups
with different ideal temperature/humidity bands, and scores how far
a reading is from that band.

There is no physical sensor integration yet - all readings are
manually entered (see app/api/storage.py). The functions here are
pure (no DB, no FastAPI) so they can be tested and adjusted in
isolation.
"""
from dataclasses import dataclass
from typing import Tuple

from app.models.storage_condition import ComplianceStatus

_COLD_CHAIN_CATEGORIES = {"dairy products", "meat & poultry", "seafood"}
_PRODUCE_CATEGORIES = {"fruits", "vegetables"}
_SHELF_STABLE_CATEGORIES = {"bakery products", "packaged foods", "beverages"}

_COLD_CHAIN_BAND = (0.0, 4.0, 80.0, 95.0)
_PRODUCE_BAND = (0.0, 10.0, 85.0, 95.0)
_SHELF_STABLE_BAND = (0.0, 25.0, 0.0, 60.0)
DEFAULT_BAND = (0.0, 10.0, 60.0, 90.0)


@dataclass
class StorageEvaluation:
    compliance_status: ComplianceStatus
    compliance_notes: str
    storage_score: float  # 0-100, one component of the overall health score


def _band_for_category(category: str) -> Tuple[float, float, float, float]:
    normalized = (category or "").strip().lower()
    if normalized in _COLD_CHAIN_CATEGORIES:
        return _COLD_CHAIN_BAND
    if normalized in _PRODUCE_CATEGORIES:
        return _PRODUCE_BAND
    if normalized in _SHELF_STABLE_CATEGORIES:
        return _SHELF_STABLE_BAND
    return DEFAULT_BAND


def _deviation_ratio(value: float, low: float, high: float) -> float:
    """
    0.0 if value is inside [low, high]. Otherwise, how far outside the
    band the value is, as a fraction of the band's own width.
    """
    if low <= value <= high:
        return 0.0
    span = max(high - low, 1e-6)
    if value < low:
        return (low - value) / span
    return (value - high) / span


def evaluate_storage_conditions(
    category: str,
    temperature_celsius: float,
    humidity_percent: float,
) -> StorageEvaluation:
    """
    Evaluate one storage reading against the ideal band for the food's
    category. Returns a compliance status (suitable/warning/critical),
    a human-readable explanation, and a 0-100 storage score.
    """
    temp_low, temp_high, hum_low, hum_high = _band_for_category(category)

    temp_dev = _deviation_ratio(temperature_celsius, temp_low, temp_high)
    hum_dev = _deviation_ratio(humidity_percent, hum_low, hum_high)
    max_dev = max(temp_dev, hum_dev)

    storage_score = max(0.0, 100.0 * (1.0 - min(max_dev, 1.0)))

    notes = []
    if temp_dev > 0:
        direction = "below" if temperature_celsius < temp_low else "above"
        notes.append(
            f"Temperature {temperature_celsius:.1f}C is {direction} the "
            f"ideal range ({temp_low:.0f}-{temp_high:.0f}C) for this category"
        )
    if hum_dev > 0:
        direction = "below" if humidity_percent < hum_low else "above"
        notes.append(
            f"Humidity {humidity_percent:.0f}% is {direction} the ideal "
            f"range ({hum_low:.0f}-{hum_high:.0f}%) for this category"
        )

    if max_dev == 0:
        status = ComplianceStatus.SUITABLE
        notes_text = "Temperature and humidity are both within the ideal range for this category."
    elif max_dev < 0.5:
        status = ComplianceStatus.WARNING
        notes_text = "; ".join(notes) + "."
    else:
        status = ComplianceStatus.CRITICAL
        notes_text = "; ".join(notes) + "."

    return StorageEvaluation(
        compliance_status=status,
        compliance_notes=notes_text,
        storage_score=round(storage_score, 1),
    )
