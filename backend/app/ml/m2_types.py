"""Shared, non-persistent types for the additive M2 v2 image-analysis path."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal


CANONICAL_CATEGORIES: Final[tuple[str, ...]] = (
    "Fruits",
    "Vegetables",
    "Dairy Products",
    "Meat & Poultry",
    "Seafood",
    "Bakery Products",
    "Packaged Foods",
    "Beverages",
)

CapabilityStatus = Literal["supported", "not_yet_supported", "uncertain"]
AssessmentStatus = Literal["assessed", "not_assessed"]

CAPABILITY_SUPPORTED: Final[CapabilityStatus] = "supported"
CAPABILITY_NOT_YET_SUPPORTED: Final[CapabilityStatus] = "not_yet_supported"
CAPABILITY_UNCERTAIN: Final[CapabilityStatus] = "uncertain"
NOT_ASSESSED: Final[AssessmentStatus] = "not_assessed"


def _category_key(value: str) -> str:
    return " ".join(
        value.strip().lower().replace("&", " and ").replace("/", " ").split()
    )


_CATEGORY_ALIASES: Final[dict[str, str]] = {
    _category_key("Fruits"): "Fruits",
    _category_key("Vegetables"): "Vegetables",
    _category_key("Dairy Products"): "Dairy Products",
    _category_key("Dairy"): "Dairy Products",
    _category_key("Meat & Poultry"): "Meat & Poultry",
    _category_key("Meat and Poultry"): "Meat & Poultry",
    _category_key("Meat/Poultry"): "Meat & Poultry",
    _category_key("Seafood"): "Seafood",
    _category_key("Bakery Products"): "Bakery Products",
    _category_key("Bakery"): "Bakery Products",
    _category_key("Packaged Foods"): "Packaged Foods",
    _category_key("Beverages"): "Beverages",
}


def normalize_category(value: str | None) -> str | None:
    """Return a canonical category only for an explicit known selection.

    This deliberately performs no image-based category inference and never maps
    an unsupported category to the legacy fruit classifier.
    """

    if not isinstance(value, str) or not value.strip():
        return None
    return _CATEGORY_ALIASES.get(_category_key(value))


@dataclass(frozen=True)
class CategoryCapability:
    category: str
    status: CapabilityStatus
    reason: str
    model_id: str | None = None

