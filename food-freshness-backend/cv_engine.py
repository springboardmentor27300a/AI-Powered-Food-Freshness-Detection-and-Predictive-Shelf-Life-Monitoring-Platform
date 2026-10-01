import numpy as np
from PIL import Image
import cv2
from datetime import datetime, date

# Optimal storage temperature defaults (°C) per category
OPTIMAL_TEMP_MAP = {
    "Fruits": 4.0,
    "Vegetables": 4.0,
    "Dairy Products": 3.0,
    "Meat & Poultry": 1.0,
    "Seafood": 0.5,
    "Bakery Products": 20.0,
    "Packaged Foods": 22.0,
    "Beverages": 5.0,
}

# Base max shelf life (days) when fresh
BASE_SHELFLIFE_DAYS = {
    "Fruits": 10.0,
    "Vegetables": 7.0,
    "Dairy Products": 14.0,
    "Meat & Poultry": 5.0,
    "Seafood": 3.0,
    "Bakery Products": 5.0,
    "Packaged Foods": 60.0,
    "Beverages": 30.0,
}


def analyze_color_degradation(pil_img: Image.Image):
    """Analyze color degradation, brownness index, and discoloration ratio using OpenCV HSV color space."""
    img_np = np.array(pil_img)
    if img_np.shape[2] == 4:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
    
    bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # Define HSV brown / decay color ranges
    lower_brown = np.array([5, 40, 20])
    upper_brown = np.array([30, 255, 180])
    
    mask = cv2.inRange(hsv, lower_brown, upper_brown)
    brown_pixels = cv2.countNonZero(mask)
    total_pixels = img_np.shape[0] * img_np.shape[1]

    browning_pct = round((brown_pixels / total_pixels) * 100, 2)
    # Color score: 100 minus browning penalty
    color_score = round(max(0.0, min(100.0, 100.0 - (browning_pct * 2.2))), 2)

    return color_score, browning_pct


def analyze_mold_and_bruising(pil_img: Image.Image):
    """Analyze surface texture anomalies, dark spots, and potential mold growth using OpenCV thresholding."""
    img_np = np.array(pil_img)
    if img_np.shape[2] == 4:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)

    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Detect dark anomaly spots (bruising / mold patches)
    _, dark_spots = cv2.threshold(blurred, 65, 255, cv2.THRESH_BINARY_INV)
    
    # Detect mold spots (greenish/white fungal growth in HSV)
    hsv = cv2.cvtColor(img_np, cv2.COLOR_RGB2HSV)
    lower_mold = np.array([35, 30, 120])
    upper_mold = np.array([85, 255, 255])
    mold_mask = cv2.inRange(hsv, lower_mold, upper_mold)

    total_pixels = gray.size
    spot_pixels = cv2.countNonZero(dark_spots)
    mold_pixels = cv2.countNonZero(mold_mask)

    bruising_pct = round((spot_pixels / total_pixels) * 100, 2)
    mold_pct = round((mold_pixels / total_pixels) * 100, 2)

    bruising_score = round(max(0.0, min(100.0, 100.0 - (bruising_pct * 1.8))), 2)
    mold_score = round(max(0.0, min(100.0, 100.0 - (mold_pct * 3.0))), 2)

    return mold_score, bruising_score, mold_pct, bruising_pct


def calculate_section_47_weighted_score(
    cnn_spoiled_prob: float,
    color_score: float,
    mold_score: float,
    bruising_score: float,
    category: str,
    storage_temp: float | None = None,
    expiry_date_str: str | None = None,
    humidity: float | None = None,
    packaging_type: str | None = "Loose",
):
    """
    Calculates Freshness Score according to Section 4.7 Weighted Model:
    - 40% Visual Condition Analysis (CNN Model + Color + Mold/Bruising)
    - 25% Storage Conditions Compliance (Optimal vs Actual Temperature + Humidity)
    - 20% Shelf-Life Prediction (Predicted Remaining Days, adjusted by packaging)
    - 15% Product Age & Expiry Proximity
    - Also computes risk level for Risk Forecasting
    """
    # 1. Visual Condition Analysis (40%)
    cnn_freshness = (1.0 - cnn_spoiled_prob) * 100.0
    visual_score = round(0.50 * cnn_freshness + 0.25 * color_score + 0.25 * min(mold_score, bruising_score), 2)

    # 2. Storage Conditions Compliance (25%) — Temperature + Humidity
    optimal_temp = OPTIMAL_TEMP_MAP.get(category, 4.0)
    if storage_temp is not None:
        temp_diff = abs(storage_temp - optimal_temp)
        temp_score = round(max(0.0, min(100.0, 100.0 - (temp_diff * 7.5))), 2)
    else:
        temp_score = 90.0

    # Humidity impact: ideal is 40-60% for most foods
    if humidity is not None:
        hum_penalty = max(0.0, humidity - 85.0) * 1.5 + max(0.0, 30.0 - humidity) * 1.0
        humidity_score = round(max(0.0, min(100.0, 100.0 - hum_penalty)), 2)
    else:
        humidity_score = 90.0

    storage_score = round((temp_score * 0.6) + (humidity_score * 0.4), 2)

    # 3. Shelf-Life Prediction (20%) — adjusted by Packaging Type
    base_days = BASE_SHELFLIFE_DAYS.get(category, 7.0)
    packaging_multiplier = {
        "Vacuum Sealed": 1.5,
        "Refrigerated Pack": 1.3,
        "Sealed Container": 1.2,
        "Loose": 1.0,
        "Open": 0.7,
    }.get(packaging_type or "Loose", 1.0)

    predicted_shelflife_days = round(
        max(0.1, (visual_score / 100.0) * (storage_score / 100.0) * base_days * packaging_multiplier), 1
    )
    shelflife_score = round(min(100.0, (predicted_shelflife_days / (base_days * packaging_multiplier)) * 100.0), 2)

    # 4. Product Age & Expiry Proximity (15%)
    if expiry_date_str:
        try:
            exp_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
            today = date.today()
            days_left = (exp_date - today).days
            if days_left <= 0:
                age_score = 0.0
            else:
                age_score = round(min(100.0, (days_left / 10.0) * 100.0), 2)
        except Exception:
            age_score = 80.0
    else:
        age_score = 80.0

    # Section 4.7 Weighted Combination
    final_score = round(
        0.40 * visual_score +
        0.25 * storage_score +
        0.20 * shelflife_score +
        0.15 * age_score,
        2
    )

    # Categorize based on final score
    if final_score >= 85:
        category_rating = "Fresh"
    elif final_score >= 70:
        category_rating = "Good"
    elif final_score >= 50:
        category_rating = "Acceptable"
    elif final_score >= 30:
        category_rating = "Near Spoilage"
    else:
        category_rating = "Spoiled"

    # Risk Level classification
    if final_score >= 70:
        risk_level = "Low Risk"
    elif final_score >= 40:
        risk_level = "Medium Risk"
    else:
        risk_level = "High Risk"

    return {
        "final_score": final_score,
        "category_rating": category_rating,
        "visual_score": visual_score,
        "storage_score": storage_score,
        "shelflife_score": shelflife_score,
        "shelflife_days": predicted_shelflife_days,
        "age_score": age_score,
        "risk_level": risk_level,
    }
