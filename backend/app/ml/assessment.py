"""
assessment.py — FreshGuard M2 Freshness Assessment Engine

Orchestrates:
  1. Image Analysis (color + texture metrics)
  2. CNN Model Inference (class probabilities)
  3. Freshness Category Mapping (dataset labels → project categories)
  4. Visual Quality Score Calculation (M2 component of the final M3 score)
  5. Structured JSON-serialisable result

Scoring Architecture (per project specification):
┌─────────────────────────────────────────────────────────────────┐
│  MILESTONE 2 (this file)                                        │
│  Image/Model Visual Quality Score (0–100)                       │
│    = Model Confidence Component  (70%)                          │
│    + Colour Integrity Component  (15%)                          │
│    + Texture Uniformity Component(15%)                          │
├─────────────────────────────────────────────────────────────────┤
│  MILESTONE 3 (future)                                           │
│  Final Freshness Score = Visual (40%) + Storage (25%)          │
│                        + Shelf-Life (20%) + Age (15%)           │
└─────────────────────────────────────────────────────────────────┘

The quality_score returned here represents the VISUAL CONDITION ANALYSIS
component that will feed the 40% weight in the full Milestone 3 model.
"""

import io
import json
from pathlib import Path
from typing import Dict, Optional

from .image_analysis import analyze_image

# ---------------------------------------------------------------------------
# Category Mapping: Dataset Labels → Project Freshness Categories
# ---------------------------------------------------------------------------
# The Kaggle "fruits fresh and rotten" dataset uses labels like:
#   freshapples, rottenapples, freshbanana, rottenbanana,
#   freshoranges, rottenoranges (and potentially others)
#
# We map these to the 5 project categories using:
#   (a) model confidence in the predicted class
#   (b) visual discoloration and texture metrics
#
# No labels are invented; the CNN predicts what the dataset trained it on.

def _map_to_freshness_category(
    is_fresh_class: bool,
    model_confidence: float,
    discoloration_index: float,
    texture_uniformity: float,
) -> str:
    """
    Map CNN prediction + visual metrics to a project freshness category.

    Args:
        is_fresh_class: True if the predicted class name starts with 'fresh'
        model_confidence: Softmax probability for the predicted class [0–1]
        discoloration_index: From image analysis [0–1], 0=none, 1=severe
        texture_uniformity: From image analysis [0–1], 1=uniform/smooth

    Returns:
        One of: 'Fresh', 'Good', 'Acceptable', 'Near Spoilage', 'Spoiled'
    """
    if is_fresh_class:
        # Model predicts fresh — refine by visual quality
        if model_confidence >= 0.80 and discoloration_index < 0.10 and texture_uniformity >= 0.75:
            return "Fresh"
        elif model_confidence >= 0.65 and discoloration_index < 0.20:
            return "Good"
        elif model_confidence >= 0.50:
            return "Acceptable"
        else:
            # Low-confidence fresh with visible degradation — borderline
            return "Near Spoilage"
    else:
        # Model predicts rotten/spoiled
        if model_confidence >= 0.80 and discoloration_index >= 0.30:
            return "Spoiled"
        elif model_confidence >= 0.65 or discoloration_index >= 0.20:
            return "Near Spoilage"
        else:
            # Low-confidence rotten — some ambiguity
            return "Acceptable"


def _extract_food_name(predicted_class: str) -> str:
    """
    Extract a human-readable food item name from dataset class label.
    e.g. 'freshapples' → 'Apple', 'rottenbanana' → 'Banana'
    """
    label = predicted_class.lower()
    # Remove freshness prefix
    for prefix in ["fresh", "rotten", "bad", "good"]:
        if label.startswith(prefix):
            label = label[len(prefix):]
            break

    # Capitalise and strip trailing 's' for singular
    label = label.strip().title()
    if label.endswith("s") and len(label) > 3:
        label = label[:-1]
    return label or "Unknown"


def _compute_visual_quality_score(
    is_fresh_class: bool,
    model_confidence: float,
    discoloration_index: float,
    texture_uniformity: float,
) -> int:
    """
    Compute the M2 Visual Quality Score (0–100).

    This represents the 'Visual Condition Analysis' component that will
    feed the 40% weight in the Milestone 3 final freshness score.

    Formula (explainable, based on available M2 data):
      confidence_score    = P(fresh) × 0.70
      colour_score        = (1 - discoloration_index) × 0.15
      texture_score       = texture_uniformity × 0.15
      raw_score           = (confidence_score + colour_score + texture_score) × 100

    Where P(fresh) is:
      - model_confidence if the class is 'fresh'
      - (1 - model_confidence) if the class is 'rotten' (inverted)
    """
    # P(fresh): probability that this image is fresh (regardless of class direction)
    p_fresh = model_confidence if is_fresh_class else (1.0 - model_confidence)

    confidence_component = p_fresh * 0.70
    colour_component = (1.0 - discoloration_index) * 0.15
    texture_component = texture_uniformity * 0.15

    raw_score = (confidence_component + colour_component + texture_component) * 100
    return max(0, min(100, round(raw_score)))


