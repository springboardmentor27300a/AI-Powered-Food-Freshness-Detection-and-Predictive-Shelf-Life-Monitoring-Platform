import os
import sys
import json

import numpy as np
import tensorflow as tf

from PIL import Image


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "food_freshness_model.keras"
)

CLASS_NAMES_PATH = os.path.join(
    BASE_DIR,
    "models",
    "class_names.txt"
)

IMAGE_SIZE = (224, 224)


# ============================================================
# LOAD CLASS NAMES
# ============================================================

with open(
    CLASS_NAMES_PATH,
    "r"
) as f:

    CLASS_NAMES = [
        line.strip()
        for line in f
        if line.strip()
    ]


# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading trained model...")

model = tf.keras.models.load_model(
    MODEL_PATH
)

print(
    "Model loaded successfully."
)


# ============================================================
# IMAGE LOADING
# ============================================================

def load_image(image_path):

    return Image.open(
        image_path
    ).convert("RGB")


# ============================================================
# FRESHNESS CLASSIFICATION
# ============================================================

def predict_freshness(image_path):

    image = load_image(
        image_path
    )

    image = image.resize(
        IMAGE_SIZE
    )

    image_array = np.array(
        image
    ).astype(
        np.float32
    )

    image_array = np.expand_dims(
        image_array,
        axis=0
    )

    predictions = model.predict(
        image_array,
        verbose=0
    )[0]

    predicted_index = int(
        np.argmax(predictions)
    )

    predicted_class = CLASS_NAMES[
        predicted_index
    ]

    confidence = float(
        predictions[predicted_index]
    ) * 100

    return (
        predicted_class,
        confidence
    )


# ============================================================
# FOOD REGION ESTIMATION
# ============================================================

def get_food_mask(image):

    r = image[:, :, 0]
    g = image[:, :, 1]
    b = image[:, :, 2]

    brightness = (
        r + g + b
    ) / 3.0

    color_range = (
        np.maximum.reduce(
            [r, g, b]
        )
        -
        np.minimum.reduce(
            [r, g, b]
        )
    )

    # Ignore very dark background.
    not_dark = (
        brightness > 30
    )

    # Do not remove white/light food.
    not_background_white = (
        brightness < 252
    )

    # Allow colorful and lightly colored foods.
    reasonable_color = (
        color_range > 3
    )

    mask = (
        not_dark
        &
        not_background_white
        &
        reasonable_color
    )

    return mask


# ============================================================
# 1. COLOR DEGRADATION
# ============================================================

def analyze_color(image_path):

    image = load_image(
        image_path
    )

    image = np.array(
        image
    ).astype(
        np.float32
    )

    food_mask = get_food_mask(
        image
    )

    if np.sum(food_mask) < 100:

        return (
            "Low",
            0.0
        )

    r = image[:, :, 0]
    g = image[:, :, 1]
    b = image[:, :, 2]

    brightness = (
        r + g + b
    ) / 3.0

    food_brightness = (
        brightness[food_mask]
    )

    mean_brightness = float(
        np.mean(
            food_brightness
        )
    )

    dark_ratio = np.mean(
        food_brightness < 55
    )

    color_variation = (
        np.maximum.reduce(
            [r, g, b]
        )
        -
        np.minimum.reduce(
            [r, g, b]
        )
    )

    mean_color_variation = float(
        np.mean(
            color_variation[
                food_mask
            ]
        )
    )

    brightness_component = max(
        0,
        65 - mean_brightness
    ) * 0.5

    dark_component = (
        dark_ratio * 20
    )

    variation_component = max(
        0,
        7 - mean_color_variation
    ) * 0.3

    score = (
        brightness_component
        +
        dark_component
        +
        variation_component
    )

    score = max(
        0,
        min(
            100,
            score
        )
    )

    if score >= 60:

        level = "High"

    elif score >= 30:

        level = "Moderate"

    else:

        level = "Low"

    return (
        level,
        float(score)
    )


# ============================================================
# 2. SURFACE TEXTURE
# ============================================================

