from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
)

from services.shelf_life_prediction import (
    predict_shelf_life,
    FOOD_STORAGE_DATA,
)

from services.image_analysis import (
    analyze_color,
    analyze_texture,
    detect_mold,
    detect_bruising,
    detect_physical_damage,
    calculate_freshness_score,
    predict_cnn_freshness,
    final_freshness_assessment,
)

import os
import shutil


router = APIRouter(
    prefix="/shelf-life",
    tags=["Shelf Life Prediction"]
)


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/predict")
async def predict_remaining_shelf_life(

    # -------------------------------------------------
    # BASIC INPUTS
    # -------------------------------------------------

    food_type: str = Form(...),

    # Image is now uploaded directly.
    # Freshness score is calculated automatically.
    image: UploadFile = File(...),

    # recommended = food-specific ideal baseline
    # monitored   = actual/simulated environment
    prediction_mode: str = Form("recommended"),

    # Optional in recommended mode.
    # Required in monitored mode.
    temperature: float | None = Form(None),
    humidity: float | None = Form(None),

    storage_duration: int = Form(0),

    packaging_type: str = Form("sealed"),

    air_circulation: str | None = Form(None),
    light_exposure: str | None = Form(None),
):

    # =================================================
    # 1. NORMALIZE INPUTS
    # =================================================

    food_key = food_type.lower().strip()
    mode = prediction_mode.lower().strip()
    packaging_type = packaging_type.lower().strip()

    # =================================================
    # 2. VALIDATION
    # =================================================

    if mode not in {
        "recommended",
        "monitored"
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "prediction_mode must be "
                "'recommended' or 'monitored'."
            ),
        )

    if packaging_type not in {
        "vacuum",
        "sealed",
        "ventilated"
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "packaging_type must be "
                "'vacuum', 'sealed', or "
                "'ventilated'."
            ),
        )

    if storage_duration < 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "storage_duration cannot be negative."
            ),
        )

    # =================================================
    # 3. SAVE UPLOADED IMAGE
    # =================================================

    file_path = os.path.join(
        UPLOAD_DIR,
        image.filename
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            image.file,
            buffer
        )

    # =================================================
    # 4. IMAGE ANALYSIS
    # =================================================

    color_analysis = analyze_color(
        file_path
    )

    texture_analysis = analyze_texture(
        file_path
    )

    mold_analysis = detect_mold(
        file_path
    )

    bruising_analysis = detect_bruising(
        file_path
    )

    physical_damage_analysis = (
        detect_physical_damage(
            file_path
        )
    )

    # =================================================
    # 5. CNN FRESHNESS ANALYSIS
    # =================================================

    cnn_analysis = predict_cnn_freshness(
        file_path
    )

    # =================================================
    # 6. FINAL IMAGE ASSESSMENT
    # =================================================

    final_assessment = (
        final_freshness_assessment(
            cnn_analysis,
            color_analysis,
            texture_analysis,
            mold_analysis,
            bruising_analysis,
            physical_damage_analysis
        )
    )

    # =================================================
    # 7. AUTOMATIC FRESHNESS SCORE
    # =================================================

    freshness_analysis = (
        calculate_freshness_score(
            cnn_analysis,
            color_analysis,
            texture_analysis,
            mold_analysis,
            bruising_analysis,
            physical_damage_analysis,
            final_assessment
        )
    )

    freshness_score = float(
        freshness_analysis[
            "freshness_score"
        ]
    )

    # =================================================
    # 8. FOOD-SPECIFIC STORAGE REQUIREMENTS
    # =================================================

    requirements = FOOD_STORAGE_DATA.get(
        food_key,
        {
            "base_shelf_life": 7,
            "temp_min": 2,
            "temp_max": 8,
            "humidity_min": 70,
            "humidity_max": 90,
            "air_circulation": [
                "moderate"
            ],
            "light_exposure": [
                "low",
                "moderate"
            ],
        },
    )

    # =================================================
    # 9. RECOMMENDED STORAGE MODE
    # =================================================

    if mode == "recommended":

        temperature = (
            requirements["temp_min"]
            +
            requirements["temp_max"]
        ) / 2

        humidity = (
            requirements["humidity_min"]
            +
            requirements["humidity_max"]
        ) / 2

        air_circulation = (
            requirements[
                "air_circulation"
            ][0]
        )

        light_exposure = (
            requirements[
                "light_exposure"
            ][0]
        )

    # =================================================
    # 10. MONITORED STORAGE MODE
    # =================================================

    else:

        if (
            temperature is None
            or humidity is None
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Temperature and humidity "
                    "are required for monitored "
                    "storage prediction."
                ),
            )

        if air_circulation is None:
            air_circulation = "moderate"

        if light_exposure is None:
            light_exposure = "low"

    air_circulation = (
        air_circulation
        .lower()
        .strip()
    )

    light_exposure = (
        light_exposure
        .lower()
        .strip()
    )

    # =================================================
    # 11. SHELF-LIFE PREDICTION
    # =================================================

    prediction = predict_shelf_life(
        food_type=food_type,

        # IMPORTANT:
        # This came automatically from the image.
        freshness_score=freshness_score,

        temperature=temperature,
        humidity=humidity,

        storage_duration=storage_duration,

        packaging_type=packaging_type,

        air_circulation=air_circulation,

        light_exposure=light_exposure,
    )

    # =================================================
    # 12. ADD IMAGE ANALYSIS INFORMATION
    # =================================================

    prediction[
        "image_analysis"
    ] = {
        "image_name":
            image.filename,

        "freshness_score":
            round(
                freshness_score,
                2
            ),

        "cnn_classification":
            cnn_analysis.get(
                "cnn_classification"
            ),

        "final_classification":
            final_assessment.get(
                "final_classification"
            ),
    }

    # =================================================
    # 13. PREDICTION MODE INFORMATION
    # =================================================

    prediction[
        "prediction_mode"
    ] = mode

    prediction[
        "environmental_source"
    ] = (
        "Food-specific recommended "
        "storage baseline"
        if mode == "recommended"
        else
        "Recorded / simulated storage "
        "monitoring data"
    )

    # =================================================
    # 14. CONDITIONS ACTUALLY USED
    # =================================================

    prediction[
        "conditions_used"
    ] = {
        "temperature":
            temperature,

        "humidity":
            humidity,

        "air_circulation":
            air_circulation,

        "light_exposure":
            light_exposure,

        "packaging_type":
            packaging_type,

        "storage_duration_days":
            storage_duration,
    }

    # =================================================
    # 15. RETURN COMPLETE RESULT
    # =================================================

    return prediction