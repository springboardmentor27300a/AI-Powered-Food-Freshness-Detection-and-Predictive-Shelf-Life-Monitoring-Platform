"""
FreshSense AI - Analysis & Scientific Calculations Engine
Provides:
1. Color Analysis (OpenCV / PIL / NumPy)
2. Texture Analysis (OpenCV Laplacian / Edge Gradient)
3. Surface Spoilage & Heuristic Indicators (Mold, Bruising, Physical Damage)
4. Five-Tier Freshness Grading & Quality Scoring
5. Storage Condition Monitoring & Baseline Evaluation
6. Shelf-Life Estimation & Expiry Forecast
7. Storage & Consumption Recommendations
8. Inventory FEFO & Waste Reduction Insights
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import cv2
import numpy as np
from PIL import Image

# =========================================================
# FOOD CATEGORY STORAGE & SHELF-LIFE BASELINES
# =========================================================

CATEGORY_BASELINES = {
    "Fruits": {
        "ideal_temp_min": 4.0,
        "ideal_temp_max": 10.0,
        "ideal_humidity_min": 80.0,
        "ideal_humidity_max": 95.0,
        "baseline_shelf_life_days": 10.0,
        "preferred_packaging": "Perforated / Breathable",
        "preferred_location": "Refrigerator Crisper or Cool Pantry"
    },
    "Vegetables": {
        "ideal_temp_min": 2.0,
        "ideal_temp_max": 8.0,
        "ideal_humidity_min": 85.0,
        "ideal_humidity_max": 95.0,
        "baseline_shelf_life_days": 8.0,
        "preferred_packaging": "Breathable bag / Crisp bin",
        "preferred_location": "Refrigerator Crisper Drawer"
    },
    "Dairy Products": {
        "ideal_temp_min": 1.0,
        "ideal_temp_max": 4.0,
        "ideal_humidity_min": 50.0,
        "ideal_humidity_max": 70.0,
        "baseline_shelf_life_days": 7.0,
        "preferred_packaging": "Sealed airtight container",
        "preferred_location": "Main Refrigerator Shelf (avoid door)"
    },
    "Meat & Poultry": {
        "ideal_temp_min": 0.0,
        "ideal_temp_max": 3.0,
        "ideal_humidity_min": 65.0,
        "ideal_humidity_max": 80.0,
        "baseline_shelf_life_days": 3.0,
        "preferred_packaging": "Vacuum / Airtight wrap",
        "preferred_location": "Coldest Refrigerator Shelf / Deep Chill"
    },
    "Seafood": {
        "ideal_temp_min": 0.0,
        "ideal_temp_max": 2.0,
        "ideal_humidity_min": 75.0,
        "ideal_humidity_max": 85.0,
        "baseline_shelf_life_days": 2.0,
        "preferred_packaging": "Moisture-sealed leakproof wrap",
        "preferred_location": "Directly on crushed ice / Coldest Zone"
    },
    "Bakery Products": {
        "ideal_temp_min": 15.0,
        "ideal_temp_max": 22.0,
        "ideal_humidity_min": 45.0,
        "ideal_humidity_max": 60.0,
        "baseline_shelf_life_days": 5.0,
        "preferred_packaging": "Bread box / Paper or foil wrap",
        "preferred_location": "Cool, dry pantry away from sunlight"
    },
    "Packaged Foods": {
        "ideal_temp_min": 12.0,
        "ideal_temp_max": 24.0,
        "ideal_humidity_min": 35.0,
        "ideal_humidity_max": 60.0,
        "baseline_shelf_life_days": 45.0,
        "preferred_packaging": "Original factory seal",
        "preferred_location": "Dry pantry cabinet"
    },
    "Beverages": {
        "ideal_temp_min": 3.0,
        "ideal_temp_max": 10.0,
        "ideal_humidity_min": 40.0,
        "ideal_humidity_max": 75.0,
        "baseline_shelf_life_days": 14.0,
        "preferred_packaging": "Sealed bottle / carton",
        "preferred_location": "Refrigerator or Cool Storage"
    }
}


# =========================================================
# 1. COLOR ANALYSIS (OpenCV & NumPy)
# =========================================================

def analyze_color(image_np: np.ndarray) -> Dict[str, Any]:
    """
    Performs physical image-based color analysis.
    image_np is expected in RGB format (H, W, 3).
    """
    if image_np is None or image_np.size == 0:
        return {
            "dominant_color": "Unknown",
            "average_rgb": [0, 0, 0],
            "brightness": 0.0,
            "color_consistency": "Unknown",
            "color_condition": "Unknown",
            "discoloration_index": 0.0
        }

    # Ensure uint8
    if image_np.dtype != np.uint8:
        img_uint8 = np.clip(image_np, 0, 255).astype(np.uint8)
    else:
        img_uint8 = image_np

    # Compute average RGB channels
    avg_r = float(np.mean(img_uint8[:, :, 0]))
    avg_g = float(np.mean(img_uint8[:, :, 1]))
    avg_b = float(np.mean(img_uint8[:, :, 2]))

    # Perceived brightness / luminance (ITU-R BT.601)
    brightness = float(0.299 * avg_r + 0.587 * avg_g + 0.114 * avg_b)
    brightness_score = round(min(100.0, max(0.0, (brightness / 255.0) * 100.0)), 2)

    # Color variation (standard deviation across pixels)
    r_std = float(np.std(img_uint8[:, :, 0]))
    g_std = float(np.std(img_uint8[:, :, 1]))
    b_std = float(np.std(img_uint8[:, :, 2]))
    overall_std = (r_std + g_std + b_std) / 3.0

    if overall_std < 28.0:
        color_consistency = "High Uniformity"
    elif overall_std < 55.0:
        color_consistency = "Moderate Variation"
    else:
        color_consistency = "High Heterogeneity"

    # Convert to HSV to detect browning / degradation
    # Dull brown / decayed tones typically exhibit Hue 10-30 with lower Saturation/Value
    hsv = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2HSV)
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]

    # Brown / dark discolored mask
    browning_mask = ((h >= 8) & (h <= 28) & (s >= 50) & (v <= 150)) | (v < 40)
    browning_ratio = float(np.sum(browning_mask) / (img_uint8.shape[0] * img_uint8.shape[1])) * 100.0
    discoloration_index = round(min(100.0, browning_ratio), 2)

    # Determine dominant color category
    if avg_r > avg_g + 20 and avg_r > avg_b + 20:
        dominant_color = "Vibrant Red / Warm"
    elif avg_g > avg_r + 15 and avg_g > avg_b + 15:
        dominant_color = "Fresh Green / Leafy"
    elif avg_r > 160 and avg_g > 140 and avg_b < 100:
        dominant_color = "Golden Yellow / Orange"
    elif avg_r > 180 and avg_g > 180 and avg_b > 180:
        dominant_color = "Clean White / Light Cream"
    elif avg_r < 65 and avg_g < 65 and avg_b < 65:
        dominant_color = "Dark / Blackish Discoloration"
    elif abs(avg_r - avg_g) < 20 and abs(avg_g - avg_b) < 20 and avg_r < 110:
        dominant_color = "Muted Grayish-Brown"
    else:
        dominant_color = f"Mixed RGB ({int(avg_r)}, {int(avg_g)}, {int(avg_b)})"

    # Color Condition determination
    if discoloration_index < 12.0 and brightness_score > 32.0:
        color_condition = "Good"
        color_summary = "Natural and vibrant pigmentation with minimal browning."
    elif discoloration_index < 32.0:
        color_condition = "Moderate"
        color_summary = "Minor surface fading or localized color variation observed."
    else:
        color_condition = "Degraded"
        color_summary = "Significant discoloration, browning, or dull dark tones detected."

    return {
        "dominant_color": dominant_color,
        "average_rgb": [round(avg_r, 1), round(avg_g, 1), round(avg_b, 1)],
        "brightness": brightness_score,
        "color_consistency": color_consistency,
        "color_condition": color_condition,
        "discoloration_index": discoloration_index,
        "summary": color_summary
    }


# =========================================================
# 2. TEXTURE ANALYSIS (OpenCV Laplacian & Gradient)
# =========================================================

def analyze_texture(image_np: np.ndarray) -> Dict[str, Any]:
    """
    Image-based texture analysis using Laplacian variance, local contrast,
    and edge density.
    """
    if image_np is None or image_np.size == 0:
        return {
            "texture_condition": "Unknown",
            "laplacian_variance": 0.0,
            "edge_density": 0.0,
            "surface_roughness": 0.0,
            "method": "Image-based visual texture analysis"
        }

    # Convert to uint8 grayscale
    if image_np.dtype != np.uint8:
        img_uint8 = np.clip(image_np, 0, 255).astype(np.uint8)
    else:
        img_uint8 = image_np

    gray = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2GRAY)

    # 1. Laplacian variance (measures sharpness / micro-texture granularity)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = float(laplacian.var())

    # 2. Edge density via Canny edge detection
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])) * 100.0

    # 3. Local contrast (standard deviation of gray values)
    contrast = float(np.std(gray))

    # Surface roughness metric (normalized index 0 - 100)
    roughness = min(100.0, (lap_var / 12.0) + (edge_density * 1.5))

    # Texture Condition evaluation
    # Decayed/spoiled food often loses structural firmness or exhibits irregular wrinkling/shriveling
    if lap_var > 60.0 and edge_density < 18.0:
        texture_condition = "Good"
        texture_summary = "Firm, well-defined surface integrity with uniform texture."
    elif lap_var > 25.0 and edge_density < 30.0:
        texture_condition = "Moderate"
        texture_summary = "Acceptable surface texture with minor softening or slight irregularities."
    else:
        texture_condition = "Degraded"
        texture_summary = "Compromised surface structure, visible wrinkling, or micro-structural collapse."

    return {
        "texture_condition": texture_condition,
        "laplacian_variance": round(lap_var, 2),
        "edge_density": round(edge_density, 2),
        "contrast_index": round(contrast, 2),
        "surface_roughness": round(roughness, 2),
        "method": "Image-based visual texture analysis (OpenCV)",
        "summary": texture_summary
    }


# =========================================================
# 3. SPOILAGE & HEURISTIC INDICATORS
# =========================================================

def detect_surface_indicators(image_np: np.ndarray) -> Dict[str, Any]:
    """
    Estimates visual indicators (mold, bruising, physical damage) using
    computer vision color-texture heuristics.
    Clearly designated as heuristic image analysis.
    """
    if image_np is None or image_np.size == 0:
        return {
            "mold_detected": False,
            "mold_confidence": 0.0,
            "bruising_detected": False,
            "physical_damage_detected": False,
            "label": "Visual indicator / heuristic analysis"
        }

    if image_np.dtype != np.uint8:
        img_uint8 = np.clip(image_np, 0, 255).astype(np.uint8)
    else:
        img_uint8 = image_np

    hsv = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2HSV)
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    total_pixels = img_uint8.shape[0] * img_uint8.shape[1]

    # 1. Mold Heuristic: fungal patches typically exhibit whitish/grey or blue-green low-saturation fuzzy patches
    # HSV: Hue 40-100 (green/cyan), low saturation, medium-high value, OR grayish patches (s < 30, v > 120)
    mold_mask = ((h >= 45) & (h <= 95) & (s >= 20) & (s <= 110) & (v >= 60)) | ((s < 30) & (v >= 130) & (v <= 220))
    # Filter for contiguous clusters using morphological opening
    kernel = np.ones((5, 5), np.uint8)
    opened_mold = cv2.morphologyEx(mold_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)
    mold_ratio = float(np.sum(opened_mold > 0) / total_pixels) * 100.0

    mold_detected = mold_ratio > 4.5
    mold_confidence = min(95.0, round(mold_ratio * 12.0, 1)) if mold_detected else 0.0

    # 2. Bruising / Soft Spots Heuristic: localized darker, sunken patches with moderate saturation
    bruise_mask = ((h >= 8) & (h <= 30) & (s >= 40) & (s <= 160) & (v >= 30) & (v <= 90))
    opened_bruise = cv2.morphologyEx(bruise_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)
    bruise_ratio = float(np.sum(opened_bruise > 0) / total_pixels) * 100.0
    bruising_detected = bruise_ratio > 6.0

    # 3. Physical damage / tearing heuristic: sharp high-contrast fracture lines
    gray = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 90, 200)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=40, minLineLength=30, maxLineGap=8)
    line_count = len(lines) if lines is not None else 0
    physical_damage_detected = line_count > 14

    return {
        "mold_detected": mold_detected,
        "mold_risk": "High" if mold_ratio > 10.0 else ("Moderate" if mold_detected else "Low"),
        "mold_patch_ratio": round(mold_ratio, 2),
        "bruising_detected": bruising_detected,
        "bruising_ratio": round(bruise_ratio, 2),
        "physical_damage_detected": physical_damage_detected,
        "fracture_line_count": line_count,
        "indicator_label": "Visual indicator / heuristic analysis"
    }


# =========================================================
# 4. FIVE-TIER FRESHNESS GRADING
# =========================================================

def compute_five_tier_grade(probability: float) -> Dict[str, Any]:
    """
    Computes continuous Freshness Score and exact 5-tier classification.
    Probability p is from binary MobileNetV2 (p -> 0 Fresh, p -> 1 Spoiled).
    """
    raw_score = (1.0 - probability) * 100.0
    freshness_score = round(max(0.0, min(100.0, raw_score)), 2)

    if freshness_score >= 85.0:
        grade = "Fresh"
        consumption_rec = "Safe condition based on image analysis. Normal consumption recommended."
        storage_rec = "Store in optimal recommended conditions to maintain peak freshness."
    elif freshness_score >= 70.0:
        grade = "Good"
        consumption_rec = "Food is in good condition. Consume normally."
        storage_rec = "Maintain proper refrigeration or cool storage. Ensure packaging is intact."
    elif freshness_score >= 50.0:
        grade = "Acceptable"
        consumption_rec = "Quality is acceptable. Consider consuming soon before deterioration begins."
        storage_rec = "Refrigerate promptly, inspect for moisture accumulation, and consume in priority order."
    elif freshness_score >= 25.0:
        grade = "Near Spoilage"
        consumption_rec = "Food is approaching spoilage. Consume soon after careful visual inspection."
        storage_rec = "Separate immediately from fresh produce to prevent ethylene/spore transmission."
    else:
        grade = "Spoiled"
        consumption_rec = "Food appears spoiled. Do not consume."
        storage_rec = "Dispose of safely or compost to avoid bacterial contamination of nearby inventory."

    return {
        "freshness_score": freshness_score,
        "grade": grade,
        "consumption_recommendation": consumption_rec,
        "storage_recommendation": storage_rec
    }


# =========================================================
# 5. STORAGE CONDITION MONITORING
# =========================================================

def evaluate_storage_condition(
    category: str = "Fruits",
    temperature: Optional[float] = None,
    humidity: Optional[float] = None,
    air_circulation: Optional[str] = "Good",
    light_exposure: Optional[str] = "Low",
    packaging_type: Optional[str] = "Standard",
    storage_duration_days: Optional[int] = 0
) -> Dict[str, Any]:
    """
    Evaluates manual storage input against category baselines.
    Outputs Good / Warning / Critical condition with actionable guidance.
    """
    baseline = CATEGORY_BASELINES.get(category, CATEGORY_BASELINES["Fruits"])
    recommendations = []
    penalty = 0.0

    # If temperature is not provided, default to normal ambient 20°C for evaluation
    temp_val = temperature if temperature is not None else 20.0
    hum_val = humidity if humidity is not None else 55.0

    # 1. Temperature evaluation
    if temp_val > baseline["ideal_temp_max"] + 5.0:
        penalty += 40.0
        recommendations.append(
            f"Temperature ({temp_val}°C) is significantly above optimal range ({baseline['ideal_temp_min']}–{baseline['ideal_temp_max']}°C). Refrigerate immediately to prevent rapid microbial growth."
        )
    elif temp_val > baseline["ideal_temp_max"]:
        penalty += 20.0
        recommendations.append(
            f"Temperature is slightly elevated. Reduce storage temperature to below {baseline['ideal_temp_max']}°C."
        )
    elif temp_val < baseline["ideal_temp_min"] - 2.0:
        penalty += 15.0
        recommendations.append(
            f"Temperature ({temp_val}°C) is below recommended minimum. Protect from chill injury or freezing."
        )

    # 2. Humidity evaluation
    if hum_val > baseline["ideal_humidity_max"] + 10.0:
        penalty += 20.0
        recommendations.append("Excessive humidity detected. Improve ventilation to prevent fungal and mold growth.")
    elif hum_val < baseline["ideal_humidity_min"] - 15.0:
        penalty += 15.0
        recommendations.append("Low humidity causes moisture loss and dehydration. Use sealed or crisper packaging.")

    # 3. Light & Air Circulation
    if light_exposure and light_exposure.lower() in ["high", "direct sunlight", "direct"]:
        penalty += 15.0
        recommendations.append("Protect from direct light exposure to slow oxidation and vitamin degradation.")

    if air_circulation and air_circulation.lower() in ["poor", "stagnant"]:
        penalty += 10.0
        recommendations.append("Improve air circulation around items to prevent localized moisture pockets.")

    if not recommendations:
        recommendations.append("Storage parameters are aligned with optimal preservation baselines.")

    # Compute Storage Condition Score (0 - 100)
    storage_score = round(max(0.0, min(100.0, 100.0 - penalty)), 2)

    if storage_score >= 80.0:
        condition = "Good"
    elif storage_score >= 50.0:
        condition = "Warning"
    else:
        condition = "Critical"

    return {
        "condition": condition,
        "storage_score": storage_score,
        "temperature": temp_val,
        "humidity": hum_val,
        "category": category,
        "preferred_location": baseline["preferred_location"],
        "preferred_packaging": baseline["preferred_packaging"],
        "recommendations": recommendations,
        "label": "Manual Storage Input"
    }


# =========================================================
# 6. SHELF-LIFE PREDICTION
# =========================================================

def estimate_shelf_life(
    category: str = "Fruits",
    freshness_score: float = 85.0,
    temperature: Optional[float] = None,
    humidity: Optional[float] = None,
    storage_duration_days: Optional[int] = 0,
    expiry_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Estimates remaining shelf life using rule-based and storage kinetics models.
    Adjusts baseline category shelf-life via freshness score and temperature degradation factors.
    """
    baseline = CATEGORY_BASELINES.get(category, CATEGORY_BASELINES["Fruits"])
    base_days = baseline["baseline_shelf_life_days"]

    # Temperature acceleration factor (Q10 rule: spoilage rate roughly doubles every 10°C above optimal)
    temp_val = temperature if temperature is not None else 8.0
    optimal_avg = (baseline["ideal_temp_min"] + baseline["ideal_temp_max"]) / 2.0
    temp_diff = max(0.0, temp_val - optimal_avg)
    q10_factor = 2.0 ** (temp_diff / 10.0)

    # Freshness degradation fraction
    freshness_fraction = max(0.05, min(1.0, freshness_score / 100.0))

    # Calculate raw remaining days
    remaining_days = (base_days * freshness_fraction) / max(0.5, q10_factor)

    # Deduct storage duration already elapsed
    if storage_duration_days and storage_duration_days > 0:
        remaining_days = max(0.0, remaining_days - (storage_duration_days * 0.4))

    # If an explicit expiry date was provided by user, cross-verify
    if expiry_date_str:
        try:
            exp_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
            today = datetime.utcnow().date()
            days_to_expiry = (exp_date - today).days
            if days_to_expiry >= 0:
                # Weighted blend with expiration date
                remaining_days = min(float(days_to_expiry), remaining_days)
            else:
                remaining_days = 0.0
        except Exception:
            pass

    remaining_days = round(max(0.0, remaining_days), 1)
    expiry_forecast = (datetime.utcnow() + timedelta(days=remaining_days)).strftime("%Y-%m-%d")

    # Risk level & trend
    if remaining_days > 5.0:
        risk_level = "Low"
        trend = "Stable"
    elif remaining_days >= 2.0:
        risk_level = "Moderate"
        trend = "Steady Consumption"
    elif remaining_days > 0.0:
        risk_level = "High"
        trend = "Rapid Deterioration"
    else:
        risk_level = "Critical"
        trend = "Expired / Spoilage Imminent"

    return {
        "estimated_remaining_days": remaining_days,
        "expiry_forecast": expiry_forecast,
        "risk_level": risk_level,
        "shelf_life_trend": trend,
        "category": category,
        "basis": "Estimated using available food and storage information (Rule-based / AI-assisted estimation)"
    }


