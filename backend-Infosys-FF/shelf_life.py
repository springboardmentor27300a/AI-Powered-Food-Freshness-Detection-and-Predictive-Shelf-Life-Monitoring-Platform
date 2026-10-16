from datetime import date, timedelta


# ============================================================
# SHELF-LIFE PREDICTION ENGINE
# ============================================================

def predict_shelf_life(
    category,
    freshness_score,
    storage_temperature=None,
    humidity=None,
    packaging_type=None,
    purchase_date=None,
    expiry_date=None
):
    """
    Estimate remaining shelf life using:

    - Food category
    - Freshness score
    - Storage temperature
    - Humidity
    - Packaging type
    - Purchase date
    - Existing expiry date
    """

    today = date.today()

    # ========================================================
    # NORMALIZE CATEGORY
    # ========================================================

    category_input = category.strip().lower()

    category_aliases = {
        "fruit": "Fruits",
        "fruits": "Fruits",

        "vegetable": "Vegetables",
        "vegetables": "Vegetables",

        "dairy": "Dairy Products",
        "dairy product": "Dairy Products",
        "dairy products": "Dairy Products",

        "meat": "Meat & Poultry",
        "poultry": "Meat & Poultry",
        "meat and poultry": "Meat & Poultry",
        "meat & poultry": "Meat & Poultry",
        "meat poultry": "Meat & Poultry",

        "seafood": "Seafood",
        "sea food": "Seafood",

        "bakery": "Bakery Products",
        "bakery product": "Bakery Products",
        "bakery products": "Bakery Products",

        "packaged food": "Packaged Foods",
        "packaged foods": "Packaged Foods",

        "beverage": "Beverages",
        "beverages": "Beverages"
    }

    category_key = category_aliases.get(
        category_input,
        category.strip().title()
    )

    # ========================================================
    # BASE SHELF LIFE
    # ========================================================

    base_shelf_life = {
        "Fruits": 14,
        "Vegetables": 10,
        "Dairy Products": 14,
        "Meat & Poultry": 7,
        "Seafood": 5,
        "Bakery Products": 7,
        "Packaged Foods": 30,
        "Beverages": 30
    }

    base_days = base_shelf_life.get(
        category_key,
        10
    )

    # ========================================================
    # PRODUCT AGE
    # ========================================================

    if purchase_date:

        product_age = (
            today - purchase_date
        ).days

        product_age = max(
            0,
            product_age
        )

    else:

        product_age = 0

    # ========================================================
    # FRESHNESS FACTOR
    # ========================================================

    freshness_score = max(
        0,
        min(
            100,
            float(freshness_score)
        )
    )

    if freshness_score >= 80:

        freshness_factor = 1.00

    elif freshness_score >= 60:

        freshness_factor = 0.75

    elif freshness_score >= 40:

        freshness_factor = 0.50

    elif freshness_score >= 20:

        freshness_factor = 0.25

    else:

        freshness_factor = 0.10

    # ========================================================
    # TEMPERATURE FACTOR
    # ========================================================

    temperature_factor = 1.00

    if storage_temperature is not None:

        temperature = float(
            storage_temperature
        )

        # ----------------------------------------------------
        # Meat / Seafood / Dairy
        # ----------------------------------------------------

        if category_key in [
            "Meat & Poultry",
            "Seafood",
            "Dairy Products"
        ]:

            if temperature > 10:

                temperature_factor = 0.60

            elif temperature > 8:

                temperature_factor = 0.70

            elif temperature > 5:

                temperature_factor = 0.85

            else:

                temperature_factor = 1.00

        # ----------------------------------------------------
        # Fruits / Vegetables
        # ----------------------------------------------------

        elif category_key in [
            "Fruits",
            "Vegetables"
        ]:

            if temperature > 20:

                temperature_factor = 0.65

            elif temperature > 15:

                temperature_factor = 0.80

            elif temperature > 10:

                temperature_factor = 0.90

            else:

                temperature_factor = 1.00

        # ----------------------------------------------------
        # Other products
        # ----------------------------------------------------

        else:

            if temperature > 35:

                temperature_factor = 0.70

            elif temperature > 30:

                temperature_factor = 0.85

            else:

                temperature_factor = 1.00

    # ========================================================
    # HUMIDITY FACTOR
    # ========================================================

    humidity_factor = 1.00

    if humidity is not None:

        humidity_value = float(
            humidity
        )

        if humidity_value > 90:

            humidity_factor = 0.65

        elif humidity_value > 80:

            humidity_factor = 0.75

        elif humidity_value > 70:

            humidity_factor = 0.90

        else:

            humidity_factor = 1.00

    # ========================================================
    # PACKAGING FACTOR
    # ========================================================

    packaging_factor = 1.00

    if packaging_type:

        packaging = (
            packaging_type
            .strip()
            .lower()
        )

        # ----------------------------------------------------
        # Protective packaging
        # ----------------------------------------------------

        if (
            "vacuum" in packaging
            or
            "sealed" in packaging
            or
            "airtight" in packaging
        ):

            packaging_factor = 1.15

        # ----------------------------------------------------
        # Poor packaging
        # ----------------------------------------------------

        elif (
            "open" in packaging
            or
            "loose" in packaging
            or
            "unpacked" in packaging
        ):

            packaging_factor = 0.85

        else:

            packaging_factor = 1.00

    # ========================================================
    # ESTIMATED TOTAL SHELF LIFE
    # ========================================================

    estimated_total_life = (
        base_days
        *
        freshness_factor
        *
        temperature_factor
        *
        humidity_factor
        *
        packaging_factor
    )

    estimated_total_life = max(
        1,
        round(
            estimated_total_life
        )
    )

    # ========================================================
    # REMAINING SHELF LIFE
    # ========================================================

    remaining_days = (
        estimated_total_life
        -
        product_age
    )

    remaining_days = max(
        0,
        remaining_days
    )

    # ========================================================
    # EXISTING EXPIRY DATE
    # ========================================================

    existing_expiry_days = None

    if expiry_date:

        existing_expiry_days = (
            expiry_date - today
        ).days

        existing_expiry_days = max(
            0,
            existing_expiry_days
        )

        # Never predict beyond the supplied expiry date.
        remaining_days = min(
            remaining_days,
            existing_expiry_days
        )

    # ========================================================
    # PREDICTED EXPIRY DATE
    # ========================================================

    predicted_expiry_date = (
        today
        +
        timedelta(
            days=remaining_days
        )
    )

    # ========================================================
    # RISK LEVEL
    # ========================================================

    if remaining_days <= 1:

        risk_level = "High"

    elif remaining_days <= 3:

        risk_level = "Moderate"

    elif remaining_days <= 7:

        risk_level = "Low"

    else:

        risk_level = "Very Low"

    # ========================================================
    # WARNINGS
    # ========================================================

    warnings = []

    if temperature_factor < 1.0:

        warnings.append(
            "Storage temperature may reduce shelf life."
        )

    if humidity_factor < 1.0:

        warnings.append(
            "Humidity conditions may reduce shelf life."
        )

    if packaging_factor < 1.0:

        warnings.append(
            "Packaging condition may reduce shelf life."
        )

    if freshness_score < 40:

        warnings.append(
            "Low freshness score indicates possible quality deterioration."
        )

    if existing_expiry_days is not None:

        if existing_expiry_days <= 0:

            warnings.append(
                "The provided expiry date has already passed."
            )

        elif existing_expiry_days <= 3:

            warnings.append(
                "The product is close to its recorded expiry date."
            )

    # ========================================================
    # RECOMMENDATION
    # ========================================================

    if risk_level == "High":

        recommendation = (
            "Consume or inspect the product immediately. "
            "Storage conditions should be reviewed."
        )

    elif risk_level == "Moderate":

        recommendation = (
            "Consume the product soon and maintain "
            "appropriate storage conditions."
        )

    elif risk_level == "Low":

        recommendation = (
            "The product can be stored, but continue "
            "monitoring freshness and storage conditions."
        )

    else:

        recommendation = (
            "The product has a reasonable estimated "
            "remaining shelf life under the provided conditions."
        )

    # ========================================================
    # RETURN RESULT
    # ========================================================

    return {

        "category": category_key,

        "estimated_total_shelf_life_days": (
            estimated_total_life
        ),

        "product_age_days": (
            product_age
        ),

        "remaining_shelf_life_days": (
            remaining_days
        ),

        "predicted_expiry_date": (
            predicted_expiry_date.isoformat()
        ),

        "risk_level": risk_level,

        "storage_factors": {

            "temperature_factor": round(
                temperature_factor,
                2
            ),

            "humidity_factor": round(
                humidity_factor,
                2
            ),

            "packaging_factor": round(
                packaging_factor,
                2
            )
        },

        "warnings": warnings,

        "recommendation": recommendation
    }