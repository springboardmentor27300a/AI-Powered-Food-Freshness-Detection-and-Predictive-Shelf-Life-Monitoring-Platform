"""
Storage Condition Monitoring Engine (Milestone 3).

Validates current storage conditions against category-specific optimal ranges
(temperature, humidity, air circulation, light exposure), computes a
storage-condition score, and derives storage optimization recommendations.
"""
from ml.storage_standards import (
    CATEGORY_STORAGE_PROFILES,
    AIR_CIRCULATION_LEVELS,
    LIGHT_EXPOSURE_LEVELS,
)

# Circulation rank: Low=0, Moderate=1, High=2
_CIRC_RANK = {level: rank for rank, level in enumerate(AIR_CIRCULATION_LEVELS)}
_LIGHT_RANK = {level: rank for rank, level in enumerate(LIGHT_EXPOSURE_LEVELS)}

_SEVERITY_PRIORITY = {"severe": "high", "moderate": "medium", "minor": "low", "info": "low"}


def _temperature_check(profile, temperature_c):
    if temperature_c is None:
        return {
            "parameter": "temperature", "value": None,
            "optimal_range": [profile["temp_min"], profile["temp_max"]],
            "unit": "C", "status": "Unknown", "severity": "none",
            "penalty": 0.0, "compliant": False, "not_recorded": True,
        }
    t = float(temperature_c)
    in_range = profile["temp_min"] <= t <= profile["temp_max"]
    if in_range:
        penalty, status, severity = 0.0, "Optimal", "none"
    else:
        span = max(profile["temp_max"] - profile["temp_min"], 1.0)
        deviation = (profile["temp_min"] - t) if t < profile["temp_min"] else (t - profile["temp_max"])
        ratio = deviation / span
        if ratio <= 0.5:
            penalty, status, severity = 15.0, "Suboptimal", "minor"
        elif ratio <= 1.5:
            penalty, status, severity = 30.0, "Suboptimal", "moderate"
        else:
            penalty, status, severity = 50.0, "Critical", "severe"
    return {
        "parameter": "temperature", "value": t,
        "optimal_range": [profile["temp_min"], profile["temp_max"]],
        "unit": "C", "status": status, "severity": severity,
        "penalty": penalty, "compliant": in_range,
    }


def _humidity_check(profile, humidity_pct):
    if humidity_pct is None:
        return {
            "parameter": "humidity", "value": None,
            "optimal_range": [profile["humidity_min"], profile["humidity_max"]],
            "unit": "%", "status": "Unknown", "severity": "none",
            "penalty": 0.0, "compliant": False, "not_recorded": True,
        }
    h = float(humidity_pct)
    in_range = profile["humidity_min"] <= h <= profile["humidity_max"]
    if in_range:
        penalty, status, severity = 0.0, "Optimal", "none"
    else:
        span = max(profile["humidity_max"] - profile["humidity_min"], 1.0)
        deviation = (profile["humidity_min"] - h) if h < profile["humidity_min"] else (h - profile["humidity_max"])
        ratio = deviation / span
        if ratio <= 0.5:
            penalty, status, severity = 10.0, "Suboptimal", "minor"
        elif ratio <= 1.5:
            penalty, status, severity = 25.0, "Suboptimal", "moderate"
        else:
            penalty, status, severity = 40.0, "Critical", "severe"
    return {
        "parameter": "humidity", "value": h,
        "optimal_range": [profile["humidity_min"], profile["humidity_max"]],
        "unit": "%", "status": status, "severity": severity,
        "penalty": penalty, "compliant": in_range,
    }


def _circulation_check(profile, air_circulation):
    if not air_circulation:
        return {
            "parameter": "air_circulation", "value": None,
            "optimal_value": profile["air_circulation"], "unit": None,
            "status": "Unknown", "severity": "none",
            "penalty": 0.0, "compliant": False, "not_recorded": True,
        }
    value = str(air_circulation).strip().title()
    known = value in _CIRC_RANK
    compliant = value == profile["air_circulation"]
    if compliant:
        penalty, status, severity = 0.0, "Optimal", "none"
    elif not known:
        penalty, status, severity = 10.0, "Unknown value", "minor"
    else:
        # One level off = minor drift; two levels = severe
        distance = abs(_CIRC_RANK[value] - _CIRC_RANK[profile["air_circulation"]])
        penalty, severity = (10.0, "minor") if distance == 1 else (25.0, "severe")
        status = "Suboptimal"
    return {
        "parameter": "air_circulation", "value": value,
        "optimal_value": profile["air_circulation"], "unit": None,
        "status": status, "severity": severity,
        "penalty": penalty, "compliant": compliant,
    }


