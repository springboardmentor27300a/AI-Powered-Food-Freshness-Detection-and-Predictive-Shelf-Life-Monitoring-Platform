# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# AI FOOD FRESHNESS PREDICTION SERVICE
# ============================================================

import json
from pathlib import Path

import numpy as np
import tensorflow as tf


# ============================================================
# PATHS
# ============================================================

# backend/
# ├── app/
# │   └── services/
# │       └── prediction.py
# └── models/
#     ├── food_freshness_model.keras
#     └── class_names.json

BACKEND_DIR = Path(__file__).resolve().parents[2]

MODEL_PATH = (
    BACKEND_DIR
    / "models"
    / "food_freshness_model.keras"
)

CLASS_NAMES_PATH = (
    BACKEND_DIR
    / "models"
    / "class_names.json"
)


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


with open(
    CLASS_NAMES_PATH,
    "r",
    encoding="utf-8",
) as file:
    CLASS_NAMES = json.load(file)


# ============================================================
# VALIDATE CLASS NAMES
# ============================================================

REQUIRED_CLASSES = {
    "fresh",
    "less_fresh",
    "rotten",
}

if not REQUIRED_CLASSES.issubset(
    set(CLASS_NAMES)
):
    raise ValueError(
        "class_names.json must contain: "
        "fresh, less_fresh, rotten"
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


# ============================================================
# MODEL INFORMATION
# ============================================================

print("============================================================")
print("FOOD FRESHNESS AI MODEL LOADED")
print("============================================================")
print(f"Model       : {MODEL_PATH}")
print(f"Classes     : {CLASS_NAMES}")
print(f"Image Size  : {IMAGE_SIZE}")
print("============================================================")


# ============================================================
# FRESHNESS SCORE
# ============================================================

def calculate_freshness_score(
    probabilities,
    predicted_class,
):
    """
    Convert model prediction into
    a freshness score from 0 to 100.

    fresh      -> 70 to 100
    less_fresh -> 40 to 70
    rotten     -> 0 to 39
    """

    fresh_index = CLASS_NAMES.index(
        "fresh"
    )

    less_fresh_index = CLASS_NAMES.index(
        "less_fresh"
    )

    rotten_index = CLASS_NAMES.index(
        "rotten"
    )

    fresh_probability = float(
        probabilities[fresh_index]
    )

    less_fresh_probability = float(
        probabilities[less_fresh_index]
    )

    rotten_probability = float(
        probabilities[rotten_index]
    )


    # --------------------------------------------------------
    # FRESH
    # --------------------------------------------------------

    if predicted_class == "fresh":

        score = (
            70
            + (
                fresh_probability
                * 30
            )
        )


    # --------------------------------------------------------
    # LESS FRESH
    # --------------------------------------------------------

    elif predicted_class == "less_fresh":

        score = (
            40
            + (
                less_fresh_probability
                * 30
            )
        )


    # --------------------------------------------------------
    # ROTTEN
    # --------------------------------------------------------

    elif predicted_class == "rotten":

        score = (
            rotten_probability
            * 39
        )


    else:

        score = 0


    return round(
        max(
            0,
            min(
                score,
                100,
            ),
        ),
        2,
    )


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def preprocess_image(
    image_path,
):
    """
    Load and prepare food image
    for the trained MobileNetV2 model.

    The image is resized to 224x224.
    """

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


    # --------------------------------------------------------
    # IMPORTANT
    # --------------------------------------------------------
    # The trained model already contains
    # MobileNetV2 preprocessing layers.
    #
    # Therefore we DO NOT apply another
    # preprocess_input() here.
    # --------------------------------------------------------


    return image_array.astype(
        np.float32
    )


# ============================================================
# PREDICTION
# ============================================================

def predict_freshness(
    food_name,
    image_path,
):
    """
    Predict freshness of a food image.

    Returns:

        {
            "food_name": "...",
            "freshness_status": "Fresh",
            "freshness_score": 85.5,
            "confidence": 91.2,
            "predicted_class": "fresh"
        }
    """


    # ========================================================
    # VALIDATE FOOD NAME
    # ========================================================

    if not food_name:

        food_name = "Unknown Food"


    food_name = str(
        food_name
    ).strip()


    # ========================================================
    # VALIDATE IMAGE
    # ========================================================

    if not image_path:

        return {
            "food_name": food_name,
            "freshness_status": "Pending",
            "freshness_score": None,
            "confidence": None,
            "predicted_class": None,
        }


    image_file = Path(
        image_path
    )


    if not image_file.exists():

        raise FileNotFoundError(
            f"Food image not found: {image_file}"
        )


    # ========================================================
    # PREPROCESS IMAGE
    # ========================================================

    image_array = preprocess_image(
        image_file
    )


    # ========================================================
    # MODEL PREDICTION
    # ========================================================

    predictions = MODEL.predict(
        image_array,
        verbose=0,
    )


    # ========================================================
    # VALIDATE MODEL OUTPUT
    # ========================================================

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


    if len(probabilities) != len(
        CLASS_NAMES
    ):

        raise RuntimeError(
            "Model output classes do not "
            "match class_names.json."
        )


    # ========================================================
    # NORMALIZE PROBABILITIES
    # ========================================================

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


    # ========================================================
    # FIND PREDICTED CLASS
    # ========================================================

    predicted_index = int(
        np.argmax(probabilities)
    )


    predicted_class = (
        CLASS_NAMES[
            predicted_index
        ]
    )


    # ========================================================
    # CONFIDENCE
    # ========================================================

    confidence = float(
        probabilities[
            predicted_index
        ]
        * 100
    )


    # ========================================================
    # FRESHNESS SCORE
    # ========================================================

    freshness_score = (
        calculate_freshness_score(
            probabilities,
            predicted_class,
        )
    )


    # ========================================================
    # STATUS MAP
    # ========================================================

    status_map = {

        "fresh":
            "Fresh",

        "less_fresh":
            "Less Fresh",

        "rotten":
            "Rotten",
    }


    freshness_status = (
        status_map.get(
            predicted_class,
            "Pending",
        )
    )


    # ========================================================
    # RESULT
    # ========================================================

    result = {

        "food_name":
            food_name,

        "freshness_status":
            freshness_status,

        "freshness_score":
            freshness_score,

        "confidence":
            round(
                confidence,
                2,
            ),

        "predicted_class":
            predicted_class,
    }


    # ========================================================
    # LOG RESULT
    # ========================================================

    print(
        "------------------------------------------------------------"
    )

    print(
        "FOOD FRESHNESS PREDICTION"
    )

    print(
        "------------------------------------------------------------"
    )

    print(
        f"Food       : {food_name}"
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
        "------------------------------------------------------------"
    )


    return result