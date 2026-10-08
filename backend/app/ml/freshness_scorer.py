"""
Freshness classification engine.

Combines, with explicit confidences and a debug trace:

1.  the calibrated OpenCV visual analysis (:mod:`app.ml.image_analyzer`),
2.  the trained MobileNetV2 CNN when weights are available
    (:mod:`app.ml.models.cnn_model`),
3.  the five-tier classification thresholds shared with the rest of the platform
    (:func:`app.utils.freshness.get_freshness_category`).

Scoring rules
-------------
* MODEL-BASED and HEURISTIC results stay clearly separated.  When no checkpoint
  loads, ``cnn_prediction`` is ``None`` and the response says so - the OpenCV
  heuristics are never presented as "AI model output".
* CNN and CV are fused by confidence, not by a fixed 60/40.  A confident CNN
  dominates; a low-confidence CNN (max softmax < 0.5) contributes much less.
* A hard, high-confidence mold finding can veto a mid score (you cannot sell
  visibly moulded produce), but it must actually be high-confidence.
* ``spoilage_probability`` is derived from weighted evidence, NOT from
  ``100 - freshness_score``, and carries an uncertainty band.
* The quality category is always derived from the final score through the same
  shared threshold table, so "Freshness 70 / Near Spoilage" cannot happen.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

from app.ml.calibration import load_calibration
from app.ml.config import CNN_CLASS_SCORE_WEIGHTS, CONFIDENCE_THRESHOLD
from app.ml.debug_trace import PipelineTrace
from app.ml.image_analyzer import FoodImageAnalyzer, ImageAnalysisResult
from app.ml.models.cnn_model import load_pytorch_model, predict_pytorch
from app.ml.preprocessing import preprocess_for_pytorch
from app.utils.freshness import get_freshness_category

logger = logging.getLogger(__name__)

#: Blend weight for the CNN when it is confident, and when it is not.
CNN_WEIGHT_CONFIDENT = 0.65
CNN_WEIGHT_UNCONFIDENT = 0.25

#: A confident, sizeable mould finding caps the achievable score.
MOLD_VETO_THRESHOLD = 0.55
MOLD_VETO_FLOOR = 35.0


@dataclass
class FreshnessAssessment:
    classification: str
    confidence_score: float
    freshness_score: float
    image_quality_score: float
    cnn_prediction: Optional[dict]
    color_score: float
    texture_score: float
    mold_risk: float
    bruise_risk: float
    damage_risk: float
    color_status: str
    texture_status: str
    mold_indicator: str
    bruise_severity: str
    damage_severity: str
    spoilage_probability: float
    recommended_action: str
    estimated_shelf_life_days: Optional[int]
    details: dict
    # --- new, additive (defaults keep old constructors working) ---
    spoilage_uncertainty: float = 0.0
    result_basis: str = "heuristic_cv"
    scoring_explanation: dict = None
    debug_trace: Optional[dict] = None


class FreshnessClassifier:
    """Main freshness classification engine combining CV + CNN analysis."""

    def __init__(self):
        self.analyzer = FoodImageAnalyzer(load_calibration())
        self.pytorch_model = load_pytorch_model()

    # ------------------------------------------------------------------ assess
    def assess(self, image_bytes: bytes, food_category: Optional[str] = None) -> FreshnessAssessment:
        """Run complete freshness assessment on a food image."""
        trace = PipelineTrace()

        # Step 1: calibrated OpenCV visual analysis (food region only)
        cv_result = self.analyzer.analyze(image_bytes, trace=trace)

        # Step 2: CNN model prediction (if a trained checkpoint is available)
        cnn_pred = self._run_cnn_inference(image_bytes)
        cnn_probs = self._cnn_probabilities(cnn_pred)

        # Step 3: confidence-aware fusion
        combined_score = self._combine_scores(cv_result, cnn_probs, trace)
        explanation = self._explain_fusion(cv_result, cnn_probs, combined_score)

        # Step 4: hard-evidence veto for visible mould / severe decay
        combined_score, veto = self._apply_evidence_veto(combined_score, cv_result)
        if veto:
            explanation["veto"] = veto

        freshness_score_100 = round(float(np.clip(combined_score, 0.0, 1.0)) * 100, 1)

        # Step 5: classification strictly derived from the final score
        classification = get_freshness_category(freshness_score_100)
        if veto:
            classification = self._cap_category(classification, veto["floor"])

        # Step 6: evidence-based spoilage probability (not 100 - freshness)
        spoilage_prob, uncertainty = self._compute_spoilage_probability(
            cv_result, cnn_probs, freshness_score_100
        )
        explanation["spoilage_types"] = self._spoilage_types(cv_result, cnn_probs)
        explanation["spoilage_probability"] = round(spoilage_prob, 1)
        explanation["spoilage_uncertainty"] = round(uncertainty, 1)

        # Step 7: action + shelf life
        action = self._recommend_action(classification, cv_result)
        shelf_life = self._estimate_shelf_life(combined_score, food_category)

        basis = "cnn+cv" if cnn_probs else "heuristic_cv"
        if cnn_probs and max(cnn_probs.values()) < CONFIDENCE_THRESHOLD:
            basis = "cv+cnn(low confidence)"

        trace.stage("classification", raw={"basis": basis, "veto": veto or None},
                    score=combined_score, confidence=1.0,
                    note=get_freshness_category(freshness_score_100))
        trace.stage("spoilage_probability", raw={"freshness": freshness_score_100},
                    score=spoilage_prob / 100.0, confidence=1.0 - uncertainty,
                    note=f"uncertainty=+-{uncertainty:.1f}pt")

        details = self._build_details(cv_result, cnn_pred, explanation, basis,
                                      uncertainty, trace, spoilage_prob)

        return FreshnessAssessment(
            classification=classification,
            confidence_score=round(combined_score, 3),
            freshness_score=freshness_score_100,
            image_quality_score=cv_result.overall_quality_score,
            cnn_prediction=cnn_pred,
            color_score=cv_result.color.color_degradation_score,
            texture_score=cv_result.texture.texture_change_score,
            mold_risk=cv_result.mold.mold_probability,
            bruise_risk=cv_result.bruise.bruise_probability,
            damage_risk=cv_result.damage.damage_probability,
            color_status=cv_result.color.color_status,
            texture_status=cv_result.texture.texture_status,
            mold_indicator=cv_result.mold.spoilage_indicator,
            bruise_severity=cv_result.bruise.bruise_severity,
            damage_severity=cv_result.damage.damage_severity,
            spoilage_probability=round(spoilage_prob, 1),
            recommended_action=action,
            estimated_shelf_life_days=shelf_life,
            details=details,
            spoilage_uncertainty=round(uncertainty, 1),
            result_basis=basis,
            scoring_explanation=explanation,
            debug_trace=trace.as_dict(),
        )

    # ------------------------------------------------------------------ pieces
    def _run_cnn_inference(self, image_bytes: bytes) -> Optional[dict]:
        """Run PyTorch inference; returns None (never a fabricated guess) if unavailable."""
        if self.pytorch_model is None:
            return None
        try:
            tensor = preprocess_for_pytorch(image_bytes)
            predictions = predict_pytorch(self.pytorch_model, tensor)
            if predictions:
                best = max(predictions, key=lambda x: x["probability"])
                return {
                    "model": "pytorch",
                    "predictions": predictions,
                    "best": best,
                    "max_confidence": best["probability"],
                    "reliable": best["probability"] >= CONFIDENCE_THRESHOLD,
                }
        except Exception as e:  # noqa: BLE001 - inference must not crash the API
            logger.warning("CNN inference failed, falling back to CV-only: %s", e)
        return None

    @staticmethod
    def _cnn_probabilities(cnn_pred: Optional[dict]) -> Optional[dict[str, float]]:
        if not cnn_pred or "predictions" not in cnn_pred:
            return None
        return {p["class"]: float(p["probability"]) for p in cnn_pred["predictions"]}

    def _combine_scores(self, cv_result: ImageAnalysisResult,
                        cnn_probs: Optional[dict] | None = None,
                        trace: PipelineTrace | None = None) -> float:
        """
        Fuse the CV score with the CNN score, weighting by confidence.

        Accepts either a raw probability map (``{"fresh": 0.9, ...}``) or a full
        ``cnn_prediction`` payload (``{"predictions": [...]}``) so the historical
        call signature keeps working.
        """
        cv_score = float(np.clip(cv_result.overall_quality_score, 0.0, 1.0))

        if isinstance(cnn_probs, dict) and "predictions" in cnn_probs:
            cnn_probs = self._cnn_probabilities(cnn_probs)
        if not cnn_probs:
            if trace is not None:
                trace.stage("cnn", raw={"available": False}, score=None,
                            confidence=0.0, note="no checkpoint loaded -> CV only")
            return cv_score

        cnn_score = float(np.clip(
            sum(cnn_probs.get(cls, 0.0) * w for cls, w in CNN_CLASS_SCORE_WEIGHTS.items()),
            0.0, 1.0,
        ))
        max_prob = max(cnn_probs.values()) if cnn_probs else 0.0
        weight = CNN_WEIGHT_CONFIDENT if max_prob >= CONFIDENCE_THRESHOLD else CNN_WEIGHT_UNCONFIDENT

        combined = weight * cnn_score + (1.0 - weight) * cv_score

        if trace is not None:
            trace.stage(
                "cnn",
                raw={k: round(v, 4) for k, v in cnn_probs.items()},
                score=cnn_score,
                confidence=max_prob,
                contribution=weight,
                note=f"blend weight {weight:.2f} (confident={max_prob >= CONFIDENCE_THRESHOLD})",
            )
        return float(np.clip(combined, 0.0, 1.0))

    @staticmethod
    def _classify(score: float) -> str:
        """
        Map a 0..1 score to a quality category.

        Kept as a method so callers (and tests) have one obvious entry point;
        it delegates to the shared table so the score and the label can never
        disagree.
        """
        return get_freshness_category(float(np.clip(score, 0.0, 1.0)) * 100.0)

    def _explain_fusion(self, cv_result: ImageAnalysisResult,
                        cnn_probs: Optional[dict[str, float]],
                        combined: float) -> dict:
        """Human-readable record of how each source contributed to the score."""
        cv_score = float(np.clip(cv_result.overall_quality_score, 0.0, 1.0))
        explanation: dict = {
            "visual_score": round(cv_score, 4),
            "visual_confidence": cv_result.visual_confidence,
            "component_health": {k: round(v, 4) for k, v in cv_result.component_health().items()},
            "component_confidence": {k: round(v, 4) for k, v in cv_result.component_confidence().items()},
        }
        if cnn_probs:
            cnn_score = float(np.clip(
                sum(cnn_probs.get(c, 0.0) * w for c, w in CNN_CLASS_SCORE_WEIGHTS.items()),
                0.0, 1.0,
            ))
            max_prob = max(cnn_probs.values())
            weight = CNN_WEIGHT_CONFIDENT if max_prob >= CONFIDENCE_THRESHOLD else CNN_WEIGHT_UNCONFIDENT
            explanation.update({
                "cnn_score": round(cnn_score, 4),
                "cnn_probabilities": {k: round(v, 4) for k, v in cnn_probs.items()},
                "cnn_max_confidence": round(max_prob, 4),
                "cnn_weight": weight,
                "cv_weight": round(1.0 - weight, 4),
                "fusion": "confidence-weighted blend of the trained CNN and the OpenCV analysis",
            })
        else:
            explanation.update({
                "cnn_score": None,
                "cnn_weight": 0.0,
                "cv_weight": 1.0,
                "fusion": "no trained CNN checkpoint available - OpenCV analysis only "
                          "(this is a HEURISTIC result, not a model prediction)",
            })
        explanation["final_score"] = round(float(combined), 4)
        return explanation

    def _apply_evidence_veto(self, score: float,
                             cv_result: ImageAnalysisResult) -> tuple[float, Optional[dict]]:
        """
        Cap the score when there is strong, confident visual evidence of mould.

        A weak/uncertain mould signal is deliberately NOT allowed to veto, which
        is the specific failure that produced "Fresh tomato -> Near Spoilage".
        """
        mold = cv_result.mold
        if mold.mold_probability < MOLD_VETO_THRESHOLD or mold.confidence < 0.5:
            return score, None

        strength = float(np.clip((mold.mold_probability - MOLD_VETO_THRESHOLD) /
                                 (1.0 - MOLD_VETO_THRESHOLD), 0.0, 1.0))
        floor = MOLD_VETO_FLOOR - 20.0 * (1.0 - strength)   # 15..35
        capped = min(score, floor / 100.0)
        return capped, {
            "reason": "high-confidence visible mold",
            "mold_probability": mold.mold_probability,
            "mold_confidence": mold.confidence,
            "mold_area_pct": mold.mold_area_percentage,
            "floor": round(floor, 1),
        }

    @staticmethod
    def _cap_category(classification: str, floor: float) -> str:
        """Never report a category better than the evidence allows."""
        order = ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"]
        worst_allowed = get_freshness_category(floor)
        if order.index(classification) < order.index(worst_allowed):
            return worst_allowed
        return classification

    def _compute_spoilage_probability(
        self,
        cv_result: ImageAnalysisResult,
        cnn_probs: Optional[dict[str, float]],
        freshness_score_100: float,
    ) -> tuple[float, float]:
        """
        Weighted-evidence spoilage probability with an explicit uncertainty band.

        Strong evidence  : confirmed mould, heavy discoloration, severe texture
                           decay, major physical damage, a *reliable* rotten
                           class prediction.
        Weak evidence    : a single uncertain heuristic - contributes little and
                           widens the uncertainty band instead of inflating the
                           number.
        """
        evidence: dict[str, float] = {}
        weights: dict[str, float] = {}

        mold = cv_result.mold
        if mold.mold_probability > 0 and mold.confidence >= 0.4:
            evidence["mold"] = mold.mold_probability
            weights["mold"] = 0.34

        color_degradation = cv_result.color.color_degradation_score
        if color_degradation > 0:
            evidence["color"] = color_degradation
            weights["color"] = 0.16

        texture_change = cv_result.texture.texture_change_score
        if texture_change > 0:
            evidence["texture"] = texture_change
            weights["texture"] = 0.12

        bruise = cv_result.bruise.bruise_probability
        if bruise > 0:
            evidence["bruise"] = bruise
            weights["bruise"] = 0.10

        damage = cv_result.damage.damage_probability
        if damage > 0:
            evidence["damage"] = damage
            weights["damage"] = 0.10

        if cnn_probs:
            rotten = cnn_probs.get("rotten", 0.0)
            max_prob = max(cnn_probs.values())
            if max_prob >= CONFIDENCE_THRESHOLD:
                evidence["cnn_rotten"] = rotten
                weights["cnn_rotten"] = 0.34
            else:
                # Not trustworthy enough to drive the number, but worth flagging.
                evidence["cnn_rotten_weak"] = rotten
                weights["cnn_rotten_weak"] = 0.08

        if not evidence:
            return 2.0, 8.0

        total_w = sum(weights.values())
        prob = sum(evidence[k] * weights[k] for k in evidence) / total_w

        # Agreement boost: independent sources pointing the same way.
        strong = [k for k in evidence if not k.endswith("_weak")]
        if len(strong) >= 3:
            prob = min(1.0, prob * 1.15)
        elif len(strong) == 2:
            prob = min(1.0, prob * 1.05)

        # The score itself is corroborating, not primary evidence.
        prob = 0.75 * prob + 0.25 * (1.0 - freshness_score_100 / 100.0)

        # Uncertainty grows when the evidence is thin or a source is unreliable.
        uncertainty = 6.0
        if len(evidence) == 1:
            uncertainty += 8.0
        if cnn_probs and max(cnn_probs.values()) < CONFIDENCE_THRESHOLD:
            uncertainty += 6.0
        if cv_result.segmentation is not None and cv_result.segmentation.used_full_frame:
            uncertainty += 5.0
        if cv_result.visual_confidence < 0.5:
            uncertainty += 4.0

        prob = float(np.clip(prob, 0.0, 0.98)) * 100.0
        return prob, float(min(uncertainty, 25.0))

    @staticmethod
    def _spoilage_types(cv_result: ImageAnalysisResult,
                        cnn_probs: Optional[dict[str, float]]) -> list[str]:
        """Spoilage classes supported by confident evidence (else ['none'])."""
        types: list[str] = []
        if cv_result.mold.mold_detected and cv_result.mold.confidence >= 0.5:
            types.append("microbial")
        if cv_result.color.color_degradation_score > 0.45 and cv_result.color.confidence >= 0.5:
            types.append("chemical")
        if (cv_result.bruise.bruise_detected and cv_result.bruise.confidence >= 0.5) or \
           (cv_result.damage.damage_detected and cv_result.damage.confidence >= 0.5):
            types.append("physical")
        if cnn_probs and max(cnn_probs.values()) >= CONFIDENCE_THRESHOLD:
            if cnn_probs.get("rotten", 0.0) > 0.5:
                types.append("microbial")
            elif cnn_probs.get("semi_fresh", 0.0) > 0.5:
                types.append("chemical")
        return sorted(set(types)) if types else ["none"]

    def _recommend_action(self, classification: str, cv_result: ImageAnalysisResult) -> str:
        if classification == "Fresh":
            action = "Continue normal storage. No immediate action required."
        elif classification == "Good":
            action = "Monitor closely. Consider selling/using within optimal window."
        elif classification == "Acceptable":
            action = "Prioritize for immediate use or sale. Reduce price if retail."
        elif classification == "Near Spoilage":
            action = "Use immediately or dispose. Do not store further. Check for contamination."
        else:
            action = "Dispose immediately. Do not consume. Document and report if needed."

        warnings = []
        if cv_result.mold.mold_detected:
            warnings.append(
                f"MOLD DETECTED ({cv_result.mold.mold_area_percentage:.1f}% of produce area) - health hazard"
            )
        elif cv_result.mold.mold_probability > 0.25:
            warnings.append(
                f"possible fungal growth ({cv_result.mold.mold_probability * 100:.0f}% risk, "
                f"low confidence) - inspect manually"
            )
        if cv_result.bruise.bruise_detected:
            warnings.append(
                f"Bruising present ({cv_result.bruise.bruise_area_percentage:.1f}% area)"
            )
        if cv_result.damage.damage_detected:
            warnings.append(
                f"Physical damage found ({cv_result.damage.damage_area_percentage:.1f}% damage)"
            )
        if cv_result.segmentation is not None and cv_result.segmentation.used_full_frame:
            warnings.append(
                "food region could not be isolated - scores may include background"
            )

        if warnings:
            action += " WARNINGS: " + "; ".join(warnings) + "."
        return action

    def _estimate_shelf_life(self, score: float, category: Optional[str]) -> Optional[int]:
        base_days = {
            "Fruits": 7,
            "Vegetables": 5,
            "Dairy Products": 10,
            "Meat & Poultry": 3,
            "Seafood": 2,
            "Bakery Products": 5,
            "Packaged Foods": 30,
            "Beverages": 60,
        }
        base = base_days.get(category, 7)
        return max(0, int(round(score * base)))

    # ----------------------------------------------------------------- details
    def _build_details(self, cv_result, cnn_pred, explanation, basis,
                       uncertainty, trace, spoilage_prob) -> dict:
        seg = cv_result.segmentation
        return {
            "color_analysis": {
                "degradation_score": cv_result.color.color_degradation_score,
                "color_status": cv_result.color.color_status,
                "dominant_colors": cv_result.color.dominant_colors[:3],
                "distribution": cv_result.color.color_distribution,
                "confidence": cv_result.color.confidence,
                "evidence": cv_result.color.evidence,
            },
            "texture_analysis": {
                "edge_density": cv_result.texture.edge_density,
                "contrast": cv_result.texture.contrast,
                "roughness": cv_result.texture.roughness_score,
                "change_score": cv_result.texture.texture_change_score,
                "texture_status": cv_result.texture.texture_status,
                "confidence": cv_result.texture.confidence,
                "evidence": cv_result.texture.evidence,
            },
            "spoilage_indicators": {
                "mold_detected": cv_result.mold.mold_detected,
                "mold_area_pct": cv_result.mold.mold_area_percentage,
                "mold_probability": cv_result.mold.mold_probability,
                "mold_confidence": cv_result.mold.confidence,
                "mold_indicator": cv_result.mold.spoilage_indicator,
                "bruise_detected": cv_result.bruise.bruise_detected,
                "bruise_area_pct": cv_result.bruise.bruise_area_percentage,
                "bruise_severity": cv_result.bruise.bruise_severity,
                "damage_detected": cv_result.damage.damage_detected,
                "damage_area_pct": cv_result.damage.damage_area_percentage,
                "damage_severity": cv_result.damage.damage_severity,
            },
            "food_region": {
                "coverage": seg.coverage if seg else None,
                "method": seg.method if seg else None,
                "confidence": seg.confidence if seg else None,
                "used_full_frame": seg.used_full_frame if seg else None,
                "bbox": list(seg.bbox) if seg else None,
                "notes": seg.notes if seg else [],
            },
            "component_health": {k: round(v, 4) for k, v in cv_result.component_health().items()},
            "component_confidence": {k: round(v, 4) for k, v in cv_result.component_confidence().items()},
            "visual_confidence": cv_result.visual_confidence,
            "result_basis": basis,
            "cnn_prediction": cnn_pred,
            "scoring": explanation,
            "spoilage_probability": round(spoilage_prob, 1),
            "spoilage_uncertainty": round(uncertainty, 1),
            "features": cv_result.features.as_dict() if cv_result.features else {},
            "debug": trace.as_dict(),
        }
