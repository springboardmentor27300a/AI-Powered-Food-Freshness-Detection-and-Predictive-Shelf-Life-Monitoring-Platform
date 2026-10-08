"""
Transparent rule-based shelf-life prediction engine (Milestone 3).

The engine estimates remaining shelf life / expected expiry for a food batch by
combining, in a deterministic and explainable way:

  - category base shelf life (configurable per-category rules),
  - the visual freshness score (Milestone 2 CNN/CV, when a recent analysis
    exists) or a calendar-derived freshness proxy,
  - storage-condition adjustments (temperature / humidity / air / light /
    storage duration) from the storage analyzer,
  - product age relative to the category's expected maximum storage duration,
  - existing spoilage indicators.

No trained shelf-life ML model exists in this project, so this service is a
rule engine.  Prediction logic is isolated here (separate from APIs/UI) and the
`predict` entry-point is the seam where a trained model could be plugged in
later.  Each prediction snapshot is persisted so a future model can be trained
on real platform data.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.constants import RISK_SCORE_BANDS
from app.services.storage_rules import get_storage_rule
from app.services.storage_service import StorageAnalysis

# How recent an image analysis must be to be treated as evidence for the
# visual freshness pillar.
MAX_ANALYSIS_AGE_DAYS = 3


@dataclass
class ShelfLifePrediction:
    batch_id: str
    food_name: str
    category: str
    estimated_remaining_days: int
    expected_expiry_date: date
    calendar_remaining_days: int
    freshness_score: float | None
    shelf_life_score: float
    storage_condition_score: float
    spoilage_risk: str
    risk_score: float
    factors: list[str]
    predicted_on: date
    storage_delta_days: int = 0
    base_shelf_life_days: int = 7

    @property
    def expired(self) -> bool:
        return self.estimated_remaining_days <= 0


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _risk_label(score: float) -> str:
    for band, label in RISK_SCORE_BANDS:
        if score >= band:
            return label
    return "Critical"


def compute_spoilage_risk(
    effective_freshness: float,
    estimated_remaining_days: int,
    base_shelf_life_days: int,
    storage_compliance: float,
    age_days: int,
    spoilage_detected: bool,
) -> tuple[float, str]:
    """
    Deterministic, explainable spoilage-risk score (0-100).

    Penalties (normalised to 100):
      - low freshness          (1 - freshness/100)              weight 0.45
      - low remaining shelf    (1 - remaining/base)             weight 0.25
      - poor storage compliance (1 - storage/100)               weight 0.20
      - excessive product age  (age/bootstrap-shelf-life max)   weight 0.10
      - spoilage indicators add a flat boost
    """
    freshness_penalty = 100 - clamp(effective_freshness, 0, 100)
    remaining = max(0, int(estimated_remaining_days))
    remaining_ratio = 1.0 - (remaining / max(base_shelf_life_days, 1))
    storage_penalty = 100 - clamp(storage_compliance, 0, 100)
    age_penalty = clamp((age_days / max(base_shelf_life_days, 1)) - 0.6, 0, 1) * 100

    score = (
        freshness_penalty * 0.45
        + remaining_ratio * 100 * 0.25
        + storage_penalty * 0.20
        + age_penalty * 0.10
    )
    if spoilage_detected:
        score += 10
    score = clamp(score, 0, 100)
    return round(score, 1), _risk_label(score)


class ShelfLifeService:
    """Predicts shelf life for one batch. Replace/extend `predict` for ML."""

    def __init__(self, storage_analyzer=None):
        from app.services.storage_service import StorageAnalyzer
        self.storage_analyzer = storage_analyzer or StorageAnalyzer()

    # ------------------------------------------------------------------
    # Public API (the seam where a trained model could plug in)
    # ------------------------------------------------------------------
    def predict(
        self,
        *,
        batch_id: str,
        food_name: str,
        category: str | None,
        received_date: date,
        expiry_date: date,
        temperature_c: float | None = None,
        humidity_pct: float | None = None,
        air_circulation: str | None = None,
        light_exposure: str | None = None,
        packaging_type: str | None = None,
        storage_location: str | None = None,
        freshness_score: float | None = None,
        analysis_created_at: date | None = None,
        spoilage_detected: bool = False,
        today: date | None = None,
    ) -> ShelfLifePrediction:
        reference = today or date.today()
        rule = get_storage_rule(category, food_name)

        storage = self.storage_analyzer.analyze(
            batch_id=batch_id,
            food_name=food_name,
            category=category,
            received_date=received_date,
            temperature_c=temperature_c,
            humidity_pct=humidity_pct,
            air_circulation=air_circulation,
            light_exposure=light_exposure,
            packaging_type=packaging_type,
            storage_location=storage_location,
            today=reference,
        )

        calendar_remaining = (expiry_date - reference).days
        age_days = max(0, (reference - received_date).days)

        effective_freshness = self._effective_freshness(
            freshness_score, analysis_created_at, calendar_remaining, rule.shelf_life_days, reference
        )

        visual_remaining = rule.shelf_life_days * clamp(effective_freshness / 100.0, 0, 1)

        age_penalty = max(0, age_days - rule.shelf_life_days)
        raw = visual_remaining + storage.shelf_life_delta_days - age_penalty

        # Never predict PAST the registered expiry label when the batch is not
        # yet expired; poor storage may still push the predicted date earlier.
        if calendar_remaining >= 0:
            predicted = min(raw, calendar_remaining)
        else:
            predicted = raw

        predicted = clamp(predicted, 0, rule.max_storage_days)
        estimated_days = int(round(predicted))
        expected_expiry = expiry_date if calendar_remaining < 0 else reference + timedelta(days=estimated_days)

        shelf_life_score = round(
            clamp(100.0 * estimated_days / max(rule.shelf_life_days, 1), 0, 100), 1
        )
        risk_score, risk_label = compute_spoilage_risk(
            effective_freshness=effective_freshness,
            estimated_remaining_days=estimated_days,
            base_shelf_life_days=rule.shelf_life_days,
            storage_compliance=storage.compliance_score,
            age_days=age_days,
            spoilage_detected=spoilage_detected,
        )

        factors = self._explain(
            rule.shelf_life_days, effective_freshness, storage, age_days, estimated_days,
            calendar_remaining, risk_label,
        )

        return ShelfLifePrediction(
            batch_id=batch_id,
            food_name=food_name,
            category=category or "Unknown",
            estimated_remaining_days=estimated_days,
            expected_expiry_date=expected_expiry,
            calendar_remaining_days=calendar_remaining,
            freshness_score=round(effective_freshness, 1),
            shelf_life_score=shelf_life_score,
            storage_condition_score=storage.compliance_score,
            spoilage_risk=risk_label,
            risk_score=risk_score,
            factors=factors,
            predicted_on=reference,
            storage_delta_days=storage.shelf_life_delta_days,
            base_shelf_life_days=rule.shelf_life_days,
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _effective_freshness(
        self,
        freshness_score: float | None,
        analysis_created_at: date | None,
        calendar_remaining: int,
        base_days: int,
        today: date,
    ) -> float:
        """Choose the freshness score used for the visual pillar."""
        if freshness_score is not None:
            if analysis_created_at is None or (today - analysis_created_at).days <= MAX_ANALYSIS_AGE_DAYS:
                return clamp(freshness_score, 0, 100)
            # Analysis is stale - fall through to the calendar proxy.
        # Calendar proxy: remaining shelf life relative to the category base.
        return clamp(100.0 * calendar_remaining / max(base_days, 1), 0, 100)

    def _explain(
        self,
        base_days: int,
        freshness: float,
        storage: StorageAnalysis,
        age_days: int,
        estimated_days: int,
        calendar_remaining: int,
        risk: str,
    ) -> list[str]:
        out = []
        if freshness >= 90:
            out.append("Freshness score is good; visual condition supports the expected shelf life.")
        elif freshness >= 60:
            out.append("Freshness score is acceptable; a moderate shelf-life estimate applies.")
        else:
            out.append("Low freshness score detected; estimated shelf life is reduced.")

        for param in ("temperature", "humidity", "air_circulation", "light_exposure", "duration", "packaging", "storage_environment"):
            status = getattr(storage, param)
            if status.status == "good":
                out.append(f"{param.replace('_', ' ').capitalize()} is within the recommended range. "
                           "No shelf-life penalty applied.")
            elif status.status == "warning":
                out.append(f"{status.explanation} Estimated shelf life reduced by 1 day.")
            elif status.status == "critical":
                out.append(f"{status.explanation} Estimated shelf life reduced by 2 days.")

        if age_days > base_days:
            out.append(f"Product age ({age_days} days) exceeds the category base shelf life; "
                       "further shelf-life reduction applied.")

        if calendar_remaining >= 0 and estimated_days == calendar_remaining:
            out.append("Prediction is consistent with the registered expiry date.")
        elif estimated_days < calendar_remaining:
            out.append(f"Predicted spoilage ({estimated_days} day(s)) occurs before the registered "
                       "expiry date due to current conditions.")
        out.append(f"Estimated spoilage risk: {risk}.")
        return out


def predictions_from_batch(batch, freshness_score=None, analysis_created_at=None, spoilage_detected=False, today=None):
    """Convenience wrapper building a prediction directly from a FoodBatch ORM row."""
    service = ShelfLifeService()
    return service.predict(
        batch_id=batch.batch_id,
        food_name=batch.food_name,
        category=batch.category,
        received_date=batch.received_date,
        expiry_date=batch.expiry_date,
        temperature_c=getattr(batch, "temperature_c", None),
        humidity_pct=getattr(batch, "humidity_pct", None),
        air_circulation=getattr(batch, "air_circulation", None),
        light_exposure=getattr(batch, "light_exposure", None),
        packaging_type=getattr(batch, "packaging_type", None),
        storage_location=getattr(batch, "storage_location", None),
        freshness_score=freshness_score,
        analysis_created_at=analysis_created_at,
        spoilage_detected=spoilage_detected,
        today=today,
    )