# =========================================================
# 7. WEIGHTED FOOD QUALITY SCORE (0 - 100)
# =========================================================

def calculate_quality_score(
    visual_freshness_score: float,
    storage_score: Optional[float] = None,
    shelf_life_score: Optional[float] = None,
    product_age_days: Optional[int] = None,
    category: str = "Fruits"
) -> Dict[str, Any]:
    """
    Weighted scoring model from the platform specification:
    - Visual Condition Analysis = 40%
    - Storage Conditions = 25%
    - Shelf-Life Prediction = 20%
    - Product Age = 15%

    Gracefully re-normalizes weights when optional storage/age inputs are absent.
    """
    factors_used = ["Visual Condition Analysis (40%)"]
    missing_inputs = []

    # Visual score (always available from model)
    visual_val = float(visual_freshness_score)

    weights = {"visual": 0.40}
    scores = {"visual": visual_val}

    # Storage conditions
    if storage_score is not None:
        weights["storage"] = 0.25
        scores["storage"] = float(storage_score)
        factors_used.append("Storage Conditions (25%)")
    else:
        missing_inputs.append("Storage Conditions (25%)")

    # Shelf-life score
    if shelf_life_score is not None:
        weights["shelf_life"] = 0.20
        scores["shelf_life"] = float(shelf_life_score)
        factors_used.append("Shelf-Life Prediction (20%)")
    else:
        missing_inputs.append("Shelf-Life Prediction (20%)")

    # Product age score
    if product_age_days is not None:
        baseline_days = CATEGORY_BASELINES.get(category, CATEGORY_BASELINES["Fruits"])["baseline_shelf_life_days"]
        age_score = max(0.0, min(100.0, 100.0 - (product_age_days / baseline_days) * 100.0))
        weights["product_age"] = 0.15
        scores["product_age"] = round(age_score, 2)
        factors_used.append("Product Age (15%)")
    else:
        missing_inputs.append("Product Age (15%)")

    # Re-normalize over available weights
    total_weight = sum(weights.values())
    weighted_sum = sum(scores[k] * weights[k] for k in weights)
    overall_score = round(weighted_sum / total_weight, 2)

    return {
        "overall_health_score": overall_score,
        "visual_condition_score": round(visual_val, 2),
        "storage_condition_score": scores.get("storage"),
        "shelf_life_score": scores.get("shelf_life"),
        "product_age_score": scores.get("product_age"),
        "factors_used": factors_used,
        "missing_inputs": missing_inputs
    }


