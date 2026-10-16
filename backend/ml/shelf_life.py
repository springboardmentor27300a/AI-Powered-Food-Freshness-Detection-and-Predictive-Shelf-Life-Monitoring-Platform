"""
Shelf-Life Estimation Engine (Milestone 3).

PARAMETRIC, DETERMINISTIC ESTIMATION - not a trained ML model.
Method (priority per project rules): no ground-truth dataset is available, so the
engine uses evidence-based Q10/Arrhenius parametric estimation over author-defined
industry-typical category guidance. Every output is labeled an ESTIMATE.

Formula:
  estimated_total_life = base_days
                         * packaging_factor         (barrier slows aging)
                         * Q10^((T_ref - T)/10)     (Arrhenius temperature rule)
                         * (1 - humidity_penalty)   (dry air accelerates water loss)
                         * freshness_factor         (visual quality from ML/CV scan)

  estimated_remaining   = max(0, estimated_total_life - storage_duration_days)
  effective_remaining   = min(estimated_remaining, label_expiry_days)   # label is a hard ceiling

Storage duration explicitly reduces remaining life. Outputs are clamped to
[0, 365] days and every response carries provenance and disclaimer fields.
"""
from datetime import datetime, timezone, date

from ml.storage_standards import CATEGORY_STORAGE_PROFILES, PACKAGING_ALIASES

# Q10 temperature coefficient: spoilage rate roughly doubles per 10 C.
Q10 = 2.0
MAX_OUTPUT_DAYS = 365.0

DEFAULT_PACKAGING = "Ventilated"
FRESHNESS_FLOOR = 0.15

FROZEN_THRESHOLD_C = -18.0

ESTIMATE_LABEL = "Estimated Remaining Shelf Life"
ESTIMATE_DISCLAIMER = (
    "Parametric Q10 estimate, not a guaranteed safe-life date. Based on author-defined "
    "industry-typical category guidance; no ground-truth shelf-life dataset was used."
)
CONFIDENCE_EXPLANATION = (
    "Prediction Confidence is an input-completeness heuristic: it starts at 85 and is reduced "
    "for each missing input (temperature -10, humidity -8, quality -12, label expiry -5, "
    "storage timestamp -3), floored at 20. It is NOT a measured prediction accuracy."
)
METRICS_NOTE = {
    "mae": None,
    "forecast_accuracy": None,
    "note": "MAE: Not measured - no ground-truth shelf-life dataset available.",
}


def _parse_datetime(value):
    """Parse a datetime from ISO string, datetime or date. Returns None on failure."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            try:
                parsed = datetime.strptime(text[:10], "%Y-%m-%d")
            except ValueError:
                return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def normalize_packaging(packaging_type):
    """Map free-form packaging input to a canonical packaging family."""
    if not packaging_type:
        return DEFAULT_PACKAGING
    key = str(packaging_type).strip().lower()
    return PACKAGING_ALIASES.get(key, str(packaging_type).strip().title())


def _reference_temperature(profile):
    return (profile["temp_min"] + profile["temp_max"]) / 2.0


def _temperature_factor(profile, temperature_c):
    """Arrhenius Q10 multiplier. >1.0 when colder than reference, <1.0 when warmer."""
    if temperature_c is None:
        return 1.0, None
    ref_temp = _reference_temperature(profile)
    factor = Q10 ** ((ref_temp - float(temperature_c)) / 10.0)
    # Clamp against unphysical extremes
    factor = max(0.05, min(3.0, factor))
    return factor, ref_temp


def _storage_regime(profile, temperature_c):
    """Describe the storage regime relative to the category's optimal band."""
    if temperature_c is None:
        return "unknown", []
    t = float(temperature_c)
    if t <= FROZEN_THRESHOLD_C:
        return "frozen", [
            "Frozen regime: the Q10 extrapolation from chilled guidance likely UNDER-estimates "
            "true frozen shelf life; no frozen ground-truth data is available."
        ]
    if profile["temp_min"] <= t <= profile["temp_max"]:
        return "within_optimal", []
    if t < profile["temp_min"]:
        return "cooler_than_optimal", []
    return "warmer_than_optimal", []


def _humidity_penalty(profile, humidity_pct):
    """Fraction of shelf life lost to sub-optimal humidity (0.0 - 0.9)."""
    if humidity_pct is None:
        return 0.0
    humidity = float(humidity_pct)
    h_min, h_max = profile["humidity_min"], profile["humidity_max"]
    if h_min <= humidity <= h_max:
        return 0.0
    if humidity < h_min:
        # Dry air: water loss accelerates aging
        deficit = (h_min - humidity) / 100.0
        return min(0.9, deficit * 0.5)
    # Excess humidity: condensation + mold acceleration
    excess = (humidity - h_max) / 100.0
    return min(0.9, excess * 0.6)


def _freshness_factor(quality_score, ml_status):
    """Map the Milestone-2 quality score (0-100) to a life-retention factor."""
    if quality_score is None:
        return 1.0 if ml_status != "Rotten" else FRESHNESS_FLOOR
    score = max(0.0, min(100.0, float(quality_score)))
    if ml_status == "Rotten":
        return FRESHNESS_FLOOR
    return max(FRESHNESS_FLOOR, score / 100.0)


