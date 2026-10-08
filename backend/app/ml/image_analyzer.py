"""
OpenCV freshness analysis engine.

Pipeline
--------
    decode -> segment food region -> relative features -> calibrated scoring

Why this was rewritten
----------------------
The previous version thresholded absolute HSV/Lab values over the WHOLE image:

* ``MOLD_WHITE = HSV(0..180, 0..30, 180..255)`` matched any bright, desaturated
  pixel - a white plate, a blown-out highlight, a paper tablecloth.  ``mold_pct``
  was then divided by a fixed 5%, so 5% of the frame produced a certain
  "MOLD RISK 100%" on a perfectly good tomato.
* ``texture_score`` penalised *smooth* surfaces as "wilted"
  (``roughness < 0.1`` -> penalty), so a smooth-skinned tomato scored 17%
  texture integrity while a bruised, mouldy one scored higher.
* ``_score_color_degradation`` required 20% green pixels, so every red tomato,
  orange and apple was permanently penalised for not being green.

Every measurement is now (a) restricted to the segmented food region and
(b) expressed relative to the produce's own colour/brightness distribution and
compared against bands calibrated on the labelled dataset
(:mod:`app.ml.calibration`).  Natural colours - red tomato, yellow banana,
brown potato, purple eggplant - are therefore never treated as spoilage, and a
single weak heuristic can no longer collapse the score because each component
also reports a confidence.
"""
import logging
from dataclasses import dataclass, field

import cv2
import numpy as np

from app.ml.calibration import Calibration, load_calibration
from app.ml.debug_trace import PipelineTrace
from app.ml.features import RegionFeatures, extract_features
from app.ml.preprocessing import decode_and_resize
from app.ml.segmentation import SegmentationResult, segment_food

logger = logging.getLogger(__name__)

TARGET_SIZE = (224, 224)


@dataclass
class ColorAnalysis:
    mean_hue: float
    mean_saturation: float
    mean_value: float
    dominant_colors: list[dict]
    color_variance: float
    color_distribution: dict
    color_degradation_score: float          # 0 = pristine, 1 = severe
    color_status: str = "Normal"
    confidence: float = 0.0
    evidence: dict = field(default_factory=dict)


@dataclass
class TextureAnalysis:
    edge_density: float
    contrast: float
    homogeneity: float
    roughness_score: float
    texture_change_score: float             # 0 = normal, 1 = severe
    texture_status: str = "Normal"
    confidence: float = 0.0
    evidence: dict = field(default_factory=dict)


@dataclass
class MoldDetection:
    mold_detected: bool
    mold_probability: float
    mold_regions: list[dict]
    mold_area_percentage: float
    spoilage_indicator: str = "Not Detected"
    confidence: float = 0.0
    evidence: dict = field(default_factory=dict)


@dataclass
class BruiseDetection:
    bruise_detected: bool
    bruise_probability: float
    bruise_regions: list[dict]
    bruise_area_percentage: float
    bruise_severity: str = "None"
    confidence: float = 0.0
    evidence: dict = field(default_factory=dict)


@dataclass
class PhysicalDamage:
    damage_detected: bool
    damage_probability: float
    crack_regions: list[dict]
    damage_area_percentage: float
    damage_severity: str = "None"
    confidence: float = 0.0
    evidence: dict = field(default_factory=dict)


@dataclass
class ImageAnalysisResult:
    color: ColorAnalysis
    texture: TextureAnalysis
    mold: MoldDetection
    bruise: BruiseDetection
    damage: PhysicalDamage
    overall_quality_score: float
    segmentation: SegmentationResult | None = None
    features: RegionFeatures | None = None
    visual_confidence: float = 0.0

    def component_health(self) -> dict[str, float]:
        """Health (1 = perfect) of each visual component, with its confidence."""
        return {
            "color": 1.0 - self.color.color_degradation_score,
            "texture": 1.0 - self.texture.texture_change_score,
            "mold": 1.0 - self.mold.mold_probability,
            "bruise": 1.0 - self.bruise.bruise_probability,
            "damage": 1.0 - self.damage.damage_probability,
        }

    def component_confidence(self) -> dict[str, float]:
        return {
            "color": self.color.confidence,
            "texture": self.texture.confidence,
            "mold": self.mold.confidence,
            "bruise": self.bruise.confidence,
            "damage": self.damage.confidence,
        }


