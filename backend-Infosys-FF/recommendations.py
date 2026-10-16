# ============================================================
# RECOMMENDATION ENGINE
# ============================================================


def generate_recommendations(
    category,
    freshness_score,
    risk_level,
    remaining_shelf_life_days,
    storage_temperature=None,
    humidity=None,
    packaging_type=None,
    purchase_date=None,
    expiry_date=None,
    warnings=None
):
    """
    Generate practical food storage, consumption,
    inventory rotation and waste reduction recommendations.
    """

    recommendations = []

    storage_recommendations = []

    consumption_recommendations = []

    inventory_recommendations = []

    waste_reduction_recommendations = []

    quality_recommendations = []

    warnings = warnings or []


    # ========================================================
    # NORMALIZE VALUES
    # ========================================================

    category_lower = (
        str(category)
        .strip()
        .lower()
    )

    risk_lower = (
        str(risk_level)
        .strip()
        .lower()
    )

    try:
        freshness_score = float(
            freshness_score
        )
    except (TypeError, ValueError):
        freshness_score = 0


    try:
        remaining_days = float(
            remaining_shelf_life_days
        )
    except (TypeError, ValueError):
        remaining_days = 0


    # ========================================================
    # 1. STORAGE RECOMMENDATIONS
    # ========================================================

    if storage_temperature is not None:

        try:

            temperature = float(
                storage_temperature
            )

            # General temperature guidance
            if temperature > 25:

                storage_recommendations.append(
                    "Storage temperature is high. "
                    "Move the food to a cooler storage area "
                    "to slow quality deterioration."
                )

            elif temperature < 0:

                storage_recommendations.append(
                    "Storage temperature is very low. "
                    "Ensure the product is suitable for freezing "
                    "and avoid unnecessary freezing and thawing."
                )

            else:

                storage_recommendations.append(
                    "Continue monitoring storage temperature "
                    "regularly to maintain food quality."
                )

        except (TypeError, ValueError):

            pass


    # ========================================================
    # CATEGORY-SPECIFIC STORAGE
    # ========================================================

    if category_lower in {
        "fruits",
        "vegetables"
    }:

        storage_recommendations.append(
            "Store fruits and vegetables under suitable "
            "temperature and humidity conditions and maintain "
            "proper air circulation."
        )


    elif category_lower == "dairy products":

        storage_recommendations.append(
            "Keep dairy products refrigerated and avoid "
            "leaving them at room temperature for long periods."
        )


    elif category_lower in {
        "meat & poultry",
        "meat and poultry"
    }:

        storage_recommendations.append(
            "Keep meat and poultry refrigerated or frozen "
            "and maintain strict temperature control."
        )


    elif category_lower == "seafood":

        storage_recommendations.append(
            "Keep seafood properly chilled and minimize "
            "the time it remains outside refrigerated storage."
        )


    elif category_lower == "bakery products":

        storage_recommendations.append(
            "Store bakery products in a clean, dry and "
            "well-protected environment."
        )


    elif category_lower == "packaged foods":

        storage_recommendations.append(
            "Keep packaged foods in a cool, dry location "
            "and protect them from moisture."
        )


    elif category_lower == "beverages":

        storage_recommendations.append(
            "Store beverages according to their packaging "
            "and recommended temperature requirements."
        )


    # ========================================================
    # HUMIDITY
    # ========================================================

    if humidity is not None:

        try:

            humidity_value = float(
                humidity
            )

            if humidity_value > 80:

                storage_recommendations.append(
                    "Humidity is high. Improve ventilation "
                    "and reduce moisture exposure where possible."
                )

            elif humidity_value < 30:

                storage_recommendations.append(
                    "Humidity is relatively low. Ensure the "
                    "product packaging protects it from excessive drying."
                )

        except (TypeError, ValueError):

            pass


    # ========================================================
    # PACKAGING
    # ========================================================

    if packaging_type:

        packaging_lower = (
            str(packaging_type)
            .strip()
            .lower()
        )


        if packaging_lower in {
            "open",
            "loose",
            "unpacked"
        }:

            storage_recommendations.append(
                "The product is not securely packaged. "
                "Use sealed or airtight packaging where appropriate "
                "to reduce contamination and quality loss."
            )

        elif packaging_lower in {
            "sealed",
            "vacuum sealed",
            "airtight"
        }:

            storage_recommendations.append(
                "Maintain the current protective packaging "
                "and ensure it remains properly sealed."
            )


    # ========================================================
    # 2. FRESHNESS-BASED RECOMMENDATIONS
    # ========================================================

    if freshness_score >= 80:

        quality_recommendations.append(
            "The food currently shows a high freshness score. "
            "Continue following recommended storage conditions."
        )


    elif freshness_score >= 60:

        quality_recommendations.append(
            "The food is reasonably fresh, but regular monitoring "
            "is recommended to maintain its quality."
        )


    elif freshness_score >= 40:

        quality_recommendations.append(
            "Freshness is declining. Monitor the product closely "
            "and prioritize it for earlier consumption."
        )


    elif freshness_score >= 20:

        quality_recommendations.append(
            "Freshness is low. Inspect the product carefully "
            "before consumption and prioritize it in inventory."
        )


    else:

        quality_recommendations.append(
            "Freshness is critically low. The product should "
            "be inspected carefully and may need to be discarded."
        )


    # ========================================================
    # 3. RISK-BASED CONSUMPTION RECOMMENDATIONS
    # ========================================================

    if risk_lower == "high":

        consumption_recommendations.append(
            "High shelf-life risk detected. Do not delay inspection "
            "or consumption decisions."
        )

        consumption_recommendations.append(
            "If visible spoilage, mold, unusual odor or other "
            "unsafe signs are present, avoid consumption."
        )


    elif risk_lower == "moderate":

        consumption_recommendations.append(
            "Consume or process this product soon to reduce "
            "the risk of food waste."
        )


    elif risk_lower == "low":

        consumption_recommendations.append(
            "The product can generally remain in storage, "
            "but continue monitoring its condition."
        )


    else:

        consumption_recommendations.append(
            "The product has a relatively low immediate shelf-life "
            "risk under the provided conditions."
        )


    # ========================================================
    # 4. REMAINING SHELF LIFE
    # ========================================================

    if remaining_days <= 0:

        consumption_recommendations.append(
            "The estimated remaining shelf life has been reached. "
            "Check the product carefully before any further use."
        )


    elif remaining_days <= 1:

        consumption_recommendations.append(
            "Less than or equal to one day of estimated shelf life "
            "remains. Prioritize this product immediately."
        )


    elif remaining_days <= 3:

        consumption_recommendations.append(
            "Only a few days remain. Prioritize this product "
            "for consumption or processing."
        )


    elif remaining_days <= 7:

        consumption_recommendations.append(
            "This product should be included in the near-term "
            "consumption or sales plan."
        )


    # ========================================================
    # 5. INVENTORY ROTATION
    # ========================================================

    if remaining_days <= 3:

        inventory_recommendations.append(
            "Apply FEFO (First Expire, First Out) and move this "
            "batch toward the front of the inventory."
        )


    elif remaining_days <= 7:

        inventory_recommendations.append(
            "Prioritize this batch before products with a longer "
            "remaining shelf life."
        )


    else:

        inventory_recommendations.append(
            "Maintain normal inventory rotation and continue "
            "monitoring the predicted expiry date."
        )


    # ========================================================
    # 6. WASTE REDUCTION
    # ========================================================

    if remaining_days <= 3:

        waste_reduction_recommendations.append(
            "Prioritize this batch for immediate sale, consumption "
            "or processing to reduce potential food waste."
        )


    if remaining_days <= 0:

        waste_reduction_recommendations.append(
            "Evaluate the batch immediately and separate any "
            "unsafe or visibly spoiled product."
        )


    else:

        waste_reduction_recommendations.append(
            "Monitor shelf-life regularly and use FEFO rotation "
            "to reduce unnecessary food waste."
        )


    # ========================================================
    # 7. WARNINGS
    # ========================================================

    if warnings:

        quality_recommendations.append(
            "Review the generated storage warnings and correct "
            "the relevant conditions where possible."
        )


    # ========================================================
    # 8. FINAL RECOMMENDATION
    # ========================================================

    if risk_lower == "high":

        overall_recommendation = (
            "High-risk product: prioritize inspection and "
            "consumption decisions. If spoilage indicators are "
            "present, do not consume the product."
        )


    elif remaining_days <= 1:

        overall_recommendation = (
            "This product should be prioritized immediately "
            "because very little estimated shelf life remains."
        )


    elif remaining_days <= 3:

        overall_recommendation = (
            "Prioritize this product for consumption, sale or "
            "processing and apply FEFO inventory rotation."
        )


    elif freshness_score < 40:

        overall_recommendation = (
            "Freshness is declining. Monitor the product closely "
            "and prioritize it over fresher inventory."
        )


    else:

        overall_recommendation = (
            "Continue recommended storage practices and monitor "
            "freshness and shelf life regularly."
        )


    # ========================================================
    # REMOVE DUPLICATES
    # ========================================================

    def remove_duplicates(items):

        return list(
            dict.fromkeys(items)
        )


    storage_recommendations = (
        remove_duplicates(
            storage_recommendations
        )
    )

    consumption_recommendations = (
        remove_duplicates(
            consumption_recommendations
        )
    )

    inventory_recommendations = (
        remove_duplicates(
            inventory_recommendations
        )
    )

    waste_reduction_recommendations = (
        remove_duplicates(
            waste_reduction_recommendations
        )
    )

    quality_recommendations = (
        remove_duplicates(
            quality_recommendations
        )
    )


    # ========================================================
    # RETURN ENGINE RESULT
    # ========================================================

    return {

        "overall_recommendation":
            overall_recommendation,

        "storage_recommendations":
            storage_recommendations,

        "consumption_recommendations":
            consumption_recommendations,

        "inventory_rotation":
            inventory_recommendations,

        "waste_reduction":
            waste_reduction_recommendations,

        "quality_improvement":
            quality_recommendations,

        "warnings":
            warnings
    }