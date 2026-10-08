"""
Spoilage detection workflow with probability estimation.

Turns the calibrated visual analysis into a multi-indicator spoilage verdict.

Changes vs. the previous version
--------------------------------
* The old detector summed six fixed-weight indicators and then multiplied by
  1.1/1.2 when two or three of them "fired".  Because the raw mold indicator
  used to be pinned at 1.0 on any bright background, a single false signal
  combined with a false texture signal produced a spurious ~50% overall
  spoilage probability.  Combination is now confidence-weighted noise-OR style:
  weak/uncertain indicators barely move the number and instead widen the
  reported uncertainty.
* Every indicator now carries its own confidence and the percentage of the
  *produce* (not the whole frame) that is affected.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

from app.ml.config import CONFIDENCE_THRESHOLD
from app.ml.debug_trace import PipelineTrace
from app.ml.image_analyzer import FoodImageAnalyzer, ImageAnalysisResult

logger = logging.getLogger(__name__)

SPOILAGE_TYPES = {
    "microbial": "Microbial spoilage (mold/bacteria growth)",
    "chemical": "Chemical spoilage (oxidation/browning)",
    "physical": "Physical damage (bruising/cracking)",
    "none": "No spoilage detected",
}

RISK_LEVELS = {
    "low": {"label": "Low Risk", "color": "green", "threshold": 0.2},
    "moderate": {"label": "Moderate Risk", "color": "amber", "threshold": 0.5},
    "high": {"label": "High Risk", "color": "red", "threshold": 0.8},
    "critical": {"label": "Critical Risk", "color": "red", "threshold": 1.0},
}

#: Base weight per indicator.  The final probability uses a confidence-weighted
#: noise-OR so a single confident signal is enough, but several weak ones are
#: not allowed to add up to a confident verdict.
_INDICATOR_WEIGHTS = {
    "Mold Growth": 0.55,
    "Severe Discoloration": 0.28,
    "Texture Degradation": 0.18,
    "Bruising": 0.22,
    "Physical Damage": 0.22,
    "Surface Moisture": 0.10,
}


@dataclass
class SpoilageIndicator:
    name: str
    detected: bool
    probability: float
    severity: str
    description: str
    affected_area_pct: float
    confidence: float = 1.0
    evidence: Optional[dict] = None


@dataclass
class SpoilageDetectionResult:
    spoilage_detected: bool
    overall_spoilage_probability: float
    risk_level: str
    spoilage_types: list[str]
    indicators: list[SpoilageIndicator]
    summary: str
    uncertainty: float = 0.0
    result_basis: str = "heuristic_cv"


class SpoilageDetector:
    """Multi-indicator spoilage detection with probability estimation."""

    def __init__(self):
        self.analyzer = FoodImageAnalyzer()

    def detect(self, image_bytes: bytes) -> SpoilageDetectionResult:
        """Run full spoilage detection pipeline."""
        trace = PipelineTrace()
        analysis = self.analyzer.analyze(image_bytes, trace=trace)

        indicators = self._build_indicators(analysis)
        overall_prob, uncertainty = self._combine_indicators(indicators, analysis)
        risk_level = self._determine_risk_level(overall_prob)
        spoilage_types = self._classify_spoilage_types(indicators)
        summary = self._generate_summary(
            overall_prob, uncertainty, risk_level, spoilage_types, indicators
        )

        return SpoilageDetectionResult(
            spoilage_detected=overall_prob > 0.35 and uncertainty < 18.0,
            overall_spoilage_probability=round(overall_prob, 4),
            risk_level=risk_level,
            spoilage_types=spoilage_types,
            indicators=indicators,
            summary=summary,
            uncertainty=round(uncertainty, 1),
            result_basis="heuristic_cv",
        )

    # ------------------------------------------------------------- indicators
    def _build_indicators(self, analysis: ImageAnalysisResult) -> list[SpoilageIndicator]:
        c, t = analysis.color, analysis.texture
        m, b, d = analysis.mold, analysis.bruise, analysis.damage

        return [
            SpoilageIndicator(
                name="Mold Growth",
                detected=m.mold_detected,
                probability=m.mold_probability,
                severity=self._severity_from_prob(m.mold_probability),
                description=(
                    "Off-colour, fuzzy patches covering "
                    f"{m.mold_area_percentage:.1f}% of the produce area "
                    "(colour + texture + region evidence)"
                ),
                affected_area_pct=m.mold_area_percentage,
                confidence=m.confidence,
                evidence=m.evidence,
            ),
            SpoilageIndicator(
                name="Severe Discoloration",
                detected=c.color_degradation_score > 0.45 and c.confidence >= 0.4,
                probability=c.color_degradation_score,
                severity=self._severity_from_prob(c.color_degradation_score),
                description=(
                    "Colour drift beyond the calibrated fresh range for this "
                    f"produce (off-hue {c.color_distribution.get('off_hue', 0):.1f}%, "
                    f"browning {c.color_distribution.get('browning', 0):.1f}%)"
                ),
                affected_area_pct=round(
                    100.0 * (1.0 - c.color_degradation_score), 2
                ),
                confidence=c.confidence,
                evidence=c.evidence,
            ),
            SpoilageIndicator(
                name="Texture Degradation",
                detected=t.texture_change_score > 0.45 and t.confidence >= 0.4,
                probability=t.texture_change_score,
                severity=self._severity_from_prob(t.texture_change_score),
                description=(
                    "Surface roughness outside the healthy band for this produce "
                    "(smooth skin is normal and is NOT penalised)"
                ),
                affected_area_pct=0.0,
                confidence=t.confidence,
                evidence=t.evidence,
            ),
            SpoilageIndicator(
                name="Bruising",
                detected=b.bruise_detected,
                probability=b.bruise_probability,
                severity=self._severity_from_prob(b.bruise_probability),
                description=(
                    f"Dark patches darker than the produce's own body covering "
                    f"{b.bruise_area_percentage:.1f}% of the produce area"
                ),
                affected_area_pct=b.bruise_area_percentage,
                confidence=b.confidence,
                evidence=b.evidence,
            ),
            SpoilageIndicator(
                name="Physical Damage",
                detected=d.damage_detected,
                probability=d.damage_probability,
                severity=self._severity_from_prob(d.damage_probability),
                description=(
                    "Long thin ridges inside the produce outline covering "
                    f"{d.damage_area_percentage:.1f}% of the produce area"
                ),
                affected_area_pct=d.damage_area_percentage,
                confidence=d.confidence,
                evidence=d.evidence,
            ),
            self._moisture_indicator(analysis),
        ]

    def _moisture_indicator(self, analysis: ImageAnalysisResult) -> SpoilageIndicator:
        """
        Sliminess proxy: high gloss on a low-texture surface.  Deliberately
        capped and low-confidence - it is the weakest signal available.
        """
        f = analysis.features
        if f is None:
            return SpoilageIndicator(
                name="Surface Moisture", detected=False, probability=0.0,
                severity="minimal", description="Not measurable", affected_area_pct=0.0,
                confidence=0.2,
            )
        glossy = float(np.clip((f.mean_value - 190.0) / 60.0, 0.0, 1.0))
        smooth = float(np.clip(1.0 - analysis.texture.edge_density / 0.05, 0.0, 1.0))
        prob = float(np.clip(glossy * smooth * 0.5, 0.0, 0.5))
        return SpoilageIndicator(
            name="Surface Moisture",
            detected=prob > 0.3,
            probability=prob,
            severity=self._severity_from_prob(prob),
            description="High gloss on an otherwise smooth surface (weak signal)",
            affected_area_pct=0.0,
            confidence=0.3,
        )

    # ----------------------------------------------------------- combination
    def _combine_indicators(self, indicators: list[SpoilageIndicator],
                            analysis: ImageAnalysisResult) -> tuple[float, float]:
        """
        Confidence-weighted noisy-OR over the indicators.

        Each indicator contributes ``w * p`` scaled by its confidence.  A
        confident, large mould finding dominates; two weak heuristics firing at
        once do not sum their way to a confident spoilage verdict.
        """
        total = 0.0
        contributing = 0
        for ind in indicators:
            if ind.probability <= 0.01:
                continue
            w = _INDICATOR_WEIGHTS.get(ind.name, 0.1)
            eff = float(np.clip(ind.confidence, 0.0, 1.0))
            # Confidence-aware shrinkage: a 0.3-risk at 0.3 confidence is weak
            # evidence, not 30% spoilage.
            contribution = w * ind.probability * (0.35 + 0.65 * eff)
            total += contribution
            if ind.detected:
                contributing += 1

        prob = float(np.clip(1.0 - np.exp(-total), 0.0, 0.98))

        # Corroboration bonus only when the signals are individually credible.
        credible = [i for i in indicators if i.detected and i.confidence >= 0.5]
        if len(credible) >= 3:
            prob = min(0.98, prob * 1.15)

        uncertainty = 5.0
        strong = [i for i in indicators if i.detected and i.confidence >= 0.5]
        if not strong:
            uncertainty += 10.0
        elif len(strong) == 1:
            uncertainty += 5.0
        if analysis.segmentation is not None and analysis.segmentation.used_full_frame:
            uncertainty += 5.0
        if analysis.visual_confidence < 0.5:
            uncertainty += 4.0

        return prob, float(min(uncertainty, 25.0))

    def _determine_risk_level(self, probability: float) -> str:
        if probability < RISK_LEVELS["low"]["threshold"]:
            return "low"
        if probability < RISK_LEVELS["moderate"]["threshold"]:
            return "moderate"
        if probability < RISK_LEVELS["high"]["threshold"]:
            return "high"
        return "critical"

    def _classify_spoilage_types(self, indicators: list[SpoilageIndicator]) -> list[str]:
        types = []
        for ind in indicators:
            # Only credible evidence may declare a spoilage type.
            if not ind.detected or ind.confidence < 0.5:
                continue
            if ind.name == "Mold Growth":
                types.append("microbial")
            elif ind.name == "Severe Discoloration":
                types.append("chemical")
            elif ind.name in ("Bruising", "Physical Damage"):
                types.append("physical")
        return sorted(set(types)) if types else ["none"]

    def _severity_from_prob(self, prob: float) -> str:
        if prob < 0.2:
            return "minimal"
        if prob < 0.5:
            return "mild"
        if prob < 0.75:
            return "moderate"
        return "severe"

    def _generate_summary(self, overall_prob: float, uncertainty: float,
                          risk_level: str, spoilage_types: list[str],
                          indicators: list[SpoilageIndicator]) -> str:
        detected = [i for i in indicators if i.detected and i.confidence >= 0.5]
        uncertain = [i for i in indicators if 0.01 < i.probability <= 0.3 and not i.detected]
        risk_info = RISK_LEVELS[risk_level]

        base = (
            f"Overall spoilage probability: {overall_prob * 100:.1f}% "
            f"(+/- {uncertainty:.0f}pt, {risk_info['label']})."
        )

        if not detected:
            extra = ""
            if uncertain:
                extra = (
                    " Weak, inconclusive signals for: "
                    + ", ".join(i.name for i in uncertain)
                    + " - visual evidence is insufficient to call these spoilage."
                )
            return "No significant spoilage indicators detected. " + base + extra

        names = ", ".join(i.name for i in detected)
        return (
            f"Detected {len(detected)} spoilage indicator(s): {names}. {base} "
            f"Primary spoilage type: {', '.join(spoilage_types)}."
        )
