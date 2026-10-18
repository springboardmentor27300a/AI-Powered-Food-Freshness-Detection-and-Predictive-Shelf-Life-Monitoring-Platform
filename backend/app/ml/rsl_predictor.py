"""
rsl_predictor.py — Production ML Remaining Shelf Life (RSL) Inference Engine

Responsible for ML shelf-life inference:
  Real / Traceable Production Models:
    - Tomato (RandomForestRegressor)
    - Paneer (LinearRegression)
    - Seafood (RandomForestRegressor)

  Synthetic Demonstration / Extension Models (DATA_TYPE = SYNTHETIC):
    - Vegetables (RandomForestRegressor)
    - Meat & Poultry (RandomForestRegressor)
    - Bakery Products (RandomForestRegressor)
    - Packaged Foods (RandomForestRegressor)
    - Beverages (RandomForestRegressor)

Unsupported categories (Avocado / unmapped) or out-of-domain requests raise RSLPredictionError (HTTP 422).
"""

import json
import logging
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger("freshguard.ml.rsl_predictor")

SAVED_MODELS_DIR = Path(__file__).parent / "saved_models"
REGISTRY_PATH = SAVED_MODELS_DIR / "model_registry.json"
SYNTHETIC_REGISTRY_PATH = SAVED_MODELS_DIR / "synthetic_model_registry.json"

REAL_CATEGORIES = {"tomato", "paneer", "seafood"}
SYNTHETIC_CATEGORIES = {"vegetables", "meat_poultry", "bakery", "packaged_foods", "beverages"}
APPROVED_CATEGORIES = REAL_CATEGORIES | SYNTHETIC_CATEGORIES

