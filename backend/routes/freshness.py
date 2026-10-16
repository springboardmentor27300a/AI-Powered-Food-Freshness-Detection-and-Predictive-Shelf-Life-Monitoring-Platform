from fastapi import APIRouter, UploadFile, File, Form

from services.image_analysis import (
    analyze_color,
    analyze_texture,
    detect_mold,
    detect_bruising,
    detect_physical_damage,
    identify_spoilage,
    calculate_freshness_score,
    classify_freshness,
    analyze_freshness_trend,
    generate_freshness_report,
    predict_cnn_freshness,
    final_freshness_assessment,
)

import os
import shutil


router = APIRouter(
    prefix="/freshness",
    tags=["Freshness Analysis"]
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/analyze")
async def analyze_food_image(
    food_type: str = Form(...),
    image: UploadFile = File(...)
):
    file_path = os.path.join(
        UPLOAD_DIR,
        image.filename
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            image.file,
            buffer
        )

    # ---------------------------------------------------------
    # VISUAL IMAGE ANALYSIS
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # CNN PREDICTION
    # ---------------------------------------------------------

    cnn_analysis = predict_cnn_freshness(
        file_path
    )

    # ---------------------------------------------------------
    # SUPPORTING SPOILAGE ANALYSIS
    # ---------------------------------------------------------

    spoilage_analysis = identify_spoilage(
        color_analysis,
        texture_analysis,
        mold_analysis,
        bruising_analysis,
        physical_damage_analysis
    )

    # ---------------------------------------------------------
    # FINAL COMBINED CLASSIFICATION
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # COMBINED IMAGE FRESHNESS SCORE
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # QUALITY CLASSIFICATION + TREND
    # ---------------------------------------------------------

    classification = classify_freshness(
        freshness_analysis
    )

    freshness_trend = (
        analyze_freshness_trend(
            freshness_analysis,
            classification
        )
    )

    # ---------------------------------------------------------
    # FORCE USER-FACING FIELDS TO AGREE WITH FINAL ASSESSMENT
    # ---------------------------------------------------------

    final_class = (
        final_assessment[
            "final_classification"
        ]
    )

    if final_class == "Spoiled":

        classification[
            "quality_classification"
        ] = "Spoiled"

        freshness_trend[
            "freshness_trend"
        ] = "Spoiled Condition"

        freshness_trend[
            "current_quality"
        ] = "Spoiled"

    elif final_class == "Near Spoilage":

        classification[
            "quality_classification"
        ] = "Near Spoilage"

        freshness_trend[
            "freshness_trend"
        ] = "Rapidly Declining"

        freshness_trend[
            "current_quality"
        ] = "Near Spoilage"

    # ---------------------------------------------------------
    # REPORT
    # ---------------------------------------------------------

    freshness_report = (
        generate_freshness_report(
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
        )
    )

    # ---------------------------------------------------------
    # API RESPONSE
    # ---------------------------------------------------------

    return {
        "message":
            "Food image analyzed successfully",

        "food_type":
            food_type,

        "image_name":
            image.filename,

        "color_analysis":
            color_analysis,

        "texture_analysis":
            texture_analysis,

        "mold_analysis":
            mold_analysis,

        "bruising_analysis":
            bruising_analysis,

        "physical_damage_analysis":
            physical_damage_analysis,

        "spoilage_analysis":
            spoilage_analysis,

        "freshness_analysis":
            freshness_analysis,

        "classification":
            classification,

        "freshness_trend":
            freshness_trend,

        "freshness_report":
            freshness_report,

        "cnn_analysis":
            cnn_analysis,

        "final_assessment":
            final_assessment,
    }
