"""
Freshness Scoring Engine implementing the authoritative Weighted Scoring Model
specified in the Food Freshness Monitoring Platform specification:
Freshness Score = Visual Condition Analysis (40%) + Storage Conditions (25%) + Shelf-Life Prediction (20%) + Product Age (15%)
Also computes discrete categories: Fresh, Good, Acceptable, Near Spoilage, Spoiled.
"""

import math
from datetime import date, datetime
from typing import Dict, Any, Optional, Union


class FreshnessScoringEngine:
    """
    Evaluates multi-modal freshness indicators to produce the composite Freshness Score,
    confidence score, component sub-scores, and overall food health score.
    """

    # Category ideal baseline storage parameters
    IDEAL_STORAGE = {
        "Fruits": {"temp": 4.0, "temp_tol": 3.0, "humidity": 90.0, "hum_tol": 10.0, "nominal_days": 14},
        "Vegetables": {"temp": 4.0, "temp_tol": 2.5, "humidity": 90.0, "hum_tol": 10.0, "nominal_days": 10},
        "Dairy": {"temp": 3.0, "temp_tol": 2.0, "humidity": 65.0, "hum_tol": 15.0, "nominal_days": 12},
        "Dairy Products": {"temp": 3.0, "temp_tol": 2.0, "humidity": 65.0, "hum_tol": 15.0, "nominal_days": 12},
        "Meat": {"temp": 1.0, "temp_tol": 2.0, "humidity": 70.0, "hum_tol": 15.0, "nominal_days": 7},
        "Meat & Poultry": {"temp": 1.0, "temp_tol": 2.0, "humidity": 70.0, "hum_tol": 15.0, "nominal_days": 7},
        "Fish": {"temp": 0.5, "temp_tol": 1.5, "humidity": 80.0, "hum_tol": 15.0, "nominal_days": 4},
        "Seafood": {"temp": 0.5, "temp_tol": 1.5, "humidity": 80.0, "hum_tol": 15.0, "nominal_days": 4},
        "Bakery": {"temp": 20.0, "temp_tol": 4.0, "humidity": 50.0, "hum_tol": 15.0, "nominal_days": 5},
        "Bakery Products": {"temp": 20.0, "temp_tol": 4.0, "humidity": 50.0, "hum_tol": 15.0, "nominal_days": 5},
        "Packaged Food": {"temp": 20.0, "temp_tol": 5.0, "humidity": 45.0, "hum_tol": 20.0, "nominal_days": 60},
        "Packaged Foods": {"temp": 20.0, "temp_tol": 5.0, "humidity": 45.0, "hum_tol": 20.0, "nominal_days": 60},
        "Beverages": {"temp": 5.0, "temp_tol": 4.0, "humidity": 60.0, "hum_tol": 20.0, "nominal_days": 30},
        "Grains": {"temp": 18.0, "temp_tol": 4.0, "humidity": 45.0, "hum_tol": 15.0, "nominal_days": 180},
        "Other": {"temp": 10.0, "temp_tol": 5.0, "humidity": 60.0, "hum_tol": 20.0, "nominal_days": 14},
    }

    @classmethod
    def classify_freshness_category(cls, score: float, mold_detected: bool = False) -> str:
        """
        Maps a 0-100 score to the 5 official specification Freshness Categories:
        - Fresh (>= 85.0)
        - Good (>= 70.0)
        - Acceptable (>= 55.0)
        - Near Spoilage (>= 40.0)
        - Spoiled (< 40.0 or active mold)
        """
        if mold_detected or score < 40.0:
            return "Spoiled"
        elif score < 55.0:
            return "Near Spoilage"
        elif score < 70.0:
            return "Acceptable"
        elif score < 85.0:
            return "Good"
        else:
            return "Fresh"

    @classmethod
    def calculate_weighted_freshness(
        cls,
        visual_score: float,
        category: str,
        purchase_date_val: Optional[Union[str, date]] = None,
        expiry_date_val: Optional[Union[str, date]] = None,
        storage_temperature: Optional[float] = None,
        storage_humidity: Optional[float] = None,
        air_circulation: Optional[str] = "Standard",
        light_exposure: Optional[str] = "Dark",
        predicted_remaining_days: Optional[float] = None,
        mold_detected: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes the official 4-pillar Weighted Scoring Model:
        Visual Condition Analysis (40%) + Storage Conditions (25%) + Shelf-Life Prediction (20%) + Product Age (15%)
        """
        today = date.today()
        baseline = cls.IDEAL_STORAGE.get(category, cls.IDEAL_STORAGE["Other"])

        # 1. Visual Condition Analysis (40%)
        # Clamped visual score from CV analyzer
        vis_score = max(0.0, min(100.0, float(visual_score)))

        # 2. Storage Conditions Score (25%)
        # Temperature & humidity compliance against regulatory bounds
        temp_score = 100.0
        if storage_temperature is not None:
            temp_delta = abs(storage_temperature - baseline["temp"])
            penalty = max(0.0, (temp_delta - baseline["temp_tol"]) * 12.0)
            temp_score = max(10.0, 100.0 - penalty)

        hum_score = 100.0
        if storage_humidity is not None:
            hum_delta = abs(storage_humidity - baseline["humidity"])
            penalty = max(0.0, (hum_delta - baseline["hum_tol"]) * 2.0)
            hum_score = max(15.0, 100.0 - penalty)

        # Environmental factors: air circulation and light exposure
        env_modifier = 0.0
        if air_circulation and "low" in air_circulation.lower():
            env_modifier -= 5.0
        if light_exposure and "direct" in light_exposure.lower():
            env_modifier -= 8.0

        storage_conditions_score = round(max(5.0, min(100.0, (0.60 * temp_score) + (0.40 * hum_score) + env_modifier)), 1)

        # 3. Shelf-Life Prediction Score (20%)
        nominal_days = baseline["nominal_days"]
        if expiry_date_val and purchase_date_val:
            try:
                p_dt = datetime.strptime(str(purchase_date_val)[:10], "%Y-%m-%d").date()
                e_dt = datetime.strptime(str(expiry_date_val)[:10], "%Y-%m-%d").date()
                span = (e_dt - p_dt).days
                if span > 0:
                    nominal_days = span
            except Exception:
                pass

        if predicted_remaining_days is not None:
            rem_days = max(0.0, float(predicted_remaining_days))
        else:
            rem_days = max(0.0, (nominal_days * (vis_score / 100.0)))

        shelf_ratio = min(1.0, rem_days / max(1.0, nominal_days))
        shelf_life_score = round(max(0.0, min(100.0, shelf_ratio * 100.0)), 1)

        # 4. Product Age Score (15%)
        # Higher score for younger product; decays as it approaches nominal lifespan
        elapsed_days = 0.0
        if purchase_date_val:
            try:
                p_dt = datetime.strptime(str(purchase_date_val)[:10], "%Y-%m-%d").date()
                elapsed_days = max(0.0, (today - p_dt).days)
            except Exception:
                elapsed_days = 1.0

        age_fraction = min(1.5, elapsed_days / max(1.0, nominal_days))
        product_age_score = round(max(5.0, min(100.0, 100.0 * (1.0 - (age_fraction * 0.70)))), 1)

        # 5. Composite Weighted Freshness Score (40% + 25% + 20% + 15%)
        weighted_score = (
            (0.40 * vis_score) +
            (0.25 * storage_conditions_score) +
            (0.20 * shelf_life_score) +
            (0.15 * product_age_score)
        )

        if mold_detected:
            weighted_score = min(25.0, weighted_score * 0.4)

        composite_score = round(max(0.0, min(100.0, weighted_score)), 1)

        # Freshness Category
        category_label = cls.classify_freshness_category(composite_score, mold_detected=mold_detected)

        # Overall food health score (0-100)
        overall_health_score = round(max(0.0, min(100.0, (0.75 * composite_score) + (0.25 * storage_conditions_score))), 1)

        # Confidence score (0.85 to 0.98)
        conf_base = 0.88 + (abs(composite_score - 50.0) / 50.0) * 0.10
        if storage_temperature is not None and storage_humidity is not None:
            conf_base += 0.02
        confidence_score = round(max(0.85, min(0.98, conf_base)), 2)

        return {
            "composite_freshness_score": composite_score,
            "freshness_score": composite_score,
            "freshness_category": category_label,
            "freshness_label": category_label,
            "overall_food_health_score": overall_health_score,
            "confidence_score": confidence_score,
            "sub_scores": {
                "visual_condition_score": vis_score,
                "visual_weight": 0.40,
                "storage_conditions_score": storage_conditions_score,
                "storage_weight": 0.25,
                "shelf_life_score": shelf_life_score,
                "shelf_life_weight": 0.20,
                "product_age_score": product_age_score,
                "product_age_weight": 0.15,
            },
            "spoilage_probability": round(max(0.0, min(1.0, (100.0 - composite_score) / 100.0)), 2),
            "is_safe_for_consumption": composite_score >= 40.0 and not mold_detected,
        }


freshness_scoring_engine = FreshnessScoringEngine()
