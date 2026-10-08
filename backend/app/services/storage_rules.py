"""
Configurable per-category food-storage rules used by the storage monitoring and
shelf-life prediction services.

These ranges are *configurable reference guidelines* used by the rule-based
engine, NOT laboratory food-safety certification.  They are kept in one module
(and could later be moved to a DB table / admin-editable config) so ranges can
be tuned without touching prediction code.
"""
from dataclasses import dataclass
import re


@dataclass(frozen=True)
class StorageRule:
    """Recommended storage envelope for one food category."""

    # Temperature (celsius). None means "not tightly defined / ambient".
    temp_min_c: float | None
    temp_max_c: float | None
    # Humidity (% relative humidity).
    humidity_min_pct: float | None
    humidity_max_pct: float | None
    # Required air circulation level: good | moderate | low.
    air_circulation: str
    # Whether the product is sensitive to direct light.
    light_sensitive: bool
    # Base shelf life (days) under recommended conditions.
    shelf_life_days: int
    # Hard maximum storage duration (days) - beyond this the batch is at risk.
    max_storage_days: int
    # Human-friendly storage mode shown in the UI.
    storage_type: str
    notes: str = ""
    recommended_temp_c: float | None = None
    recommended_humidity_pct: float | None = None
    light_requirement: str = "Controlled"
    packaging_requirement: str = "Use clean, intact packaging suitable for the product"
    storage_environment: str = "Clean, dry storage area"
    refrigeration_required: bool = False
    packaging_keywords: tuple[str, ...] = (
        "pack", "crate", "box", "carton", "bag", "sack", "tray",
        "bottle", "container", "loose", "wrapped", "sealed", "vacuum",
    )
    environment_keywords: tuple[str, ...] = (
        "storage", "fridge", "freezer", "room", "cabinet", "shelf",
        "cold", "chilled", "ambient", "dry", "ventilated",
    )
    rule_scope: str = "category"
    rule_key: str = ""

    def air_circulation_label(self) -> str:
        return {
            "good": "Good (free airflow)",
            "moderate": "Moderate (limited airflow)",
            "low": "Low (closed / sealed)",
        }.get(self.air_circulation, self.air_circulation)

    def recommended_temperature(self) -> float | None:
        if self.recommended_temp_c is not None:
            return self.recommended_temp_c
        if self.temp_min_c is not None and self.temp_max_c is not None:
            return round((self.temp_min_c + self.temp_max_c) / 2, 1)
        return None

    def recommended_humidity(self) -> float | None:
        if self.recommended_humidity_pct is not None:
            return self.recommended_humidity_pct
        if self.humidity_min_pct is not None and self.humidity_max_pct is not None:
            return round((self.humidity_min_pct + self.humidity_max_pct) / 2, 1)
        return None


# Per-category rules.  Ranges are representative reference values used to drive
# the transparent rule engine; update freely here (configurable).
STORAGE_RULES: dict[str, StorageRule] = {
    "Fruits": StorageRule(
        temp_min_c=4.0, temp_max_c=10.0,
        humidity_min_pct=85.0, humidity_max_pct=95.0,
        air_circulation="moderate", light_sensitive=False,
        shelf_life_days=7, max_storage_days=14, storage_type="Cool storage",
        notes="High humidity reduces moisture loss; avoid direct sunlight.",
    ),
    "Vegetables": StorageRule(
        temp_min_c=4.0, temp_max_c=8.0,
        humidity_min_pct=90.0, humidity_max_pct=95.0,
        air_circulation="moderate", light_sensitive=True,
        shelf_life_days=5, max_storage_days=10, storage_type="Cool, dark storage",
        notes="Leafy greens are light sensitive and require high humidity.",
    ),
    "Dairy Products": StorageRule(
        temp_min_c=2.0, temp_max_c=8.0,
        humidity_min_pct=60.0, humidity_max_pct=80.0,
        air_circulation="low", light_sensitive=False,
        shelf_life_days=10, max_storage_days=15, storage_type="Refrigerated",
        notes="Keep refrigerated in sealed original packaging.",
    ),
    "Meat & Poultry": StorageRule(
        temp_min_c=0.0, temp_max_c=4.0,
        humidity_min_pct=70.0, humidity_max_pct=80.0,
        air_circulation="low", light_sensitive=False,
        shelf_life_days=3, max_storage_days=5, storage_type="Refrigerated / chilled",
        notes="Cold chain essential; vacuum or sealed packaging preferred.",
    ),
    "Seafood": StorageRule(
        temp_min_c=-2.0, temp_max_c=2.0,
        humidity_min_pct=70.0, humidity_max_pct=85.0,
        air_circulation="low", light_sensitive=False,
        shelf_life_days=2, max_storage_days=4, storage_type="Chilled / iced",
        notes="Very short shelf life. Keep on ice and use quickly.",
    ),
    "Bakery Products": StorageRule(
        temp_min_c=15.0, temp_max_c=22.0,
        humidity_min_pct=50.0, humidity_max_pct=65.0,
        air_circulation="moderate", light_sensitive=True,
        shelf_life_days=5, max_storage_days=8, storage_type="Ambient / bakery cabinet",
        notes="Store away from direct sunlight; moderate humidity prevents staling & mould.",
    ),
    "Packaged Foods": StorageRule(
        temp_min_c=10.0, temp_max_c=25.0,
        humidity_min_pct=None, humidity_max_pct=60.0,
        air_circulation="good", light_sensitive=False,
        shelf_life_days=30, max_storage_days=90, storage_type="Ambient dry storage",
        notes="Cool, dry storage. Unopened packaging drives the true shelf life.",
    ),
    "Beverages": StorageRule(
        temp_min_c=5.0, temp_max_c=25.0,
        humidity_min_pct=None, humidity_max_pct=65.0,
        air_circulation="low", light_sensitive=False,
        shelf_life_days=60, max_storage_days=120, storage_type="Ambient / chilled",
        notes="Keep sealed; some beverages stored away from light.",
    ),
}


