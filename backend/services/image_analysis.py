import cv2
import numpy as np
import tensorflow as tf
from pathlib import Path


# =========================================================
# MODEL SETUP
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "ml" / "freshness_transfer_model.keras"

freshness_model = tf.keras.models.load_model(MODEL_PATH)

IMG_SIZE = (224, 224)


# =========================================================
# COLOUR ANALYSIS
# =========================================================

def analyze_color(image_path):
    image = cv2.imread(image_path)

    if image is None:
        return {
            "color_score": 0,
            "color_degradation": "Unable to analyze"
        }

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]

    avg_saturation = float(np.mean(saturation))
    avg_brightness = float(np.mean(value))

    color_score = (avg_saturation + avg_brightness) / 2
    color_score = round(min(color_score / 2.55, 100), 2)

    if color_score >= 75:
        degradation = "Low"
    elif color_score >= 50:
        degradation = "Moderate"
    else:
        degradation = "High"

    return {
        "color_score": color_score,
        "color_degradation": degradation
    }


# =========================================================
# TEXTURE ANALYSIS
# =========================================================

def analyze_texture(image_path):
    image = cv2.imread(
        image_path,
        cv2.IMREAD_GRAYSCALE
    )

    if image is None:
        return {
            "texture_score": 0,
            "texture_change": "Unable to analyze"
        }

    blurred = cv2.GaussianBlur(
        image,
        (5, 5),
        0
    )

    laplacian = cv2.Laplacian(
        blurred,
        cv2.CV_64F
    )

    variance = float(laplacian.var())

    texture_score = round(
        min(variance / 6.0, 100),
        2
    )

    if texture_score >= 55:
        texture_change = "Low"
    elif texture_score >= 25:
        texture_change = "Moderate"
    else:
        texture_change = "High"

    return {
        "texture_score": texture_score,
        "texture_change": texture_change
    }


# =========================================================
# MOLD INDICATOR
# =========================================================

def detect_mold(image_path):
    image = cv2.imread(image_path)

    if image is None:
        return {
            "mold_detected": False,
            "mold_percentage": 0
        }

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV
    )

    white_mask = cv2.inRange(
        hsv,
        np.array([0, 0, 90]),
        np.array([180, 45, 225])
    )

    green_mask = cv2.inRange(
        hsv,
        np.array([45, 15, 45]),
        np.array([105, 95, 180])
    )

    mold_mask = cv2.bitwise_or(
        white_mask,
        green_mask
    )

    kernel = np.ones(
        (5, 5),
        np.uint8
    )

    mold_mask = cv2.morphologyEx(
        mold_mask,
        cv2.MORPH_OPEN,
        kernel
    )

    mold_mask = cv2.morphologyEx(
        mold_mask,
        cv2.MORPH_CLOSE,
        kernel
    )

    mold_pixels = cv2.countNonZero(
        mold_mask
    )

    total_pixels = (
        image.shape[0] *
        image.shape[1]
    )

    mold_percentage = round(
        (mold_pixels / total_pixels) * 100,
        2
    )

    # Conservative supporting indicator.
    mold_detected = mold_percentage >= 8.0

    return {
        "mold_detected": mold_detected,
        "mold_percentage": mold_percentage
    }


# =========================================================
# BRUISING INDICATOR
# =========================================================

def detect_bruising(image_path):
    image = cv2.imread(image_path)

    if image is None:
        return {
            "bruising_detected": False,
            "bruising_percentage": 0
        }

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV
    )

    mask = cv2.inRange(
        hsv,
        np.array([5, 45, 25]),
        np.array([25, 220, 150])
    )

    kernel = np.ones(
        (5, 5),
        np.uint8
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel
    )

    bruise_pixels = cv2.countNonZero(
        mask
    )

    total_pixels = (
        image.shape[0] *
        image.shape[1]
    )

    bruising_percentage = round(
        (bruise_pixels / total_pixels) * 100,
        2
    )

    # Conservative because stems, shadows and normal skin colour
    # can also look brown.
    bruising_detected = bruising_percentage >= 10.0

    return {
        "bruising_detected": bruising_detected,
        "bruising_percentage": bruising_percentage
    }


# =========================================================
# PHYSICAL DAMAGE INDICATOR
# =========================================================

def detect_physical_damage(image_path):
    image = cv2.imread(image_path)

    if image is None:
        return {
            "physical_damage_detected": False,
            "damage_percentage": 0
        }

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    gray = cv2.GaussianBlur(
        gray,
        (5, 5),
        0
    )

    edges = cv2.Canny(
        gray,
        120,
        220
    )

    damaged_pixels = cv2.countNonZero(
        edges
    )

    total_pixels = (
        image.shape[0] *
        image.shape[1]
    )

    damage_percentage = round(
        (damaged_pixels / total_pixels) * 100,
        2
    )

    physical_damage_detected = (
        damage_percentage >= 8.0
    )

    return {
        "physical_damage_detected":
            physical_damage_detected,
        "damage_percentage":
            damage_percentage
    }


