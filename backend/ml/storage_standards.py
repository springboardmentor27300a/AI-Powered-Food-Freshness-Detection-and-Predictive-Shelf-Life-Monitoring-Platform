"""
Storage standards reference data (Milestone 3).
Central knowledge base for shelf-life prediction, storage validation and
recommendation engines. Values are industry-typical storage guidance for the
food categories used in the platform.
"""

# CATEGORY STORAGE PROFILES
# Each profile defines:
#   optimal temp range (C), optimal humidity range (%),
#   max storage duration (days) under OPTIMAL conditions,
#   ideal air circulation + light exposure,
#   packaging factors that accelerate/slow aging,
#   baseline storage recommendations.
CATEGORY_STORAGE_PROFILES = {
    "Fruits": {
        "temp_min": 0.0, "temp_max": 8.0,
        "humidity_min": 85.0, "humidity_max": 95.0,
        "max_shelf_life_days": 21,
        "air_circulation": "Moderate",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Vacuum Sealed": 1.20,
            "Modified Atmosphere": 1.25,
            "Sealed Container": 1.10,
            "Ventilated": 1.00,
            "Open": 0.90,
            "None": 0.85,
        },
        "recommendations": [
            "Refrigerate in the crisper drawer with moderate airflow.",
            "Keep away from ethylene-producing fruits to avoid premature ripening.",
            "Do not wash before storage; moisture accelerates mold growth.",
        ],
    },
    "Vegetables": {
        "temp_min": 0.0, "temp_max": 10.0,
        "humidity_min": 90.0, "humidity_max": 98.0,
        "max_shelf_life_days": 18,
        "air_circulation": "Moderate",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Vacuum Sealed": 1.25,
            "Modified Atmosphere": 1.20,
            "Sealed Container": 1.10,
            "Ventilated": 1.00,
            "Open": 0.90,
            "None": 0.85,
        },
        "recommendations": [
            "Store leafy greens in high-humidity crisper drawer.",
            "Separate ethylene-sensitive vegetables from ripening fruits.",
            "Remove rubber bands and ties that trap moisture.",
        ],
    },
    "Dairy Products": {
        "temp_min": 1.0, "temp_max": 4.0,
        "humidity_min": 80.0, "humidity_max": 90.0,
        "max_shelf_life_days": 14,
        "air_circulation": "Low",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Vacuum Sealed": 1.15,
            "Modified Atmosphere": 1.15,
            "Sealed Container": 1.10,
            "Ventilated": 0.95,
            "Open": 0.85,
            "None": 0.80,
        },
        "recommendations": [
            "Store on interior refrigerator shelves, never in the door.",
            "Keep sealed; dairy absorbs surrounding food odors.",
            "Return to refrigeration promptly after every use.",
        ],
    },
    "Meat & Poultry": {
        "temp_min": -1.0, "temp_max": 2.0,
        "humidity_min": 75.0, "humidity_max": 85.0,
        "max_shelf_life_days": 7,
        "air_circulation": "Low",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Vacuum Sealed": 1.35,
            "Modified Atmosphere": 1.30,
            "Sealed Container": 1.10,
            "Ventilated": 0.90,
            "Open": 0.80,
            "None": 0.75,
        },
        "recommendations": [
            "Coldest part of the refrigerator (below 2 C) or freezer for longer storage.",
            "Store on the lowest shelf to prevent cross-contamination drips.",
            "Freeze portions not used within 2 days.",
        ],
    },
    "Seafood": {
        "temp_min": -2.0, "temp_max": 1.0,
        "humidity_min": 70.0, "humidity_max": 85.0,
        "max_shelf_life_days": 4,
        "air_circulation": "Low",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Vacuum Sealed": 1.40,
            "Modified Atmosphere": 1.35,
            "Sealed Container": 1.10,
            "Ventilated": 0.90,
            "Open": 0.75,
            "None": 0.70,
        },
        "recommendations": [
            "Keep on ice or in the coldest refrigerator zone; very perishable.",
            "Consume within 1-2 days of purchase whenever possible.",
            "Freeze immediately if not cooking the same day.",
        ],
    },
    "Bakery Products": {
        "temp_min": 15.0, "temp_max": 22.0,
        "humidity_min": 45.0, "humidity_max": 60.0,
        "max_shelf_life_days": 7,
        "air_circulation": "Moderate",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Modified Atmosphere": 1.30,
            "Vacuum Sealed": 1.15,
            "Sealed Container": 1.10,
            "Ventilated": 1.00,
            "Open": 0.85,
            "None": 0.80,
        },
        "recommendations": [
            "Store at cool room temperature in a bread box or sealed bag.",
            "Refrigeration slows staling for humid climates but dries bread faster.",
            "Freeze slices individually for long-term storage.",
        ],
    },
    "Packaged Foods": {
        "temp_min": 10.0, "temp_max": 25.0,
        "humidity_min": 40.0, "humidity_max": 60.0,
        "max_shelf_life_days": 180,
        "air_circulation": "Moderate",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Vacuum Sealed": 1.10,
            "Modified Atmosphere": 1.10,
            "Sealed Container": 1.05,
            "Ventilated": 1.00,
            "Open": 0.80,
            "None": 1.00,
        },
        "recommendations": [
            "Store in a cool, dry pantry away from direct sunlight.",
            "Once opened, transfer to airtight containers.",
            "Practice FIFO rotation: first in, first out.",
        ],
    },
    "Beverages": {
        "temp_min": 4.0, "temp_max": 25.0,
        "humidity_min": 40.0, "humidity_max": 60.0,
        "max_shelf_life_days": 120,
        "air_circulation": "Moderate",
        "light_exposure": "Dark",
        "packaging_factors": {
            "Modified Atmosphere": 1.05,
            "Vacuum Sealed": 1.05,
            "Sealed Container": 1.05,
            "Ventilated": 1.00,
            "Open": 0.85,
            "None": 1.00,
        },
        "recommendations": [
            "Store unopened containers away from heat and light.",
            "Refrigerate after opening; consume pasteurized juices quickly.",
            "Keep caps tightly sealed to preserve carbonation and flavor.",
        ],
    },
}

# PACKAGING FAMILIES (for normalizing free-form packaging input)
PACKAGING_ALIASES = {
    "vacuum sealed": "Vacuum Sealed", "vacuum": "Vacuum Sealed",
    "modified atmosphere": "Modified Atmosphere", "map": "Modified Atmosphere",
    "sealed container": "Sealed Container", "airtight": "Sealed Container",
    "sealed": "Sealed Container", "container": "Sealed Container",
    "ventilated": "Ventilated", "perforated": "Ventilated",
    "open": "Open", "unwrapped": "Open",
    "none": "None", "unpackaged": "None",
}

AIR_CIRCULATION_LEVELS = ["Low", "Moderate", "High"]
LIGHT_EXPOSURE_LEVELS = ["Dark", "Dim", "Bright"]

RISK_LEVELS = ["Low", "Medium", "High", "Critical"]
