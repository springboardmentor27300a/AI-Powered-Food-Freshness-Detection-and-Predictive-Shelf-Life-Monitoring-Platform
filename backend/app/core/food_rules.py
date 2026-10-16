"""
Food-specific shelf-life and storage rules (shelf-life fix).

IMPORTANT: These are transparent, hand-written, configurable rules based
on GENERAL food-storage guidance (typical consumer refrigerator /
freezer / pantry guidance). They are NOT a trained model, NOT a
food-safety standard, and NOT a guarantee. Edit the tables below to
tune them - nothing else in the code needs to change.

How they are used:
  * A rule for the SPECIFIC food (apple, banana, tomato, leafy greens,
    milk, bread, raw meat, seafood, ...) wins over the broader
    CATEGORY rule (fruits, vegetables, dairy products, ...).
  * `shelf_life_days` is the typical TOTAL number of days from purchase
    under each storage method. 0 means "not suitable for that method"
    (e.g. raw meat at room temperature). A missing method means the rule
    has no figure for it, so the estimator falls back to recorded dates.
  * These figures are only ever used to SHORTEN the recorded expiry
    date, never to extend it.

All functions are pure (no DB, no FastAPI).
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

REFRIGERATED = "refrigerated"
FROZEN = "frozen"
ROOM_TEMPERATURE = "room_temperature"
STORAGE_METHODS = (REFRIGERATED, FROZEN, ROOM_TEMPERATURE)

METHOD_LABELS = {
    REFRIGERATED: "Refrigerated",
    FROZEN: "Frozen",
    ROOM_TEMPERATURE: "Room temperature",
    "unknown": "Unknown",
}


@dataclass(frozen=True)
class FoodProfile:
    key: str
    label: str
    shelf_life_days: Dict[str, int]
    recommended_method: str
    temperature_range_c: Optional[Tuple[float, float]]
    humidity_range_percent: Optional[Tuple[float, float]]  # None = no supported guidance
    packaging: str
    handling: str


# ---------------------------------------------------------------- specific foods
_SPECIFIC_PROFILES: Dict[str, FoodProfile] = {
    "apple": FoodProfile(
        "apple", "Apples",
        {REFRIGERATED: 28, ROOM_TEMPERATURE: 7, FROZEN: 240},
        REFRIGERATED, (0.0, 4.0), (90.0, 95.0),
        "Keep in a perforated bag or the crisper drawer; do not seal airtight.",
        "Store away from strongly-scented foods; remove any bruised apple so it does not spoil the rest.",
    ),
    "banana": FoodProfile(
        "banana", "Bananas",
        {ROOM_TEMPERATURE: 5, REFRIGERATED: 7, FROZEN: 90},
        ROOM_TEMPERATURE, (13.0, 22.0), None,
        "Leave unwrapped at room temperature; hang or separate from other fruit.",
        "Bananas give off ethylene and ripen quickly. Refrigeration blackens the peel but the fruit can still be eaten; peel and freeze very ripe ones.",
    ),
    "tomato": FoodProfile(
        "tomato", "Tomatoes",
        {ROOM_TEMPERATURE: 7, REFRIGERATED: 10, FROZEN: 60},
        ROOM_TEMPERATURE, (12.0, 21.0), None,
        "Store stem-side up, single layer, out of direct sunlight; do not seal in plastic.",
        "Ripen at room temperature; refrigerate only once fully ripe. Discard any that are mouldy or leaking.",
    ),
    "leafy_greens": FoodProfile(
        "leafy_greens", "Leafy vegetables",
        {REFRIGERATED: 5, ROOM_TEMPERATURE: 1, FROZEN: 180},
        REFRIGERATED, (0.0, 4.0), (95.0, 100.0),
        "Keep dry in a breathable bag or container lined with a paper towel.",
        "Wash just before use; remove wilted or slimy leaves promptly so they do not spread.",
    ),
    "milk": FoodProfile(
        "milk", "Milk",
        {REFRIGERATED: 7, FROZEN: 90, ROOM_TEMPERATURE: 0},
        REFRIGERATED, (0.0, 4.0), None,
        "Keep tightly closed in its original container, on an inner shelf rather than the door.",
        "Do not leave out of refrigeration for more than about 2 hours. If it smells sour or is lumpy, discard it.",
    ),
    "bread": FoodProfile(
        "bread", "Bread",
        {ROOM_TEMPERATURE: 5, REFRIGERATED: 7, FROZEN: 90},
        ROOM_TEMPERATURE, (18.0, 25.0), None,
        "Keep in a bread bin or sealed bag; slice and freeze for long storage.",
        "Check for mould before use - if any is visible, discard the whole loaf. Refrigeration dries bread out faster.",
    ),
    "raw_meat": FoodProfile(
        "raw_meat", "Raw meat and poultry",
        {REFRIGERATED: 3, FROZEN: 180, ROOM_TEMPERATURE: 0},
        REFRIGERATED, (0.0, 4.0), None,
        "Keep sealed on a tray on the lowest shelf so juices cannot drip onto other food.",
        "Never leave out at room temperature for more than about 2 hours. Cook thoroughly; thaw in the refrigerator.",
    ),
    "seafood": FoodProfile(
        "seafood", "Fish and seafood",
        {REFRIGERATED: 2, FROZEN: 90, ROOM_TEMPERATURE: 0},
        REFRIGERATED, (0.0, 2.0), None,
        "Keep sealed, on ice or the coldest shelf, away from ready-to-eat food.",
        "Use as soon as possible; a strong fishy or ammonia smell or slimy texture means it should be discarded.",
    ),
}

# ---------------------------------------------------------------- category rules
_CATEGORY_PROFILES: Dict[str, FoodProfile] = {
    "fruits": FoodProfile(
        "cat_fruits", "Fruits (general)",
        {REFRIGERATED: 7, ROOM_TEMPERATURE: 4, FROZEN: 180},
        REFRIGERATED, (0.0, 10.0), (85.0, 95.0),
        "Keep in a breathable container or the crisper drawer.",
        "Separate ripe from unripe fruit and remove any that are bruised or mouldy.",
    ),
    "vegetables": FoodProfile(
        "cat_vegetables", "Vegetables (general)",
        {REFRIGERATED: 7, ROOM_TEMPERATURE: 3, FROZEN: 180},
        REFRIGERATED, (0.0, 10.0), (85.0, 95.0),
        "Keep in a breathable bag or the crisper drawer.",
        "Wash just before use and discard any that are slimy or mouldy.",
    ),
    "dairy products": FoodProfile(
        "cat_dairy", "Dairy products (general)",
        {REFRIGERATED: 7, FROZEN: 60, ROOM_TEMPERATURE: 0},
        REFRIGERATED, (0.0, 4.0), None,
        "Keep sealed in the original container.",
        "Keep cold, avoid leaving out for more than about 2 hours, and follow the printed date.",
    ),
    "meat & poultry": FoodProfile(
        "cat_meat", "Meat & poultry (general)",
        {REFRIGERATED: 3, FROZEN: 180, ROOM_TEMPERATURE: 0},
        REFRIGERATED, (0.0, 4.0), None,
        "Keep sealed on a tray on the lowest shelf.",
        "Keep cold, cook thoroughly and avoid cross-contamination with other food.",
    ),
    "seafood": FoodProfile(
        "cat_seafood", "Seafood (general)",
        {REFRIGERATED: 2, FROZEN: 90, ROOM_TEMPERATURE: 0},
        REFRIGERATED, (0.0, 2.0), None,
        "Keep sealed, on ice or the coldest shelf.",
        "Use as soon as possible and discard if it smells strongly or feels slimy.",
    ),
    "bakery products": FoodProfile(
        "cat_bakery", "Bakery products (general)",
        {ROOM_TEMPERATURE: 4, REFRIGERATED: 7, FROZEN: 90},
        ROOM_TEMPERATURE, (18.0, 25.0), None,
        "Keep in a sealed bag or container.",
        "Check for mould before use; freeze portions for longer storage.",
    ),
    # Packaged foods and beverages vary too much for a generic day count,
    # so no figures are given: the estimator uses the recorded dates.
    "packaged foods": FoodProfile(
        "cat_packaged", "Packaged foods (general)", {},
        ROOM_TEMPERATURE, None, None,
        "Keep in the original sealed packaging.",
        "Follow the storage instructions printed on the label and check the printed date.",
    ),
    "beverages": FoodProfile(
        "cat_beverages", "Beverages (general)", {},
        ROOM_TEMPERATURE, None, None,
        "Keep sealed in the original container.",
        "Follow the storage instructions on the label; refrigerate after opening if it says so.",
    ),
}

# (substring, profile key) - first match wins; more specific words first.
_SPECIFIC_FOOD_MATCHES: List[Tuple[str, str]] = [
    ("apple", "apple"),
    ("banana", "banana"),
    ("tomato", "tomato"),
    ("lettuce", "leafy_greens"), ("spinach", "leafy_greens"), ("kale", "leafy_greens"),
    ("arugula", "leafy_greens"), ("cabbage", "leafy_greens"), ("coriander", "leafy_greens"),
    ("cilantro", "leafy_greens"), ("mint", "leafy_greens"), ("leafy", "leafy_greens"),
    ("milk", "milk"), ("yogurt", "milk"), ("yoghurt", "milk"), ("curd", "milk"),
    ("cheese", "milk"),
    ("bread", "bread"), ("loaf", "bread"), ("roti", "bread"),
    ("chicken", "raw_meat"), ("beef", "raw_meat"), ("pork", "raw_meat"),
    ("mutton", "raw_meat"), ("lamb", "raw_meat"), ("turkey", "raw_meat"), ("meat", "raw_meat"),
    ("fish", "seafood"), ("salmon", "seafood"), ("tuna", "seafood"), ("shrimp", "seafood"),
    ("prawn", "seafood"), ("seafood", "seafood"), ("crab", "seafood"),
]


def get_food_profile(
    food_name: Optional[str], category: Optional[str]
) -> Tuple[Optional[FoodProfile], bool]:
    """
    Returns (profile, matched_specific_food). A specific food rule always
    beats a category rule. (None, False) when neither matches.
    """
    name = (food_name or "").strip().lower()
    for needle, key in _SPECIFIC_FOOD_MATCHES:
        if needle in name:
            return _SPECIFIC_PROFILES[key], True
    cat = (category or "").strip().lower()
    if cat in _CATEGORY_PROFILES:
        return _CATEGORY_PROFILES[cat], False
    return None, False


# ---------------------------------------------------------------- storage method
FROZEN_MAX_C = -5.0
REFRIGERATED_MAX_C = 8.0

_LOCATION_KEYWORDS: List[Tuple[str, str]] = [
    ("freez", FROZEN),
    ("fridge", REFRIGERATED), ("refriger", REFRIGERATED), ("chiller", REFRIGERATED),
    ("cold room", REFRIGERATED), ("cooler", REFRIGERATED),
    ("pantry", ROOM_TEMPERATURE), ("shelf", ROOM_TEMPERATURE), ("counter", ROOM_TEMPERATURE),
    ("cupboard", ROOM_TEMPERATURE), ("room", ROOM_TEMPERATURE), ("ambient", ROOM_TEMPERATURE),
    ("kitchen", ROOM_TEMPERATURE), ("display", ROOM_TEMPERATURE), ("dry", ROOM_TEMPERATURE),
]


def infer_storage_method(
    temperature_celsius: Optional[float], location_text: Optional[str]
) -> Optional[str]:
    """
    An actual recorded temperature wins. Otherwise the inventory item's
    free-text storage_location is used. None when neither is usable -
    a temperature is never assumed.
    """
    if temperature_celsius is not None:
        if temperature_celsius <= FROZEN_MAX_C:
            return FROZEN
        if temperature_celsius <= REFRIGERATED_MAX_C:
            return REFRIGERATED
        return ROOM_TEMPERATURE
    text = (location_text or "").strip().lower()
    if text:
        for needle, method in _LOCATION_KEYWORDS:
            if needle in text:
                return method
    return None


# ---------------------------------------------------------------- guidance
@dataclass
class StorageGuidance:
    basis: str  # "food_specific" | "category" | "generic"
    rule_label: Optional[str]
    recommended_method: str  # refrigerated / frozen / room_temperature / unknown
    temperature_range_c: Optional[Tuple[float, float]]
    humidity_range_percent: Optional[Tuple[float, float]]
    packaging: str
    handling: str
    actual_method: Optional[str]
    has_readings: bool
    comparison_notes: List[str] = field(default_factory=list)


GENERIC_PACKAGING = "Keep in the original packaging or a clean, sealed container."
GENERIC_HANDLING = (
    "No food-specific rule exists for this item, so follow the storage instructions "
    "printed on the label and the recorded expiry date."
)


def build_storage_guidance(
    food_name: Optional[str],
    category: Optional[str],
    storage_location: Optional[str] = None,
    temperature_celsius: Optional[float] = None,
    humidity_percent: Optional[float] = None,
) -> StorageGuidance:
    """
    Always returns guidance, even with no readings. Readings are only
    compared when real values are supplied; nothing is assumed.
    """
    profile, specific = get_food_profile(food_name, category)
    actual = infer_storage_method(temperature_celsius, storage_location)
    has_readings = temperature_celsius is not None or humidity_percent is not None

    if profile is None:
        g = StorageGuidance(
            "generic", None, "unknown", None, None,
            GENERIC_PACKAGING, GENERIC_HANDLING, actual, has_readings,
        )
    else:
        g = StorageGuidance(
            "food_specific" if specific else "category", profile.label,
            profile.recommended_method, profile.temperature_range_c,
            profile.humidity_range_percent, profile.packaging, profile.handling,
            actual, has_readings,
        )

    notes = g.comparison_notes
    if not has_readings:
        notes.append(
            "No storage readings have been recorded for this item, so actual conditions "
            "are not compared. Nothing has been assumed about its current temperature."
        )
    if profile is not None:
        if temperature_celsius is not None and g.temperature_range_c:
            lo, hi = g.temperature_range_c
            if temperature_celsius < lo:
                notes.append(f"Recorded temperature {temperature_celsius:.1f}C is below the recommended {lo:.0f}-{hi:.0f}C.")
            elif temperature_celsius > hi:
                notes.append(f"Recorded temperature {temperature_celsius:.1f}C is above the recommended {lo:.0f}-{hi:.0f}C.")
            else:
                notes.append(f"Recorded temperature {temperature_celsius:.1f}C is within the recommended {lo:.0f}-{hi:.0f}C.")
        if humidity_percent is not None:
            if g.humidity_range_percent:
                lo, hi = g.humidity_range_percent
                if humidity_percent < lo:
                    notes.append(f"Recorded humidity {humidity_percent:.0f}% is below the recommended {lo:.0f}-{hi:.0f}%.")
                elif humidity_percent > hi:
                    notes.append(f"Recorded humidity {humidity_percent:.0f}% is above the recommended {lo:.0f}-{hi:.0f}%.")
                else:
                    notes.append(f"Recorded humidity {humidity_percent:.0f}% is within the recommended {lo:.0f}-{hi:.0f}%.")
            else:
                notes.append("No humidity guidance is defined for this food, so recorded humidity is not compared.")
        if actual is not None and actual != g.recommended_method and profile.shelf_life_days:
            notes.append(
                f"Current storage looks like '{METHOD_LABELS[actual]}', but '{METHOD_LABELS[g.recommended_method]}' "
                "is recommended for this food."
            )
    return g
