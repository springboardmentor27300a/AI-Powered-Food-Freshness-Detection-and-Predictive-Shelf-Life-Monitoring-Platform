"""Shared domain constants used by schemas, routers and validation."""

# Allowed user roles (stored as these exact strings in the users table).
ROLES = [
    "consumer",
    "retail_manager",
    "warehouse_operator",
    "quality_inspector",
    "administrator",
]

ROLE_LABELS = {
    "consumer": "Consumer",
    "retail_manager": "Retail Manager",
    "warehouse_operator": "Warehouse Operator",
    "quality_inspector": "Food Quality Inspector",
    "administrator": "Administrator",
}

# Allowed food categories.
FOOD_CATEGORIES = [
    "Fruits",
    "Vegetables",
    "Dairy Products",
    "Meat & Poultry",
    "Seafood",
    "Bakery Products",
    "Packaged Foods",
    "Beverages",
]

# Allowed quantity units.
UNITS = ["kg", "g", "litres", "pieces", "packets"]

# A batch is "Expiring Soon" when its expiry date falls within this many days.
EXPIRING_SOON_WINDOW_DAYS = 3

# ---------------------------------------------------------------------------
# Milestone 3 - overall freshness scoring
# ---------------------------------------------------------------------------

# Application-level freshness status mapped from the OVERALL freshness score.
# These are application classifications, NOT medical/food-safety certification.
FRESHNESS_STATUS_THRESHOLDS = [
    (80, "Fresh"),
    (60, "Acceptable"),
    (40, "Needs Attention"),
    (0, "Spoiled"),
]

# The canonical backend risk levels (lowercase, used as DB values).
RISK_LEVELS = ["low", "moderate", "high", "critical"]

# Risk score bands (0-100) -> display label. Higher score = higher spoilage risk.
RISK_SCORE_BANDS = [
    (75, "Critical"),
    (50, "High"),
    (25, "Moderate"),
    (0, "Low"),
]

# Allowed storage condition values used by /storage endpoints.
AIR_CIRCULATION_OPTIONS = ["good", "moderate", "poor"]
LIGHT_EXPOSURE_OPTIONS = [
    "appropriate", "low", "moderate", "high", "controlled", "excessive", "not_applicable"
]

# Shelf-life warning horizons (days remaining) for alerts / labels.
SHELF_LIFE_WARNING_DAYS = [0, 1, 3, 7]

# Weighted-model component weights (also declared in app.ml.config.SCORING_PILLARS,
# which is the single source of truth used by the scoring service).
SCORE_WEIGHTS = {
    "visual_condition": 0.40,
    "storage_conditions": 0.25,
    "shelf_life_prediction": 0.20,
    "product_age": 0.15,
}

# Neutral score used when storage data is missing so batches are not unfairly
# penalised before any storage readings have been recorded.
DEFAULT_STORAGE_SCORE_WHEN_UNKNOWN = 75

# Recommendation categories produced by the recommendation engine.
RECOMMENDATION_CATEGORIES = [
    "storage",
    "consumption",
    "rotation",
    "waste_reduction",
    "quality_improvement",
]

# Alert types produced by the alert service.
ALERT_TYPES = [
    "freshness",
    "shelf_life",
    "spoilage",
    "storage",
    "inventory",
    "platform",
]
