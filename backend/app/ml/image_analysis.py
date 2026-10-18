"""
image_analysis.py — FreshGuard M2
Visual feature extraction from food images using OpenCV.

Computes:
  1. Color Analysis  — dominant color, browning/discoloration index, HSV saturation
  2. Texture Analysis — Laplacian gradient variance (surface degradation), local contrast
  3. Dark Spot Detection — morphological isolation of dark regions
  4. Visual Degradation Summary — combined degradation indicator

All values are derived from the actual image pixels. No hardcoded results.
"""

import io
from typing import Dict

import cv2
import numpy as np


def analyze_image(image_bytes: bytes) -> Dict:
    """
    Run full visual analysis on raw image bytes.
    Returns a structured dict with color and texture metrics.
    """
    # Decode image bytes into an OpenCV BGR array
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Could not decode image bytes")

    # Resize to a standard 224x224 for consistent metric ranges
    img_bgr = cv2.resize(img_bgr, (224, 224), interpolation=cv2.INTER_AREA)

    # Convert colour spaces once — reuse everywhere
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # -- Analyse --
    color_metrics = _compute_color_metrics(img_rgb, img_hsv)
    texture_metrics = _compute_texture_metrics(img_gray)

    return {
        "color": color_metrics,
        "texture": texture_metrics,
    }


# ---------------------------------------------------------------------------
# Color Analysis (OpenCV HSV-based)
# ---------------------------------------------------------------------------

def _compute_color_metrics(img_rgb: np.ndarray, img_hsv: np.ndarray) -> Dict:
    """
    Compute color-based visual freshness indicators using OpenCV HSV.

    OpenCV HSV ranges:
      H: 0-179 (degrees / 2)
      S: 0-255
      V: 0-255

    Browning/Discoloration Index:
      Fresh fruit/vegetables have high green/orange saturation.
      Spoiled/rotten items shift toward brown/dark tones.

    Dark Spot Detection:
      Uses morphological opening to isolate connected dark regions,
      then computes the ratio of dark-spot area to total area.
    """
    h = img_hsv[:, :, 0].astype(np.float32)  # 0-179
    s = img_hsv[:, :, 1].astype(np.float32) / 255.0  # normalise to 0-1
    v = img_hsv[:, :, 2].astype(np.float32) / 255.0  # normalise to 0-1

    total_pixels = img_hsv.shape[0] * img_hsv.shape[1]

    # -- Browning Index (hue 7-25 in OpenCV = 14-50 degrees, brown-orange) --
    brown_mask = (
        (h >= 7) & (h <= 25) &
        (s >= 0.15) & (s <= 0.70) &
        (v >= 0.15) & (v <= 0.60)
    )
    browning_index = float(np.sum(brown_mask) / total_pixels)

    # -- Dark Spot Detection (morphological) --
    # Threshold on Value channel to find very dark pixels
    v_uint8 = img_hsv[:, :, 2]
    _, dark_binary = cv2.threshold(v_uint8, 30, 255, cv2.THRESH_BINARY_INV)
    # Morphological opening to remove noise and keep true dark spots
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dark_spots = cv2.morphologyEx(dark_binary, cv2.MORPH_OPEN, kernel)
    dark_spot_ratio = float(np.sum(dark_spots > 0) / total_pixels)

    # Combined discoloration indicator (0 = no discoloration, 1 = severe)
    discoloration = min(1.0, browning_index * 0.7 + dark_spot_ratio * 0.3)

    # -- Dominant Colour (mean RGB) --
    mean_rgb = img_rgb.mean(axis=(0, 1))
    dominant_color = {
        "r": int(round(mean_rgb[0])),
        "g": int(round(mean_rgb[1])),
        "b": int(round(mean_rgb[2])),
    }

    # -- Summary --
    mean_saturation = float(s.mean())
    mean_value = float(v.mean())

    return {
        "dominant_color_rgb": dominant_color,
        "dominant_color_hex": "#{:02x}{:02x}{:02x}".format(
            dominant_color["r"], dominant_color["g"], dominant_color["b"]
        ),
        "mean_saturation": round(mean_saturation, 4),
        "mean_brightness": round(mean_value, 4),
        "browning_index": round(browning_index, 4),
        "dark_spot_ratio": round(dark_spot_ratio, 4),
        "discoloration_index": round(discoloration, 4),
    }


# ---------------------------------------------------------------------------
# Texture Analysis (OpenCV Laplacian + Local Contrast)
# ---------------------------------------------------------------------------

def _compute_texture_metrics(img_gray: np.ndarray) -> Dict:
    """
    Compute texture-based visual freshness indicators.

    Laplacian Variance (cv2.Laplacian):
      Proper 2D Laplacian operator replaces the manual finite-difference
      approximation. Measures surface roughness / texture complexity.

    Local Contrast:
      Standard deviation of grayscale intensity, normalised to [0, 1].
    """
    gray_f32 = img_gray.astype(np.float32)

    # -- Laplacian Gradient Variance (OpenCV kernel, 64-bit output) --
    laplacian = cv2.Laplacian(img_gray, cv2.CV_64F)
    gradient_variance = float(laplacian.var())

    # Normalise to [0, 1] using an empirically reasonable max for food images
    MAX_VARIANCE = 3000.0
    surface_roughness = min(1.0, gradient_variance / MAX_VARIANCE)

    # -- Local Contrast --
    local_contrast = float(gray_f32.std() / 255.0)

    # -- Texture Uniformity (inverse of roughness for scoring) --
    texture_uniformity = max(0.0, 1.0 - surface_roughness)

    return {
        "gradient_variance": round(gradient_variance, 2),
        "surface_roughness": round(surface_roughness, 4),
        "local_contrast": round(local_contrast, 4),
        "texture_uniformity": round(texture_uniformity, 4),
    }