def predict_shelf_life(payload: dict) -> dict:
    """
    Estimate remaining shelf life for a food item.

    Expected payload keys (all optional unless noted):
      name, category (required), quantity, batch_number,
      quality_score, ml_status, temperature_c, humidity_pct,
      packaging_type, stored_at, expiry_date
    """
    category = payload.get("category", "Packaged Foods")
    profile = CATEGORY_STORAGE_PROFILES.get(category, CATEGORY_STORAGE_PROFILES["Packaged Foods"])

    base_days = profile["max_shelf_life_days"]
    packaging = normalize_packaging(payload.get("packaging_type"))
    packaging_factor = profile["packaging_factors"].get(packaging, 1.0)

    temp_c = payload.get("temperature_c")
    humidity = payload.get("humidity_pct")
    quality_score = payload.get("quality_score")
    ml_status = payload.get("ml_status", "Unknown") or "Unknown"

    temp_factor, ref_temp = _temperature_factor(profile, temp_c)
    hum_penalty = _humidity_penalty(profile, humidity)
    fresh_factor = _freshness_factor(quality_score, ml_status)
    regime, regime_notes = _storage_regime(profile, temp_c)

    # Elapsed storage duration must reduce remaining life
    now = datetime.now(timezone.utc)
    stored_at = _parse_datetime(payload.get("stored_at"))
    storage_duration_days = None
    if stored_at is not None:
        elapsed = (now - stored_at).total_seconds() / 86400.0
        storage_duration_days = round(max(0.0, elapsed), 1)

    estimated_total_days = base_days * packaging_factor * temp_factor * (1.0 - hum_penalty) * fresh_factor

    capped = False
    if estimated_total_days > MAX_OUTPUT_DAYS:
        estimated_total_days = MAX_OUTPUT_DAYS
        capped = True

    if storage_duration_days is None:
        remaining_days = round(estimated_total_days, 1)
        duration_applied = False
    else:
        remaining_days = round(max(0.0, estimated_total_days - storage_duration_days), 1)
        duration_applied = True
    if remaining_days > MAX_OUTPUT_DAYS:
        remaining_days = MAX_OUTPUT_DAYS
        capped = True

    predicted_expiry = now.timestamp() + remaining_days * 86400.0
    predicted_expiry_dt = datetime.fromtimestamp(predicted_expiry, tz=timezone.utc)

    label_expiry = _parse_datetime(payload.get("expiry_date"))

    label_expiry_days = None
    if label_expiry:
        label_expiry_days = max(0.0, round((label_expiry - now).total_seconds() / 86400.0, 1))

    # Conservative view: never claim more life than the label allows
    effective_days = remaining_days
    if label_expiry_days is not None:
        effective_days = min(remaining_days, label_expiry_days)
        effective_days = max(0.0, round(effective_days, 1))

    base = base_days * packaging_factor if base_days > 0 else 1.0
    ratio = effective_days / base
    if effective_days <= 0:
        risk = "Critical"
    elif ratio < 0.10:
        risk = "Critical"
    elif ratio < 0.30:
        risk = "High"
    elif ratio < 0.60:
        risk = "Medium"
    else:
        risk = "Low"

    if ml_status == "Rotten" and risk in ("Low", "Medium"):
        risk = "High"

    confidence = 85.0
    if temp_c is None:
        confidence -= 10.0
    if humidity is None:
        confidence -= 8.0
    if quality_score is None:
        confidence -= 12.0
    if label_expiry is None:
        confidence -= 5.0
    if storage_duration_days is None:
        confidence -= 3.0
    confidence = max(20.0, round(confidence, 1))

    return {
        "category": category,
        "ml_status": ml_status,
        "base_shelf_life_days": base_days,
        "packaging_type": packaging,
        "packaging_factor": packaging_factor,
        "temperature_c": temp_c,
        "humidity_pct": humidity,
        "reference_temperature_c": round(ref_temp, 1) if ref_temp is not None else None,
        "temperature_factor": round(temp_factor, 3),
        "humidity_penalty": round(hum_penalty, 3),
        "freshness_factor": round(fresh_factor, 3),
        "storage_regime": regime,
        "regime_notes": regime_notes,
        "estimated_total_life_days": round(estimated_total_days, 1),
        "storage_duration_days": storage_duration_days,
        "duration_applied": duration_applied,
        "estimated_remaining_days": remaining_days,
        "predicted_remaining_days": remaining_days,
        "effective_remaining_days": effective_days,
        "predicted_expiry_date": predicted_expiry_dt.isoformat(),
        "label_expiry_date": label_expiry.isoformat() if label_expiry else None,
        "label_expiry_in_days": label_expiry_days,
        "risk_level": risk,
        "prediction_confidence": confidence,
        "estimate_label": ESTIMATE_LABEL,
        "estimate_disclaimer": ESTIMATE_DISCLAIMER,
        "confidence_explanation": CONFIDENCE_EXPLANATION,
        "metrics_note": METRICS_NOTE,
        "source_type": "parametric_estimate",
        "guidance_source": (
            "Author-defined industry-typical category values (ml/storage_standards.py); "
            "no cited dataset, closest category used when exact match unavailable"
            if category not in CATEGORY_STORAGE_PROFILES else
            "Author-defined industry-typical category values (ml/storage_standards.py); no cited dataset"
        ),
        "output_capped": capped,
        "model": "Q10-Arrhenius + packaging/humidity/freshness multipliers - duration-subtracted (v2)",
    }


def batch_predict(items: list) -> list:
    """Estimate shelf life for a list of item payloads."""
    return [predict_shelf_life(item) for item in items]
