from datetime import date


def generate_rotation_plan(batches):
    """
    Creates a FEFO (First Expired, First Out) inventory rotation plan.
    Batches with the earliest predicted expiry are prioritized first.
    """

    today = date.today()
    rotation_data = []

    for batch in batches:

        # Prefer AI/system predicted expiry.
        # If unavailable, use the original expiry date.
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

        rotation_data.append({
            "batch_id": batch.id,
            "food_item_id": batch.food_item_id,
            "quantity": batch.quantity,
            "original_expiry_date": batch.expiry_date,
            "predicted_expiry_date":
                batch.predicted_expiry_date,
            "effective_expiry_date":
                effective_expiry,
            "days_until_expiry":
                days_until_expiry,
            "spoilage_risk":
                batch.spoilage_risk or "Not Assessed",
            "availability":
                batch.availability,
        })

    # FEFO:
    # earliest effective expiry receives highest priority
    rotation_data.sort(
        key=lambda item: item["effective_expiry_date"]
    )

    for index, item in enumerate(rotation_data, start=1):

        item["rotation_priority"] = index

        if item["days_until_expiry"] < 0:
            item["rotation_action"] = (
                "Expired - remove from usable inventory"
            )

        elif item["days_until_expiry"] == 0:
            item["rotation_action"] = (
                "Expires today - immediate action required"
            )

        elif item["days_until_expiry"] <= 2:
            item["rotation_action"] = (
                "Consume or sell immediately"
            )

        elif item["days_until_expiry"] <= 5:
            item["rotation_action"] = (
                "Prioritize for consumption or sale"
            )

        else:
            item["rotation_action"] = (
                "Continue normal storage"
            )

    return rotation_data