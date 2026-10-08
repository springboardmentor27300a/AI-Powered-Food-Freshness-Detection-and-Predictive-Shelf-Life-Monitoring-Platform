"""
Storage condition monitoring and compliance analysis (Milestone 3).

Analyzes temperature, humidity, air circulation, light exposure and storage
duration against the configurable per-category rules and produces:
  - per-parameter status + explanations,
  - an overall storage compliance score (0-100),
  - a shelf-life adjustment (days) used by the prediction engine,
  - actionable optimization recommendations.

Everything is deterministic and read-only: storage history is recorded through
the /storage endpoints and the StorageReading model.
"""
from dataclasses import dataclass
from datetime import date

from app.constants import AIR_CIRCULATION_OPTIONS, DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN, LIGHT_EXPOSURE_OPTIONS
from app.services.storage_rules import StorageRule, get_storage_rule

# Sub-score per status used to build the compliance score.
STATUS_SCORES = {"good": 100, "warning": 55, "critical": 15}

# Per-component weights (renormalized when some components are unknown/na).
COMPONENT_WEIGHTS = {
    "temperature": 0.30,
    "humidity": 0.20,
    "air_circulation": 0.12,
    "light_exposure": 0.08,
    "duration": 0.15,
    "packaging": 0.075,
    "storage_environment": 0.075,
}

@dataclass
class ParameterStatus:
    value: float | str | None
    recommended: str
    status: str
    explanation: str
    assessment: str = ""
    impact: str = ""
    recommendation: str = ""


@dataclass
class StorageAnalysis:
    batch_id: str
    food_name: str
    category: str
    rule: StorageRule
    temperature: ParameterStatus
    humidity: ParameterStatus
    air_circulation: ParameterStatus
    light_exposure: ParameterStatus
    duration: ParameterStatus
    packaging: ParameterStatus
    storage_environment: ParameterStatus
    compliance_score: int
    sub_scores: dict
    shelf_life_delta_days: int
    optimization_recommendations: list[str]
    has_storage_data: bool
    condition_status: str
    condition_summary: str
    shelf_life_impact: str
    storage_start_date: date
    current_date: date
    days_stored: int
    remaining_storage_duration_days: int


