# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# AI FOOD FRESHNESS + COMPUTER VISION + MILESTONE 3
# SHELF-LIFE + STORAGE INTELLIGENCE + RECOMMENDATION ENGINE
# ============================================================

import json
import math
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import cv2
import numpy as np
import tensorflow as tf


# ============================================================
# PATHS
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[2]

MODEL_PATH = BACKEND_DIR / "models" / "food_freshness_model.keras"
CLASS_NAMES_PATH = BACKEND_DIR / "models" / "class_names.json"

UPLOADS_DIR = BACKEND_DIR / "uploads"
ANALYSIS_DIR = UPLOADS_DIR / "analysis"

ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# IMAGE SETTINGS
# ============================================================

IMAGE_SIZE = (224, 224)


# ============================================================
# LOAD CLASS NAMES
# ============================================================

if not CLASS_NAMES_PATH.exists():
    raise FileNotFoundError(
        f"Class names file not found: {CLASS_NAMES_PATH}"
    )

with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as file:
    CLASS_NAMES = json.load(file)


REQUIRED_CLASSES = {
    "fresh",
    "less_fresh",
    "rotten",
}

if not REQUIRED_CLASSES.issubset(set(CLASS_NAMES)):
    raise ValueError(
        "class_names.json must contain: fresh, less_fresh, rotten"
    )


# ============================================================
# LOAD TRAINED MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Trained model not found: {MODEL_PATH}"
    )

MODEL = tf.keras.models.load_model(
    MODEL_PATH,
    compile=False,
)


print("============================================================")
print("FOOD FRESHNESS AI MODEL LOADED")
print("============================================================")
print(f"Model       : {MODEL_PATH}")
print(f"Classes     : {CLASS_NAMES}")
print(f"Image Size  : {IMAGE_SIZE}")
print("Computer Vision: OpenCV visual analysis enabled")
print("Shelf-Life Intelligence: enabled")
print("Storage Intelligence: enabled")
print("Recommendation Engine: enabled")
print("============================================================")


# ============================================================
# GENERAL HELPERS
# ============================================================

def clamp(value, minimum=0.0, maximum=100.0):
    return float(
        max(
            minimum,
            min(maximum, float(value)),
        )
    )


def pct(value):
    return round(clamp(value), 2)


def safe_ratio(value, total):
    if total <= 0:
        return 0.0

    return float(value) / float(total)


def safe_float(value, default=None):
    try:
        if value is None:
            return default

        return float(value)

    except (TypeError, ValueError):
        return default


def safe_date(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    return None


def normalize_text(value):
    """
    Normalize text for comparisons without changing the
    original value returned to the frontend.
    """
    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .replace("&", " and ")
    )


def normalize_food_name(food_name):
    if not food_name:
        return "other"

    normalized = normalize_text(food_name)

    return " ".join(normalized.split())


def normalize_category(category):
    """
    Normalize frontend/PDF category names into internal groups.

    Frontend examples:
        Fruits
        Vegetables
        Dairy Products
        Meat & Poultry
        Seafood
        Bakery Products
        Packaged Foods
        Beverages
        Other
    """

    normalized = normalize_text(category)

    normalized = " ".join(
        normalized.split()
    )

    category_aliases = {
        "fruit": "fruits",
        "fruits": "fruits",

        "vegetable": "vegetables",
        "vegetables": "vegetables",

        "dairy": "dairy",
        "dairy product": "dairy",
        "dairy products": "dairy",

        "meat": "meat",
        "meat poultry": "meat",
        "meat and poultry": "meat",
        "meat poultry products": "meat",

        "seafood": "seafood",
        "sea food": "seafood",

        "bakery": "bakery",
        "bakery product": "bakery",
        "bakery products": "bakery",

        "packaged food": "packaged foods",
        "packaged foods": "packaged foods",

        "beverage": "beverages",
        "beverages": "beverages",

        "other": "other",
    }

    if normalized in category_aliases:
        return category_aliases[normalized]

    # Defensive matching for slightly different frontend values.
    if "fruit" in normalized:
        return "fruits"

    if "vegetable" in normalized:
        return "vegetables"

    if "dairy" in normalized:
        return "dairy"

    if "meat" in normalized or "poultry" in normalized:
        return "meat"

    if "seafood" in normalized or "sea food" in normalized:
        return "seafood"

    if "bakery" in normalized:
        return "bakery"

    if "packaged" in normalized:
        return "packaged foods"

    if "beverage" in normalized:
        return "beverages"

    return "other"


def largest_contour(contours):
    if not contours:
        return None

    return max(
        contours,
        key=cv2.contourArea,
    )


def contour_boxes(
    mask,
    min_area=80,
    max_items=5,
):
    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    candidates = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if area < min_area:
            continue

        x, y, w, h = cv2.boundingRect(contour)

        if w < 4 or h < 4:
            continue

        candidates.append(
            (
                area,
                (
                    x,
                    y,
                    w,
                    h,
                ),
            )
        )

    candidates.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    return [
        box
        for _, box in candidates[:max_items]
    ]


def mask_fraction(
    mask,
    reference_mask=None,
):
    if reference_mask is not None:
        denominator = int(
            np.count_nonzero(reference_mask)
        )

        if denominator <= 0:
            return 0.0

        numerator = int(
            np.count_nonzero(
                cv2.bitwise_and(
                    mask,
                    reference_mask,
                )
            )
        )

        return safe_ratio(
            numerator,
            denominator,
        )

    return safe_ratio(
        int(np.count_nonzero(mask)),
        int(
            mask.shape[0]
            * mask.shape[1]
        ),
    )


# ============================================================
# FRESHNESS SCORE
# ============================================================

def calculate_freshness_score(
    probabilities,
    predicted_class,
):
    fresh_probability = float(
        probabilities[
            CLASS_NAMES.index("fresh")
        ]
    )

    less_fresh_probability = float(
        probabilities[
            CLASS_NAMES.index("less_fresh")
        ]
    )

    rotten_probability = float(
        probabilities[
            CLASS_NAMES.index("rotten")
        ]
    )

    if predicted_class == "fresh":
        score = (
            70
            + (
                fresh_probability
                * 30
            )
        )

    elif predicted_class == "less_fresh":
        score = (
            40
            + (
                less_fresh_probability
                * 30
            )
        )

    elif predicted_class == "rotten":
        score = (
            rotten_probability
            * 39
        )

    else:
        score = 0

    return round(
        clamp(score),
        2,
    )


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def preprocess_image(image_path):
    image = tf.keras.utils.load_img(
        image_path,
        target_size=IMAGE_SIZE,
    )

    image_array = (
        tf.keras.utils.img_to_array(
            image
        )
    )

    image_array = np.expand_dims(
        image_array,
        axis=0,
    )

    # Existing trained model preprocessing
    return image_array.astype(
        np.float32
    )


# ============================================================
# FOOD REGION ESTIMATION
# ============================================================

def build_food_mask(image):
    """
    Estimate the visible food region.

    This is used only by the visual-analysis layer.
    The trained freshness model is not modified.
    """

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV,
    )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]

    mask = np.zeros(
        gray.shape,
        dtype=np.uint8,
    )

    mask[
        (saturation > 35)
        & (value > 35)
    ] = 255

    mask[
        (value > 25)
        & (value < 245)
        & (saturation > 15)
    ] = 255

    kernel = np.ones(
        (7, 7),
        np.uint8,
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=2,
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel,
        iterations=1,
    )

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    if not contours:
        return (
            np.ones(
                gray.shape,
                dtype=np.uint8,
            )
            * 255
        )

    h, w = gray.shape
    image_area = h * w

    center_x = w / 2.0
    center_y = h / 2.0

    scored = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if area < (
            image_area * 0.01
        ):
            continue

        x, y, cw, ch = cv2.boundingRect(
            contour
        )

        cx = (
            x
            + cw / 2.0
        )

        cy = (
            y
            + ch / 2.0
        )

        distance = math.sqrt(
            (
                (cx - center_x)
                / max(w, 1)
            )
            ** 2
            + (
                (cy - center_y)
                / max(h, 1)
            )
            ** 2
        )

        centrality = max(
            0.0,
            1.0 - distance,
        )

        score = (
            area
            * (
                0.65
                + 0.35
                * centrality
            )
        )

        scored.append(
            (
                score,
                contour,
            )
        )

    if not scored:
        return (
            np.ones(
                gray.shape,
                dtype=np.uint8,
            )
            * 255
        )

    _, best = max(
        scored,
        key=lambda item: item[0],
    )

    food_mask = np.zeros(
        gray.shape,
        dtype=np.uint8,
    )

    cv2.drawContours(
        food_mask,
        [best],
        -1,
        255,
        thickness=-1,
    )

    food_mask = cv2.dilate(
        food_mask,
        np.ones(
            (9, 9),
            np.uint8,
        ),
        iterations=1,
    )

    return food_mask