def analyze_texture(image_path):

    image = load_image(
        image_path
    )

    gray = np.array(
        image.convert("L")
    ).astype(
        np.float32
    )

    horizontal_difference = np.abs(
        gray[:, 1:]
        -
        gray[:, :-1]
    )

    vertical_difference = np.abs(
        gray[1:, :]
        -
        gray[:-1, :]
    )

    texture_variation = float(
        (
            np.mean(
                horizontal_difference
            )
            +
            np.mean(
                vertical_difference
            )
        ) / 2
    )

    score = min(
        100,
        texture_variation * 1.0
    )

    if score >= 60:

        level = "High"

    elif score >= 30:

        level = "Moderate"

    else:

        level = "Low"

    return (
        level,
        float(score)
    )


# ============================================================
# 3. MOLD DETECTION
# ============================================================

def analyze_mold(image_path):

    image = load_image(
        image_path
    )

    image = np.array(
        image
    ).astype(
        np.float32
    )

    r = image[:, :, 0]
    g = image[:, :, 1]
    b = image[:, :, 2]

    brightness = (
        r + g + b
    ) / 3.0

    food_mask = get_food_mask(
        image
    )

    if np.sum(food_mask) < 100:

        return (
            "Not Detected",
            0.0
        )

    # --------------------------------------------------------
    # GREEN MOLD
    # --------------------------------------------------------
    # Require a stronger green dominance.
    # This reduces false detection from normal green food.

    green_mold = (
        (g > r * 1.35)
        &
        (g > b * 1.20)
        &
        (g > 85)
        &
        (brightness < 190)
    )

    # --------------------------------------------------------
    # BLUE MOLD
    # --------------------------------------------------------
    # Require strong blue dominance.

    blue_mold = (
        (b > r * 1.35)
        &
        (b > g * 1.20)
        &
        (b > 85)
        &
        (brightness < 190)
    )

    # --------------------------------------------------------
    # BROWN / DARK SUSPICIOUS AREAS
    # --------------------------------------------------------
    # Dark pixels alone are NOT considered mold.
    # Brown regions need stronger color evidence.

    brown_dark_region = (
        (r > b * 1.30)
        &
        (g > b * 1.15)
        &
        (r > 65)
        &
        (g > 45)
        &
        (brightness < 105)
        &
        food_mask
    )

    mold_candidate = (
        (
            green_mold
            |
            blue_mold
            |
            brown_dark_region
        )
        &
        food_mask
    )

    # --------------------------------------------------------
    # REMOVE VERY SMALL ISOLATED AREAS
    # --------------------------------------------------------

    candidate_uint = (
        mold_candidate.astype(
            np.uint8
        )
    )

    padded = np.pad(
        candidate_uint,
        1,
        mode="constant"
    )

    neighbor_count = (
        padded[:-2, :-2]
        +
        padded[:-2, 1:-1]
        +
        padded[:-2, 2:]
        +
        padded[1:-1, :-2]
        +
        padded[1:-1, 1:-1]
        +
        padded[1:-1, 2:]
        +
        padded[2:, :-2]
        +
        padded[2:, 1:-1]
        +
        padded[2:, 2:]
    )

    localized_mold = (
        mold_candidate
        &
        (
            neighbor_count >= 5
        )
    )

    mold_pixels = np.sum(
        localized_mold
    )

    food_pixels = np.sum(
        food_mask
    )

    mold_ratio = (
        mold_pixels
        /
        max(
            food_pixels,
            1
        )
    )

    # --------------------------------------------------------
    # MOLD SCORE
    # --------------------------------------------------------
    # More conservative thresholds.

    if mold_ratio < 0.005:

        score = 0.0

    elif mold_ratio < 0.012:

        score = 10.0

    elif mold_ratio < 0.025:

        score = 20.0

    elif mold_ratio < 0.045:

        score = 35.0

    elif mold_ratio < 0.08:

        score = 55.0

    else:

        score = 80.0

    score = min(
        100,
        score
    )

    if score >= 70:

        level = "High"

    elif score >= 40:

        level = "Moderate"

    elif score >= 15:

        level = "Low"

    else:

        level = "Not Detected"

    return (
        level,
        float(score)
    )


# ============================================================
# 4. BRUISING DETECTION
# ============================================================

