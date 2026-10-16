"""
Heuristic computer-vision image analysis for food freshness.

IMPORTANT — READ THIS FIRST:
This module does NOT use a trained machine learning model. It does not
learn from data, and it was not trained on labeled fresh/spoiled
images. Every function here is a hand-written, rule-based measurement
using classic computer-vision techniques (color histograms, edge
detection, blob/contour analysis) via OpenCV and Pillow.

This is a reasonable, explainable MVP for detecting obvious visual
spoilage cues, but it is NOT a lab-grade or AI-based food safety test.
It should be described to users as "heuristic computer-vision
analysis," never as "AI-powered" or "machine learning-based."

All functions here are pure: given an image, they return numbers/flags.
They have no knowledge of FastAPI, the database, or the current user —
that keeps this module independently testable and reusable.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, asdict
from typing import Tuple

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError


class InvalidImageError(ValueError):
    """Raised when the uploaded bytes are not a decodable, supported image."""


# ---------------------------------------------------------------------------
# Image loading & validation
# ---------------------------------------------------------------------------

SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_DIMENSION = 4000  # px, guards against decompression-bomb style huge images


def load_and_validate_image(file_bytes: bytes) -> np.ndarray:
    """
    Validate that `file_bytes` is a real, supported image and return it
    as an OpenCV-compatible BGR numpy array.

    Raises InvalidImageError with a user-safe message on any problem.
    """
    try:
        pil_image = Image.open(io.BytesIO(file_bytes))
        pil_image.verify()  # checks the file isn't truncated/corrupt
        # verify() invalidates the file handle, so re-open for actual use
        pil_image = Image.open(io.BytesIO(file_bytes))
    except (UnidentifiedImageError, OSError):
        raise InvalidImageError("The uploaded file is not a valid image.")

    if pil_image.format not in SUPPORTED_FORMATS:
        raise InvalidImageError(
            f"Unsupported image format '{pil_image.format}'. "
            f"Supported formats: {', '.join(sorted(SUPPORTED_FORMATS))}."
        )

    if pil_image.width > MAX_DIMENSION or pil_image.height > MAX_DIMENSION:
        raise InvalidImageError(
            f"Image dimensions too large (max {MAX_DIMENSION}x{MAX_DIMENSION}px)."
        )

    pil_image = pil_image.convert("RGB")
    rgb_array = np.array(pil_image)
    bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    return bgr_array


# ---------------------------------------------------------------------------
# Color analysis (color degradation)
# ---------------------------------------------------------------------------

@dataclass
class ColorAnalysis:
    color_score: float  # 0-100, higher = fresher-looking color profile
    degradation_level: str  # none / mild / moderate / severe
    dominant_hue_shift: float


def analyze_color(image_bgr: np.ndarray) -> ColorAnalysis:
    """
    Heuristic color-degradation check.

    Approach: convert to HSV and look at how much of the image falls
    into "degraded" hue/saturation/value ranges typically associated
    with browning, greying, or blackening (low saturation + low value,
    or hue drifted into brown/grey bands) versus vividly saturated
    "fresh-looking" pixels.
    """
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    hue, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    # "Degraded" pixels: dull (low saturation) AND darker (low-ish value).
    # These thresholds are simple, hand-picked heuristics, not learned.
    degraded_mask = (sat < 60) & (val < 120)
    degraded_ratio = float(np.mean(degraded_mask))

    # Vividness of the rest of the image (fresh produce tends to be
    # more saturated).
    mean_saturation = float(np.mean(sat)) / 255.0  # 0-1

    # Combine: more degraded pixels + lower overall saturation -> lower score.
    color_score = 100.0 * (1.0 - degraded_ratio) * (0.5 + 0.5 * mean_saturation)
    color_score = max(0.0, min(100.0, color_score))

    # Rough "how far the average hue has drifted" toward brown/grey (hue ~ 15-30
    # in OpenCV's 0-179 hue range is a common browning band for produce).
    mean_hue = float(np.mean(hue))
    dominant_hue_shift = abs(mean_hue - 22.5)  # distance from the browning band center

    if color_score >= 80:
        level = "none"
    elif color_score >= 60:
        level = "mild"
    elif color_score >= 35:
        level = "moderate"
    else:
        level = "severe"

    return ColorAnalysis(
        color_score=round(color_score, 1),
        degradation_level=level,
        dominant_hue_shift=round(dominant_hue_shift, 1),
    )


# ---------------------------------------------------------------------------
# Texture analysis (surface texture changes)
# ---------------------------------------------------------------------------

@dataclass
class TextureAnalysis:
    texture_score: float  # 0-100, higher = smoother / more "expected" texture
    surface_roughness: float
    texture_change_level: str  # none / mild / moderate / severe


def analyze_texture(image_bgr: np.ndarray) -> TextureAnalysis:
    """
    Heuristic surface-texture check using the variance of the Laplacian
    (a standard, well-known CV technique for measuring local
    sharpness/roughness) plus local standard deviation as a second
    roughness signal. High local variance can indicate wrinkling,
    shriveling, mold texture, or bruised/uneven surfaces.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    laplacian_variance = float(laplacian.var())

    # Local roughness via a sliding-window standard deviation approximation.
    mean = cv2.blur(gray.astype(np.float32), (9, 9))
    mean_sq = cv2.blur((gray.astype(np.float32)) ** 2, (9, 9))
    local_variance = np.clip(mean_sq - mean**2, 0, None)
    surface_roughness = float(np.mean(np.sqrt(local_variance)))

    # Normalize into a 0-100 "texture score" — these divisors are
    # heuristic scaling constants tuned by inspection, not learned.
    normalized_laplacian = min(laplacian_variance / 500.0, 1.0)
    normalized_roughness = min(surface_roughness / 40.0, 1.0)

    roughness_penalty = 0.5 * normalized_laplacian + 0.5 * normalized_roughness
    texture_score = max(0.0, min(100.0, 100.0 * (1.0 - roughness_penalty)))

    if texture_score >= 80:
        level = "none"
    elif texture_score >= 60:
        level = "mild"
    elif texture_score >= 35:
        level = "moderate"
    else:
        level = "severe"

    return TextureAnalysis(
        texture_score=round(texture_score, 1),
        surface_roughness=round(surface_roughness, 2),
        texture_change_level=level,
    )