# ============================================================
# VISUAL ANALYSIS
# ============================================================

def analyse_visual_condition(
    image,
    food_name,
):
    """
    Existing OpenCV visual analysis:

    - Color Analysis
    - Color Degradation
    - Texture Analysis
    - Surface Texture Changes
    - Mold Detection
    - Bruising Detection
    - Physical Damage
    - Spoilage Identification

    Existing visual marker generation is preserved.
    """

    original = image.copy()

    h, w = image.shape[:2]

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV,
    )

    lab = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2LAB,
    )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    food_mask = build_food_mask(image)

    food_pixels = max(
        int(
            np.count_nonzero(
                food_mask
            )
        ),
        1,
    )

    # ========================================================
    # 1. COLOR ANALYSIS
    # ========================================================

    mean_bgr = cv2.mean(
        image,
        mask=food_mask,
    )[:3]

    mean_hsv = cv2.mean(
        hsv,
        mask=food_mask,
    )[:3]

    mean_lab = cv2.mean(
        lab,
        mask=food_mask,
    )[:3]

    saturation_mean = mean_hsv[1]
    brightness_mean = mean_hsv[2]

    color_variation = (
        float(
            np.std(
                hsv[:, :, 1][
                    food_mask > 0
                ]
            )
        )
        if food_pixels > 1
        else 0.0
    )

    color_score = clamp(
        100.0
        - abs(
            float(brightness_mean)
            - 145.0
        )
        * 0.18
        - abs(
            float(saturation_mean)
            - 105.0
        )
        * 0.20
        - max(
            color_variation
            - 65.0,
            0.0,
        )
        * 0.18
    )

    color_status = (
        "Healthy colour appearance"
        if color_score >= 75
        else "Slight colour variation"
        if color_score >= 55
        else "Noticeable colour variation"
    )

    # ========================================================
    # 2. COLOR DEGRADATION
    # ========================================================

    brown_mask = cv2.inRange(
        hsv,
        np.array(
            [5, 45, 20],
            dtype=np.uint8,
        ),
        np.array(
            [28, 255, 175],
            dtype=np.uint8,
        ),
    )

    dark_mask = cv2.inRange(
        hsv,
        np.array(
            [0, 0, 0],
            dtype=np.uint8,
        ),
        np.array(
            [180, 255, 65],
            dtype=np.uint8,
        ),
    )

    degradation_mask = cv2.bitwise_or(
        brown_mask,
        dark_mask,
    )

    degradation_fraction = mask_fraction(
        degradation_mask,
        food_mask,
    )

    degradation_score = clamp(
        degradation_fraction
        * 520.0
    )

    degradation_status = (
        "No significant degradation"
        if degradation_score < 15
        else "Mild colour degradation"
        if degradation_score < 35
        else "Visible colour degradation"
        if degradation_score < 60
        else "High colour degradation"
    )

    degradation_boxes = contour_boxes(
        cv2.bitwise_and(
            degradation_mask,
            food_mask,
        ),
        min_area=max(
            60,
            int(
                food_pixels
                * 0.00035
            ),
        ),
        max_items=5,
    )

    # ========================================================
    # 3. TEXTURE ANALYSIS
    # ========================================================

    laplacian_variance = float(
        cv2.Laplacian(
            gray,
            cv2.CV_64F,
        ).var()
    )

    edge_map = cv2.Canny(
        gray,
        70,
        150,
    )

    edge_fraction = mask_fraction(
        edge_map,
        food_mask,
    )

    texture_score = clamp(
        45.0
        + min(
            laplacian_variance,
            300.0,
        )
        * 0.16
    )

    texture_status = (
        "Distinct surface texture"
        if texture_score >= 75
        else "Moderate surface texture"
        if texture_score >= 55
        else "Low/soft surface texture"
    )

    # ========================================================
    # 4. SURFACE TEXTURE CHANGES
    # ========================================================

    local_blur = cv2.GaussianBlur(
        gray,
        (0, 0),
        5,
    )

    local_difference = cv2.absdiff(
        gray,
        local_blur,
    )

    surface_change_mask = (
        (
            local_difference > 18
        ).astype(np.uint8)
        * 255
    )

    local_texture_fraction = mask_fraction(
        surface_change_mask,
        food_mask,
    )

    surface_change_score = clamp(
        (
            local_texture_fraction
            * 180.0
        )
        + (
            edge_fraction
            * 80.0
        )
    )

    surface_texture_status = (
        "No major surface change"
        if surface_change_score < 20
        else "Mild surface texture change"
        if surface_change_score < 45
        else "Visible surface texture change"
        if surface_change_score < 70
        else "Strong surface deterioration pattern"
    )

    surface_boxes = contour_boxes(
        cv2.bitwise_and(
            surface_change_mask,
            food_mask,
        ),
        min_area=max(
            40,
            int(
                food_pixels
                * 0.00025
            ),
        ),
        max_items=4,
    )

    # ========================================================
    # 5. MOLD DETECTION
    # ========================================================

    mold_dark = cv2.inRange(
        hsv,
        np.array(
            [0, 0, 0],
            dtype=np.uint8,
        ),
        np.array(
            [180, 110, 85],
            dtype=np.uint8,
        ),
    )

    mold_green_gray = cv2.inRange(
        hsv,
        np.array(
            [35, 20, 20],
            dtype=np.uint8,
        ),
        np.array(
            [95, 180, 150],
            dtype=np.uint8,
        ),
    )

    mold_candidate = cv2.bitwise_or(
        mold_dark,
        mold_green_gray,
    )

    mold_candidate = cv2.morphologyEx(
        mold_candidate,
        cv2.MORPH_OPEN,
        np.ones(
            (5, 5),
            np.uint8,
        ),
    )

    mold_fraction = mask_fraction(
        mold_candidate,
        food_mask,
    )

    mold_boxes = contour_boxes(
        cv2.bitwise_and(
            mold_candidate,
            food_mask,
        ),
        min_area=max(
            80,
            int(
                food_pixels
                * 0.00045
            ),
        ),
        max_items=4,
    )

    mold_cluster_fraction = safe_ratio(
        len(mold_boxes),
        4,
    )

    mold_score = clamp(
        mold_fraction
        * 650.0
        + mold_cluster_fraction
        * 18.0
    )

    mold_status = (
        "No visible mold-like pattern"
        if mold_score < 18
        else "Possible mold-like surface pattern"
        if mold_score < 40
        else "Visible mold-like pattern"
    )

    # ========================================================
    # 6. BRUISING DETECTION
    # ========================================================

    bruising_brown = cv2.inRange(
        hsv,
        np.array(
            [0, 45, 15],
            dtype=np.uint8,
        ),
        np.array(
            [18, 255, 120],
            dtype=np.uint8,
        ),
    )

    bruising_purple = cv2.inRange(
        hsv,
        np.array(
            [125, 35, 15],
            dtype=np.uint8,
        ),
        np.array(
            [175, 255, 150],
            dtype=np.uint8,
        ),
    )

    bruising_mask = cv2.bitwise_or(
        bruising_brown,
        bruising_purple,
    )

    bruising_mask = cv2.morphologyEx(
        bruising_mask,
        cv2.MORPH_OPEN,
        np.ones(
            (5, 5),
            np.uint8,
        ),
    )

    bruising_fraction = mask_fraction(
        bruising_mask,
        food_mask,
    )

    bruising_boxes = contour_boxes(
        cv2.bitwise_and(
            bruising_mask,
            food_mask,
        ),
        min_area=max(
            70,
            int(
                food_pixels
                * 0.00035
            ),
        ),
        max_items=4,
    )

    bruising_score = clamp(
        bruising_fraction
        * 800.0
        + len(bruising_boxes)
        * 4.0
    )

    bruising_status = (
        "No significant bruising detected"
        if bruising_score < 18
        else "Mild bruising-like patch"
        if bruising_score < 40
        else "Visible bruising-like patches"
    )

    # ========================================================
    # 7. PHYSICAL DAMAGE
    # ========================================================

    damage_edges = cv2.Canny(
        gray,
        100,
        210,
    )

    damage_edges = cv2.bitwise_and(
        damage_edges,
        food_mask,
    )

    damage_edges = cv2.dilate(
        damage_edges,
        np.ones(
            (3, 3),
            np.uint8,
        ),
        iterations=1,
    )

    damage_boxes = contour_boxes(
        damage_edges,
        min_area=max(
            45,
            int(
                food_pixels
                * 0.00020
            ),
        ),
        max_items=5,
    )

    damage_fraction = mask_fraction(
        damage_edges,
        food_mask,
    )

    physical_damage_score = clamp(
        damage_fraction
        * 230.0
        + len(damage_boxes)
        * 2.5
    )

    physical_damage_status = (
        "No major physical damage visible"
        if physical_damage_score < 22
        else "Possible minor surface damage"
        if physical_damage_score < 45
        else "Visible physical damage pattern"
    )

    # ========================================================
    # 8. SPOILAGE IDENTIFICATION
    # ========================================================

    spoilage_score = clamp(
        degradation_score * 0.30
        + mold_score * 0.30
        + bruising_score * 0.15
        + surface_change_score * 0.15
        + physical_damage_score * 0.10
    )

    if spoilage_score < 20:
        spoilage_status = (
            "No significant visual spoilage detected"
        )

    elif spoilage_score < 40:
        spoilage_status = (
            "Low visual spoilage risk"
        )

    elif spoilage_score < 65:
        spoilage_status = (
            "Moderate visual spoilage indicators"
        )

    else:
        spoilage_status = (
            "High visual spoilage indicators"
        )

    # ========================================================
    # VISUAL HEALTH SUMMARY
    # ========================================================

    visual_condition_score = clamp(
        100.0 - spoilage_score
    )

    visual_condition = (
        "Healthy visual condition"
        if visual_condition_score >= 75
        else "Mostly healthy with minor visual changes"
        if visual_condition_score >= 55
        else "Visible quality deterioration"
        if visual_condition_score >= 35
        else "Poor visual condition"
    )

    # ========================================================
    # ANNOTATION DATA
    # ========================================================

    annotated = original.copy()

    marker_definitions = [
        {
            "key": "color_degradation",
            "short": "Color",
            "label": degradation_status,
            "score": degradation_score,
            "boxes": degradation_boxes,
            "color": (255, 120, 80),
        },
        {
            "key": "surface_texture_changes",
            "short": "Texture",
            "label": surface_texture_status,
            "score": surface_change_score,
            "boxes": surface_boxes,
            "color": (180, 80, 230),
        },
        {
            "key": "mold_detection",
            "short": "Mold",
            "label": mold_status,
            "score": mold_score,
            "boxes": mold_boxes,
            "color": (50, 180, 70),
        },
        {
            "key": "bruising_detection",
            "short": "Bruise",
            "label": bruising_status,
            "score": bruising_score,
            "boxes": bruising_boxes,
            "color": (60, 70, 180),
        },
        {
            "key": "physical_damage",
            "short": "Damage",
            "label": physical_damage_status,
            "score": physical_damage_score,
            "boxes": damage_boxes,
            "color": (40, 80, 230),
        },
    ]

    marker_number = 1
    marker_legend = []

    for definition in marker_definitions:
        boxes = definition["boxes"]

        if not boxes:
            marker_legend.append(
                f"{definition['short']}: none"
            )
            continue

        marker_legend.append(
            f"{definition['short']}: {len(boxes)} region(s)"
        )

        for box in boxes[:3]:
            x, y, bw, bh = box
            color = definition["color"]

            cv2.rectangle(
                annotated,
                (x, y),
                (
                    x + bw,
                    y + bh,
                ),
                color,
                3,
            )

            label = (
                f"{marker_number}. "
                f"{definition['short']}"
            )

            marker_number += 1

            font = cv2.FONT_HERSHEY_SIMPLEX

            font_scale = max(
                0.48,
                min(
                    0.72,
                    w / 1000.0,
                ),
            )

            thickness = 2

            (
                tw,
                th,
            ), baseline = cv2.getTextSize(
                label,
                font,
                font_scale,
                thickness,
            )

            label_y = max(
                y,
                th + baseline + 4,
            )

            cv2.rectangle(
                annotated,
                (
                    x,
                    label_y
                    - th
                    - baseline
                    - 6,
                ),
                (
                    min(
                        w - 1,
                        x + tw + 12,
                    ),
                    label_y + 2,
                ),
                color,
                -1,
            )

            cv2.putText(
                annotated,
                label,
                (
                    x + 6,
                    label_y - 4,
                ),
                font,
                font_scale,
                (255, 255, 255),
                thickness,
                cv2.LINE_AA,
            )

    # ========================================================
    # IMAGE TITLE
    # ========================================================

    overlay = annotated.copy()

    title_height = max(
        70,
        int(h * 0.11),
    )

    cv2.rectangle(
        overlay,
        (0, 0),
        (
            w,
            title_height,
        ),
        (5, 59, 39),
        -1,
    )

    annotated = cv2.addWeighted(
        overlay,
        0.82,
        annotated,
        0.18,
        0,
    )

    cv2.putText(
        annotated,
        (
            "FreshGuard Visual Inspection - "
            f"{food_name}"
        ),
        (
            18,
            30,
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        max(
            0.55,
            min(
                0.9,
                w / 1200.0,
            ),
        ),
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    cv2.putText(
        annotated,
        (
            "Visual condition: "
            f"{visual_condition}"
        ),
        (
            18,
            57,
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        max(
            0.42,
            min(
                0.65,
                w / 1500.0,
            ),
        ),
        (220, 255, 235),
        1,
        cv2.LINE_AA,
    )

    # ========================================================
    # BOTTOM LEGEND
    # ========================================================

    legend_height = max(
        72,
        int(h * 0.13),
    )

    legend_y = h - legend_height

    overlay = annotated.copy()

    cv2.rectangle(
        overlay,
        (
            0,
            legend_y,
        ),
        (
            w,
            h,
        ),
        (5, 59, 39),
        -1,
    )

    annotated = cv2.addWeighted(
        overlay,
        0.82,
        annotated,
        0.18,
        0,
    )

    legend_text = " | ".join(
        marker_legend
    )

    first_line = legend_text[:120]
    second_line = legend_text[120:240]

    cv2.putText(
        annotated,
        "Markers: " + first_line,
        (
            16,
            legend_y + 27,
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        max(
            0.38,
            min(
                0.58,
                w / 1600.0,
            ),
        ),
        (235, 255, 242),
        1,
        cv2.LINE_AA,
    )

    if second_line:
        cv2.putText(
            annotated,
            second_line,
            (
                16,
                legend_y + 52,
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            max(
                0.38,
                min(
                    0.58,
                    w / 1600.0,
                ),
            ),
            (235, 255, 242),
            1,
            cv2.LINE_AA,
        )

    # ========================================================
    # SAVE ANNOTATED IMAGE
    # ========================================================

    annotated_name = (
        f"analysis_{uuid.uuid4().hex}.jpg"
    )

    annotated_path = (
        ANALYSIS_DIR
        / annotated_name
    )

    if not cv2.imwrite(
        str(annotated_path),
        annotated,
        [
            int(cv2.IMWRITE_JPEG_QUALITY),
            92,
        ],
    ):
        raise RuntimeError(
            "Unable to save the annotated visual-analysis image."
        )

    return {
        "image_analysis_version": "opencv-v1",

        "image_url": (
            f"/uploads/analysis/"
            f"{annotated_name}"
        ),

        "visual_condition": visual_condition,

        "visual_condition_score": round(
            visual_condition_score,
            2,
        ),

        "color_analysis": color_status,

        "color_score": round(
            color_score,
            2,
        ),

        "color_confidence": round(
            color_score,
            2,
        ),

        "color_mean_bgr": [
            round(float(v), 2)
            for v in mean_bgr
        ],

        "color_mean_hsv": [
            round(float(v), 2)
            for v in mean_hsv
        ],

        "color_mean_lab": [
            round(float(v), 2)
            for v in mean_lab
        ],

        "color_degradation": degradation_status,

        "color_degradation_score": round(
            degradation_score,
            2,
        ),

        "color_degradation_confidence": round(
            degradation_score,
            2,
        ),

        "texture_analysis": texture_status,

        "texture_score": round(
            texture_score,
            2,
        ),

        "texture_confidence": round(
            texture_score,
            2,
        ),

        "surface_texture_changes": (
            surface_texture_status
        ),

        "surface_texture_score": round(
            surface_change_score,
            2,
        ),

        "surface_texture_confidence": round(
            surface_change_score,
            2,
        ),

        "mold_detection": mold_status,

        "mold_score": round(
            mold_score,
            2,
        ),

        "mold_confidence": round(
            mold_score,
            2,
        ),

        "bruising_detection": bruising_status,

        "bruising_score": round(
            bruising_score,
            2,
        ),

        "bruising_confidence": round(
            bruising_score,
            2,
        ),

        "physical_damage": physical_damage_status,

        "physical_damage_detection": (
            physical_damage_status
        ),

        "physical_damage_score": round(
            physical_damage_score,
            2,
        ),

        "physical_damage_confidence": round(
            physical_damage_score,
            2,
        ),

        "spoilage_identification": (
            spoilage_status
        ),

        "spoilage_score": round(
            spoilage_score,
            2,
        ),

        "spoilage_confidence": round(
            spoilage_score,
            2,
        ),

        "spoilage_risk": spoilage_status,

        "spoilage_risk_score": round(
            spoilage_score,
            2,
        ),

        "marker_regions": {
            definition["key"]: [
                {
                    "x": int(box[0]),
                    "y": int(box[1]),
                    "width": int(box[2]),
                    "height": int(box[3]),
                }
                for box in definition["boxes"][:5]
            ]
            for definition in marker_definitions
        },

        "analysis_notes": [
            (
                "Visual indicators are calculated "
                "from the uploaded image using OpenCV."
            ),
            (
                "Detected regions are highlighted "
                "on the annotated image."
            ),
            (
                "The trained freshness classifier "
                "remains the main freshness assessment."
            ),
        ],
    }


# ============================================================
# MILESTONE 3
# SHELF-LIFE BASELINE DATABASE
# ============================================================

DEFAULT_SHELF_LIFE_DAYS = {
    "fruits": 7.0,
    "vegetables": 7.0,
    "dairy": 7.0,
    "meat": 4.0,
    "seafood": 3.0,
    "bakery": 5.0,
    "packaged foods": 30.0,
    "beverages": 14.0,
    "other": 7.0,
}


FOOD_SHELF_LIFE_DAYS = {
    "apple": 21.0,
    "banana": 7.0,
    "orange": 21.0,
    "mango": 7.0,
    "grapes": 10.0,
    "strawberry": 5.0,
    "strawberries": 5.0,
    "watermelon": 10.0,
    "papaya": 6.0,
    "pineapple": 7.0,

    "tomato": 7.0,
    "potato": 21.0,
    "onion": 30.0,
    "carrot": 21.0,
    "cucumber": 7.0,
    "cabbage": 14.0,
    "broccoli": 7.0,
    "spinach": 5.0,
    "cauliflower": 7.0,
    "peas": 5.0,

    "milk": 7.0,
    "curd": 7.0,
    "yogurt": 14.0,
    "cheese": 21.0,
    "butter": 30.0,

    "chicken": 3.0,
    "mutton": 4.0,
    "beef": 4.0,
    "meat": 4.0,

    "fish": 2.0,
    "prawns": 2.0,
    "shrimp": 2.0,
    "seafood": 2.0,

    "bread": 5.0,
    "cake": 5.0,

    "juice": 7.0,
    "water": 365.0,
}


# ============================================================
# FOOD NAME NORMALIZATION
# ============================================================

def get_base_shelf_life_days(
    food_name,
    category=None,
):
    normalized_name = normalize_food_name(
        food_name
    )

    if normalized_name in FOOD_SHELF_LIFE_DAYS:
        return FOOD_SHELF_LIFE_DAYS[
            normalized_name
        ]

    normalized_category = normalize_category(
        category
    )

    return DEFAULT_SHELF_LIFE_DAYS.get(
        normalized_category,
        DEFAULT_SHELF_LIFE_DAYS["other"],
    )


# ============================================================
# STORAGE INTELLIGENCE
# ============================================================

def calculate_storage_intelligence(
    food_name,
    category=None,
    storage_temperature=None,
    storage_humidity=None,
    packaging_type=None,
    storage_duration=None,
    air_circulation=None,
    light_exposure=None,
):
    """
    Estimate storage compliance using available food/storage
    parameters.

    This is a rule-based intelligence layer, not a replacement
    for physical IoT sensors.
    """

    temperature = safe_float(
        storage_temperature
    )

    humidity = safe_float(
        storage_humidity
    )

    duration = safe_float(
        storage_duration,
        0.0,
    )

    packaging = normalize_text(
        packaging_type
    )

    circulation = normalize_text(
        air_circulation
    )

    light = normalize_text(
        light_exposure
    )

    category_normalized = normalize_category(
        category
    )

    # --------------------------------------------------------
    # Category-based temperature guidance
    # --------------------------------------------------------

    if category_normalized in {
        "meat",
        "seafood",
    }:
        ideal_min = 0.0
        ideal_max = 4.0

    elif category_normalized == "dairy":
        ideal_min = 1.0
        ideal_max = 7.0

    elif category_normalized == "fruits":
        ideal_min = 2.0
        ideal_max = 12.0

    elif category_normalized == "vegetables":
        ideal_min = 2.0
        ideal_max = 10.0

    elif category_normalized == "bakery":
        ideal_min = 15.0
        ideal_max = 25.0

    elif category_normalized == "packaged foods":
        ideal_min = 10.0
        ideal_max = 25.0

    elif category_normalized == "beverages":
        ideal_min = 2.0
        ideal_max = 10.0

    else:
        ideal_min = 5.0
        ideal_max = 25.0

    # --------------------------------------------------------
    # Temperature score
    # --------------------------------------------------------

    if temperature is None:
        temperature_score = 70.0
        temperature_status = (
            "Temperature not provided"
        )

    else:
        if ideal_min <= temperature <= ideal_max:
            temperature_score = 100.0
            temperature_status = (
                "Temperature within recommended range"
            )

        elif temperature < ideal_min:
            difference = ideal_min - temperature

            temperature_score = clamp(
                100.0 - difference * 12.0
            )

            temperature_status = (
                "Storage temperature is below the typical range"
            )

        else:
            difference = temperature - ideal_max

            temperature_score = clamp(
                100.0 - difference * 12.0
            )

            temperature_status = (
                "Storage temperature is above the typical range"
            )

    # --------------------------------------------------------
    # Humidity score
    # --------------------------------------------------------

    if humidity is None:
        humidity_score = 70.0
        humidity_status = (
            "Humidity not provided"
        )

    else:
        if category_normalized in {
            "fruits",
            "vegetables",
        }:
            humidity_min = 50.0
            humidity_max = 90.0

        elif category_normalized == "dairy":
            humidity_min = 30.0
            humidity_max = 70.0

        elif category_normalized in {
            "meat",
            "seafood",
        }:
            humidity_min = 60.0
            humidity_max = 85.0

        else:
            humidity_min = 30.0
            humidity_max = 70.0

        if humidity_min <= humidity <= humidity_max:
            humidity_score = 100.0
            humidity_status = (
                "Humidity within recommended range"
            )

        else:
            if humidity < humidity_min:
                difference = humidity_min - humidity
            else:
                difference = humidity - humidity_max

            humidity_score = clamp(
                100.0 - difference * 1.5
            )

            humidity_status = (
                "Humidity is outside the typical recommended range"
            )

    # --------------------------------------------------------
    # Packaging score
    # --------------------------------------------------------

    if not packaging:
        packaging_score = 70.0
        packaging_status = (
            "Packaging type not provided"
        )

    elif any(
        keyword in packaging
        for keyword in [
            "airtight",
            "sealed",
            "vacuum",
            "vacuum sealed",
        ]
    ):
        packaging_score = 100.0
        packaging_status = (
            "Protective packaging detected"
        )

    elif any(
        keyword in packaging
        for keyword in [
            "container",
            "box",
            "reusable",
            "covered",
        ]
    ):
        packaging_score = 88.0
        packaging_status = (
            "Suitable protective packaging"
        )

    elif any(
        keyword in packaging
        for keyword in [
            "plastic",
            "bag",
            "wrap",
        ]
    ):
        packaging_score = 78.0
        packaging_status = (
            "Basic protective packaging"
        )

    else:
        packaging_score = 65.0
        packaging_status = (
            "Packaging may provide limited protection"
        )

    # --------------------------------------------------------
    # Air circulation score
    # --------------------------------------------------------

    if not circulation:
        circulation_score = 70.0
        circulation_status = (
            "Air circulation not provided"
        )

    elif any(
        keyword in circulation
        for keyword in [
            "good",
            "adequate",
            "proper",
            "ventilated",
        ]
    ):
        circulation_score = 100.0
        circulation_status = (
            "Adequate air circulation"
        )

    elif any(
        keyword in circulation
        for keyword in [
            "poor",
            "low",
            "none",
            "blocked",
        ]
    ):
        circulation_score = 45.0
        circulation_status = (
            "Poor air circulation"
        )

    else:
        circulation_score = 75.0
        circulation_status = (
            "Moderate air circulation"
        )

    # --------------------------------------------------------
    # Light exposure score
    # --------------------------------------------------------

    if not light:
        light_score = 70.0
        light_status = (
            "Light exposure not provided"
        )

    elif any(
        keyword in light
        for keyword in [
            "dark",
            "low",
            "minimal",
            "none",
        ]
    ):
        light_score = 100.0
        light_status = (
            "Low light exposure"
        )

    elif any(
        keyword in light
        for keyword in [
            "direct",
            "high",
            "sunlight",
        ]
    ):
        light_score = 45.0
        light_status = (
            "High/direct light exposure"
        )

    else:
        light_score = 80.0
        light_status = (
            "Moderate light exposure"
        )

    # --------------------------------------------------------
    # Storage duration score
    # --------------------------------------------------------

    base_shelf_life = get_base_shelf_life_days(
        food_name,
        category,
    )

    if duration <= 0:
        duration_score = 100.0
        duration_status = (
            "Storage duration not yet provided"
        )

    else:
        duration_ratio = (
            duration
            / max(
                base_shelf_life,
                1.0,
            )
        )

        duration_score = clamp(
            100.0
            - (
                duration_ratio
                * 80.0
            )
        )

        if duration_ratio < 0.5:
            duration_status = (
                "Storage duration is within a comfortable range"
            )

        elif duration_ratio < 0.8:
            duration_status = (
                "Storage duration is approaching the recommended limit"
            )

        elif duration_ratio <= 1.0:
            duration_status = (
                "Storage duration is close to the expected shelf-life"
            )

        else:
            duration_status = (
                "Storage duration exceeds the baseline shelf-life"
            )

    # --------------------------------------------------------
    # Compliance score
    # --------------------------------------------------------

    storage_compliance_score = clamp(
        temperature_score * 0.30
        + humidity_score * 0.20
        + packaging_score * 0.15
        + duration_score * 0.15
        + circulation_score * 0.10
        + light_score * 0.10
    )

    if storage_compliance_score >= 85:
        compliance_status = (
            "Excellent storage compliance"
        )

    elif storage_compliance_score >= 70:
        compliance_status = (
            "Good storage compliance"
        )

    elif storage_compliance_score >= 50:
        compliance_status = (
            "Moderate storage compliance"
        )

    else:
        compliance_status = (
            "Poor storage compliance"
        )

    return {
        "storage_temperature": temperature,

        "storage_humidity": humidity,

        # Preserve the original user-facing value.
        "packaging_type": (
            packaging_type
        ),

        "storage_duration": duration,

        "air_circulation": (
            air_circulation
        ),

        "light_exposure": (
            light_exposure
        ),

        "normalized_category": (
            category_normalized
        ),

        "temperature_score": round(
            temperature_score,
            2,
        ),

        "temperature_status": (
            temperature_status
        ),

        "humidity_score": round(
            humidity_score,
            2,
        ),

        "humidity_status": (
            humidity_status
        ),

        "packaging_score": round(
            packaging_score,
            2,
        ),

        "packaging_status": (
            packaging_status
        ),

        "air_circulation_score": round(
            circulation_score,
            2,
        ),

        "air_circulation_status": (
            circulation_status
        ),

        "light_exposure_score": round(
            light_score,
            2,
        ),

        "light_exposure_status": (
            light_status
        ),

        "storage_duration_score": round(
            duration_score,
            2,
        ),

        "storage_duration_status": (
            duration_status
        ),

        "storage_compliance_score": round(
            storage_compliance_score,
            2,
        ),

        "storage_compliance_status": (
            compliance_status
        ),

        "baseline_shelf_life_days": round(
            base_shelf_life,
            2,
        ),
    }


# ============================================================
# SHELF-LIFE PREDICTION
# ============================================================

def calculate_shelf_life_prediction(
    food_name,
    category=None,
    freshness_status="Pending",
    freshness_score=None,
    visual_condition_score=None,
    storage_temperature=None,
    storage_humidity=None,
    packaging_type=None,
    storage_duration=None,
    air_circulation=None,
    light_exposure=None,
    manufacturing_date=None,
    expiry_date=None,
):
    """
    Milestone-3 shelf-life intelligence.

    Combines:
        - food/product baseline
        - ML freshness assessment
        - visual condition
        - storage compliance
        - product age
        - known expiry date
    """

    storage = calculate_storage_intelligence(
        food_name=food_name,
        category=category,
        storage_temperature=storage_temperature,
        storage_humidity=storage_humidity,
        packaging_type=packaging_type,
        storage_duration=storage_duration,
        air_circulation=air_circulation,
        light_exposure=light_exposure,
    )

    base_shelf_life = float(
        storage[
            "baseline_shelf_life_days"
        ]
    )

    freshness_score_value = safe_float(
        freshness_score,
        70.0,
    )

    visual_score_value = safe_float(
        visual_condition_score,
        freshness_score_value,
    )

    storage_score_value = float(
        storage[
            "storage_compliance_score"
        ]
    )

    # --------------------------------------------------------
    # Freshness factor
    # --------------------------------------------------------

    freshness_factor = clamp(
        freshness_score_value / 100.0,
        0.35,
        1.0,
    )

    # --------------------------------------------------------
    # Visual factor
    # --------------------------------------------------------

    visual_factor = clamp(
        visual_score_value / 100.0,
        0.35,
        1.0,
    )

    # --------------------------------------------------------
    # Storage factor
    # --------------------------------------------------------

    storage_factor = clamp(
        storage_score_value / 100.0,
        0.35,
        1.0,
    )

    # --------------------------------------------------------
    # Product age factor
    # --------------------------------------------------------

    manufacturing = safe_date(
        manufacturing_date
    )

    expiry = safe_date(
        expiry_date
    )

    today = date.today()

    product_age_days = None

    if manufacturing is not None:
        product_age_days = max(
            0,
            (
                today - manufacturing
            ).days,
        )

    elif safe_float(
        storage_duration
    ) is not None:
        product_age_days = max(
            0,
            int(
                safe_float(
                    storage_duration,
                    0.0,
                )
            ),
        )

    if product_age_days is None:
        age_factor = 0.85

    else:
        age_ratio = (
            product_age_days
            / max(
                base_shelf_life,
                1.0,
            )
        )

        age_factor = clamp(
            1.0
            - (
                age_ratio
                * 0.65
            ),
            0.20,
            1.0,
        )

    # --------------------------------------------------------
    # ML freshness adjustment
    # --------------------------------------------------------

    freshness_multiplier = {
        "Fresh": 1.00,
        "Less Fresh": 0.78,
        "Rotten": 0.15,
    }.get(
        str(freshness_status),
        0.85,
    )

    # --------------------------------------------------------
    # Predicted total remaining life
    # --------------------------------------------------------

    weighted_condition = (
        freshness_factor * 0.40
        + visual_factor * 0.25
        + storage_factor * 0.25
        + age_factor * 0.10
    )

    estimated_total_life = (
        base_shelf_life
        * weighted_condition
        * freshness_multiplier
    )

    estimated_total_life = max(
        0.0,
        estimated_total_life,
    )

    # --------------------------------------------------------
    # Already stored duration
    # --------------------------------------------------------

    stored_duration = safe_float(
        storage_duration,
        0.0,
    )

    remaining_shelf_life = max(
        0.0,
        estimated_total_life
        - stored_duration,
    )

    # --------------------------------------------------------
    # Known expiry date has priority
    # --------------------------------------------------------

    expiry_remaining_days = None

    if expiry is not None:
        expiry_remaining_days = max(
            0,
            (
                expiry - today
            ).days,
        )

        if (
            remaining_shelf_life
            > expiry_remaining_days
        ):
            remaining_shelf_life = float(
                expiry_remaining_days
            )

    # --------------------------------------------------------
    # Expiry forecast
    # --------------------------------------------------------

    forecast_expiry_date = (
        today
        + timedelta(
            days=max(
                0,
                int(
                    math.ceil(
                        remaining_shelf_life
                    )
                ),
            )
        )
    )

    if expiry is not None:
        if forecast_expiry_date > expiry:
            forecast_expiry_date = expiry

    # --------------------------------------------------------
    # Shelf-life confidence
    # --------------------------------------------------------

    model_confidence_component = clamp(
        freshness_score_value
    )

    input_count = 0

    if storage_temperature is not None:
        input_count += 1

    if storage_humidity is not None:
        input_count += 1

    if packaging_type:
        input_count += 1

    if storage_duration is not None:
        input_count += 1

    if air_circulation:
        input_count += 1

    if light_exposure:
        input_count += 1

    if manufacturing is not None:
        input_count += 1

    if expiry is not None:
        input_count += 1

    input_completeness = (
        input_count / 8.0
    )

    shelf_life_confidence = clamp(
        model_confidence_component * 0.45
        + storage_score_value * 0.30
        + visual_score_value * 0.15
        + input_completeness
        * 100.0
        * 0.10
    )

    # --------------------------------------------------------
    # Risk
    # --------------------------------------------------------

    life_ratio = (
        remaining_shelf_life
        / max(
            base_shelf_life,
            1.0,
        )
    )

    if freshness_status == "Rotten":
        shelf_life_risk = "Critical"

    elif remaining_shelf_life <= 0:
        shelf_life_risk = "Expired"

    elif life_ratio <= 0.15:
        shelf_life_risk = "Critical"

    elif life_ratio <= 0.30:
        shelf_life_risk = "High"

    elif life_ratio <= 0.55:
        shelf_life_risk = "Moderate"

    else:
        shelf_life_risk = "Low"

    # --------------------------------------------------------
    # Forecast explanation
    # --------------------------------------------------------

    if shelf_life_risk == "Low":
        shelf_life_status = (
            "Good remaining shelf-life"
        )

    elif shelf_life_risk == "Moderate":
        shelf_life_status = (
            "Shelf-life approaching caution range"
        )

    elif shelf_life_risk == "High":
        shelf_life_status = (
            "Limited remaining shelf-life"
        )

    else:
        shelf_life_status = (
            "Immediate attention recommended"
        )

    return {
        "baseline_shelf_life_days": round(
            base_shelf_life,
            2,
        ),

        "remaining_shelf_life": round(
            remaining_shelf_life,
            2,
        ),

        "forecast_expiry_date": (
            forecast_expiry_date.isoformat()
        ),

        "known_expiry_date": (
            expiry.isoformat()
            if expiry is not None
            else None
        ),

        "product_age_days": product_age_days,

        "shelf_life_confidence": round(
            shelf_life_confidence,
            2,
        ),

        "shelf_life_risk": (
            shelf_life_risk
        ),

        "shelf_life_status": (
            shelf_life_status
        ),

        "freshness_factor": round(
            freshness_factor,
            4,
        ),

        "visual_factor": round(
            visual_factor,
            4,
        ),

        "storage_factor": round(
            storage_factor,
            4,
        ),

        "age_factor": round(
            age_factor,
            4,
        ),

        "estimated_total_life": round(
            estimated_total_life,
            2,
        ),

        "storage_intelligence": storage,
    }


# ============================================================
# FRESHNESS SCORING ENGINE
# ============================================================

def calculate_overall_health_score(
    visual_condition_score,
    storage_compliance_score,
    shelf_life_score,
    product_age_score,
):
    """
    PDF weighted scoring model:

        Visual Condition Analysis = 40%
        Storage Conditions        = 25%
        Shelf-Life Prediction     = 20%
        Product Age               = 15%
    """

    overall_score = clamp(
        safe_float(
            visual_condition_score,
            0.0,
        )
        * 0.40
        + safe_float(
            storage_compliance_score,
            0.0,
        )
        * 0.25
        + safe_float(
            shelf_life_score,
            0.0,
        )
        * 0.20
        + safe_float(
            product_age_score,
            0.0,
        )
        * 0.15
    )

    return round(
        overall_score,
        2,
    )


def calculate_shelf_life_score(
    remaining_shelf_life,
    baseline_shelf_life,
):
    baseline = max(
        safe_float(
            baseline_shelf_life,
            1.0,
        ),
        1.0,
    )

    remaining = max(
        safe_float(
            remaining_shelf_life,
            0.0,
        ),
        0.0,
    )

    return round(
        clamp(
            (
                remaining / baseline
            )
            * 100.0
        ),
        2,
    )


def calculate_product_age_score(
    product_age_days,
    baseline_shelf_life,
):
    if product_age_days is None:
        return 80.0

    baseline = max(
        safe_float(
            baseline_shelf_life,
            1.0,
        ),
        1.0,
    )

    age = max(
        safe_float(
            product_age_days,
            0.0,
        ),
        0.0,
    )

    return round(
        clamp(
            100.0
            - (
                age
                / baseline
                * 100.0
            )
        ),
        2,
    )


# ============================================================
# RECOMMENDATION ENGINE
# ============================================================

def generate_recommendations(
    food_name,
    category,
    freshness_status,
    freshness_score,
    visual_condition_score,
    shelf_life_result,
    storage_result,
):
    """
    Milestone-3 recommendation engine.

    Generates:
        - Storage recommendations
        - Consumption recommendations
        - Inventory rotation suggestions
        - Waste reduction recommendations
        - Quality improvement suggestions
    """

    recommendations = []

    storage_recommendations = []
    consumption_recommendations = []
    inventory_rotation_recommendations = []
    waste_reduction_recommendations = []
    quality_improvement_recommendations = []

    storage_score = float(
        storage_result[
            "storage_compliance_score"
        ]
    )

    remaining_shelf_life = float(
        shelf_life_result[
            "remaining_shelf_life"
        ]
    )

    shelf_life_risk = shelf_life_result[
        "shelf_life_risk"
    ]

    # ========================================================
    # STORAGE RECOMMENDATIONS
    # ========================================================

    if (
        storage_result[
            "temperature_score"
        ]
        < 70
    ):
        storage_recommendations.append(
            "Move the food to a more suitable temperature-controlled storage area."
        )

    if (
        storage_result[
            "humidity_score"
        ]
        < 70
    ):
        storage_recommendations.append(
            "Adjust humidity or improve moisture control around the food."
        )

    if (
        storage_result[
            "packaging_score"
        ]
        < 75
    ):
        storage_recommendations.append(
            "Use sealed, covered, or food-safe protective packaging where appropriate."
        )

    if (
        storage_result[
            "air_circulation_score"
        ]
        < 70
    ):
        storage_recommendations.append(
            "Improve air circulation and avoid blocking ventilation around stored food."
        )

    if (
        storage_result[
            "light_exposure_score"
        ]
        < 70
    ):
        storage_recommendations.append(
            "Reduce direct or excessive light exposure during storage."
        )

    if not storage_recommendations:
        storage_recommendations.append(
            "Current storage parameters are generally suitable. Continue monitoring temperature and humidity."
        )

    # ========================================================
    # CONSUMPTION RECOMMENDATIONS
    # ========================================================

    if freshness_status == "Rotten":
        consumption_recommendations.append(
            "Do not consume food classified as rotten; inspect and dispose of it according to local food-safety practices."
        )

    elif shelf_life_risk in {
        "Critical",
        "Expired",
    }:
        consumption_recommendations.append(
            "Prioritize this item immediately because its estimated remaining shelf-life is very limited."
        )

    elif shelf_life_risk == "High":
        consumption_recommendations.append(
            "Consume this item soon and avoid unnecessary additional storage."
        )

    elif freshness_status == "Less Fresh":
        consumption_recommendations.append(
            "Prioritize consumption while the item remains within an acceptable freshness range."
        )

    else:
        consumption_recommendations.append(
            "Food can remain in inventory under suitable storage conditions; continue monitoring its freshness."
        )

    # ========================================================
    # INVENTORY ROTATION
    # ========================================================

    if remaining_shelf_life <= 2:
        inventory_rotation_recommendations.append(
            "Move this item to the front of the inventory using FEFO (First Expire, First Out)."
        )

    elif remaining_shelf_life <= 5:
        inventory_rotation_recommendations.append(
            "Mark this item as a near-term priority for inventory rotation."
        )

    else:
        inventory_rotation_recommendations.append(
            "Maintain normal inventory rotation and prioritize items with earlier expiry dates."
        )

    # ========================================================
    # WASTE REDUCTION
    # ========================================================

    if shelf_life_risk in {
        "Critical",
        "High",
        "Expired",
    }:
        waste_reduction_recommendations.append(
            "Prioritize consumption or appropriate processing before further quality loss occurs."
        )

    if storage_score < 70:
        waste_reduction_recommendations.append(
            "Correct storage conditions to slow avoidable quality deterioration."
        )

    if not waste_reduction_recommendations:
        waste_reduction_recommendations.append(
            "Continue condition monitoring and FEFO-based inventory rotation to reduce unnecessary waste."
        )

    # ========================================================
    # QUALITY IMPROVEMENT
    # ========================================================

    if visual_condition_score < 70:
        quality_improvement_recommendations.append(
            "Increase inspection frequency because visible quality changes have been detected."
        )

    if (
        float(
            storage_result[
                "storage_duration_score"
            ]
        )
        < 70
    ):
        quality_improvement_recommendations.append(
            "Reduce unnecessary storage duration and rotate older inventory sooner."
        )

    if not quality_improvement_recommendations:
        quality_improvement_recommendations.append(
            "Maintain current handling practices and continue periodic visual inspection."
        )

    # ========================================================
    # MASTER RECOMMENDATIONS
    # ========================================================

    recommendations.extend(
        storage_recommendations
    )

    recommendations.extend(
        consumption_recommendations
    )

    recommendations.extend(
        inventory_rotation_recommendations
    )

    recommendations.extend(
        waste_reduction_recommendations
    )

    recommendations.extend(
        quality_improvement_recommendations
    )

    # Remove duplicates while preserving order.
    unique_recommendations = []

    seen = set()

    for recommendation in recommendations:
        if recommendation in seen:
            continue

        seen.add(recommendation)
        unique_recommendations.append(
            recommendation
        )

    # ========================================================
    # SMART SUMMARY
    # ========================================================

    if freshness_status == "Rotten":
        recommendation_priority = "Critical"

    elif shelf_life_risk in {
        "Critical",
        "Expired",
    }:
        recommendation_priority = "Critical"

    elif shelf_life_risk == "High":
        recommendation_priority = "High"

    elif shelf_life_risk == "Moderate":
        recommendation_priority = "Medium"

    else:
        recommendation_priority = "Low"

    if shelf_life_risk in {
        "Critical",
        "Expired",
    }:
        summary = (
            f"{food_name} requires immediate attention because "
            "its estimated remaining shelf-life is very limited."
        )

    elif storage_score < 60:
        summary = (
            f"{food_name} should be moved to improved storage conditions "
            "to reduce avoidable quality deterioration."
        )

    elif freshness_status == "Less Fresh":
        summary = (
            f"{food_name} should be prioritized for consumption "
            "while its quality remains acceptable."
        )

    else:
        summary = (
            f"{food_name} is currently suitable for continued monitoring "
            "under appropriate storage conditions."
        )

    return {
        "recommendation_priority": (
            recommendation_priority
        ),

        "recommendation_summary": summary,

        "recommendations": (
            unique_recommendations
        ),

        "storage_recommendations": (
            storage_recommendations
        ),

        "consumption_recommendations": (
            consumption_recommendations
        ),

        "inventory_rotation_recommendations": (
            inventory_rotation_recommendations
        ),

        "waste_reduction_recommendations": (
            waste_reduction_recommendations
        ),

        "quality_improvement_recommendations": (
            quality_improvement_recommendations
        ),

        "storage_temperature_advice": (
            storage_result[
                "temperature_status"
            ]
        ),

        "storage_humidity_advice": (
            storage_result[
                "humidity_status"
            ]
        ),

        "remaining_shelf_life_days": round(
            remaining_shelf_life,
            2,
        ),
    }


# ============================================================
# IMAGE PATH FOR RESPONSE
# ============================================================

def image_path_for_response(
    image_path,
):
    """
    Return upload-relative path without exposing
    OS filesystem paths.
    """

    path = Path(image_path)

    try:
        relative = (
            path.resolve()
            .relative_to(
                BACKEND_DIR.resolve()
            )
        )

        return (
            "/"
            + relative.as_posix()
        )

    except Exception:
        return (
            "/uploads/"
            + path.name
        )


# ============================================================
# MAIN PREDICTION FUNCTION
# ============================================================

def predict_freshness(
    food_name,
    image_path,
    category=None,
    storage_temperature=None,
    storage_humidity=None,
    packaging_type=None,
    storage_duration=None,
    air_circulation=None,
    light_exposure=None,
    manufacturing_date=None,
    expiry_date=None,
):
    """
    Main AI prediction pipeline.

    Existing arguments:
        food_name
        image_path

    Optional Milestone-3 arguments:
        category
        storage_temperature
        storage_humidity
        packaging_type
        storage_duration
        air_circulation
        light_exposure
        manufacturing_date
        expiry_date

    Existing callers using only:
        predict_freshness(food_name, image_path)

    remain fully supported.
    """

    if not food_name:
        food_name = "Unknown Food"

    food_name = str(
        food_name
    ).strip()

    # ========================================================
    # NO IMAGE
    # ========================================================

    if not image_path:
        return {
            "food_name": food_name,

            "freshness_status": "Pending",

            "freshness_score": None,

            "confidence": None,

            "predicted_class": None,

            "image_analysis": {},

            "remaining_shelf_life": None,

            "shelf_life_confidence": None,

            "shelf_life_risk": "Unknown",

            "storage_compliance_score": None,

            "overall_health_score": None,

            "storage_intelligence": {},

            "shelf_life_prediction": {},

            "recommendations": {},
        }

    # ========================================================
    # RESOLVE IMAGE PATH
    # ========================================================

    image_file = Path(
        image_path
    )

    if not image_file.exists():

        fallback = (
            BACKEND_DIR
            / str(
                image_path
            ).lstrip(
                "/\\"
            )
        )

        if fallback.exists():
            image_file = fallback

        else:
            raise FileNotFoundError(
                f"Food image not found: {image_file}"
            )

    # ========================================================
    # TRAINED MODEL PREDICTION
    # ========================================================

    image_array = preprocess_image(
        image_file
    )

    predictions = MODEL.predict(
        image_array,
        verbose=0,
    )

    if (
        predictions is None
        or len(predictions) == 0
    ):
        raise RuntimeError(
            "Model returned an empty prediction."
        )

    probabilities = np.asarray(
        predictions[0],
        dtype=np.float32,
    )

    if (
        len(probabilities)
        != len(CLASS_NAMES)
    ):
        raise RuntimeError(
            "Model output classes do not match class_names.json."
        )

    probability_sum = float(
        np.sum(probabilities)
    )

    if probability_sum <= 0:
        raise RuntimeError(
            "Invalid model probabilities."
        )

    probabilities = (
        probabilities
        / probability_sum
    )

    predicted_index = int(
        np.argmax(
            probabilities
        )
    )

    predicted_class = CLASS_NAMES[
        predicted_index
    ]

    confidence = float(
        probabilities[
            predicted_index
        ]
        * 100
    )

    freshness_score = calculate_freshness_score(
        probabilities,
        predicted_class,
    )

    status_map = {
        "fresh": "Fresh",
        "less_fresh": "Less Fresh",
        "rotten": "Rotten",
    }

    freshness_status = status_map.get(
        predicted_class,
        "Pending",
    )

    # ========================================================
    # OPENCV VISUAL ANALYSIS
    # ========================================================

    cv_image = cv2.imread(
        str(image_file),
        cv2.IMREAD_COLOR,
    )

    if cv_image is None:
        raise RuntimeError(
            "OpenCV could not read the food image: "
            f"{image_file}"
        )

    image_analysis = analyse_visual_condition(
        cv_image,
        food_name,
    )

    original_relative_path = (
        image_path_for_response(
            image_file
        )
    )

    image_analysis[
        "original_image_path"
    ] = original_relative_path

    # ========================================================
    # NORMALIZED CATEGORY
    # ========================================================

    normalized_category = normalize_category(
        category
    )

    # ========================================================
    # MILESTONE 3
    # STORAGE INTELLIGENCE
    # ========================================================

    storage_intelligence = (
        calculate_storage_intelligence(
            food_name=food_name,
            category=category,
            storage_temperature=storage_temperature,
            storage_humidity=storage_humidity,
            packaging_type=packaging_type,
            storage_duration=storage_duration,
            air_circulation=air_circulation,
            light_exposure=light_exposure,
        )
    )

    # ========================================================
    # MILESTONE 3
    # SHELF-LIFE PREDICTION
    # ========================================================

    shelf_life_prediction = (
        calculate_shelf_life_prediction(
            food_name=food_name,
            category=category,
            freshness_status=freshness_status,
            freshness_score=freshness_score,
            visual_condition_score=(
                image_analysis[
                    "visual_condition_score"
                ]
            ),
            storage_temperature=storage_temperature,
            storage_humidity=storage_humidity,
            packaging_type=packaging_type,
            storage_duration=storage_duration,
            air_circulation=air_circulation,
            light_exposure=light_exposure,
            manufacturing_date=manufacturing_date,
            expiry_date=expiry_date,
        )
    )

    # ========================================================
    # SHELF-LIFE SCORE
    # ========================================================

    shelf_life_score = (
        calculate_shelf_life_score(
            shelf_life_prediction[
                "remaining_shelf_life"
            ],
            shelf_life_prediction[
                "baseline_shelf_life_days"
            ],
        )
    )

    # ========================================================
    # PRODUCT AGE SCORE
    # ========================================================

    product_age_score = (
        calculate_product_age_score(
            shelf_life_prediction[
                "product_age_days"
            ],
            shelf_life_prediction[
                "baseline_shelf_life_days"
            ],
        )
    )

    # ========================================================
    # OVERALL HEALTH SCORE
    #
    # PDF:
    # Visual Condition       40%
    # Storage Conditions     25%
    # Shelf-Life             20%
    # Product Age            15%
    # ========================================================

    overall_health_score = (
        calculate_overall_health_score(
            visual_condition_score=(
                image_analysis[
                    "visual_condition_score"
                ]
            ),
            storage_compliance_score=(
                storage_intelligence[
                    "storage_compliance_score"
                ]
            ),
            shelf_life_score=(
                shelf_life_score
            ),
            product_age_score=(
                product_age_score
            ),
        )
    )

    # ========================================================
    # RECOMMENDATION ENGINE
    # ========================================================

    recommendation_engine = (
        generate_recommendations(
            food_name=food_name,
            category=category,
            freshness_status=freshness_status,
            freshness_score=freshness_score,
            visual_condition_score=(
                image_analysis[
                    "visual_condition_score"
                ]
            ),
            shelf_life_result=(
                shelf_life_prediction
            ),
            storage_result=(
                storage_intelligence
            ),
        )
    )

    # ========================================================
    # FINAL RESULT
    # ========================================================

    result = {
        # ----------------------------------------------------
        # EXISTING FIELDS
        # ----------------------------------------------------

        "food_name": food_name,

        "category": category,

        "normalized_category": (
            normalized_category
        ),

        "freshness_status": (
            freshness_status
        ),

        "freshness_score": (
            freshness_score
        ),

        "confidence": round(
            confidence,
            2,
        ),

        "predicted_class": (
            predicted_class
        ),

        "image_path": (
            original_relative_path
        ),

        "image_url": (
            original_relative_path
        ),

        "image_analysis": (
            image_analysis
        ),

        # ----------------------------------------------------
        # MILESTONE 3 - SHELF LIFE
        # ----------------------------------------------------

        "remaining_shelf_life": (
            shelf_life_prediction[
                "remaining_shelf_life"
            ]
        ),

        "shelf_life_confidence": (
            shelf_life_prediction[
                "shelf_life_confidence"
            ]
        ),

        "shelf_life_risk": (
            shelf_life_prediction[
                "shelf_life_risk"
            ]
        ),

        "forecast_expiry_date": (
            shelf_life_prediction[
                "forecast_expiry_date"
            ]
        ),

        "baseline_shelf_life_days": (
            shelf_life_prediction[
                "baseline_shelf_life_days"
            ]
        ),

        "product_age_days": (
            shelf_life_prediction[
                "product_age_days"
            ]
        ),

        "shelf_life_score": (
            shelf_life_score
        ),

        "shelf_life_status": (
            shelf_life_prediction[
                "shelf_life_status"
            ]
        ),

        "shelf_life_prediction": (
            shelf_life_prediction
        ),

        # ----------------------------------------------------
        # STORAGE INTELLIGENCE
        # ----------------------------------------------------

        "storage_temperature": (
            storage_intelligence[
                "storage_temperature"
            ]
        ),

        "storage_humidity": (
            storage_intelligence[
                "storage_humidity"
            ]
        ),

        "packaging_type": (
            storage_intelligence[
                "packaging_type"
            ]
        ),

        "storage_duration": (
            storage_intelligence[
                "storage_duration"
            ]
        ),

        "air_circulation": (
            storage_intelligence[
                "air_circulation"
            ]
        ),

        "light_exposure": (
            storage_intelligence[
                "light_exposure"
            ]
        ),

        "storage_compliance_score": (
            storage_intelligence[
                "storage_compliance_score"
            ]
        ),

        "storage_compliance_status": (
            storage_intelligence[
                "storage_compliance_status"
            ]
        ),

        "storage_intelligence": (
            storage_intelligence
        ),

        # ----------------------------------------------------
        # OVERALL HEALTH
        # ----------------------------------------------------

        "product_age_score": (
            product_age_score
        ),

        "overall_health_score": (
            overall_health_score
        ),

        # ----------------------------------------------------
        # RECOMMENDATIONS
        # ----------------------------------------------------

        "recommendation_priority": (
            recommendation_engine[
                "recommendation_priority"
            ]
        ),

        "recommendation_summary": (
            recommendation_engine[
                "recommendation_summary"
            ]
        ),

        "recommendations": (
            recommendation_engine[
                "recommendations"
            ]
        ),

        "storage_recommendations": (
            recommendation_engine[
                "storage_recommendations"
            ]
        ),

        "consumption_recommendations": (
            recommendation_engine[
                "consumption_recommendations"
            ]
        ),

        "inventory_rotation_recommendations": (
            recommendation_engine[
                "inventory_rotation_recommendations"
            ]
        ),

        "waste_reduction_recommendations": (
            recommendation_engine[
                "waste_reduction_recommendations"
            ]
        ),

        "quality_improvement_recommendations": (
            recommendation_engine[
                "quality_improvement_recommendations"
            ]
        ),

        "recommendation_engine": (
            recommendation_engine
        ),

        # ----------------------------------------------------
        # MODULE METADATA
        # ----------------------------------------------------

        "milestone_3": {
            "shelf_life_prediction": True,
            "storage_intelligence": True,
            "recommendation_engine": True,
            "inventory_insights": True,
            "weighted_health_scoring": True,
        },
    }

    # ========================================================
    # CONSOLE LOG
    # ========================================================

    print(
        "------------------------------------------------------------"
    )

    print(
        "FOOD FRESHNESS + VISUAL ANALYSIS + MILESTONE 3"
    )

    print(
        "------------------------------------------------------------"
    )

    print(
        f"Food       : {food_name}"
    )

    print(
        f"Category   : {category}"
    )

    print(
        f"Prediction : {freshness_status}"
    )

    print(
        f"Score      : {freshness_score}/100"
    )

    print(
        f"Confidence : {confidence:.2f}%"
    )

    print(
        f"Class      : {predicted_class}"
    )

    print(
        f"Visual     : "
        f"{image_analysis['visual_condition']}"
    )

    print(
        f"Visual Score: "
        f"{image_analysis['visual_condition_score']}"
    )

    print(
        f"Shelf Life : "
        f"{shelf_life_prediction['remaining_shelf_life']} days"
    )

    print(
        f"Shelf Risk : "
        f"{shelf_life_prediction['shelf_life_risk']}"
    )

    print(
        f"Shelf Conf : "
        f"{shelf_life_prediction['shelf_life_confidence']}%"
    )

    print(
        f"Storage    : "
        f"{storage_intelligence['storage_compliance_score']}/100"
    )

    print(
        f"Health     : "
        f"{overall_health_score}/100"
    )

    print(
        f"Priority   : "
        f"{recommendation_engine['recommendation_priority']}"
    )

    print(
        f"Annotated  : "
        f"{image_analysis['image_url']}"
    )

    print(
        "------------------------------------------------------------"
    )

    return result