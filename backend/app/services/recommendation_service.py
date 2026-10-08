"""
Centralized recommendation engine (Milestone 3).

Generates storage, consumption, inventory-rotation, waste-reduction and
quality-improvement recommendations from ACTUAL product data (never random).
Recommendations are deterministic and can be persisted (Recommendation model)
for history; the engine itself is a pure function of the batch state.
"""
from dataclasses import dataclass

from app.services.scoring_service import FreshnessScore
from app.services.shelf_life_service import ShelfLifePrediction
from app.services.storage_service import StorageAnalysis


BULK_QUANTITY_THRESHOLDS = {"kg": 50, "litres": 50, "pieces": 100, "packets": 100, "g": 5000}


@dataclass
class Recommendation:
    category: str          # storage | consumption | rotation | waste_reduction | quality_improvement
    message: str
    priority: str          # high | medium | low
    batch_id: str
    source: str = "rule_engine"


class RecommendationEngine:
    """Pure (side-effect free) generator; persistence happens in the router."""

    def generate_for_batch(
        self,
        batch,
        prediction: ShelfLifePrediction,
        storage: StorageAnalysis | None,
        score: FreshnessScore | None,
        sibling_batches: list | None = None,
    ) -> list[Recommendation]:
        recs: list[Recommendation] = []

        recs.extend(self._consumption(batch, prediction))
        recs.extend(self._storage_recommendations(batch, storage))
        recs.extend(self._quality(batch, storage))
        recs.extend(self._waste(batch, prediction, storage))
        recs.extend(self._rotation(batch, sibling_batches or []))

        return recs

    def _consumption(self, batch, prediction: ShelfLifePrediction) -> list[Recommendation]:
        days = prediction.estimated_remaining_days
        if prediction.expired:
            return [Recommendation(
                "consumption",
                "Product has passed its predicted expiry date. Do not recommend consumption.",
                "high", batch.batch_id,
            )]
        if days == 0:
            return [Recommendation(
                "consumption",
                "Priority consumption: product expires today.",
                "high", batch.batch_id,
            )]
        if days <= 1:
            return [Recommendation(
                "consumption",
                "Prioritize safe sale or consumption within 1 day.",
                "high", batch.batch_id,
            )]
        if days <= 3:
            return [Recommendation(
                "consumption",
                f"Prioritize safe sale or consumption within {days} days.",
                "medium", batch.batch_id,
            )]
        if prediction.spoilage_risk in ("High", "Critical"):
            return [Recommendation(
                "consumption",
                "High spoilage risk detected. Consider immediate consumption or disposal.",
                "high", batch.batch_id,
            )]
        return []

    def _storage_recommendations(self, batch, storage: StorageAnalysis | None) -> list[Recommendation]:
        if storage is None:
            return []
        out = []
        for rec in storage.optimization_recommendations:
            priority = "high" if "immediately" in rec or "older stock" in rec else "medium"
            out.append(Recommendation("storage", rec, priority, batch.batch_id))
        if not out and storage.compliance_score >= 90:
            out.append(Recommendation(
                "storage",
                "Maintain the current storage temperature and conditions.",
                "low", batch.batch_id,
            ))
        return out

    def _quality(self, batch, storage: StorageAnalysis | None) -> list[Recommendation]:
        if storage is None:
            return []
        out = []
        for param in ("temperature", "humidity", "air_circulation", "light_exposure", "packaging", "storage_environment"):
            status = getattr(storage, param, None)
            if status is not None and status.status in ("warning", "critical"):
                message = status.recommendation or f"Improve {param.replace('_', ' ')}."
                out.append(Recommendation("quality_improvement", message, "medium", batch.batch_id))
        if out:
            out.append(Recommendation(
                "quality_improvement",
                "Maintaining suitable storage conditions can help preserve product quality and slow freshness degradation.",
                "medium",
                batch.batch_id,
            ))
        return out

    def _waste(self, batch, prediction: ShelfLifePrediction, storage: StorageAnalysis | None) -> list[Recommendation]:
        days = prediction.estimated_remaining_days
        quantity = f"{batch.available_quantity:g} {batch.unit}"
        out = []
        if 0 <= days <= 2:
            bulk = " Large available quantity increases the potential waste." if self._is_bulk(batch) else ""
            out.append(Recommendation(
                "waste_reduction",
                f"'{batch.food_name}' ({batch.batch_id}) has {quantity} available and {days} day(s) remaining. "
                f"Prioritize safe sale or consumption before newer lots to reduce potential waste.{bulk}",
                "high", batch.batch_id,
            ))
        if prediction.spoilage_risk in ("High", "Critical"):
            out.append(Recommendation(
                "waste_reduction",
                f"'{batch.food_name}' has elevated spoilage risk. Improve the flagged storage conditions "
                "to reduce further freshness loss and potential waste.",
                "medium", batch.batch_id,
            ))
        if storage is not None and self._is_bulk(batch) and getattr(storage, "condition_status", "GOOD") in {"WARNING", "UNSUITABLE", "CRITICAL"}:
            out.append(Recommendation(
                "waste_reduction",
                f"Large '{batch.food_name}' inventory ({quantity}) is outside its recommended storage conditions. "
                "Correct the storage deviations to reduce freshness loss across the batch.",
                "high", batch.batch_id,
            ))
        return out

    @staticmethod
    def _is_bulk(batch) -> bool:
        threshold = BULK_QUANTITY_THRESHOLDS.get(batch.unit)
        return threshold is not None and float(batch.available_quantity) >= threshold

    def _rotation(self, batch, sibling_batches: list) -> list[Recommendation]:
        """FEFO-style: compare this batch's predicted expiry with the same product's other batches."""
        if not sibling_batches:
            return []
        comparable = [s for s in sibling_batches if s.batch_id != batch.batch_id]
        if not comparable:
            return []
        ordered = sorted(comparable, key=lambda s: s.expiry_date)
        out = []
        for other in ordered:
            if other.expiry_date < batch.expiry_date:
                out.append(Recommendation(
                    "rotation",
                    f"Prioritize {other.batch_id} before {batch.batch_id} "
                    f"({other.food_name} expires earlier).",
                    "medium", batch.batch_id,
                ))
        return out