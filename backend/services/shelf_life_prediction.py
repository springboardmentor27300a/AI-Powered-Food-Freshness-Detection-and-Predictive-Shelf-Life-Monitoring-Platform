from datetime import datetime, timedelta


# =========================================================
# FOOD-SPECIFIC STORAGE REQUIREMENTS
# =========================================================

FOOD_STORAGE_DATA = {
    "apple": {
        "base_shelf_life": 21,
        "temp_min": 1,
        "temp_max": 4,
        "humidity_min": 80,
        "humidity_max": 95,
        "air_circulation": ["moderate", "high"],
        "light_exposure": ["low"],
    },

    "banana": {
        "base_shelf_life": 7,
        "temp_min": 12,
        "temp_max": 14,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    },

    "mango": {
        "base_shelf_life": 8,
        "temp_min": 10,
        "temp_max": 13,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    },

    "strawberry": {
        "base_shelf_life": 7,
        "temp_min": 0,
        "temp_max": 4,
        "humidity_min": 90,
        "humidity_max": 95,
        "air_circulation": ["moderate", "high"],
        "light_exposure": ["low"],
    },

    "tomato": {
        "base_shelf_life": 10,
        "temp_min": 10,
        "temp_max": 15,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    },

    "potato": {
        "base_shelf_life": 30,
        "temp_min": 7,
        "temp_max": 10,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate", "high"],
        "light_exposure": ["low"],
    },

    "carrot": {
        "base_shelf_life": 21,
        "temp_min": 0,
        "temp_max": 4,
        "humidity_min": 90,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low"],
    },
}


# =========================================================
# PROTOTYPE PACKAGING FACTORS
# =========================================================
#
# These are configurable heuristic factors for this prototype.
# They should NOT be described as experimentally validated
# universal food-science constants.
#
# Vacuum:
#   Reduced exposure to surrounding air.
#
# Sealed:
#   Moderate protection from the environment.
#
# Ventilated:
#   Greater exposure to surrounding air.
#
# The factor is applied to the shelf-life estimate.

PACKAGING_FACTORS = {
    "vacuum": 1.15,
    "sealed": 1.05,
    "ventilated": 0.95,
}


# =========================================================
# DEVIATION FACTOR
# =========================================================

def calculate_deviation_factor(
    value,
    minimum,
    maximum,
    penalty_per_unit
):
    """
    Returns 1.0 when the value is within the recommended range.

    The factor decreases progressively as the value moves away
    from the recommended range.
    """

    if minimum <= value <= maximum:
        return 1.0

    if value < minimum:
        deviation = minimum - value
    else:
        deviation = value - maximum

    factor = 1 - (deviation * penalty_per_unit)

    # Prevent one environmental factor from reducing
    # shelf life unrealistically to zero.
    return max(0.35, factor)


# =========================================================
# SHELF-LIFE PREDICTION
# =========================================================