def _compute_spoilage_probability(
    is_fresh_class: bool,
    model_confidence: float,
    discoloration_index: float,
) -> float:
    """
    Compute spoilage probability [0.00 – 1.00].

    Directly derived from model output and visual degradation.
    P(spoilage) = (P(rotten) × 0.80) + (discoloration_index × 0.20)
    """
    p_rotten = (1.0 - model_confidence) if is_fresh_class else model_confidence
    spoilage_prob = (p_rotten * 0.80) + (discoloration_index * 0.20)
    return max(0.0, min(1.0, round(spoilage_prob, 4)))


# ---------------------------------------------------------------------------
# Model State (Lazy Loaded)
# ---------------------------------------------------------------------------
_model = None
_metadata = None
_device = None


def _load_model_if_needed():
    global _model, _metadata, _device
    if _model is None:
        from .model import load_model
        _model, _metadata, _device = load_model()


def is_model_ready() -> bool:
    from .model import is_model_available
    return is_model_available()


# ---------------------------------------------------------------------------
# Main Assessment Function
# ---------------------------------------------------------------------------

def assess_freshness(image_bytes: bytes) -> Dict:
    """
    Full freshness assessment pipeline for a single image.

    Args:
        image_bytes: Raw image file bytes (JPEG, PNG, WebP)

    Returns:
        Structured dict with classification, confidence, quality_score,
        spoilage_probability, and visual metric breakdowns.

    Raises:
        FileNotFoundError: If no trained model exists yet.
        ValueError: If image cannot be decoded.
    """
    import torch
    import torch.nn.functional as F
    from PIL import Image
    from torchvision import transforms

    # ── Step 1: Image Analysis ────────────────────────────────────────────
    try:
        visual = analyze_image(image_bytes)
    except Exception as e:
        raise ValueError(f"Could not analyse image: {e}") from e

    color_metrics = visual["color"]
    texture_metrics = visual["texture"]

    # ── Step 2: CNN Inference ─────────────────────────────────────────────
    _load_model_if_needed()

    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Cannot decode image: {e}") from e

    tensor = preprocess(img).unsqueeze(0).to(_device)

    with torch.no_grad():
        logits = _model(tensor)
        probabilities = F.softmax(logits, dim=1)[0]

    predicted_idx = int(probabilities.argmax().item())
    model_confidence = float(probabilities[predicted_idx].item())
    predicted_class = _metadata["idx_to_class"][str(predicted_idx)]

    # All class probabilities for transparency
    all_probs = {
        _metadata["idx_to_class"][str(i)]: round(float(probabilities[i].item()), 4)
        for i in range(len(probabilities))
    }

    # ── Step 3: Category Mapping ──────────────────────────────────────────
    # Determine if the predicted class represents "fresh" state
    is_fresh_class = predicted_class.lower().startswith("fresh")
    discoloration = color_metrics["discoloration_index"]
    uniformity = texture_metrics["texture_uniformity"]

    freshness_category = _map_to_freshness_category(
        is_fresh_class=is_fresh_class,
        model_confidence=model_confidence,
        discoloration_index=discoloration,
        texture_uniformity=uniformity,
    )

    # ── Step 4: Scoring ───────────────────────────────────────────────────
    quality_score = _compute_visual_quality_score(
        is_fresh_class=is_fresh_class,
        model_confidence=model_confidence,
        discoloration_index=discoloration,
        texture_uniformity=uniformity,
    )

    spoilage_probability = _compute_spoilage_probability(
        is_fresh_class=is_fresh_class,
        model_confidence=model_confidence,
        discoloration_index=discoloration,
    )

    # ── Step 5: Build Response ────────────────────────────────────────────
    return {
        # Core M2 results
        "classification": freshness_category,
        "confidence": round(model_confidence, 4),
        "quality_score": quality_score,
        "spoilage_probability": round(spoilage_probability, 4),

        # Model details
        "model_prediction": {
            "predicted_class": predicted_class,
            "food_item": _extract_food_name(predicted_class),
            "is_fresh_class": is_fresh_class,
            "all_class_probabilities": all_probs,
        },

        # Visual analysis breakdown
        "visual_analysis": {
            "color": {
                "dominant_color_hex": color_metrics["dominant_color_hex"],
                "mean_saturation": color_metrics["mean_saturation"],
                "mean_brightness": color_metrics["mean_brightness"],
                "browning_index": color_metrics["browning_index"],
                "dark_spot_ratio": color_metrics["dark_spot_ratio"],
                "discoloration_index": color_metrics["discoloration_index"],
            },
            "texture": {
                "surface_roughness": texture_metrics["surface_roughness"],
                "local_contrast": texture_metrics["local_contrast"],
                "texture_uniformity": texture_metrics["texture_uniformity"],
            },
        },

        # Scoring breakdown (for transparency with mentor)
        "score_breakdown": {
            "note": "M2 Visual Quality Score — will feed the 40% Visual Condition factor in the M3 full Freshness Score.",
            "p_fresh": round(model_confidence if is_fresh_class else 1.0 - model_confidence, 4),
            "confidence_component": round((model_confidence if is_fresh_class else 1.0 - model_confidence) * 0.70, 4),
            "colour_component": round((1.0 - discoloration) * 0.15, 4),
            "texture_component": round(uniformity * 0.15, 4),
        },
    }
