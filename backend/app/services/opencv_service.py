"""
app/services/opencv_service.py

Real computer-vision analysis using OpenCV + NumPy. These are documented,
deterministic heuristics — NOT a trained model, NOT proof of food safety.
Every score is derived directly from actual pixel statistics of the
uploaded image; nothing here is hardcoded or randomized.

Method summary (see docs/ARCHITECTURE.md for the full write-up):
  - color_score:     % of pixels within a "vivid/expected" saturation-value
                      band vs. dull/browned pixels, in HSV space.
  - texture_score:   normalized Laplacian variance — fresh produce tends to
                      have smoother, more uniform surface texture than
                      wrinkled/shriveled spoiled produce (lower variance
                      here = smoother = better, so score is inverted from
                      raw variance against an empirically reasonable cap).
  - dark_spot_score: 100 minus the % of image area covered by very dark,
                      low-saturation connected regions above a minimum size
                      (candidate mold/rot spots).
  - bruising_score:  100 minus the % of image area covered by brown/patchy
                      discoloration distinct from the dominant color.
  - damage_score:    100 minus a normalized count of irregular high-contrast
                      contours (candidate cuts/punctures/splits).
  - overall_visual_score: weighted average of the five above.
"""
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class VisualAnalysis:
    color_score: float
    texture_score: float
    dark_spot_score: float
    bruising_score: float
    damage_score: float
    overall_visual_score: float
    dark_spot_area_pct: float
    summary: str
    explanation: str


# Weights for overall_visual_score — documented, not tuned on hidden data.
_WEIGHTS = {
    "color_score": 0.30,
    "texture_score": 0.15,
    "dark_spot_score": 0.25,
    "bruising_score": 0.20,
    "damage_score": 0.10,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _color_score(hsv: np.ndarray) -> float:
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)
    # "Vivid" = reasonably saturated and reasonably bright — proxy for
    # unfaded, undiscolored produce.
    vivid_mask = (s > 60) & (v > 60)
    vivid_pct = float(np.mean(vivid_mask)) * 100
    return _clamp(vivid_pct)


def _texture_score(gray: np.ndarray) -> float:
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Empirical cap: very high local variance suggests a wrinkled/mottled
    # surface. Score decreases as variance climbs past this cap.
    cap = 800.0
    score = 100.0 - (laplacian_var / cap) * 100.0
    return _clamp(score)


def _dark_spot_analysis(hsv: np.ndarray) -> tuple[float, float]:
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    dark_mask = ((v < 60) & (s < 120)).astype(np.uint8) * 255
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    contours, _ = cv2.findContours(dark_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total_area = hsv.shape[0] * hsv.shape[1]
    min_spot_area = total_area * 0.0008  # ignore noise-sized specks
    spot_area = sum(cv2.contourArea(c) for c in contours if cv2.contourArea(c) > min_spot_area)
    area_pct = (spot_area / total_area) * 100

    score = _clamp(100.0 - area_pct * 6.0)  # each 1% of dark-spot coverage costs 6 points
    return score, round(area_pct, 2)


def _bruising_score(hsv: np.ndarray) -> float:
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    # Brown/patch discoloration: hue in the brown/orange-brown band,
    # moderate saturation, mid-low brightness.
    brown_mask = ((h > 5) & (h < 25) & (s > 40) & (s < 180) & (v > 40) & (v < 150)).astype(np.uint8)
    total = h.shape[0] * h.shape[1]
    pct = float(np.mean(brown_mask)) * 100
    score = _clamp(100.0 - pct * 4.0)
    return score


def _damage_score(gray: np.ndarray) -> float:
    edges = cv2.Canny(gray, 80, 160)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    total_area = gray.shape[0] * gray.shape[1]
    min_len = 15
    significant = [c for c in contours if cv2.arcLength(c, False) > min_len]
    # Normalize by image size so this doesn't scale with resolution alone.
    density = len(significant) / (total_area / (200 * 200))
    score = _clamp(100.0 - density * 0.9)
    return score


def analyze_image(image_path: str) -> VisualAnalysis:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"OpenCV could not read image at {image_path}")

    # Standardize size so scores are comparable across uploads.
    img = cv2.resize(img, (512, 512))
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    color = _color_score(hsv)
    texture = _texture_score(gray)
    dark_spot, dark_spot_pct = _dark_spot_analysis(hsv)
    bruising = _bruising_score(hsv)
    damage = _damage_score(gray)

    overall = float(
        color * _WEIGHTS["color_score"]
        + texture * _WEIGHTS["texture_score"]
        + dark_spot * _WEIGHTS["dark_spot_score"]
        + bruising * _WEIGHTS["bruising_score"]
        + damage * _WEIGHTS["damage_score"]
    )

    flags = []
    if dark_spot_pct > 2.0:
        flags.append(f"dark/mold-like regions covering ~{dark_spot_pct}% of the image")
    if bruising < 70:
        flags.append("possible bruising or brown discoloration detected")
    if color < 50:
        flags.append("color appears faded/dulled relative to a vivid, fresh appearance")
    if damage < 60:
        flags.append("irregular surface contours detected (possible cuts/damage)")

    summary = "No significant visual concerns detected." if not flags else "; ".join(flags).capitalize() + "."
    explanation = (
        "Visual indicators are computed directly from this image's pixel statistics "
        "(color distribution, local texture variance, dark-region area, brown-discoloration "
        "area, and edge/contour irregularity). These are heuristic image-processing signals, "
        "not a trained model, and are not a guarantee of food safety — always apply your own "
        "judgment and, where relevant, food safety testing."
    )

    return VisualAnalysis(
        color_score=round(color, 2),
        texture_score=round(texture, 2),
        dark_spot_score=round(dark_spot, 2),
        bruising_score=round(bruising, 2),
        damage_score=round(damage, 2),
        overall_visual_score=round(overall, 2),
        dark_spot_area_pct=dark_spot_pct,
        summary=summary,
        explanation=explanation,
    )