# ---------------------------------------------------------------------------
# Spoilage indicators: mold, bruising, physical damage
# ---------------------------------------------------------------------------

@dataclass
class SpoilageIndicators:
    mold_detected: bool
    mold_confidence: float  # 0.0-1.0
    bruising_detected: bool
    bruising_confidence: float  # 0.0-1.0
    physical_damage_detected: bool
    physical_damage_confidence: float  # 0.0-1.0


def _largest_contour_area_ratio(mask: np.ndarray, total_pixels: int) -> float:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0
    largest = max(cv2.contourArea(c) for c in contours)
    return float(largest) / float(total_pixels)


def detect_spoilage_indicators(image_bgr: np.ndarray) -> SpoilageIndicators:
    """
    Heuristic detection of three visible spoilage cues:

    - Mold: clusters of green/white/grey "fuzzy" color patches.
    - Bruising: dark, low-saturation, roughly circular blobs.
    - Physical damage: irregular breaks in an otherwise smooth silhouette,
      approximated via edge-density inside the object's contour.

    Each check is intentionally simple and explainable rather than
    exhaustive — false positives/negatives are expected on ambiguous
    or naturally textured/dark foods. See module docstring.
    """
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    total_pixels = gray.shape[0] * gray.shape[1]

    # ---- Mold: greenish/whitish fuzzy patches ----
    # Green mold band (hue ~35-85) combined with mid brightness,
    # OR very low-saturation whitish patches (white/grey mold).
    green_mold_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
    white_mold_mask = cv2.inRange(hsv, (0, 0, 150), (179, 40, 255))
    mold_mask = cv2.bitwise_or(green_mold_mask, white_mold_mask)
    mold_mask = cv2.morphologyEx(mold_mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    mold_ratio = _largest_contour_area_ratio(mold_mask, total_pixels)
    mold_confidence = min(mold_ratio * 8.0, 1.0)  # scaling constant, heuristic
    mold_detected = mold_confidence > 0.25

    # ---- Bruising: dark, low-saturation, roughly round blobs ----
    dark_mask = cv2.inRange(hsv, (0, 0, 0), (179, 90, 90))
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    bruise_ratio = _largest_contour_area_ratio(dark_mask, total_pixels)
    bruising_confidence = min(bruise_ratio * 6.0, 1.0)
    bruising_detected = bruising_confidence > 0.25

    # ---- Physical damage: edge density (irregular breaks/cuts/tears) ----
    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.mean(edges > 0))
    physical_damage_confidence = min(edge_density * 12.0, 1.0)
    physical_damage_detected = physical_damage_confidence > 0.30

    return SpoilageIndicators(
        mold_detected=mold_detected,
        mold_confidence=round(mold_confidence, 2),
        bruising_detected=bruising_detected,
        bruising_confidence=round(bruising_confidence, 2),
        physical_damage_detected=physical_damage_detected,
        physical_damage_confidence=round(physical_damage_confidence, 2),
    )


# ---------------------------------------------------------------------------
# Convenience: run everything at once
# ---------------------------------------------------------------------------

def run_full_analysis(
    file_bytes: bytes,
) -> Tuple[ColorAnalysis, TextureAnalysis, SpoilageIndicators]:
    """
    Validate + run all three heuristic analyses on one uploaded image.
    Raises InvalidImageError if the file isn't a valid/supported image.
    """
    image_bgr = load_and_validate_image(file_bytes)
    color = analyze_color(image_bgr)
    texture = analyze_texture(image_bgr)
    spoilage = detect_spoilage_indicators(image_bgr)
    return color, texture, spoilage


def analysis_results_to_dicts(
    color: ColorAnalysis, texture: TextureAnalysis
) -> Tuple[dict, dict]:
    """Small helper for callers that need plain dicts for JSON columns."""
    return asdict(color), asdict(texture)
