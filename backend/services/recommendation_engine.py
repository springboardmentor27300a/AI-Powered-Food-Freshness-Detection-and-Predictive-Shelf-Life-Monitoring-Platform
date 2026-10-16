from datetime import datetime


def generate_recommendations(
    food_type: str,
    remaining_days: int,
    spoilage_probability: float,
    temperature_status: str,
    humidity_status: str,
    air_status: str,
    light_status: str,
    recommended_temperature: str,
    recommended_humidity: str,
    predicted_expiry_date: str,
    freshness_status: str = "",
):
    storage_recommendations = []
    consumption_recommendations = []
    waste_reduction_recommendations = []
    quality_improvement_recommendations = []

    # --------------------------------
    # 1. Storage recommendations
    # --------------------------------
    if temperature_status != "Optimal":
        storage_recommendations.append(
            f"Adjust storage temperature to {recommended_temperature}."
        )

    if humidity_status != "Optimal":
        storage_recommendations.append(
            f"Maintain humidity within {recommended_humidity}."
        )

    if air_status != "Suitable":
        storage_recommendations.append(
            "Improve air circulation around the stored product."
        )

    if light_status != "Suitable":
        storage_recommendations.append(
            "Reduce light exposure and avoid direct light."
        )

    if not storage_recommendations:
        storage_recommendations.append(
            "Current storage conditions are suitable."
        )

    # --------------------------------
    # 2. Consumption recommendations
    # --------------------------------
    is_spoiled = str(freshness_status).strip().lower() == "spoiled"

    if is_spoiled:
        consumption_priority = "Do Not Consume"
        consumption_recommendations.append(
            "Do not consume. Remove this product from usable inventory "
            "and discard it according to food-safety procedures."
        )

    elif remaining_days <= 0:
        consumption_priority = "Immediate"
        consumption_recommendations.append(
            "Shelf life has been exhausted. Inspect the product immediately "
            "and do not use it if spoilage is present."
        )

    elif remaining_days <= 2:
        consumption_priority = "Urgent"
        consumption_recommendations.append(
            f"Consume as soon as possible, preferably within "
            f"{remaining_days} day(s)."
        )

    elif remaining_days <= 5:
        consumption_priority = "High"
        consumption_recommendations.append(
            f"Plan consumption within {remaining_days} days."
        )

    else:
        consumption_priority = "Normal"
        consumption_recommendations.append(
            f"Consume before the predicted expiry date: "
            f"{predicted_expiry_date}."
        )

    # --------------------------------
    # 3. Waste reduction
    # --------------------------------
    if is_spoiled:
        waste_reduction_recommendations.append(
            "Separate spoiled stock immediately to prevent cross-contamination "
            "and review storage or purchasing patterns to reduce future waste."
        )

    elif remaining_days <= 2:
        waste_reduction_recommendations.append(
            "Prioritize this item for immediate consumption "
            "to reduce avoidable food waste."
        )

    elif remaining_days <= 5:
        waste_reduction_recommendations.append(
            "Move this item ahead of longer-lasting stock."
        )

    else:
        waste_reduction_recommendations.append(
            "Continue monitoring freshness and shelf life."
        )

    # --------------------------------
    # 4. Quality improvement
    # --------------------------------
    poor_conditions = 0

    if temperature_status != "Optimal":
        poor_conditions += 1

    if humidity_status != "Optimal":
        poor_conditions += 1

    if air_status != "Suitable":
        poor_conditions += 1

    if light_status != "Suitable":
        poor_conditions += 1

    if poor_conditions == 0:
        quality_improvement_recommendations.append(
            "Maintain the current storage environment."
        )
    else:
        quality_improvement_recommendations.append(
            f"Correct {poor_conditions} unsuitable storage "
            "condition(s) to help preserve product quality."
        )

    # --------------------------------
    # 5. Overall action
    # --------------------------------
    if is_spoiled:
        overall_action = "Do not consume - remove from usable inventory"

    elif spoilage_probability >= 75:
        overall_action = "Immediate inspection required"

    elif spoilage_probability >= 50:
        overall_action = "Prioritize for consumption"

    elif spoilage_probability >= 25:
        overall_action = "Monitor closely"

    else:
        overall_action = "Continue normal storage"

    return {
        "food_type": food_type.title(),

        "consumption_priority": consumption_priority,

        "overall_action": overall_action,

        "storage_recommendations":
            storage_recommendations,

        "consumption_recommendations":
            consumption_recommendations,

        "waste_reduction_recommendations":
            waste_reduction_recommendations,

        "quality_improvement_recommendations":
            quality_improvement_recommendations,
    }