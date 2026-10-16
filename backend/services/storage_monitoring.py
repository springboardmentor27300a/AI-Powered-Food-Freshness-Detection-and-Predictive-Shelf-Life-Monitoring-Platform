# Food-specific recommended storage conditions
STORAGE_REQUIREMENTS = {
    "apple": {
        "temp_min": 1,
        "temp_max": 4,
        "humidity_min": 80,
        "humidity_max": 95,
        "air_circulation": ["moderate", "high"],
        "light_exposure": ["low"],
    },

    "banana": {
        "temp_min": 12,
        "temp_max": 14,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    },

    "mango": {
        "temp_min": 10,
        "temp_max": 13,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    },

    "strawberry": {
        "temp_min": 0,
        "temp_max": 4,
        "humidity_min": 90,
        "humidity_max": 95,
        "air_circulation": ["moderate", "high"],
        "light_exposure": ["low"],
    },

    "tomato": {
        "temp_min": 10,
        "temp_max": 15,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low", "moderate"],
    },

    "potato": {
        "temp_min": 7,
        "temp_max": 10,
        "humidity_min": 85,
        "humidity_max": 95,
        "air_circulation": ["moderate", "high"],
        "light_exposure": ["low"],
    },

    "carrot": {
        "temp_min": 0,
        "temp_max": 4,
        "humidity_min": 90,
        "humidity_max": 95,
        "air_circulation": ["moderate"],
        "light_exposure": ["low"],
    },
}


def analyze_storage_conditions(
    food_type: str,
    temperature: float,
    humidity: float,
    air_circulation: str,
    light_exposure: str,
):
    food_type = food_type.lower().strip()
    air_circulation = air_circulation.lower().strip()
    light_exposure = light_exposure.lower().strip()

    # General fallback for foods not yet stored in our requirements
    requirements = STORAGE_REQUIREMENTS.get(
        food_type,
        {
            "temp_min": 2,
            "temp_max": 8,
            "humidity_min": 70,
            "humidity_max": 90,
            "air_circulation": ["moderate"],
            "light_exposure": ["low", "moderate"],
        },
    )

    recommendations = []
    compliant_conditions = 0
    total_conditions = 4

    # ---------------------------------
    # Temperature validation
    # ---------------------------------
    if requirements["temp_min"] <= temperature <= requirements["temp_max"]:
        temperature_status = "Optimal"
        compliant_conditions += 1

    elif temperature > requirements["temp_max"]:
        temperature_status = "Too High"

        recommendations.append(
            f"Reduce temperature to "
            f"{requirements['temp_min']}–{requirements['temp_max']}°C."
        )

    else:
        temperature_status = "Too Low"

        recommendations.append(
            f"Increase temperature to "
            f"{requirements['temp_min']}–{requirements['temp_max']}°C."
        )

    # ---------------------------------
    # Humidity validation
    # ---------------------------------
    if requirements["humidity_min"] <= humidity <= requirements["humidity_max"]:
        humidity_status = "Optimal"
        compliant_conditions += 1

    elif humidity > requirements["humidity_max"]:
        humidity_status = "Too High"

        recommendations.append(
            f"Reduce humidity to "
            f"{requirements['humidity_min']}–"
            f"{requirements['humidity_max']}%."
        )

    else:
        humidity_status = "Too Low"

        recommendations.append(
            f"Increase humidity to "
            f"{requirements['humidity_min']}–"
            f"{requirements['humidity_max']}%."
        )

    # ---------------------------------
    # Air circulation validation
    # ---------------------------------
    if air_circulation in requirements["air_circulation"]:
        air_status = "Suitable"
        compliant_conditions += 1

    else:
        air_status = "Unsuitable"

        recommended_air = ", ".join(requirements["air_circulation"])

        recommendations.append(
            f"Maintain {recommended_air} air circulation."
        )

    # ---------------------------------
    # Light exposure validation
    # ---------------------------------
    if light_exposure in requirements["light_exposure"]:
        light_status = "Suitable"
        compliant_conditions += 1

    else:
        light_status = "Unsuitable"

        recommended_light = ", ".join(requirements["light_exposure"])

        recommendations.append(
            f"Maintain {recommended_light} light exposure."
        )

    # ---------------------------------
    # Overall compliance
    # ---------------------------------
    compliance_score = round(
        (compliant_conditions / total_conditions) * 100
    )

    if compliance_score == 100:
        overall_status = "Optimal Storage"

    elif compliance_score >= 75:
        overall_status = "Good Storage"

    elif compliance_score >= 50:
        overall_status = "Needs Improvement"

    else:
        overall_status = "Poor Storage"

    if not recommendations:
        recommendations.append(
            "Current storage conditions are suitable for this food item."
        )

    return {
        "food_type": food_type.title(),

        "temperature": {
            "current": temperature,
            "recommended":
                f"{requirements['temp_min']} - "
                f"{requirements['temp_max']} °C",
            "status": temperature_status,
        },

        "humidity": {
            "current": humidity,
            "recommended":
                f"{requirements['humidity_min']} - "
                f"{requirements['humidity_max']}%",
            "status": humidity_status,
        },

        "air_circulation": {
            "current": air_circulation.title(),
            "recommended": requirements["air_circulation"],
            "status": air_status,
        },

        "light_exposure": {
            "current": light_exposure.title(),
            "recommended": requirements["light_exposure"],
            "status": light_status,
        },

        "storage_compliance_score": compliance_score,
        "overall_storage_status": overall_status,

        "recommendations": recommendations,
    }