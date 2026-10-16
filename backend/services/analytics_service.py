from datetime import date


# ==================================================
# FRESHNESS CLASSIFICATION
# Uses the same thresholds as image_analysis.py
# ==================================================

def classify_score(score):

    if score >= 80:
        return "Fresh"

    elif score >= 65:
        return "Good"

    elif score >= 50:
        return "Acceptable"

    elif score >= 40:
        return "Near Spoilage"

    else:
        return "Spoiled"


# ==================================================
# GENERATE INVENTORY ANALYTICS
# ==================================================

def generate_inventory_analytics(batches):

    today = date.today()

    total_batches = len(batches)

    freshness_distribution = {
        "Fresh": 0,
        "Good": 0,
        "Acceptable": 0,
        "Near Spoilage": 0,
        "Spoiled": 0,
        "Not Assessed": 0
    }

    expiry_distribution = {
        "Safe": 0,
        "Expiring Soon": 0,
        "Expired": 0
    }

    risk_distribution = {
        "Low": 0,
        "Medium": 0,
        "High": 0,
        "Very High": 0,
        "Not Assessed": 0
    }

    assessed_scores = []

    attention_batches = []

    total_quantity = 0

    # --------------------------------------------------
    # Analyze every batch
    # --------------------------------------------------

    for batch in batches:

        total_quantity += batch.quantity

        # ----------------------------------------------
        # Freshness distribution
        # ----------------------------------------------

        if batch.freshness_score is None:

            freshness_category = "Not Assessed"

        else:

            freshness_category = classify_score(
                batch.freshness_score
            )

            assessed_scores.append(
                batch.freshness_score
            )

        freshness_distribution[
            freshness_category
        ] += 1

        # ----------------------------------------------
        # Effective expiry
        # ----------------------------------------------

        effective_expiry = (
            min(
                batch.expiry_date,
                batch.predicted_expiry_date
            )
            if batch.predicted_expiry_date
            else batch.expiry_date
        )

        days_until_expiry = (
            effective_expiry - today
        ).days

        if days_until_expiry < 0:

            expiry_category = "Expired"

        elif days_until_expiry <= 7:

            expiry_category = "Expiring Soon"

        else:

            expiry_category = "Safe"

        expiry_distribution[
            expiry_category
        ] += 1

        # ----------------------------------------------
        # Spoilage risk distribution
        # ----------------------------------------------

        risk = (
            batch.spoilage_risk
            if batch.spoilage_risk
            else "Not Assessed"
        )

        if risk not in risk_distribution:
            risk = "Not Assessed"

        risk_distribution[risk] += 1

        # ----------------------------------------------
        # Batches requiring attention
        # ----------------------------------------------

        requires_attention = (
            expiry_category == "Expired"
            or expiry_category == "Expiring Soon"
            or freshness_category == "Near Spoilage"
            or freshness_category == "Spoiled"
            or risk == "High"
            or risk == "Very High"
        )

        if requires_attention:

            attention_batches.append({
                "batch_id":
                    batch.id,

                "food_item_id":
                    batch.food_item_id,

                "quantity":
                    batch.quantity,

                "freshness_score":
                    batch.freshness_score,

                "freshness_category":
                    freshness_category,

                "effective_expiry_date":
                    str(effective_expiry),

                "days_until_expiry":
                    days_until_expiry,

                "spoilage_probability":
                    batch.spoilage_probability,

                "spoilage_risk":
                    risk
            })

    # --------------------------------------------------
    # Average freshness score
    # --------------------------------------------------

    if assessed_scores:

        average_freshness = round(
            sum(assessed_scores)
            / len(assessed_scores),
            2
        )

    else:

        average_freshness = None

    # --------------------------------------------------
    # Sort urgent batches first
    # --------------------------------------------------

    attention_batches.sort(
        key=lambda item:
            item["days_until_expiry"]
    )

    # --------------------------------------------------
    # Final analytics response
    # --------------------------------------------------

    return {

        "summary": {
            "total_batches":
                total_batches,

            "total_quantity":
                total_quantity,

            "assessed_batches":
                len(assessed_scores),

            "average_freshness_score":
                average_freshness,

            "batches_requiring_attention":
                len(attention_batches)
        },

        "freshness_distribution":
            freshness_distribution,

        "expiry_distribution":
            expiry_distribution,

        "spoilage_risk_distribution":
            risk_distribution,

        "attention_batches":
            attention_batches
    }