# =========================================================
# CNN PREDICTION
# =========================================================

def predict_cnn_freshness(image_path):
    image = tf.keras.utils.load_img(
        image_path,
        target_size=IMG_SIZE
    )

    image_array = (
        tf.keras.utils.img_to_array(image)
    )

    image_array = np.expand_dims(
        image_array,
        axis=0
    )

    prediction = float(
        freshness_model.predict(
            image_array,
            verbose=0
        )[0][0]
    )

    # Training labels:
    # fresh = 0
    # spoiled = 1
    if prediction >= 0.5:
        cnn_classification = "Spoiled"
    else:
        cnn_classification = "Fresh"

    return {
        "cnn_score": round(prediction, 4),
        "cnn_classification":
            cnn_classification
    }


# =========================================================
# SPOILAGE INDICATORS
# =========================================================

def identify_spoilage(
    color_analysis,
    texture_analysis,
    mold_analysis,
    bruising_analysis,
    physical_damage_analysis
):
    evidence = 0

    if (
        color_analysis["color_degradation"]
        == "High"
    ):
        evidence += 1

    if (
        texture_analysis["texture_change"]
        == "High"
    ):
        evidence += 1

    if mold_analysis["mold_detected"]:
        evidence += 2

    if bruising_analysis[
        "bruising_detected"
    ]:
        evidence += 1

    if physical_damage_analysis[
        "physical_damage_detected"
    ]:
        evidence += 1

    if evidence >= 4:
        status = "High Spoilage Indicators"
    elif evidence >= 2:
        status = "Moderate Spoilage Indicators"
    else:
        status = "Low Spoilage Indicators"

    return {
        "spoilage_signs": evidence,
        "spoilage_status": status
    }


# =========================================================
# FINAL COMBINED ASSESSMENT
# =========================================================

def final_freshness_assessment(
    cnn_analysis,
    color_analysis,
    texture_analysis,
    mold_analysis,
    bruising_analysis,
    physical_damage_analysis
):
    """
    CNN is the primary learned classifier.

    OpenCV features are supporting evidence. Several independent
    deterioration indicators can override a false-fresh CNN result,
    which helps with localized spoilage.
    """

    cnn_score = float(
        cnn_analysis["cnn_score"]
    )

    high_color = (
        color_analysis["color_degradation"]
        == "High"
    )

    high_texture = (
        texture_analysis["texture_change"]
        == "High"
    )

    mold = mold_analysis[
        "mold_detected"
    ]

    bruising = bruising_analysis[
        "bruising_detected"
    ]

    damage = physical_damage_analysis[
        "physical_damage_detected"
    ]

    strong_count = sum([
        high_color,
        high_texture,
        mold,
        bruising,
        damage
    ])

    # Strong learned-model spoilage evidence.
    if cnn_score >= 0.70:
        final_classification = "Spoiled"

    # Model leans spoiled; one supporting visual sign is enough.
    elif cnn_score >= 0.50:
        if strong_count >= 1:
            final_classification = "Spoiled"
        else:
            final_classification = "Near Spoilage"

    # Localized spoilage can be missed by a whole-image CNN.
    elif mold and strong_count >= 3:
        final_classification = "Spoiled"

    # Strong colour + texture deterioration plus another sign.
    elif (
        high_color
        and high_texture
        and strong_count >= 3
    ):
        final_classification = "Spoiled"

    # Moderate concern: model is uncertain and multiple
    # supporting indicators agree.
    elif (
        cnn_score >= 0.30
        and strong_count >= 2
    ):
        final_classification = "Near Spoilage"

    # Mold plus another sign is concerning even if CNN is fresh.
    elif mold and strong_count >= 2:
        final_classification = "Near Spoilage"

    else:
        final_classification = "Fresh"

    return {
        "final_classification":
            final_classification
    }


# =========================================================
# COMBINED IMAGE FRESHNESS SCORE
# =========================================================

