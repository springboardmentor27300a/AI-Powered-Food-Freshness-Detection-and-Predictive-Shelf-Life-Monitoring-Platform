def generate_recommendations(analysis, food_item):
    """
    Generate recommendations for a food item based on its freshness analysis.
    """
    recs = {
        "storage": [],
        "consumption": [],
        "inventory": [],
        "waste_reduction": [],
        "quality": []
    }

    # 1. Storage Recommendations
    if analysis.storage_score and analysis.storage_score < 80.0:
        recs["storage"].append("Temperature deviates from optimal. Adjust storage temperature to preserve freshness.")
    else:
        recs["storage"].append("Storage temperature is within optimal bounds.")

    if food_item.category in ["Meat & Poultry", "Seafood", "Dairy Products"]:
        recs["storage"].append(f"Ensure {food_item.category} is kept in the coldest part of the refrigerator or frozen if not used soon.")

    # 2. Consumption Recommendations
    if analysis.category == "Spoiled":
        recs["consumption"].append("DO NOT CONSUME. Item is spoiled and poses health risks.")
    elif analysis.category == "Near Spoilage":
        recs["consumption"].append("Consume immediately or cook thoroughly today.")
    elif analysis.category == "Acceptable":
        recs["consumption"].append("Consume within the next few days for best quality.")
    else:
        recs["consumption"].append(f"Item is {analysis.category}. It can be safely consumed or stored for later.")

    # 3. Inventory Rotation Suggestions
    recs["inventory"].append("Practice FIFO (First-In, First-Out): Use older batches before newer ones.")
    if analysis.shelflife_days and analysis.shelflife_days <= 3.0:
        recs["inventory"].append("High priority for use. Move to the front of your storage to ensure it's used first.")

    # 4. Waste Reduction Recommendations
    if analysis.category in ["Near Spoilage", "Acceptable"] and analysis.shelflife_days and analysis.shelflife_days <= 3.0:
        if food_item.category in ["Fruits", "Vegetables"]:
            recs["waste_reduction"].append("Consider freezing, pickling, or making a smoothie/soup to extend life.")
        elif food_item.category in ["Meat & Poultry", "Bakery Products"]:
            recs["waste_reduction"].append("Consider freezing immediately to prevent spoilage.")
    else:
        recs["waste_reduction"].append("Monitor regularly to prevent premature spoilage.")

    # 5. Quality Improvement Suggestions
    if analysis.color_score and analysis.color_score < 70.0:
        recs["quality"].append("Significant color degradation detected. Ensure item is not exposed to excessive light or air.")
    if analysis.mold_score and analysis.mold_score < 85.0:
        recs["quality"].append("Possible mold detected. Inspect closely and discard if mold is confirmed to prevent spreading.")
    if analysis.bruising_score and analysis.bruising_score < 85.0:
        recs["quality"].append("Bruising detected. Handle gently and consume bruised portions first.")

    return recs