FOOD_STORAGE_RULES: dict[str, StorageRule] = {
    "apple": StorageRule(
        temp_min_c=0.0, temp_max_c=4.0, recommended_temp_c=2.0,
        humidity_min_pct=90.0, humidity_max_pct=95.0, recommended_humidity_pct=92.0,
        air_circulation="moderate", light_sensitive=False, light_requirement="Controlled",
        shelf_life_days=14, max_storage_days=30, storage_type="Refrigerated produce storage",
        notes="Use a clean ventilated container and avoid moisture buildup.",
        packaging_requirement="Ventilated crate, box or suitable produce bag",
        storage_environment="Refrigerated or cool produce storage",
        refrigeration_required=True,
        packaging_keywords=("crate", "box", "bag", "loose", "ventilated"),
        environment_keywords=("refriger", "chilled", "cold", "cool", "storage"),
        rule_scope="food", rule_key="apple",
    ),
    "banana": StorageRule(
        temp_min_c=13.0, temp_max_c=18.0, recommended_temp_c=15.0,
        humidity_min_pct=85.0, humidity_max_pct=95.0, recommended_humidity_pct=90.0,
        air_circulation="moderate", light_sensitive=True, light_requirement="Low / controlled",
        shelf_life_days=5, max_storage_days=7, storage_type="Cool, dry ventilated storage",
        notes="Avoid direct sunlight and enclosed condensation; use FEFO while ripening.",
        packaging_requirement="Ventilated carton or box that does not trap moisture",
        storage_environment="Room-temperature, dry and ventilated storage",
        refrigeration_required=False,
        packaging_keywords=("carton", "box", "crate", "bag", "loose", "ventilated"),
        environment_keywords=("room", "ambient", "dry", "ventilated", "banana"),
        rule_scope="food", rule_key="banana",
    ),
    "milk": StorageRule(
        temp_min_c=2.0, temp_max_c=6.0, recommended_temp_c=4.0,
        humidity_min_pct=60.0, humidity_max_pct=80.0, recommended_humidity_pct=70.0,
        air_circulation="low", light_sensitive=False, light_requirement="Low / controlled",
        shelf_life_days=7, max_storage_days=14, storage_type="Refrigerated dairy storage",
        notes="Keep closed in the original or equivalent airtight container.",
        packaging_requirement="Airtight original bottle, carton or sealed package",
        storage_environment="Refrigerated storage at 2–6°C",
        refrigeration_required=True,
        packaging_keywords=("sealed", "bottle", "carton", "packet", "container", "capped"),
        environment_keywords=("refriger", "fridge", "chilled", "cold", "storage"),
        rule_scope="food", rule_key="milk",
    ),
    "curd": StorageRule(
        temp_min_c=2.0, temp_max_c=6.0, recommended_temp_c=4.0,
        humidity_min_pct=60.0, humidity_max_pct=80.0, recommended_humidity_pct=70.0,
        air_circulation="low", light_sensitive=False, light_requirement="Low / controlled",
        shelf_life_days=5, max_storage_days=10, storage_type="Refrigerated dairy storage",
        notes="Keep the container closed to reduce contamination and moisture loss.",
        packaging_requirement="Clean sealed cup or airtight food-grade container",
        storage_environment="Refrigerated storage at 2–6°C",
        refrigeration_required=True,
        packaging_keywords=("sealed", "cup", "container", "packet", "capped"),
        environment_keywords=("refriger", "fridge", "chilled", "cold", "storage"),
        rule_scope="food", rule_key="curd",
    ),
    "bread": StorageRule(
        temp_min_c=15.0, temp_max_c=22.0, recommended_temp_c=18.0,
        humidity_min_pct=50.0, humidity_max_pct=65.0, recommended_humidity_pct=58.0,
        air_circulation="moderate", light_sensitive=True, light_requirement="Low / controlled",
        shelf_life_days=5, max_storage_days=8, storage_type="Ambient bakery storage",
        notes="Keep original wrapping to reduce moisture exchange and staling.",
        packaging_requirement="Original sealed bag or equivalent moisture-conscious wrapping",
        storage_environment="Dry ambient bakery cabinet away from direct light",
        refrigeration_required=False,
        packaging_keywords=("sealed", "bag", "wrap", "wrapped", "original", "pack"),
        environment_keywords=("ambient", "bakery", "cabinet", "room", "dry", "shelf"),
        rule_scope="food", rule_key="bread",
    ),
    "tomato": StorageRule(
        temp_min_c=10.0, temp_max_c=15.0, recommended_temp_c=12.0,
        humidity_min_pct=85.0, humidity_max_pct=90.0, recommended_humidity_pct=88.0,
        air_circulation="moderate", light_sensitive=True, light_requirement="Controlled",
        shelf_life_days=7, max_storage_days=10, storage_type="Cool ventilated produce storage",
        notes="Avoid condensation and direct sunlight while keeping produce dry.",
        packaging_requirement="Ventilated crate, carton or box",
        storage_environment="Cool, dry and ventilated produce storage",
        refrigeration_required=False,
        packaging_keywords=("crate", "carton", "box", "loose", "ventilated"),
        environment_keywords=("room", "ambient", "dry", "ventilated", "produce", "storage"),
        rule_scope="food", rule_key="tomato",
    ),
    "potato": StorageRule(
        temp_min_c=7.0, temp_max_c=10.0, recommended_temp_c=8.0,
        humidity_min_pct=85.0, humidity_max_pct=90.0, recommended_humidity_pct=88.0,
        air_circulation="low", light_sensitive=True, light_requirement="Dark",
        shelf_life_days=30, max_storage_days=120, storage_type="Cool, dark dry storage",
        notes="Store away from light and avoid humid, enclosed conditions.",
        packaging_requirement="Breathable sack, mesh bag or ventilated crate",
        storage_environment="Cool, dark and dry storage with limited airflow",
        refrigeration_required=False,
        packaging_keywords=("sack", "mesh", "bag", "crate", "box", "loose", "ventilated"),
        environment_keywords=("cool", "dark", "dry", "room", "ambient", "storage", "cellar"),
        rule_scope="food", rule_key="potato",
    ),
    "leafy vegetables": StorageRule(
        temp_min_c=0.0, temp_max_c=4.0, recommended_temp_c=2.0,
        humidity_min_pct=90.0, humidity_max_pct=95.0, recommended_humidity_pct=92.0,
        air_circulation="moderate", light_sensitive=True, light_requirement="Dark / controlled",
        shelf_life_days=3, max_storage_days=7, storage_type="Refrigerated high-humidity storage",
        notes="Use a perforated package and keep leaves protected from drying and heat.",
        packaging_requirement="Perforated bag, clamshell or ventilated tray",
        storage_environment="Refrigerated, dark and high-humidity storage",
        refrigeration_required=True,
        packaging_keywords=("perforated", "clamshell", "bag", "tray", "box", "wrapped", "ventilated"),
        environment_keywords=("refriger", "fridge", "chilled", "cold", "storage", "humidity"),
        rule_scope="food", rule_key="leafy vegetables",
    ),
}