def calculate_freshness_score(
    cnn_analysis,
    color_analysis,
    texture_analysis,
    mold_analysis,
    bruising_analysis,
    physical_damage_analysis,
    final_assessment
):
    """
    Milestone-2 IMAGE freshness score.

    70% comes from CNN freshness confidence.
    30% comes from supporting visual analysis.

    The final categorical assessment is then used to keep the
    numerical score in a logically consistent range.

    This is NOT the later full Module-7 weighted score because
    storage conditions, shelf-life prediction and product age
    are not yet part of this Milestone-2 image analysis.
    """

    cnn_spoilage = float(
        cnn_analysis["cnn_score"]
    )

    cnn_freshness = (
        1.0 - cnn_spoilage
    ) * 100.0

    visual_score = 100.0

    color = color_analysis[
        "color_degradation"
    ]

    texture = texture_analysis[
        "texture_change"
    ]

    mold = mold_analysis[
        "mold_detected"
    ]

    bruising = bruising_analysis[
        "bruising_detected"
    ]

    damage = physical_damage_analysis[
        "physical_damage_detected"
    ]

    # Supporting visual deductions.
    if color == "High":
        visual_score -= 15
    elif color == "Moderate":
        visual_score -= 5

    if texture == "High":
        visual_score -= 10
    elif texture == "Moderate":
        visual_score -= 4

    if mold:
        visual_score -= 25

    if bruising:
        visual_score -= 5

    if damage:
        visual_score -= 5

    strong_signals = sum([
        color == "High",
        texture == "High",
        mold,
        bruising,
        damage
    ])

    if strong_signals >= 3:
        visual_score -= 10

    visual_score = max(
        0.0,
        min(visual_score, 100.0)
    )

    # CNN is primary; OpenCV features support it.
    combined_score = (
        0.70 * cnn_freshness
        + 0.30 * visual_score
    )

    final_class = final_assessment[
        "final_classification"
    ]

    # Keep numerical score consistent with final assessment.
    if final_class == "Spoiled":
        combined_score = min(
            combined_score,
            39.0
        )

    elif final_class == "Near Spoilage":
        combined_score = max(
            40.0,
            min(combined_score, 59.0)
        )

    else:
        combined_score = max(
            combined_score,
            60.0
        )

    combined_score = round(
        max(0.0, min(combined_score, 100.0)),
        2
    )

    return {
        "freshness_score":
            combined_score,
        "cnn_freshness_score":
            round(cnn_freshness, 2),
        "visual_freshness_score":
            round(visual_score, 2)
    }


# =========================================================
# QUALITY CLASSIFICATION
# =========================================================

def classify_freshness(
    freshness_analysis
):
    score = freshness_analysis[
        "freshness_score"
    ]

    # Heuristic estimate for project reporting.
    spoilage_probability = round(
        100 - score,
        2
    )

    if score >= 80:
        quality = "Fresh"
    elif score >= 65:
        quality = "Good"
    elif score >= 50:
        quality = "Acceptable"
    elif score >= 40:
        quality = "Near Spoilage"
    else:
        quality = "Spoiled"

    return {
        "spoilage_probability":
            spoilage_probability,
        "quality_classification":
            quality
    }


# =========================================================
# FRESHNESS TREND
# =========================================================

def analyze_freshness_trend(
    freshness_analysis,
    classification
):
    score = freshness_analysis[
        "freshness_score"
    ]

    quality = classification[
        "quality_classification"
    ]

    if score >= 80:
        trend = "Stable"
    elif score >= 65:
        trend = "Slightly Declining"
    elif score >= 50:
        trend = "Declining"
    elif score >= 40:
        trend = "Rapidly Declining"
    else:
        trend = "Spoiled Condition"

    return {
        "freshness_trend":
            trend,
        "current_quality":
            quality
    }


# =========================================================
# REPORT GENERATION
# =========================================================

def generate_freshness_report(
    food_type,
    color_analysis,
    texture_analysis,
    mold_analysis,
    bruising_analysis,
    physical_damage_analysis,
    spoilage_analysis,
    freshness_analysis,
    classification,
    freshness_trend,
    final_assessment
):
    return {
        "food_type":
            food_type,

        "final_classification":
            final_assessment[
                "final_classification"
            ],

        "freshness_score":
            freshness_analysis[
                "freshness_score"
            ],

        "quality_classification":
            classification[
                "quality_classification"
            ],

        "spoilage_probability":
            classification[
                "spoilage_probability"
            ],

        "spoilage_status":
            spoilage_analysis[
                "spoilage_status"
            ],

        "freshness_trend":
            freshness_trend[
                "freshness_trend"
            ],

        "visual_analysis": {
            "color_degradation":
                color_analysis[
                    "color_degradation"
                ],

            "texture_change":
                texture_analysis[
                    "texture_change"
                ],

            "mold_detected":
                mold_analysis[
                    "mold_detected"
                ],

            "bruising_detected":
                bruising_analysis[
                    "bruising_detected"
                ],

            "physical_damage_detected":
                physical_damage_analysis[
                    "physical_damage_detected"
                ]
        }
    }