def analyze_bruising(image_path):

    image = load_image(
        image_path
    )

    image = np.array(
        image
    ).astype(
        np.float32
    )

    r = image[:, :, 0]
    g = image[:, :, 1]
    b = image[:, :, 2]

    brightness = (
        r + g + b
    ) / 3.0

    food_mask = get_food_mask(
        image
    )

    if np.sum(food_mask) < 100:

        return (
            "Low",
            0.0
        )

    food_brightness = (
        brightness[
            food_mask
        ]
    )

    normal_brightness = float(
        np.percentile(
            food_brightness,
            60
        )
    )

    # --------------------------------------------------------
    # BROWN DISCOLORATION
    # --------------------------------------------------------
    # Require stronger brown characteristics and
    # significantly lower brightness.

    brown_region = (
        (r > g * 1.08)
        &
        (g > b * 1.18)
        &
        (r > 60)
        &
        (
            brightness
            <
            normal_brightness * 0.62
        )
    )

    # --------------------------------------------------------
    # PURPLE / BLUE BRUISING
    # --------------------------------------------------------
    # Require stronger blue/purple dominance.

    purple_region = (
        (b > g * 1.12)
        &
        (r > g * 0.90)
        &
        (
            brightness
            <
            normal_brightness * 0.62
        )
        &
        (brightness > 40)
    )

    candidate = (
        brown_region
        |
        purple_region
    )

    candidate &= food_mask

    # --------------------------------------------------------
    # NEIGHBORHOOD FILTER
    # --------------------------------------------------------

    candidate_uint = (
        candidate.astype(
            np.uint8
        )
    )

    padded = np.pad(
        candidate_uint,
        1,
        mode="constant"
    )

    neighbor_count = (
        padded[:-2, :-2]
        +
        padded[:-2, 1:-1]
        +
        padded[:-2, 2:]
        +
        padded[1:-1, :-2]
        +
        padded[1:-1, 1:-1]
        +
        padded[1:-1, 2:]
        +
        padded[2:, :-2]
        +
        padded[2:, 1:-1]
        +
        padded[2:, 2:]
    )

    localized_bruise = (
        candidate
        &
        (
            neighbor_count >= 5
        )
    )

    food_area = np.sum(
        food_mask
    )

    bruise_area = np.sum(
        localized_bruise
    )

    bruise_ratio = (
        bruise_area
        /
        max(
            food_area,
            1
        )
    )

    # --------------------------------------------------------
    # BRUISING SCORE
    # --------------------------------------------------------

    if bruise_ratio < 0.005:

        score = 0.0

    elif bruise_ratio < 0.012:

        score = 10.0

    elif bruise_ratio < 0.025:

        score = 25.0

    elif bruise_ratio < 0.045:

        score = 45.0

    elif bruise_ratio < 0.08:

        score = 65.0

    else:

        score = 80.0

    score = min(
        100,
        score
    )

    if score >= 70:

        level = "High"

    elif score >= 40:

        level = "Moderate"

    elif score >= 15:

        level = "Low"

    else:

        level = "Low"

    return (
        level,
        float(score)
    )


# ============================================================
# 5. PHYSICAL DAMAGE
# ============================================================

def analyze_physical_damage(image_path):

    image = load_image(
        image_path
    )

    image = np.array(
        image
    ).astype(
        np.float32
    )

    gray = np.mean(
        image,
        axis=2
    )

    horizontal_edges = np.abs(
        gray[:, 1:]
        -
        gray[:, :-1]
    )

    vertical_edges = np.abs(
        gray[1:, :]
        -
        gray[:-1, :]
    )

    edge_strength = (
        np.mean(
            horizontal_edges
        )
        +
        np.mean(
            vertical_edges
        )
    ) / 2

    score = min(
        100,
        float(edge_strength) * 1.0
    )

    if score >= 60:

        level = "High"

    elif score >= 30:

        level = "Moderate"

    else:

        level = "Low"

    return (
        level,
        float(score)
    )


# ============================================================
# OVERALL FRESHNESS REPORT
# ============================================================

