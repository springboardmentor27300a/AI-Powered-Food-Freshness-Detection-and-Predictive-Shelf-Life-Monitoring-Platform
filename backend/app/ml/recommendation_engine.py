from typing import Dict, Any, List, Optional


class FoodRecommendationEngine:
    """
    Intelligent Recommendation Engine.
    Generates actionable storage optimizations, consumption priorities,
    FEFO (First Expired First Out) rotation alerts, and waste reduction strategies.
    """

    CATEGORY_THRESHOLDS = {
        "Fruits": {"temp_min": 1.0, "temp_max": 6.0, "hum_min": 85.0, "hum_max": 95.0, "default_price_per_unit": 4.50},
        "Vegetables": {"temp_min": 1.0, "temp_max": 5.0, "hum_min": 85.0, "hum_max": 95.0, "default_price_per_unit": 3.80},
        "Dairy": {"temp_min": 1.0, "temp_max": 4.0, "hum_min": 50.0, "hum_max": 75.0, "default_price_per_unit": 5.20},
        "Meat": {"temp_min": -2.0, "temp_max": 2.0, "hum_min": 60.0, "hum_max": 75.0, "default_price_per_unit": 12.00},
        "Fish": {"temp_min": -1.0, "temp_max": 2.0, "hum_min": 70.0, "hum_max": 85.0, "default_price_per_unit": 16.50},
        "Bakery": {"temp_min": 18.0, "temp_max": 24.0, "hum_min": 40.0, "hum_max": 60.0, "default_price_per_unit": 4.00},
        "Grains": {"temp_min": 15.0, "temp_max": 22.0, "hum_min": 35.0, "hum_max": 55.0, "default_price_per_unit": 2.50},
        "Packaged Food": {"temp_min": 15.0, "temp_max": 24.0, "hum_min": 30.0, "hum_max": 65.0, "default_price_per_unit": 6.00},
        "Other": {"temp_min": 2.0, "temp_max": 8.0, "hum_min": 40.0, "hum_max": 75.0, "default_price_per_unit": 5.00},
    }

    def generate_recommendations(
        self,
        category: str,
        freshness_status: str,
        freshness_score: float,
        days_remaining: float,
        temperature: Optional[float] = None,
        humidity: Optional[float] = None,
        packaging_type: str = "Standard Pack",
        quantity: float = 1.0,
        unit: str = "kg"
    ) -> Dict[str, Any]:
        """
        Synthesizes physical conditions and predictive analytics to generate prescriptive interventions.
        """
        thresholds = self.CATEGORY_THRESHOLDS.get(category, self.CATEGORY_THRESHOLDS["Other"])
        ideal_temp_min = thresholds["temp_min"]
        ideal_temp_max = thresholds["temp_max"]
        ideal_hum_min = thresholds["hum_min"]
        ideal_hum_max = thresholds["hum_max"]

        storage_recs = []
        consumption_recs = []
        rotation_recs = []
        waste_recs = []
        quality_recs = []

        # 1. Temperature Analysis & Recommendations
        if temperature is not None:
            if temperature > ideal_temp_max:
                diff = round(temperature - ideal_temp_max, 1)
                storage_recs.append(
                    f"Chamber temperature ({temperature}°C) is {diff}°C above optimal threshold ({ideal_temp_max}°C). "
                    f"Lower refrigeration setpoint immediately to suppress enzymatic decay and bacterial growth."
                )
            elif temperature < ideal_temp_min:
                diff = round(ideal_temp_min - temperature, 1)
                storage_recs.append(
                    f"Storage temperature ({temperature}°C) is {diff}°C below minimum threshold ({ideal_temp_min}°C). "
                    f"Risk of chilling injury or cold burn. Modulate thermostat slightly upward."
                )
            else:
                storage_recs.append(
                    f"Storage temperature ({temperature}°C) is within ideal preservation range ({ideal_temp_min}°C to {ideal_temp_max}°C)."
                )
        else:
            storage_recs.append(
                f"Recommended storage temperature for {category}: maintain between {ideal_temp_min}°C and {ideal_temp_max}°C."
            )

        # Humidity Analysis
        if humidity is not None:
            if humidity < ideal_hum_min:
                storage_recs.append(
                    f"Relative humidity ({humidity}%) is below optimal ({ideal_hum_min}%). "
                    f"Moisture loss risk: Use perforated wrapping or misting to prevent dehydration."
                )
            elif humidity > ideal_hum_max:
                storage_recs.append(
                    f"Relative humidity ({humidity}%) is excessively elevated. "
                    f"Surface condensation increases fungal spore risk. Enhance chamber ventilation."
                )
            else:
                storage_recs.append(
                    f"Relative humidity ({humidity}%) is optimal ({ideal_hum_min}% to {ideal_hum_max}%)."
                )

        # 2. Consumption Priority Recommendations
        if days_remaining <= 0 or freshness_status == "Spoiled":
            consumption_recs.append("Product has surpassed safe consumption window. Do not consume. Quarantine or divert to compost.")
        elif days_remaining <= 2 or freshness_status == "Expiring Soon":
            hours = max(1, int(days_remaining * 24))
            consumption_recs.append(f"Immediate consumption required within next {hours} hours.")
            consumption_recs.append("Alternatively, cook, freeze, or blanch immediately to extend usable life by up to 3 months.")
        elif days_remaining <= 5:
            consumption_recs.append("Optimal culinary usage window: next 3 to 4 days for peak nutritional content and texture.")
        else:
            consumption_recs.append(f"Stable product lifecycle. Scheduled for normal consumption over the next {int(days_remaining)} days.")

        # 3. FEFO Inventory Rotation & Retail Clearance
        discount_percentage = 0
        if days_remaining <= 0 or freshness_status == "Spoiled":
            rotation_priority = "QUARANTINE"
            rotation_recs.append("Quarantine item from display shelves immediately.")
        elif days_remaining <= 1.5:
            discount_percentage = 50
            rotation_priority = "CRITICAL (FEFO Rank 1)"
            rotation_recs.append(f"Apply 50% quick-sale promotional clearance on {quantity} {unit} today.")
            rotation_recs.append("Relocate stock to front-of-shelf clearance displays.")
        elif days_remaining <= 3.5:
            discount_percentage = 25
            rotation_priority = "HIGH (FEFO Rank 2)"
            rotation_recs.append("Apply 25% promotional discount to accelerate inventory turnover.")
        else:
            rotation_priority = "NORMAL"
            rotation_recs.append("Maintain standard rotation. Position new inbound shipments behind this batch.")

        # 4. Waste Avoidance Interventions & Financial Valuation
        unit_price = thresholds["default_price_per_unit"]
        batch_value = round(quantity * unit_price, 2)

        if days_remaining <= 2 and days_remaining > 0:
            waste_recs.append(f"Secondary processing opportunity: Convert {quantity} {unit} into purees, sauces, or bakery fillings.")
            waste_recs.append(f"Community Food Rescue: Dispatch to local food bank or pantry within 24 hours to recover approximately ${batch_value} in food value.")
        elif days_remaining <= 0:
            waste_recs.append("Organic compost diversion: Route to municipal composting facility to prevent landfill greenhouse emissions.")
        else:
            waste_recs.append(f"Batch health is excellent. On schedule for zero-waste full utilization (Economic value: ${batch_value}).")

        # 5. Packaging Upgrades
        if packaging_type in ["Open Air", "Ventilated Crate", "Standard Pack"]:
            quality_recs.append("Upgrading to Modified Atmosphere Packaging (MAP) or vacuum sealing can extend shelf life by 40% to 60%.")
        else:
            quality_recs.append(f"Packaging ({packaging_type}) provides good barrier protection against oxygen and moisture transmission.")

        return {
            "storage_recommendations": storage_recs,
            "consumption_recommendations": consumption_recs,
            "rotation_recommendations": rotation_recs,
            "waste_reduction_recommendations": waste_recs,
            "quality_improvement_recommendations": quality_recs,
            "fefo_priority": rotation_priority,
            "recommended_markdown_discount_pct": discount_percentage,
            "estimated_batch_value_usd": batch_value,
        }


recommendation_engine = FoodRecommendationEngine()