def _light_check(profile, light_exposure):
    if not light_exposure:
        return {
            "parameter": "light_exposure", "value": None,
            "optimal_value": profile["light_exposure"], "unit": None,
            "status": "Unknown", "severity": "none",
            "penalty": 0.0, "compliant": False, "not_recorded": True,
        }
    value = str(light_exposure).strip().title()
    known = value in _LIGHT_RANK
    compliant = value == profile["light_exposure"]
    if compliant:
        penalty, status, severity = 0.0, "Optimal", "none"
    elif not known:
        penalty, status, severity = 5.0, "Unknown value", "minor"
    else:
        distance = abs(_LIGHT_RANK[value] - _LIGHT_RANK[profile["light_exposure"]])
        penalty, severity = (5.0, "minor") if distance == 1 else (15.0, "severe")
        status = "Suboptimal"
    return {
        "parameter": "light_exposure", "value": value,
        "optimal_value": profile["light_exposure"], "unit": None,
        "status": status, "severity": severity,
        "penalty": penalty, "compliant": compliant,
    }


def validate_storage_conditions(
    category: str,
    temperature_c=None,
    humidity_pct=None,
    air_circulation=None,
    light_exposure=None,
) -> dict:
    """
    Validate a storage environment for a food category.

    Returns per-parameter compliance checks, an overall storage score (0-100),
    a compliance status, and optimization recommendations.
    """
    profile = CATEGORY_STORAGE_PROFILES.get(category) or CATEGORY_STORAGE_PROFILES["Packaged Foods"]

    checks = [
        _temperature_check(profile, temperature_c),
        _humidity_check(profile, humidity_pct),
        _circulation_check(profile, air_circulation),
        _light_check(profile, light_exposure),
    ]

    recorded = [c for c in checks if not c.get("not_recorded")]
    total_penalty = sum(c["penalty"] for c in recorded)
    storage_score = round(max(0.0, 100.0 - total_penalty), 1)

    has_missing = len(recorded) < len(checks)
    if not recorded:
        compliance_status = "Unknown"
    elif any(c["status"] == "Critical" for c in recorded):
        compliance_status = "Non-Compliant"
    elif all(c["compliant"] for c in recorded):
        # Full compliance only when every parameter was actually recorded
        compliance_status = "Partially Compliant" if has_missing else "Compliant"
    else:
        compliance_status = "Partially Compliant"

    # ------------- Optimization recommendations -----------------------------
    recommendations = []
    for check in recorded:
        if check["compliant"]:
            continue
        param = check["parameter"]
        if param == "temperature":
            target = check["optimal_range"]
            direction = "lower" if check["value"] > target[1] else "raise"
            urgency = "Immediately " if check["status"] == "Critical" else ""
            recommendations.append({
                "type": "storage_fix",
                "parameter": param,
                "action": f"{urgency}{direction} storage temperature to {target[0]}-{target[1]} C.",
                "severity": check["severity"],
                "priority": _SEVERITY_PRIORITY.get(check["severity"], "low"),
            })
        elif param == "humidity":
            target = check["optimal_range"]
            direction = "reduce" if check["value"] > target[1] else "increase"
            recommendations.append({
                "type": "storage_fix",
                "parameter": param,
                "action": f"{direction.capitalize()} relative humidity to {target[0]}-{target[1]}%.",
                "severity": check["severity"],
                "priority": _SEVERITY_PRIORITY.get(check["severity"], "low"),
            })
        elif param == "air_circulation":
            recommendations.append({
                "type": "storage_fix",
                "parameter": param,
                "action": f"Adjust air circulation to {profile['air_circulation']}.",
                "severity": check["severity"],
                "priority": _SEVERITY_PRIORITY.get(check["severity"], "low"),
            })
        elif param == "light_exposure":
            recommendations.append({
                "type": "storage_fix",
                "parameter": param,
                "action": f"Reduce light exposure to {profile['light_exposure'].lower()} conditions.",
                "severity": check["severity"],
                "priority": _SEVERITY_PRIORITY.get(check["severity"], "low"),
            })

    # Unknown parameters -> prompt recording
    for check in checks:
        if check.get("not_recorded"):
            recommendations.append({
                "type": "data_capture",
                "parameter": check["parameter"],
                "action": f"Record {check['parameter'].replace('_', ' ')} readings to enable full compliance validation.",
                "severity": "info",
                "priority": "low",
            })

    return {
        "category": category,
        "optimal_ranges": {
            "temperature_c": [profile["temp_min"], profile["temp_max"]],
            "humidity_pct": [profile["humidity_min"], profile["humidity_max"]],
            "air_circulation": profile["air_circulation"],
            "light_exposure": profile["light_exposure"],
        },
        "checks": checks,
        "storage_score": storage_score,
        "compliance_status": compliance_status,
        "recommendations": recommendations,
    }
