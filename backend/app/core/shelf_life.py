"""
Shelf-life estimation (Milestone 3, food-specific fix).

IMPORTANT: This is a transparent, rule-based/weighted ESTIMATE, NOT a
trained machine learning prediction, and NOT a food-safety guarantee.

Inputs (all real, stored values - nothing is fabricated):
  - the item's food name and category   -> food-specific rule (app/core/food_rules.py)
  - purchase date and recorded expiry   -> nominal remaining time
  - storage method (from a recorded temperature, else the item's
    storage_location text)              -> which rule figure applies
  - latest heuristic freshness category -> multiplier
  - latest storage compliance           -> multiplier
  - freshness trend (if >= 2 images)    -> may raise the risk level

Rules of the estimate:
  * It can only ever SHORTEN the time implied by the recorded expiry
    date, never extend it.
  * If the food has no rule, or the storage method is unknown or has no
    figure, it falls back to the recorded dates (and says so).
  * If the recorded expiry date has passed, the result is "expired":
    0 days remaining, and the original date is NOT replaced.

All functions are pure (no DB, no FastAPI) for testability.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Optional

from app.core.food_rules import (
    METHOD_LABELS,
    get_food_profile,
    infer_storage_method,
)
from app.models.freshness_assessment import FreshnessCategory
from app.models.storage_condition import ComplianceStatus

FRESHNESS_FACTORS = {
    FreshnessCategory.FRESH: 1.00,
    FreshnessCategory.GOOD: 1.00,
    FreshnessCategory.ACCEPTABLE: 0.85,
    FreshnessCategory.NEAR_SPOILAGE: 0.50,
    FreshnessCategory.SPOILED: 0.10,
}

STORAGE_FACTORS = {
    ComplianceStatus.SUITABLE: 1.00,
    ComplianceStatus.WARNING: 0.85,
    ComplianceStatus.CRITICAL: 0.60,
}

RISK_HIGH_DAYS = 3
RISK_MEDIUM_DAYS = 7

METHOD_SPECIFIC = "food_and_storage_specific_heuristic"
METHOD_FALLBACK_UNKNOWN = "date_based_fallback_unknown_food_or_storage"
METHOD_FALLBACK_UNSUPPORTED = "date_based_fallback_unsupported_storage_method"

_RISK_ORDER = {"Low": 0, "Medium": 1, "High": 2}


@dataclass
class ShelfLifeResult:
    remaining_shelf_life_days: int
    original_expiry_date: date
    analysis_date: date
    forecasted_expiry_date: date
    is_expired: bool
    risk_level: str
    factors: List[str]
    risk_reasons: List[str] = field(default_factory=list)
    matched_food_rule: Optional[str] = None
    storage_method_used: Optional[str] = None
    method: str = METHOD_FALLBACK_UNKNOWN


def _raise_risk(current: str, minimum: str) -> str:
    return minimum if _RISK_ORDER[minimum] > _RISK_ORDER[current] else current


def estimate_shelf_life(
    food_name: Optional[str],
    category: Optional[str],
    purchase_date: date,
    expiry_date: date,
    as_of: date,
    freshness_category: Optional[FreshnessCategory] = None,
    storage_status: Optional[ComplianceStatus] = None,
    storage_temperature_celsius: Optional[float] = None,
    storage_location_text: Optional[str] = None,
    trend_direction: Optional[str] = None,
) -> ShelfLifeResult:
    is_expired = expiry_date < as_of
    nominal = max((expiry_date - as_of).days, 0)
    age_days = max((as_of - purchase_date).days, 0)

    factors: List[str] = [
        f"Recorded purchase date: {purchase_date.isoformat()}; recorded expiry date: "
        f"{expiry_date.isoformat()}; analysis date: {as_of.isoformat()}."
    ]
    risk_reasons: List[str] = []

    # ---- expired: never extend or replace the printed date ----
    if is_expired:
        factors.append(
            f"The recorded expiry date passed {(as_of - expiry_date).days} day(s) before the "
            "analysis date, so remaining shelf life is 0 days. The original date is kept as recorded."
        )
        return ShelfLifeResult(
            remaining_shelf_life_days=0,
            original_expiry_date=expiry_date,
            analysis_date=as_of,
            forecasted_expiry_date=expiry_date,
            is_expired=True,
            risk_level="High",
            factors=factors,
            risk_reasons=["The recorded expiry date has passed."],
            method=METHOD_FALLBACK_UNKNOWN,
        )

    # ---- choose the rule basis ----
    profile, specific = get_food_profile(food_name, category)
    storage_method = infer_storage_method(storage_temperature_celsius, storage_location_text)

    baseline = nominal
    method = METHOD_FALLBACK_UNKNOWN
    matched = profile.label if profile else None

    if profile is None:
        factors.append(
            "No food-specific or category rule matches this item, so the recorded expiry date "
            "is used as the baseline."
        )
    elif storage_method is None:
        factors.append(
            f"A rule exists for '{profile.label}', but the storage method is unknown (no temperature "
            "reading and the storage location does not indicate refrigerated, frozen or room "
            "temperature), so the recorded expiry date is used as the baseline."
        )
    elif storage_method not in profile.shelf_life_days:
        method = METHOD_FALLBACK_UNSUPPORTED
        factors.append(
            f"The rule for '{profile.label}' has no figure for {METHOD_LABELS[storage_method].lower()} "
            "storage, so the recorded expiry date is used as the baseline."
        )
    else:
        typical_total = profile.shelf_life_days[storage_method]
        typical_remaining = max(typical_total - age_days, 0)
        baseline = min(nominal, typical_remaining)
        method = METHOD_SPECIFIC
        origin = "food-specific" if specific else "category"
        source = (
            f"recorded temperature {storage_temperature_celsius:.1f}C"
            if storage_temperature_celsius is not None
            else f"storage location '{storage_location_text}'"
        )
        factors.append(
            f"Applied the {origin} rule for '{profile.label}' under "
            f"{METHOD_LABELS[storage_method].lower()} storage (from {source}): typically about "
            f"{typical_total} day(s) in total from purchase; the item is {age_days} day(s) old, "
            f"so about {typical_remaining} day(s) remain by that rule."
        )
        if typical_total == 0:
            risk_reasons.append(
                f"{profile.label} are generally not suitable for {METHOD_LABELS[storage_method].lower()} storage."
            )
        if typical_remaining < nominal:
            factors.append(
                f"The rule gives less time than the recorded expiry ({nominal} day(s)), so the "
                "shorter value is used. The recorded date is never extended."
            )
        else:
            factors.append(
                f"The recorded expiry ({nominal} day(s) remaining) is the earlier limit, so it is used."
            )

    factors.append(f"Time remaining until the recorded expiry date: {nominal} day(s).")

    # ---- multipliers ----
    ff = FRESHNESS_FACTORS.get(freshness_category, 1.00) if freshness_category else 1.00
    sf = STORAGE_FACTORS.get(storage_status, 1.00) if storage_status else 1.00
    if freshness_category:
        factors.append(
            f"Latest freshness category '{freshness_category.value}' (heuristic image analysis) "
            f"applied a {ff:.2f}x adjustment."
        )
    else:
        factors.append("No freshness assessment exists, so no visual adjustment was applied.")
    if storage_status:
        factors.append(
            f"Latest storage compliance '{storage_status.value}' applied a {sf:.2f}x adjustment."
        )
    else:
        factors.append("No storage readings exist, so no storage-compliance adjustment was applied.")

    remaining = max(0, min(int(baseline * ff * sf), nominal))
    forecast = as_of + timedelta(days=remaining)

    # ---- risk ----
    if remaining <= RISK_HIGH_DAYS:
        risk = "High"
        risk_reasons.append(f"Estimated remaining shelf life is {remaining} day(s) (3 or fewer).")
    elif remaining <= RISK_MEDIUM_DAYS:
        risk = "Medium"
        risk_reasons.append(f"Estimated remaining shelf life is {remaining} day(s) (7 or fewer).")
    else:
        risk = "Low"
        risk_reasons.append(f"Estimated remaining shelf life is {remaining} day(s) (more than 7).")

    if freshness_category == FreshnessCategory.SPOILED:
        risk = _raise_risk(risk, "High")
        risk_reasons.append("The latest image analysis detected spoilage indicators.")
    elif freshness_category == FreshnessCategory.NEAR_SPOILAGE:
        risk = _raise_risk(risk, "Medium")
        risk_reasons.append("The latest image analysis indicates the item is near spoilage.")
    if storage_status == ComplianceStatus.CRITICAL:
        risk = _raise_risk(risk, "Medium")
        risk_reasons.append("The latest recorded storage conditions are critical.")
    elif storage_status == ComplianceStatus.WARNING:
        risk_reasons.append("The latest recorded storage conditions need attention.")
    if trend_direction == "declining":
        risk = _raise_risk(risk, "Medium")
        risk_reasons.append("The freshness score declined between the two most recent images.")
    risk_reasons.append(
        "This is an estimate. A low risk level or a good-looking image does not prove the food is safe to eat."
    )

    return ShelfLifeResult(
        remaining_shelf_life_days=remaining,
        original_expiry_date=expiry_date,
        analysis_date=as_of,
        forecasted_expiry_date=forecast,
        is_expired=False,
        risk_level=risk,
        factors=factors,
        risk_reasons=risk_reasons,
        matched_food_rule=matched,
        storage_method_used=storage_method,
        method=method,
    )


def product_age_score(purchase_date: date, expiry_date: date, as_of: date) -> float:
    total_days = max((expiry_date - purchase_date).days, 1)
    age_days = max((as_of - purchase_date).days, 0)
    remaining_ratio = max(0.0, 1.0 - (age_days / total_days))
    return round(remaining_ratio * 100.0, 1)


def shelf_life_score(remaining_days: int, purchase_date: date, expiry_date: date) -> float:
    total_days = max((expiry_date - purchase_date).days, 1)
    return round(max(0.0, min(1.0, remaining_days / total_days)) * 100.0, 1)