def generate_report(
    freshness,
    confidence,
    color_level,
    color_score,
    texture_level,
    texture_score,
    mold_level,
    mold_score,
    bruise_level,
    bruise_score,
    physical_level,
    physical_score
):

    # --------------------------------------------------------
    # TRAINED MODEL SCORE
    # --------------------------------------------------------

    freshness_scores = {

        "fresh": 90,

        "half_fresh": 60,

        "moderately_fresh": 60,

        "rotten": 20,

        "spoiled": 10
    }

    classifier_score = freshness_scores.get(
        freshness.lower(),
        50
    )

    # --------------------------------------------------------
    # VISUAL QUALITY SCORE
    # --------------------------------------------------------

    visual_score = (

        (100 - color_score) * 0.20

        +

        (100 - texture_score) * 0.15

        +

        (100 - mold_score) * 0.20

        +

        (100 - bruise_score) * 0.15

        +

        (100 - physical_score) * 0.10

        +

        classifier_score * 0.20
    )

    # --------------------------------------------------------
    # COMBINE MODEL + VISUAL ANALYSIS
    # --------------------------------------------------------

    overall_score = (

        classifier_score * 0.60

        +

        visual_score * 0.40
    )

    overall_score = max(
        0,
        min(
            100,
            overall_score
        )
    )

    # --------------------------------------------------------
    # SAFETY INDICATORS
    # --------------------------------------------------------

    # Mold now needs BOTH:
    # 1. A high mold score
    # 2. High-confidence freshness model evidence
    #
    # This prevents a weak heuristic from immediately
    # declaring a fresh image spoiled.

    strong_mold = (
        mold_score >= 70
        and
        mold_level.lower() == "high"
        and
        freshness.lower()
        in [
            "rotten",
            "spoiled"
        ]
        and
        confidence >= 70
    )

    strong_bruising = (
        bruise_score >= 70
        and
        bruise_level.lower() == "high"
    )

    strong_physical_damage = (
        physical_score >= 75
        and
        physical_level.lower() == "high"
    )

    # --------------------------------------------------------
    # DETERMINE FINAL CONDITION
    # --------------------------------------------------------

    if strong_mold:

        condition = "Spoiled / Unsafe"

        recommendation = (
            "Strong visual indicators of possible mold "
            "or spoilage were detected. Avoid consumption "
            "and inspect or discard the food."
        )

        overall_score = min(
            overall_score,
            30
        )

    elif (
        freshness.lower()
        in [
            "rotten",
            "spoiled"
        ]
        and
        confidence >= 70
    ):

        condition = "Spoiled / Unsafe"

        recommendation = (
            "The trained freshness model indicates "
            "significant spoilage. Avoid consumption."
        )

        overall_score = min(
            overall_score,
            30
        )

    elif (
        strong_bruising
        or
        strong_physical_damage
    ):

        condition = "Low Freshness"

        recommendation = (
            "Significant physical deterioration was "
            "detected. Inspect the food carefully "
            "before use."
        )

        overall_score = min(
            overall_score,
            55
        )

    elif overall_score >= 70:

        condition = "Fresh"

        recommendation = (
            "Food appears suitable for consumption "
            "based on the available visual analysis."
        )

    elif overall_score >= 50:

        condition = "Moderately Fresh"

        recommendation = (
            "Food shows some quality deterioration "
            "and should be consumed soon."
        )

    elif overall_score >= 30:

        condition = "Low Freshness"

        recommendation = (
            "Food shows noticeable deterioration. "
            "Inspect carefully before use."
        )

    else:

        condition = "Spoiled / Unsafe"

        recommendation = (
            "Food shows significant deterioration. "
            "Avoid consumption."
        )

    # ========================================================
    # FINAL CLASSIFICATION
    # ========================================================

    if overall_score >= 70:

        final_classification = "Fresh"

    elif overall_score >= 50:

        final_classification = "Moderately Fresh"

    elif overall_score >= 30:

        final_classification = "Low Freshness"

    else:

        final_classification = "Spoiled / Unsafe"

    # ========================================================
    # PRINT REPORT
    # ========================================================

    print("\n")

    print("=" * 60)

    print(
        "              OVERALL FRESHNESS REPORT"
    )

    print("=" * 60)

    print(
        f"\nModel Prediction          : "
        f"{freshness}"
    )

    print(
        f"Model Confidence          : "
        f"{confidence:.2f}%"
    )

    print(
        f"Final Classification      : "
        f"{final_classification}"
    )

    print("\nColor Degradation")

    print(
        f"  Level : {color_level}"
    )

    print(
        f"  Score : {color_score:.2f}/100"
    )

    print("\nSurface Texture Changes")

    print(
        f"  Level : {texture_level}"
    )

    print(
        f"  Score : {texture_score:.2f}/100"
    )

    print("\nMold Detection")

    print(
        f"  Level : {mold_level}"
    )

    print(
        f"  Score : {mold_score:.2f}/100"
    )

    print("\nBruising Detection")

    print(
        f"  Level : {bruise_level}"
    )

    print(
        f"  Score : {bruise_score:.2f}/100"
    )

    print("\nPhysical Damage Detection")

    print(
        f"  Level : {physical_level}"
    )

    print(
        f"  Score : {physical_score:.2f}/100"
    )

    print("\nOverall Assessment")

    print(
        f"  Freshness Score : "
        f"{overall_score:.2f}/100"
    )

    print(
        f"  Condition       : "
        f"{condition}"
    )

    print("\nRecommendation")

    print(
        f"  {recommendation}"
    )

    print("\n" + "=" * 60)

    # ========================================================
    # JSON REPORT
    # ========================================================

    return {

        "freshness": {

            "classification":
                final_classification,

            "confidence":
                round(
                    confidence,
                    2
                )
        },

        "color_degradation": {

            "level":
                color_level,

            "score":
                round(
                    color_score,
                    2
                )
        },

        "surface_texture_changes": {

            "level":
                texture_level,

            "score":
                round(
                    texture_score,
                    2
                )
        },

        "mold_detection": {

            "level":
                mold_level,

            "score":
                round(
                    mold_score,
                    2
                )
        },

        "bruising_detection": {

            "level":
                bruise_level,

            "score":
                round(
                    bruise_score,
                    2
                )
        },

        "physical_damage_detection": {

            "level":
                physical_level,

            "score":
                round(
                    physical_score,
                    2
                )
        },

        "overall_assessment": {

            "freshness_score":
                round(
                    overall_score,
                    2
                ),

            "condition":
                condition,

            "recommendation":
                recommendation
        }
    }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print("\nUsage:")

        print(
            r'python .\Datasets\analyze_food.py "path_to_image.jpg"'
        )

        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.exists(
        image_path
    ):

        print(
            "\nERROR: Image not found:"
        )

        print(
            image_path
        )

        sys.exit(1)

    print(
        "\nAnalyzing image..."
    )

    print(
        f"Image: {image_path}"
    )

    # --------------------------------------------------------
    # 1. FRESHNESS
    # --------------------------------------------------------

    freshness, confidence = (
        predict_freshness(
            image_path
        )
    )

    print(
        "\nFreshness prediction completed."
    )

    # --------------------------------------------------------
    # 2. COLOR
    # --------------------------------------------------------

    color_level, color_score = (
        analyze_color(
            image_path
        )
    )

    print(
        "Color degradation analysis completed."
    )

    # --------------------------------------------------------
    # 3. TEXTURE
    # --------------------------------------------------------

    texture_level, texture_score = (
        analyze_texture(
            image_path
        )
    )

    print(
        "Surface texture analysis completed."
    )

    # --------------------------------------------------------
    # 4. MOLD
    # --------------------------------------------------------

    mold_level, mold_score = (
        analyze_mold(
            image_path
        )
    )

    print(
        "Mold detection completed."
    )

    # --------------------------------------------------------
    # 5. BRUISING
    # --------------------------------------------------------

    bruise_level, bruise_score = (
        analyze_bruising(
            image_path
        )
    )

    print(
        "Bruising detection completed."
    )

    # --------------------------------------------------------
    # 6. PHYSICAL DAMAGE
    # --------------------------------------------------------

    physical_level, physical_score = (
        analyze_physical_damage(
            image_path
        )
    )

    print(
        "Physical damage detection completed."
    )

    # --------------------------------------------------------
    # 7. FINAL REPORT
    # --------------------------------------------------------

    report = generate_report(

        freshness,

        confidence,

        color_level,

        color_score,

        texture_level,

        texture_score,

        mold_level,

        mold_score,

        bruise_level,

        bruise_score,

        physical_level,

        physical_score
    )

    # --------------------------------------------------------
    # JSON OUTPUT
    # --------------------------------------------------------

    print(
        "\nREPORT_JSON_START"
    )

    print(
        json.dumps(report)
    )

    print(
        "REPORT_JSON_END"
    )