FOOD_RULE_ALIASES = {
    "yogurt": "curd",
    "spinach": "leafy vegetables",
    "leafy greens": "leafy vegetables",
    "green leafy vegetables": "leafy vegetables",
}


def _normalise_food_name(food_name: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (food_name or "").lower()).strip()


def get_storage_rule(
    category: str | None,
    food_name: str | None = None,
) -> StorageRule:
    """Return a food-specific rule, then its category rule, then a general rule."""
    normalised = _normalise_food_name(food_name)
    normalised = FOOD_RULE_ALIASES.get(normalised, normalised)
    food_rule = FOOD_STORAGE_RULES.get(normalised)
    if food_rule is None and normalised.endswith("s"):
        if normalised.endswith("ies"):
            singular = normalised[:-3] + "y"
        elif normalised.endswith("oes"):
            singular = normalised[:-2]
        else:
            singular = normalised[:-1]
        singular = FOOD_RULE_ALIASES.get(singular, singular)
        food_rule = FOOD_STORAGE_RULES.get(singular)
    if food_rule is not None:
        return food_rule
    if category and category in STORAGE_RULES:
        return STORAGE_RULES[category]
    return StorageRule(
        temp_min_c=4.0, temp_max_c=25.0, recommended_temp_c=14.0,
        humidity_min_pct=None, humidity_max_pct=70.0, recommended_humidity_pct=60.0,
        air_circulation="moderate", light_sensitive=False, light_requirement="Controlled",
        shelf_life_days=7, max_storage_days=21, storage_type="General storage",
        notes="Unknown category - using general-purpose storage defaults.",
        packaging_requirement="Clean, intact packaging suitable for the product",
        storage_environment="Clean, dry general storage area",
        rule_scope="general", rule_key="general",
    )