def _color_status(degradation_score: float) -> str:
    if degradation_score < 0.15:
        return "Normal"
    if degradation_score < 0.35:
        return "Slightly Degraded"
    if degradation_score < 0.60:
        return "Moderately Degraded"
    return "Highly Degraded"


def _texture_status(change_score: float) -> str:
    if change_score < 0.15:
        return "Normal"
    if change_score < 0.35:
        return "Slightly Changed"
    if change_score < 0.60:
        return "Moderately Changed"
    return "Highly Changed"


def _mold_indicator(probability: float) -> str:
    if probability < 0.08:
        return "Not Detected"
    if probability < 0.25:
        return "Low Suspicion"
    if probability < 0.55:
        return "Moderate Suspicion"
    return "High Suspicion"


def _bruise_severity_label(probability: float) -> str:
    if probability < 0.10:
        return "None"
    if probability < 0.30:
        return "Minor"
    if probability < 0.60:
        return "Moderate"
    return "Severe"


def _damage_severity_label(probability: float) -> str:
    return _bruise_severity_label(probability)


class FoodImageAnalyzer:
    """Calibrated, food-region-restricted OpenCV freshness analysis."""

    def __init__(self, calibration: Calibration | None = None):
        self.target_size = TARGET_SIZE
        self.calibration = calibration or load_calibration()

    # ------------------------------------------------------------------ entry
    def analyze(self, image_bytes: bytes, trace: PipelineTrace | None = None) -> ImageAnalysisResult:
        """Run the full visual pipeline on raw image bytes."""
        trace = trace or PipelineTrace()

        img = self._decode_image(image_bytes)
        trace.add("preprocess", f"decoded -> BGR {img.shape[1]}x{img.shape[0]}")

        seg = segment_food(img)
        trace.stage(
            "food_region",
            raw={"coverage": seg.coverage, "method": seg.method,
                 "bbox": list(seg.bbox), "full_frame": seg.used_full_frame},
            score=None,
            confidence=seg.confidence,
            note=seg.notes[-1] if seg.notes else "",
        )

        f = extract_features(img, seg.mask)
        f.seg_method = seg.method
        f.seg_confidence = seg.confidence
        f.used_full_frame = seg.used_full_frame
        f.mask = seg.mask

        color = self._analyze_color(img, f, trace)
        texture = self._analyze_texture(img, f, trace)
        mold = self._detect_mold(img, f, seg, trace)
        bruise = self._detect_bruise(img, f, trace)
        damage = self._detect_damage(img, f, trace)

        overall, visual_conf = self._compute_overall_score(
            color, texture, mold, bruise, damage, seg, trace
        )

        return ImageAnalysisResult(
            color=color,
            texture=texture,
            mold=mold,
            bruise=bruise,
            damage=damage,
            overall_quality_score=overall,
            segmentation=seg,
            features=f,
            visual_confidence=visual_conf,
        )

    def _decode_image(self, image_bytes: bytes) -> np.ndarray:
        return decode_and_resize(image_bytes, self.target_size)

    # ------------------------------------------------------------------ colour
    def _analyze_color(self, img: np.ndarray, f: RegionFeatures,
                       trace: PipelineTrace) -> ColorAnalysis:
        """
        Score how far the produce's colour has drifted from the calibrated
        FRESH distribution.  No fixed HSV range is treated as spoilage, so red
        tomatoes, yellow bananas and brown potatoes all pass.
        """
        cal = self.calibration
        parts = {
            "dark_fraction": f.dark_fraction,
            "off_hue_fraction": f.off_hue_fraction,
            "browning_fraction": f.browning_fraction,
            "bleached_fraction": f.bleached_fraction,
            "bright_specular_fraction": f.bright_specular_fraction,
            "p05_value": f.p05_value,
        }
        weights = {
            "dark_fraction": 1.4,
            "off_hue_fraction": 1.2,
            "browning_fraction": 1.6,
            "bleached_fraction": 1.0,
            "bright_specular_fraction": 0.5,
            "p05_value": 1.0,
        }
        healths = {k: cal.health(k, v) for k, v in parts.items()}
        total_w = sum(weights.values())
        health = sum(healths[k] * weights[k] for k in parts) / total_w
        degradation = float(np.clip(1.0 - health, 0.0, 1.0))

        # Confidence: a well-isolated produce patch is easy to judge; a
        # full-frame fallback means the background is polluting the statistics.
        confidence = self._region_confidence(f)
        degradation *= 0.55 + 0.45 * confidence

        # Keep the historical k-means dominant colours (used by the UI chips),
        # but compute them on the food region only.
        dominant = self._dominant_colors(img, f)

        distribution = {
            "browning": round(f.browning_fraction * 100, 2),
            "dark": round(f.dark_fraction * 100, 2),
            "off_hue": round(f.off_hue_fraction * 100, 2),
            "bleached": round(f.bleached_fraction * 100, 2),
            "saturation_mean": round(f.mean_saturation, 2),
            "saturation_median": round(f.median_saturation, 2),
            "brightness_mean": round(f.mean_value, 2),
            "brightness_median": round(f.median_value, 2),
        }

        trace.stage(
            "color",
            raw={k: round(v, 4) for k, v in parts.items()},
            score=1.0 - degradation,
            confidence=confidence,
            note=f"dom_hue={f.mean_hue} hue_disp={f.hue_dispersion}",
        )

        return ColorAnalysis(
            mean_hue=f.mean_hue,
            mean_saturation=f.mean_saturation,
            mean_value=f.mean_value,
            dominant_colors=dominant,
            color_variance=f.hue_dispersion,
            color_distribution=distribution,
            color_degradation_score=round(degradation, 4),
            color_status=_color_status(degradation),
            confidence=round(confidence, 3),
            evidence={"feature_health": {k: round(v, 3) for k, v in healths.items()}},
        )

    def _dominant_colors(self, img: np.ndarray, f: RegionFeatures) -> list[dict]:
        """k-means dominant colours computed on the food region only."""
        flat = img.reshape(-1, 3)
        if f.mask is not None:
            sel = flat[f.mask.reshape(-1).astype(bool)]
        else:
            sel = flat
        if sel.size == 0:
            sel = flat
        sel = sel.astype(np.float32)
        n_dominant = 5
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        try:
            _, labels, centers = cv2.kmeans(
                sel, n_dominant, None, criteria, 8, cv2.KMEANS_PP_CENTERS
            )
        except cv2.error:
            return []
        counts = np.bincount(labels.flatten(), minlength=len(centers))
        total = max(int(counts.sum()), 1)
        out = [
            {
                "color_bgr": [int(c) for c in centers[i]],
                "percentage": round(float(counts[i]) / total * 100, 2),
            }
            for i in range(len(centers))
        ]
        out.sort(key=lambda c: c["percentage"], reverse=True)
        return out

    # ----------------------------------------------------------------- texture
    def _analyze_texture(self, img: np.ndarray, f: RegionFeatures,
                         trace: PipelineTrace) -> TextureAnalysis:
        """
        Texture is judged against the calibrated FRESH band, inside the food
        region only.  A smooth-skinned tomato lands inside the band and scores
        100%; only a genuinely degraded surface (outside the band) loses points,
        and losing points is gradual, never a cliff.
        """
        cal = self.calibration
        parts = {
            "edge_density": f.edge_density,
            "laplacian_var": f.laplacian_var,
            "contrast": f.contrast,
            "entropy": f.entropy,
            "local_std_mean": f.local_std_mean,
        }
        healths = {k: cal.health(k, v) for k, v in parts.items()}
        texture_health = float(np.mean(list(healths.values())))
        change = float(np.clip(1.0 - texture_health, 0.0, 1.0))

        confidence = self._region_confidence(f)
        change *= 0.55 + 0.45 * confidence

        roughness = min(float(np.clip(f.edge_density * 6.0 + f.contrast / 90.0, 0.0, 1.0)), 1.0)
        homogeneity = float(np.clip(1.0 - f.local_std_mean / 60.0, 0.0, 1.0))

        trace.stage(
            "texture",
            raw={k: round(v, 4) for k, v in parts.items()},
            score=texture_health,
            confidence=confidence,
            note="smooth==healthy; only out-of-band roughness degrades the score",
        )

        return TextureAnalysis(
            edge_density=f.edge_density,
            contrast=f.contrast,
            homogeneity=homogeneity,
            roughness_score=round(roughness, 4),
            texture_change_score=round(change, 4),
            texture_status=_texture_status(change),
            confidence=round(confidence, 3),
            evidence={"feature_health": {k: round(v, 3) for k, v in healths.items()}},
        )

    # -------------------------------------------------------------------- mold
    def _detect_mold(self, img: np.ndarray, f: RegionFeatures, seg: SegmentationResult,
                     trace: PipelineTrace) -> MoldDetection:
        """
        Evidence-based fungal detection.

        A pixel is only a mold candidate when ALL of the following hold:
          * it is inside the food region (so background/table is excluded),
          * its hue is clearly different from the produce's own dominant hue,
          * it is pale-green/grey (fungal cast) rather than the food's colour,
          * its neighbourhood is locally irregular (fuzzy mycelium, not a flat
            highlight or a smooth shadow),
          * it forms a coherent blob above a minimum relative area.

        The reported risk is the *fraction of produce area* affected, gated by
        blob count, concentration and fuzziness.  With weak or absent evidence
        the result is LOW/UNCERTAIN - never 100% - while genuinely fuzzy,
        off-colour, concentrated patches still score high.
        """
        cal = self.calibration
        # Three complementary signals, all measured inside the food region:
        # how much area carries the specific fungal signature, how fuzzy that
        # growth is, and how concentrated it is in one patch.
        area_health = cal.health("mold_fraction", f.mold_fraction)
        fuzzy_health = cal.health("mold_fuzzy_score", f.mold_fuzzy_score)
        conc_health = cal.health(
            "mold_largest_region_fraction", f.mold_largest_region_fraction
        )

        # Core risk: affected area dominates, texture and concentration support.
        risk = 1.0 - float(np.clip(
            area_health * 0.60 + fuzzy_health * 0.25 + conc_health * 0.15, 0.0, 1.0
        ))

        # Evidence gates.  A small isolated spot is a blemish, not an outbreak.
        blob_support = float(np.clip(f.mold_region_count / 4.0, 0.0, 1.0))
        if f.mold_fraction <= 0.0:
            # No fungal signature at all: nothing to be uncertain about.
            risk = 0.0
        else:
            risk *= (0.60 + 0.28 * blob_support)

        confidence = self._region_confidence(f)
        if f.mold_region_count == 0:
            # Nothing even looked suspicious - we are confident in the "no".
            confidence = max(confidence, 0.8)
        risk *= 0.6 + 0.4 * confidence
        risk = float(np.clip(risk, 0.0, 0.97))   # never a certain 100% from pixels alone

        detected = risk > 0.30 and f.mold_fraction > 0.01

        regions = self._describe_blobs(f, img)
        trace.stage(
            "mold",
            raw={
                "fungal_pct_of_food": round(f.mold_fraction * 100, 3),
                "offcolour_pct_of_food": round(f.mold_offcolour_fraction * 100, 3),
                "regions": f.mold_region_count,
                "largest_pct_of_food": round(f.mold_largest_region_fraction * 100, 3),
                "fuzzy_ratio": f.mold_fuzzy_score,
            },
            score=1.0 - risk,
            confidence=confidence,
            note="requires off-colour + fuzzy growth inside the food region, scored against the calibrated FRESH band",
        )

        return MoldDetection(
            mold_detected=detected,
            mold_probability=round(risk, 4),
            mold_regions=regions,
            mold_area_percentage=round(f.mold_fraction * 100, 3),
            spoilage_indicator=_mold_indicator(risk),
            confidence=round(confidence, 3),
            evidence={
                "blob_support": round(blob_support, 3),
                "area_health": round(area_health, 3),
                "fuzzy_health": round(fuzzy_health, 3),
                "concentration_health": round(conc_health, 3),
                "fungal_pct_of_food": round(f.mold_fraction * 100, 3),
                "offcolour_pct_of_food": round(f.mold_offcolour_fraction * 100, 3),
            },
        )

    def _describe_blobs(self, f: RegionFeatures, img: np.ndarray) -> list[dict]:
        """
        Report geometry of the mold regions the scores were measured on.

        The mask is reused from the feature pass instead of being recomputed
        here: a second, slightly different reconstruction is how a detector
        ends up drawing boxes that do not match its own numbers.
        """
        cand = f.mold_candidate_mask
        if cand is None or not cand.any():
            return []
        contours, _ = cv2.findContours(cand, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        food_area = float(np.count_nonzero(f.mask)) if f.mask is not None else 1.0
        out = []
        for c in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
            a = cv2.contourArea(c)
            if a < max(12, int(0.0006 * food_area)):
                continue
            x, y, w, hh = cv2.boundingRect(c)
            out.append({"x": int(x), "y": int(y), "width": int(w), "height": int(hh),
                        "area": int(a)})
        return out

    # ------------------------------------------------------------------ bruise
    def _detect_bruise(self, img: np.ndarray, f: RegionFeatures,
                       trace: PipelineTrace) -> BruiseDetection:
        """
        Bruising = dark spots that are darker than the produce's own body,
        excluding the silhouette rim (self-shadow) and excluding anything the
        mold stage already claimed.
        """
        cal = self.calibration
        spot_health = cal.health("spot_fraction", f.spot_fraction)
        risk = 1.0 - spot_health
        # Many small spots read as surface speckling (e.g. a seeded cucumber);
        # a few large dark patches read as bruising.
        support = float(np.clip(f.spot_count / 6.0, 0.0, 1.0))
        risk *= (0.6 + 0.4 * support)
        confidence = self._region_confidence(f)
        risk *= 0.6 + 0.4 * confidence
        risk = float(np.clip(risk, 0.0, 0.95))

        detected = risk > 0.30 and f.spot_fraction > 0.02
        trace.stage(
            "bruise",
            raw={"spots_pct_of_food": round(f.spot_fraction * 100, 3),
                 "spot_count": f.spot_count},
            score=1.0 - risk,
            confidence=confidence,
            note="spots darker than the produce's own median, rim excluded",
        )
        return BruiseDetection(
            bruise_detected=detected,
            bruise_probability=round(risk, 4),
            bruise_regions=[],
            bruise_area_percentage=round(f.spot_fraction * 100, 3),
            bruise_severity=_bruise_severity_label(risk),
            confidence=round(confidence, 3),
            evidence={"spot_health": round(spot_health, 3), "spot_support": round(support, 3)},
        )

    # ------------------------------------------------------------------ damage
    def _detect_damage(self, img: np.ndarray, f: RegionFeatures,
                       trace: PipelineTrace) -> PhysicalDamage:
        """
        Physical damage = long, thin, high-contrast ridges strictly inside the
        produce.  The silhouette outline is erased first, so the food/background
        boundary (or a plate rim) can no longer be reported as a crack.
        """
        cal = self.calibration
        crack_health = cal.health("crack_fraction", f.crack_fraction)
        risk = 1.0 - crack_health
        support = float(np.clip(f.crack_count / 3.0, 0.0, 1.0))
        risk *= (0.55 + 0.45 * support)
        confidence = self._region_confidence(f)
        risk *= 0.6 + 0.4 * confidence
        risk = float(np.clip(risk, 0.0, 0.95))

        detected = risk > 0.30 and f.crack_fraction > 0.015
        trace.stage(
            "damage",
            raw={"crack_pct_of_food": round(f.crack_fraction * 100, 3),
                 "crack_count": f.crack_count},
            score=1.0 - risk,
            confidence=confidence,
            note="long thin interior ridges only (silhouette removed)",
        )
        return PhysicalDamage(
            damage_detected=detected,
            damage_probability=round(risk, 4),
            crack_regions=[],
            damage_area_percentage=round(f.crack_fraction * 100, 3),
            damage_severity=_damage_severity_label(risk),
            confidence=round(confidence, 3),
            evidence={"crack_health": round(crack_health, 3), "crack_support": round(support, 3)},
        )

    # ------------------------------------------------------------------ overall
    def _region_confidence(self, f: RegionFeatures) -> float:
        """Confidence that the visual statistics describe only the food."""
        return float(np.clip(f.seg_confidence, 0.0, 1.0))

    def _compute_overall_score(self, color, texture, mold, bruise, damage,
                              seg: SegmentationResult, trace: PipelineTrace) -> tuple[float, float]:
        """
        Confidence-weighted visual quality score (1 = pristine, 0 = ruined).

        Each component contributes in proportion to its own confidence, and a
        LOW-confidence component is additionally capped, so an uncertain
        heuristic can nudge the result but never destroy it.  This is the
        guarantee that "one weak signal must not tank the score".
        """
        weights = {
            "color": 0.30,
            "texture": 0.20,
            "mold": 0.25,
            "bruise": 0.15,
            "damage": 0.10,
        }
        health = {
            "color": 1.0 - color.color_degradation_score,
            "texture": 1.0 - texture.texture_change_score,
            "mold": 1.0 - mold.mold_probability,
            "bruise": 1.0 - bruise.bruise_probability,
            "damage": 1.0 - damage.damage_probability,
        }
        conf = {
            "color": color.confidence,
            "texture": texture.confidence,
            "mold": mold.confidence,
            "bruise": bruise.confidence,
            "damage": damage.confidence,
        }

        # A component with low confidence is pulled toward the neutral 0.9
        # (i.e. it "abstains") in proportion to how unconfident it is.
        effective = {}
        for k in weights:
            c = float(np.clip(conf[k], 0.0, 1.0))
            abstain = 0.9 * (1.0 - c)          # up to 90% pull toward neutral
            effective[k] = float(np.clip(health[k] * c + abstain, 0.0, 1.0))

        total_w = sum(weights.values())
        weighted = sum(weights[k] * effective[k] for k in weights) / total_w

        # Overall visual confidence (used to weight CNN vs CV later).
        visual_conf = float(np.clip(
            0.5 * seg.confidence + 0.5 * float(np.mean(list(conf.values()))), 0.0, 1.0
        ))

        for k in weights:
            trace.stage(
                f"weight:{k}",
                raw={"health": round(health[k], 3), "conf": round(conf[k], 3)},
                score=effective[k],
                confidence=conf[k],
                contribution=weights[k] * effective[k] / total_w,
            )

        score = float(np.clip(weighted, 0.0, 1.0))
        trace.stage("visual_overall", raw=trace.extra, score=score,
                    confidence=visual_conf, note="confidence-weighted CV score")
        return round(score, 4), round(visual_conf, 4)