def predict_shelf_life(
    food_type: str,
    freshness_score: float,
    temperature: float,
    humidity: float,
    storage_duration: int = 0,
    packaging_type: str = "sealed",
    air_circulation: str = "moderate",
    light_exposure: str = "low",
):
    # -----------------------------------------------------
    # Normalize inputs
    # -----------------------------------------------------

    food_type = food_type.lower().strip()
    packaging_type = packaging_type.lower().strip()
    air_circulation = air_circulation.lower().strip()
    light_exposure = light_exposure.lower().strip()

    # Safety fallback
    if packaging_type not in PACKAGING_FACTORS:
        packaging_type = "sealed"

    # -----------------------------------------------------
    # Food-specific requirements
    # -----------------------------------------------------

    data = FOOD_STORAGE_DATA.get(
        food_type,
        {
            "base_shelf_life": 7,
            "temp_min": 2,
            "temp_max": 8,
            "humidity_min": 70,
            "humidity_max": 90,
            "air_circulation": ["moderate"],
            "light_exposure": ["low", "moderate"],
        },
    )

    # -----------------------------------------------------
    # 1. Visual freshness impact
    # -----------------------------------------------------

    freshness_factor = max(
        0,
        min(freshness_score / 100, 1)
    )

    estimated_days = (
        data["base_shelf_life"] * freshness_factor
    )

    # -----------------------------------------------------
    # 2. Temperature impact
    # -----------------------------------------------------

    temperature_factor = calculate_deviation_factor(
        temperature,
        data["temp_min"],
        data["temp_max"],
        0.05,
    )

    if data["temp_min"] <= temperature <= data["temp_max"]:
        temperature_status = "Optimal"

    elif temperature > data["temp_max"]:
        temperature_status = "Too High"

    else:
        temperature_status = "Too Low"

    # -----------------------------------------------------
    # 3. Humidity impact
    # -----------------------------------------------------

    humidity_factor = calculate_deviation_factor(
        humidity,
        data["humidity_min"],
        data["humidity_max"],
        0.015,
    )

    if data["humidity_min"] <= humidity <= data["humidity_max"]:
        humidity_status = "Optimal"

    elif humidity > data["humidity_max"]:
        humidity_status = "Too High"

    else:
        humidity_status = "Too Low"

    # -----------------------------------------------------
    # 4. Air circulation impact
    # -----------------------------------------------------

    if air_circulation in data["air_circulation"]:
        air_status = "Suitable"
        air_factor = 1.0

    else:
        air_status = "Unsuitable"
        air_factor = 0.90

    # -----------------------------------------------------
    # 5. Light exposure impact
    # -----------------------------------------------------

    if light_exposure in data["light_exposure"]:
        light_status = "Suitable"
        light_factor = 1.0

    else:
        light_status = "Unsuitable"
        light_factor = 0.90

    # -----------------------------------------------------
    # 6. Packaging impact
    # -----------------------------------------------------

    packaging_factor = PACKAGING_FACTORS[packaging_type]

    if packaging_type == "vacuum":
        packaging_status = "Enhanced Protection"

    elif packaging_type == "sealed":
        packaging_status = "Protected"

    else:
        packaging_status = "Ventilated Storage"

    # -----------------------------------------------------
    # 7. Combined shelf-life estimate
    # -----------------------------------------------------

    estimated_days *= temperature_factor
    estimated_days *= humidity_factor
    estimated_days *= air_factor
    estimated_days *= light_factor
    estimated_days *= packaging_factor

    # Remove time already spent in storage.
    estimated_days -= storage_duration

    remaining_days = max(
        0,
        round(estimated_days)
    )

    # -----------------------------------------------------
    # 8. Expiry forecasting
    # -----------------------------------------------------

    predicted_expiry = (
        datetime.now() +
        timedelta(days=remaining_days)
    )

    # -----------------------------------------------------
    # 9. Spoilage probability
    # -----------------------------------------------------

    spoilage_probability = max(
        0,
        min(100, 100 - freshness_score)
    )

    # Environmental penalties
    if temperature_status != "Optimal":
        spoilage_probability += 8

    if humidity_status != "Optimal":
        spoilage_probability += 5

    if air_status != "Suitable":
        spoilage_probability += 4

    if light_status != "Suitable":
        spoilage_probability += 4

    # Packaging contribution to estimated spoilage risk.
    # These are also prototype heuristic adjustments.
    if packaging_type == "vacuum":
        spoilage_probability -= 4

    elif packaging_type == "sealed":
        spoilage_probability -= 2

    elif packaging_type == "ventilated":
        spoilage_probability += 2

    spoilage_probability = round(
        max(
            0,
            min(100, spoilage_probability)
        ),
        2
    )

    # -----------------------------------------------------
    # 10. Risk classification
    # -----------------------------------------------------

    if spoilage_probability >= 75:
        risk_level = "Very High"

    elif spoilage_probability >= 50:
        risk_level = "High"

    elif spoilage_probability >= 25:
        risk_level = "Medium"

    else:
        risk_level = "Low"

    # -----------------------------------------------------
    # 11. Recommendations
    # -----------------------------------------------------

    recommendations = []

    if temperature_status != "Optimal":
        recommendations.append(
            f"Maintain temperature between "
            f"{data['temp_min']}°C and "
            f"{data['temp_max']}°C."
        )

    if humidity_status != "Optimal":
        recommendations.append(
            f"Maintain humidity between "
            f"{data['humidity_min']}% and "
            f"{data['humidity_max']}%."
        )

    if air_status != "Suitable":
        recommendations.append(
            "Improve air circulation according to the "
            "recommended storage conditions."
        )

    if light_status != "Suitable":
        recommendations.append(
            "Reduce light exposure and store the food "
            "away from direct light."
        )

    if packaging_type == "ventilated":
        recommendations.append(
            "Ventilated packaging provides greater "
            "environmental exposure in this prototype. "
            "Consider sealed or vacuum packaging when "
            "appropriate for the product."
        )

    if remaining_days == 0:
        recommendations.append(
            "The product has reached its estimated "
            "shelf-life limit."
        )

    elif remaining_days <= 2:
        recommendations.append(
            "Consume as soon as possible."
        )

    else:
        recommendations.append(
            f"Recommended to consume within approximately "
            f"{remaining_days} days."
        )

    # -----------------------------------------------------
    # 12. Return complete prediction
    # -----------------------------------------------------

    return {
        "food_type": food_type.title(),

        "freshness_score": round(
            freshness_score,
            2
        ),

        "remaining_shelf_life_days":
            remaining_days,

        "predicted_expiry_date":
            predicted_expiry.strftime(
                "%d %B %Y"
            ),

        "spoilage_probability":
            spoilage_probability,

        "spoilage_risk":
            risk_level,

        "storage_impact": {
            "temperature_status":
                temperature_status,

            "temperature_factor":
                round(temperature_factor, 2),

            "humidity_status":
                humidity_status,

            "humidity_factor":
                round(humidity_factor, 2),

            "air_circulation_status":
                air_status,

            "air_circulation_factor":
                round(air_factor, 2),

            "light_exposure_status":
                light_status,

            "light_exposure_factor":
                round(light_factor, 2),

            "packaging_status":
                packaging_status,

            "packaging_factor":
                round(packaging_factor, 2),
        },

        "recommended_conditions": {
            "temperature":
                f"{data['temp_min']} - "
                f"{data['temp_max']} °C",

            "humidity":
                f"{data['humidity_min']} - "
                f"{data['humidity_max']}%",

            "air_circulation":
                data["air_circulation"],

            "light_exposure":
                data["light_exposure"],
        },

        "packaging": {
            "type": packaging_type.title(),
            "factor": round(
                packaging_factor,
                2
            ),
            "status": packaging_status,
            "model_note": (
                "Packaging influence uses a configurable "
                "prototype heuristic factor."
            ),
        },

        "storage_duration_days":
            storage_duration,

        "recommendations":
            recommendations,
    }