# =========================================================
# 8. INVENTORY FEFO & WASTE REDUCTION INSIGHTS
# =========================================================

def compute_inventory_insights(inventory_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes FEFO (First-Expired, First-Out) priority, items at risk,
    and waste reduction recommendations.
    """
    today = datetime.utcnow().date()
    expiring_soon = []
    consume_first = []
    at_risk_qty = 0.0
    total_qty = 0.0
    fresh_stock = 0
    near_spoilage_stock = 0
    spoiled_stock = 0

    for item in inventory_items:
        qty = float(item.get("quantity") or 1.0)
        total_qty += qty
        exp_str = item.get("expiry_date")
        days_left = 999

        if exp_str:
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
                days_left = (exp_date - today).days
            except Exception:
                pass

        status = (item.get("freshness_status") or "Fresh").lower()
        if "spoil" in status:
            spoiled_stock += 1
            at_risk_qty += qty
            consume_first.append({**item, "reason": "Spoiled / Past Expiry", "days_left": days_left})
        elif "near" in status or days_left <= 2:
            near_spoilage_stock += 1
            at_risk_qty += qty
            consume_first.append({**item, "reason": f"Expires in {days_left} day(s)", "days_left": days_left})
        elif days_left <= 5:
            expiring_soon.append({**item, "days_left": days_left})
            at_risk_qty += qty
        else:
            fresh_stock += 1

    # Sort consume_first by urgency
    consume_first.sort(key=lambda x: x.get("days_left", 999))

    waste_recommendations = []
    if consume_first:
        waste_recommendations.append(
            f"Immediate Action: {len(consume_first)} item(s) are near spoilage or expired. Follow FEFO (First-Expired, First-Out) consumption."
        )
    if expiring_soon:
        waste_recommendations.append(
            f"{len(expiring_soon)} item(s) will expire within 5 days. Plan meal preparation around these items to minimize food waste."
        )
    if not waste_recommendations:
        waste_recommendations.append("All inventory items currently have stable shelf-life buffers.")

    return {
        "total_items": len(inventory_items),
        "total_quantity": round(total_qty, 1),
        "quantity_at_risk": round(at_risk_qty, 1),
        "fresh_stock_count": fresh_stock,
        "near_spoilage_count": near_spoilage_stock,
        "spoiled_stock_count": spoiled_stock,
        "consume_first": consume_first,
        "expiring_soon": expiring_soon,
        "waste_reduction_recommendations": waste_recommendations
    }