class RSLPredictionError(Exception):
    """Exception raised when an unsupported category or out-of-domain input is supplied."""
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class RSLPredictor:
    def __init__(self):
        self._models: Dict[str, Any] = {}
        self._registry: Dict[str, Any] = {}
        self._model_lock = threading.Lock()
        self._load_registry_and_models()

    def _load_registry_and_models(self):
        # 1. Load Real/Traceable Production Registry & Models
        if REGISTRY_PATH.exists():
            try:
                with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                    real_registry = json.load(f)
                    for cat, info in real_registry.items():
                        info["data_type"] = "REAL/TRACEABLE"
                        self._registry[cat] = info
            except Exception as e:
                logger.error(f"Error reading model registry: {e}")

        # Keep only registry metadata in memory during startup.
        if SYNTHETIC_REGISTRY_PATH.exists():
            try:
                with open(SYNTHETIC_REGISTRY_PATH, "r", encoding="utf-8") as f:
                    synth_registry = json.load(f)
                    for cat, info in synth_registry.items():
                        self._registry[cat] = info
            except Exception as e:
                logger.error(f"Error reading synthetic model registry: {e}")

        # Pipelines are loaded on the first request for their category.

    def _load_model(self, category: str):
        """Load the requested pipeline and retain at most one model in memory."""
        with self._model_lock:
            if category in self._models:
                return self._models[category]
            info = self._registry.get(category)
            if not info or info.get("status") == "BLOCKED":
                return None
            model_file = info.get("model_file")
            if not model_file:
                return None
            model_path = SAVED_MODELS_DIR / model_file
            if not model_path.is_file():
                logger.error("Model file for '%s' is missing", category)
                return None
            try:
                import joblib

                model = joblib.load(model_path)
            except Exception:
                logger.exception("Failed to load model for '%s'", category)
                return None
            self._models.clear()
            self._models[category] = model
            logger.info("Loaded %s model for '%s'", info.get("data_type", "production"), category)
            return model

    def normalize_category(self, raw_category: str) -> str:
        """Map user-supplied food type string to an approved ML category key."""
        val = (raw_category or "").lower().strip()
        if not val:
            return "unknown"

        # Production Real Models
        if "tomato" in val:
            return "tomato"
        if "paneer" in val or "cottage cheese" in val:
            return "paneer"
        if any(s in val for s in ["fish", "seafood", "mackerel", "tilapia", "tuna", "mujair", "tongkol"]):
            return "seafood"

        # Synthetic Demonstration Categories
        if "vegetable" in val:
            return "vegetables"
        if "meat" in val or "poultry" in val or "chicken" in val or "beef" in val or "pork" in val or "turkey" in val:
            return "meat_poultry"
        if "bakery" in val or "bread" in val or "pastry" in val or "cake" in val or "muffin" in val or "croissant" in val:
            return "bakery"
        if "packaged" in val or "snack" in val or "ready meal" in val or "pasta" in val:
            return "packaged_foods"
        if "beverage" in val or "juice" in val or "tea" in val or "coffee" in val or "smoothie" in val or "kombucha" in val:
            return "beverages"
        
        return val

    def normalize_species(self, raw_species: Any) -> str:
        """Map a user-supplied seafood species string to an approved ML species key."""
        val = str(raw_species or "").lower().strip()
        if "tilapia" in val or "mujair" in val:
            return "tilapia"
        if "tuna" in val or "tongkol" in val:
            return "tuna"
        if "mackerel" in val:
            return "mackerel"
        return val

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        raw_food_type = payload.get("food_type", "")
        category = self.normalize_category(raw_food_type)

        # 1. Reject unsupported / non-approved categories (HTTP 422)
        if category not in APPROVED_CATEGORIES:
            logger.warning(f"Prediction rejected for unsupported category: '{raw_food_type}' (mapped to '{category}')")
            raise RSLPredictionError("ML shelf-life prediction is currently unsupported for this food category.")

        model_pipeline = self._load_model(category)
        if model_pipeline is None:
            logger.warning("Prediction rejected because no usable model is available for '%s'", category)
            raise RSLPredictionError("ML shelf-life prediction is currently unsupported for this food category.")

        model_info = self._registry[category]
        domain = model_info["domain"]
        data_type = model_info.get("data_type", "REAL/TRACEABLE")

        import pandas as pd

        # Extract & validate input features
        temp = float(payload.get("temperature_c", 0.0))
        humidity = float(payload.get("humidity_pct", 0.0))
        duration = float(payload.get("storage_duration_days", 0.0))
        packaging = str(payload.get("packaging_type", "")).lower().strip()

        # 2. Domain Bounds Validation (HTTP 422 if out-of-domain)
        if temp < domain["temperature_min"] or temp > domain["temperature_max"]:
            raise RSLPredictionError(
                f"Storage temperature {temp:.1f}°C is outside validated ML domain ({domain['temperature_min']}–{domain['temperature_max']}°C) for {category}."
            )

        if humidity < domain["humidity_min"] or humidity > domain["humidity_max"]:
            raise RSLPredictionError(
                f"Relative humidity {humidity:.1f}% is outside validated ML domain ({domain['humidity_min']}–{domain['humidity_max']}%) for {category}."
            )

        if duration < domain["storage_duration_min"] or duration > domain["storage_duration_max"]:
            raise RSLPredictionError(
                f"Storage duration {duration:.1f} days is outside validated ML domain ({domain['storage_duration_min']}–{domain['storage_duration_max']} days) for {category}."
            )

        # 2b. Packaging Validation (HTTP 422 — packaging is never silently substituted)
        allowed_packaging = domain.get("allowed_packaging", [])
        if packaging not in allowed_packaging:
            raise RSLPredictionError(
                f"Packaging type '{packaging or 'unspecified'}' is outside validated ML domain ({', '.join(allowed_packaging)}) for {category}."
            )

        # 3. Construct Category Feature Matrix
        if category == "tomato":
            nled = int(payload.get("nled_level", 0))
            bwc = int(payload.get("bwc_level", 0))
            pkg_type = packaging
            
            X_df = pd.DataFrame([{
                "nled_level": nled,
                "bwc_level": bwc,
                "packaging_type": pkg_type,
                "storage_temperature_c": temp,
                "humidity_pct": humidity,
                "storage_duration_days": duration
            }])

        elif category == "paneer":
            pkg_type = "sealed"
            X_df = pd.DataFrame([{
                "packaging_type": pkg_type,
                "storage_temperature_c": temp,
                "humidity_pct": humidity,
                "storage_duration_days": duration
            }])

        elif category == "seafood":
            species = self.normalize_species(payload.get("species", ""))
            allowed_species = domain.get("allowed_species", [])
            if species not in allowed_species:
                raise RSLPredictionError(
                    f"Species '{payload.get('species') or 'unspecified'}' is outside validated ML domain ({', '.join(allowed_species)}) for seafood."
                )

            pkg_type = "open"
            X_df = pd.DataFrame([{
                "species": species,
                "packaging_type": pkg_type,
                "storage_temperature_c": temp,
                "humidity_pct": humidity,
                "storage_duration_days": duration
            }])

        else:
            # Synthetic demonstration models: vegetables, meat_poultry, bakery, packaged_foods, beverages
            pkg_type = packaging
            X_df = pd.DataFrame([{
                "packaging_type": pkg_type,
                "storage_temperature_c": temp,
                "humidity_pct": humidity,
                "storage_duration_days": duration
            }])

        # 4. Model Prediction & Non-Negative Clipping
        raw_pred = model_pipeline.predict(X_df)[0]
        remaining_days = max(0, int(round(raw_pred)))
        predicted_expiry = date.today() + timedelta(days=remaining_days)

        # 5. Risk Level Calculation
        if remaining_days <= 1:
            risk = "critical"
        elif remaining_days <= 3:
            risk = "high"
        elif remaining_days <= 7:
            risk = "moderate"
        else:
            risk = "low"

        is_synthetic = (data_type == "SYNTHETIC")
        model_prefix = "SYNTHETIC_ML_" if is_synthetic else "ML_"
        model_type_str = f"{model_prefix}{model_info['model_type']}"

        logger.info(f"ML RSL Prediction [{category}] ({data_type}): {remaining_days} days remaining (raw_pred={raw_pred:.2f}, model={model_info['model_type']})")

        return {
            "model_type": model_type_str,
            "food_type": category,
            "data_type": data_type,
            "remaining_shelf_life_days": remaining_days,
            "predicted_expiry_date": predicted_expiry,
            "confidence": None,  # Transparent confidence: null (no fabricated confidence percentage)
            "risk_level": risk,
            "domain_validated": not is_synthetic,
            "is_synthetic": is_synthetic,
            "model_metadata": {
                "dataset_rows": model_info.get("training_rows", model_info.get("total_rows")),
                "cv_mae": model_info.get("mae_mean", model_info.get("cv_mae_mean")),
                "data_type": data_type
            }
        }

# Global singleton predictor instance
rsl_predictor_instance = RSLPredictor()