class StorageAnalyzer:
    """Evaluates storage conditions for one batch against category rules."""

    def analyze(
        self,
        batch_id: str,
        food_name: str,
        category: str | None,
        received_date: date,
        temperature_c: float | None = None,
        humidity_pct: float | None = None,
        air_circulation: str | None = None,
        light_exposure: str | None = None,
        packaging_type: str | None = None,
        storage_location: str | None = None,
        today: date | None = None,
    ) -> StorageAnalysis:
        rule = get_storage_rule(category, food_name)
        reference = today or date.today()

        temp_status = self._temperature(temperature_c, rule)
        humidity_status = self._humidity(humidity_pct, rule)
        air_status = self._air(air_circulation, rule)
        light_status = self._light(light_exposure, rule)
        duration_status = self._duration(received_date, rule, reference)
        packaging_status = self._packaging(packaging_type, rule)
        environment_status = self._storage_environment(storage_location, rule)

        components = {
            "temperature": temp_status,
            "humidity": humidity_status,
            "air_circulation": air_status,
            "light_exposure": light_status,
            "duration": duration_status,
            "packaging": packaging_status,
            "storage_environment": environment_status,
        }
        has_sensor_data = any(
            components[param].status not in ("unknown", "not_applicable")
            for param in ("temperature", "humidity", "air_circulation", "light_exposure")
        )
        has_storage_data = has_sensor_data or bool(packaging_type or storage_location)
        if has_storage_data:
            compliance, sub_scores, _measured = self._compliance(components)
        else:
            compliance = DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN
            sub_scores = {name: None for name in components}

        recommendations = self._recommendations(
            rule,
            temp_status,
            humidity_status,
            air_status,
            light_status,
            duration_status,
            packaging_status,
            environment_status,
        )
        delta = self._shelf_life_delta(
            temp_status,
            humidity_status,
            air_status,
            light_status,
            duration_status,
            packaging_status,
            environment_status,
            compliance,
        )
        condition_status = self._condition_status(components, compliance, has_storage_data)
        days_stored = max(0, (reference - received_date).days)
        remaining_duration = max(0, rule.max_storage_days - days_stored)

        return StorageAnalysis(
            batch_id=batch_id,
            food_name=food_name,
            category=category or "Unknown",
            rule=rule,
            temperature=temp_status,
            humidity=humidity_status,
            air_circulation=air_status,
            light_exposure=light_status,
            duration=duration_status,
            packaging=packaging_status,
            storage_environment=environment_status,
            compliance_score=compliance,
            sub_scores=sub_scores,
            shelf_life_delta_days=delta,
            optimization_recommendations=recommendations,
            has_storage_data=has_storage_data,
            condition_status=condition_status,
            condition_summary=self._condition_summary(components, condition_status),
            shelf_life_impact=self._shelf_life_impact(components),
            storage_start_date=received_date,
            current_date=reference,
            days_stored=days_stored,
            remaining_storage_duration_days=remaining_duration,
        )

    # ------------------------------------------------------------------
    # Per-parameter evaluation
    # ------------------------------------------------------------------
    def _temperature(self, value, rule: StorageRule) -> ParameterStatus:
        recommended = self._temp_range(rule)
        if value is None:
            return ParameterStatus(
                None, recommended, "unknown",
                "Temperature has not been recorded for this batch.",
                "NOT_RECORDED", "Shelf-life impact cannot be assessed from temperature alone.",
                "Record the current storage temperature.",
            )
        if rule.temp_min_c is None or rule.temp_max_c is None:
            return ParameterStatus(
                value, recommended, "not_applicable",
                "No specific temperature range is defined for this product rule.",
                "NOT_DEFINED", "No temperature penalty is applied.",
                "Follow the product label or supplier storage instructions.",
            )
        margin = 3.0
        if rule.temp_min_c <= value <= rule.temp_max_c:
            return ParameterStatus(
                value, recommended, "good",
                f"Temperature ({value:g}°C) is within the recommended range.",
                "SUITABLE", "No major temperature-related shelf-life penalty is expected.",
                f"Maintain temperature near the recommended {rule.recommended_temperature():g}°C.",
            )
        direction = "high" if value > rule.temp_max_c else "low"
        if rule.temp_min_c - margin <= value <= rule.temp_max_c + margin:
            return ParameterStatus(
                value, recommended, "warning",
                f"Temperature ({value:g}°C) is slightly outside the recommended range.",
                f"TOO {direction.upper()}",
                "Shelf life may decrease if this condition continues.",
                f"Adjust temperature toward {recommended}.",
            )
        if direction == "high":
            impact = "Temperature above the recommended range may accelerate freshness degradation."
            recommendation = f"Reduce storage temperature to {recommended} and use the recommended storage environment."
        else:
            impact = "Temperature below the recommended range may cause chilling or freezing damage."
            recommendation = f"Increase temperature toward {recommended} and avoid freezing exposure."
        return ParameterStatus(
            value, recommended, "critical",
            f"Temperature ({value:g}°C) is too {direction}; recommended: {recommended}.",
            f"TOO {direction.upper()}", impact, recommendation,
        )

    def _humidity(self, value, rule: StorageRule) -> ParameterStatus:
        recommended = self._humidity_range(rule)
        if value is None:
            return ParameterStatus(
                None, recommended, "unknown",
                "Humidity has not been recorded for this batch.",
                "NOT_RECORDED", "Moisture-related shelf-life impact cannot be assessed.",
                "Record the current relative humidity.",
            )
        if rule.humidity_min_pct is None and rule.humidity_max_pct is None:
            return ParameterStatus(
                value, recommended, "not_applicable",
                "No specific humidity range is defined for this product rule.",
                "NOT_DEFINED", "No humidity penalty is applied.",
                "Follow the product label or supplier storage instructions.",
            )
        below = rule.humidity_min_pct is not None and value < rule.humidity_min_pct
        above = rule.humidity_max_pct is not None and value > rule.humidity_max_pct
        if not below and not above:
            recommended_value = rule.recommended_humidity()
            maintain = (
                f"Maintain humidity near {recommended_value:g}%."
                if recommended_value is not None else "Maintain current humidity."
            )
            return ParameterStatus(
                value, recommended, "good",
                f"Humidity ({value:g}%) is within the recommended range.",
                "SUITABLE", "No major moisture-related shelf-life penalty is expected.", maintain,
            )
        direction = "high" if above else "low"
        margin = 10.0
        severity = "warning"
        if direction == "high" and value > rule.humidity_max_pct + margin:
            severity = "critical"
        if direction == "low" and value < rule.humidity_min_pct - margin:
            severity = "critical"
        if direction == "high":
            impact = "High humidity may increase condensation and moisture-related spoilage risk."
            action = f"Reduce humidity toward {recommended}. Improve ventilation if moisture accumulates."
        else:
            impact = "Low humidity may increase moisture loss and quality deterioration."
            action = f"Increase humidity toward {recommended}. Reduce ventilation if moisture loss is excessive."
        return ParameterStatus(
            value, recommended, severity,
            f"Humidity ({value:g}%) is too {direction}; recommended: {recommended}.",
            f"TOO {direction.upper()}", impact, action,
        )

    def _air(self, value: str | None, rule: StorageRule) -> ParameterStatus:
        if value:
            value = value.strip().lower()
        recommended = rule.air_circulation_label()
        if value is None:
            return ParameterStatus(
                None, recommended, "unknown",
                "Air circulation has not been recorded for this batch.",
                "NOT_RECORDED", "Airflow-related deterioration risk cannot be assessed.",
                "Record whether airflow around the product is good, moderate or poor.",
            )
        if value not in {"good", "moderate", "poor"}:
            return ParameterStatus(
                value, recommended, "unknown",
                f"Unrecognised air circulation value '{value}'.",
                "NOT_RECOGNISED", "No air-circulation penalty is applied.",
                "Record air circulation as good, moderate or poor.",
            )
        if rule.air_circulation == "good":
            status = {"good": "good", "moderate": "warning", "poor": "critical"}[value]
        elif rule.air_circulation == "moderate":
            status = {"good": "good", "moderate": "good", "poor": "critical"}[value]
        else:
            status = {"good": "good", "moderate": "good", "poor": "warning"}[value]
        if status == "good":
            return ParameterStatus(
                value, recommended, "good",
                f"Air circulation ({value}) is suitable; requirement: {recommended}.",
                "SUITABLE", "No major air-circulation-related shelf-life penalty is expected.",
                "Maintain the current airflow arrangement.",
            )
        critical = status == "critical"
        impact = (
            "Poor air circulation may increase moisture accumulation, uneven cooling and spoilage risk."
            if critical else
            "Limited or stagnant airflow may affect cooling and moisture balance."
        )
        return ParameterStatus(
            value, recommended, status,
            f"Air circulation ({value}) does not match the requirement: {recommended}.",
            "INSUFFICIENT", impact,
            "Improve ventilation and avoid stagnant air around the product.",
        )

    def _light(self, value: str | None, rule: StorageRule) -> ParameterStatus:
        if value:
            value = value.strip().lower()
        recommended = rule.light_requirement
        if not rule.light_sensitive or recommended.lower() == "not applicable":
            return ParameterStatus(
                value, recommended, "not_applicable",
                "Light exposure is not a limiting factor in the configured rule for this product.",
                "NOT_APPLICABLE", "No light-related shelf-life penalty is applied.",
                "Continue following the product packaging instructions.",
            )
        if value is None:
            return ParameterStatus(
                None, recommended, "unknown",
                "Light exposure has not been recorded for this light-sensitive product.",
                "NOT_RECORDED", "Light-related quality risk cannot be assessed.",
                "Record current light exposure.",
            )
        suitable = {"appropriate", "low", "controlled"}
        excessive = {"high", "excessive"}
        if value in suitable:
            return ParameterStatus(
                value, recommended, "good",
                f"Light exposure ({value}) is suitable; requirement: {recommended}.",
                "SUITABLE", "No major light-related quality penalty is expected.",
                "Maintain the current light protection.",
            )
        if value in excessive or value == "moderate":
            return ParameterStatus(
                value, recommended, "warning",
                f"Light exposure ({value}) exceeds the product requirement: {recommended}.",
                "EXCESSIVE" if value in excessive else "TOO HIGH",
                "Excess light may accelerate quality deterioration for this product.",
                "Move the product away from direct light and use the required light protection.",
            )
        return ParameterStatus(
            value, recommended, "unknown",
            f"Unrecognised light exposure value '{value}'.",
            "NOT_RECOGNISED", "No light-related penalty is applied.",
            "Record light exposure as low, moderate, high, controlled or not applicable.",
        )

    def _duration(self, received_date: date, rule: StorageRule, today: date) -> ParameterStatus:
        days = max(0, (today - received_date).days)
        suitable = rule.shelf_life_days
        expected_max = rule.max_storage_days
        remaining = max(0, expected_max - days)
        recommended = f"{suitable} days suitable; maximum {expected_max} days"
        if days <= suitable:
            return ParameterStatus(
                f"{days} days", recommended, "good",
                f"Stored for {days} day(s), within the suitable {suitable}-day period.",
                "WITHIN_RANGE", "No duration-related shelf-life penalty is applied.",
                "Maintain suitable storage and use before the maximum duration.",
            )
        if days <= expected_max:
            return ParameterStatus(
                f"{days} days", recommended, "warning",
                f"Storage duration ({days} days) has passed the suitable period but is within the {expected_max}-day maximum.",
                "APPROACHING_LIMIT", "Shelf life may decrease if the batch remains stored beyond the suitable period.",
                "Prioritize this batch for sale or consumption before newer stock.",
            )
        return ParameterStatus(
            f"{days} days", recommended, "critical",
            f"Storage duration ({days} days) exceeds the expected maximum of {expected_max} days.",
            "EXCEEDED", "Extended storage increases spoilage and waste risk.",
            "Isolate the batch, prioritize safe use or disposal, and stop treating it as fresh stock.",
        )

    def _packaging(self, value: str | None, rule: StorageRule) -> ParameterStatus:
        if not value or not value.strip():
            return ParameterStatus(
                None, rule.packaging_requirement, "unknown",
                "Packaging has not been recorded.",
                "NOT_RECORDED", "Packaging-related protection cannot be assessed.",
                f"Use: {rule.packaging_requirement}.",
            )
        value = value.strip()
        if any(term in value.lower() for term in ("unsealed", "opened", "damaged", "torn", "leaking")):
            return ParameterStatus(
                value, rule.packaging_requirement, "critical",
                f"Packaging '{value}' is damaged, open or leaking.",
                "UNSAFE_OR_BROKEN", "Broken packaging can increase contamination, moisture loss and spoilage risk.",
                f"Replace it immediately with: {rule.packaging_requirement}.",
            )
        if self._matches_rule(value, rule.packaging_keywords):
            return ParameterStatus(
                value, rule.packaging_requirement, "good",
                f"Packaging '{value}' matches the configured reference guidance.",
                "SUITABLE", "Current packaging supports the expected handling and moisture exchange.",
                "Keep the packaging intact and clean.",
            )
        return ParameterStatus(
            value, rule.packaging_requirement, "warning",
            f"Packaging '{value}' needs review against the configured product guidance.",
            "REVIEW_REQUIRED", "Unsuitable packaging may increase moisture loss, contamination or physical damage risk.",
            f"Use suitable packaging: {rule.packaging_requirement}.",
        )

    def _storage_environment(self, value: str | None, rule: StorageRule) -> ParameterStatus:
        if not value or not value.strip():
            return ParameterStatus(
                None, rule.storage_environment, "unknown",
                "Storage environment has not been recorded.",
                "NOT_RECORDED", "Location suitability cannot be assessed.",
                f"Use: {rule.storage_environment}.",
            )
        value = value.strip()
        normalised = value.lower()
        refrigerated = any(term in normalised for term in ("refriger", "chilled", "freezer", "cold room", "cold storage"))
        if rule.refrigeration_required and not refrigerated:
            return ParameterStatus(
                value, rule.storage_environment, "warning",
                f"Storage location '{value}' does not identify refrigerated storage.",
                "REFRIGERATION_NOT_CONFIRMED", "Temperature abuse can rapidly reduce shelf life even if packaging is suitable.",
                f"Move the batch to: {rule.storage_environment}.",
            )
        if not rule.refrigeration_required and refrigerated and (rule.temp_min_c or 0) > 8:
            return ParameterStatus(
                value, rule.storage_environment, "warning",
                f"Storage location '{value}' appears refrigerated but this product rule expects ambient storage.",
                "ENVIRONMENT_MISMATCH", "Cold exposure may cause chilling damage for this product.",
                f"Move the batch to: {rule.storage_environment}.",
            )
        if self._matches_rule(value, rule.environment_keywords):
            return ParameterStatus(
                value, rule.storage_environment, "good",
                f"Storage location '{value}' matches the configured environment guidance.",
                "SUITABLE", "The recorded location is consistent with the storage rule.",
                "Continue monitoring conditions at this location.",
            )
        return ParameterStatus(
            value, rule.storage_environment, "warning",
            f"Storage location '{value}' needs review against the configured environment.",
            "REVIEW_REQUIRED", "An unsuitable environment may undermine temperature, humidity or light control.",
            f"Move the batch to: {rule.storage_environment}.",
        )

    @staticmethod
    def _matches_rule(value: str, keywords: tuple[str, ...]) -> bool:
        normalised = value.lower()
        return any(keyword.lower() in normalised for keyword in keywords)

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------
    def _compliance(self, components: dict) -> tuple[int, dict, bool]:
        """Weighted compliance score, skipping unmeasured/na components."""
        total_w = 0.0
        acc = 0.0
        sub_scores = {}
        measured = False
        for name, status in components.items():
            if status.status in ("unknown", "not_applicable"):
                sub_scores[name] = None
                continue
            measured = True
            score = STATUS_SCORES.get(status.status, 50)
            w = COMPONENT_WEIGHTS[name]
            acc += score * w
            total_w += w
            sub_scores[name] = score
        if total_w == 0:
            return DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN, sub_scores, measured
        return int(round(acc / total_w)), sub_scores, measured

    @staticmethod
    def _condition_status(components: dict, compliance: int, has_storage_data: bool) -> str:
        if not has_storage_data:
            return "UNKNOWN"
        statuses = [parameter.status for parameter in components.values()]
        if "critical" in statuses:
            return "CRITICAL"
        warnings = sum(1 for status in statuses if status == "warning")
        if compliance < 60 or warnings >= 2:
            return "UNSUITABLE"
        if compliance < 80 or warnings:
            return "WARNING"
        return "GOOD"

    @staticmethod
    def _condition_summary(components: dict, condition_status: str) -> str:
        if condition_status == "GOOD":
            return "Recorded storage conditions match the configured product rule."
        if condition_status == "UNKNOWN":
            return "Storage conditions have not been recorded for this batch."
        issues = [
            parameter.assessment
            for parameter in components.values()
            if parameter.status in {"warning", "critical"} and parameter.assessment
        ]
        if not issues:
            return f"Storage compliance is {condition_status.lower()} based on the weighted factor score."
        return f"Storage condition is {condition_status.lower()}: {', '.join(issues)}."

    @staticmethod
    def _shelf_life_impact(components: dict) -> str:
        statuses = [parameter.status for parameter in components.values()]
        if "critical" in statuses:
            return "HIGH"
        if "warning" in statuses:
            return "MODERATE"
        return "LOW"

    def _shelf_life_delta(
        self,
        temp,
        hum,
        air,
        light,
        duration,
        packaging,
        environment,
        compliance,
    ) -> int:
        delta = 0
        if temp.status == "warning":
            delta -= 1
        elif temp.status == "critical":
            delta -= 2
        if hum.status == "warning":
            delta -= 1
        elif hum.status == "critical":
            delta -= 2
        if air.status == "critical":
            delta -= 1
        elif air.status == "warning":
            delta -= 1
        if light.status == "warning":
            delta -= 1
        if duration.status == "warning":
            delta -= 1
        elif duration.status == "critical":
            delta -= 2
        if packaging.status == "warning":
            delta -= 1
        if environment.status == "warning":
            delta -= 1
        delta = max(-8, min(1, delta))
        if delta == 0 and compliance >= 90:
            delta = 1
        return delta

    def _recommendations(
        self,
        rule,
        temp,
        hum,
        air,
        light,
        duration,
        packaging,
        environment,
    ) -> list[str]:
        recs = []
        for parameter in (temp, hum, air, light, duration, packaging, environment):
            if parameter.status in {"warning", "critical"} and parameter.recommendation:
                recs.append(parameter.recommendation)
        if temp.status == "critical" and temp.value is not None and rule.temp_max_c is not None and temp.value > rule.temp_max_c:
            recs.append("Move the product to the recommended storage environment immediately.")
        if duration.status == "warning":
            recs.append("Use FEFO rotation: prioritize this batch before newer stock.")
        elif duration.status == "critical":
            recs.append("Remove this batch from saleable fresh stock and follow the applicable disposal policy.")
        return list(dict.fromkeys(recs))

    # helpers for explanations
    @staticmethod
    def _temp_range(rule: StorageRule) -> str:
        if rule.temp_min_c is None or rule.temp_max_c is None:
            return "ambient"
        return f"{rule.temp_min_c:g}°C–{rule.temp_max_c:g}°C"

    @staticmethod
    def _humidity_range(rule: StorageRule) -> str:
        if rule.humidity_min_pct is None and rule.humidity_max_pct is None:
            return "not defined"
        lo = rule.humidity_min_pct if rule.humidity_min_pct is not None else 0
        hi = rule.humidity_max_pct if rule.humidity_max_pct is not None else 100
        return f"{lo:g}–{hi:g}%"


def normalize_air_circulation(value: str | None) -> str | None:
    v = value.strip().lower() if value else None
    return v if v in AIR_CIRCULATION_OPTIONS else None


def normalize_light_exposure(value: str | None) -> str | None:
    v = value.strip().lower() if value else None
    return v if v in LIGHT_EXPOSURE_OPTIONS else None