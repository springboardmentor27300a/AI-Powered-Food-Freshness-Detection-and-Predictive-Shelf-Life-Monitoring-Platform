import math
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Union


class ShelfLifePredictor:
    """
    Kinetic & Arrhenius-based Shelf-Life Prediction Engine.
    Models temperature sensitivity (Q10 rule & Arrhenius equation),
    relative humidity stress, packaging barriers, and dynamic quality decay.
    """

    PACKAGING_FACTORS = {
        "Vacuum Pack": 1.85,
        "Modified Atmosphere Bag": 1.55,
        "Modified Atmosphere": 1.55,
        "Clamshell Punnet": 1.15,
        "Tetra Pak": 1.40,
        "Sealed Tub": 1.25,
        "Ventilated Crate": 0.90,
        "Perforated Polybag": 1.05,
        "Paper Bread Bag": 0.80,
        "Standard Pack": 1.00,
        "Open Air": 0.70
    }

    CATEGORY_KINETICS = {
        "Fruits": {"Ea": 65.0, "Q10": 2.2, "ref_temp": 4.0, "default_days": 14},
        "Vegetables": {"Ea": 70.0, "Q10": 2.4, "ref_temp": 4.0, "default_days": 10},
        "Dairy": {"Ea": 85.0, "Q10": 2.8, "ref_temp": 3.0, "default_days": 12},
        "Meat": {"Ea": 95.0, "Q10": 3.2, "ref_temp": 1.0, "default_days": 7},
        "Fish": {"Ea": 105.0, "Q10": 3.5, "ref_temp": 0.0, "default_days": 4},
        "Bakery": {"Ea": 40.0, "Q10": 1.5, "ref_temp": 20.0, "default_days": 5},
        "Grains": {"Ea": 35.0, "Q10": 1.4, "ref_temp": 20.0, "default_days": 180},
        "Packaged Food": {"Ea": 50.0, "Q10": 1.8, "ref_temp": 20.0, "default_days": 60},
        "Other": {"Ea": 60.0, "Q10": 2.0, "ref_temp": 10.0, "default_days": 14}
    }

    COMMODITY_DATABASE = {
        # Fruits
        "apple": {"display_name": "Apples", "category": "Fruits", "base_days": 24, "ref_temp": 4.0, "ref_rh": 90.0, "q10": 2.2, "emoji": "🍏", "storage_advice": "Refrigerate in crisper drawer (2–4°C). Store separately from ethylene-sensitive produce."},
        "banana": {"display_name": "Bananas", "category": "Fruits", "base_days": 7, "ref_temp": 14.0, "ref_rh": 85.0, "q10": 2.5, "emoji": "🍌", "storage_advice": "Keep at room temperature (13–15°C). Never refrigerate before ripening to prevent chill damage."},
        "strawberry": {"display_name": "Strawberries", "category": "Fruits", "base_days": 6, "ref_temp": 2.0, "ref_rh": 92.0, "q10": 2.6, "emoji": "🍓", "storage_advice": "Keep unwashed in ventilated clamshell at 1–2°C. Wash only right before eating."},
        "berries": {"display_name": "Fresh Berries", "category": "Fruits", "base_days": 5, "ref_temp": 2.0, "ref_rh": 92.0, "q10": 2.6, "emoji": "🫐", "storage_advice": "High perishability. Store chilled near 2°C with high humidity in original packaging."},
        "orange": {"display_name": "Oranges & Citrus", "category": "Fruits", "base_days": 21, "ref_temp": 6.0, "ref_rh": 85.0, "q10": 2.0, "emoji": "🍊", "storage_advice": "Store in refrigerator produce bin (4–7°C) or cool dry pantry (12–15°C)."},
        "mango": {"display_name": "Fresh Mangoes", "category": "Fruits", "base_days": 8, "ref_temp": 12.0, "ref_rh": 85.0, "q10": 2.3, "emoji": "🥭", "storage_advice": "Ripen at room temperature; once soft, refrigerate at 10–12°C for up to 5 days."},
        "avocado": {"display_name": "Avocado", "category": "Fruits", "base_days": 7, "ref_temp": 12.0, "ref_rh": 65.0, "q10": 2.4, "emoji": "🥑", "storage_advice": "Ripen at ambient; transfer ripe avocados to refrigerator (4–6°C) to delay softening."},
        "grape": {"display_name": "Table Grapes", "category": "Fruits", "base_days": 14, "ref_temp": 1.0, "ref_rh": 92.0, "q10": 2.3, "emoji": "🍇", "storage_advice": "Store unwashed in perforated plastic bag near 0–2°C. Keep away from strong odorous foods."},
        "watermelon": {"display_name": "Watermelon", "category": "Fruits", "base_days": 14, "ref_temp": 12.0, "ref_rh": 85.0, "q10": 2.1, "emoji": "🍉", "storage_advice": "Whole melons keep best at 12–15°C. Once cut, wrap tightly and chill at 2–4°C for max 4 days."},
        "lemon": {"display_name": "Lemons & Limes", "category": "Fruits", "base_days": 28, "ref_temp": 8.0, "ref_rh": 85.0, "q10": 1.9, "emoji": "🍋", "storage_advice": "Seal in crisper drawer bag to retain juice and prevent skin dehydration."},
        "peach": {"display_name": "Peaches & Plums", "category": "Fruits", "base_days": 8, "ref_temp": 2.0, "ref_rh": 90.0, "q10": 2.4, "emoji": "🍑", "storage_advice": "Ripen at room temperature stem-side down, then refrigerate at 1–3°C."},
        "pineapple": {"display_name": "Fresh Pineapple", "category": "Fruits", "base_days": 10, "ref_temp": 10.0, "ref_rh": 85.0, "q10": 2.2, "emoji": "🍍", "storage_advice": "Store whole at 8–10°C. Cut fruit must be stored refrigerated in airtight container."},
        "kiwi": {"display_name": "Kiwi Fruit", "category": "Fruits", "base_days": 18, "ref_temp": 2.0, "ref_rh": 90.0, "q10": 2.2, "emoji": "🥝", "storage_advice": "Keep at 0–2°C away from apples and bananas to prevent premature softening."},

        # Vegetables
        "tomato": {"display_name": "Fresh Tomatoes", "category": "Vegetables", "base_days": 10, "ref_temp": 13.0, "ref_rh": 85.0, "q10": 2.2, "emoji": "🍅", "storage_advice": "Keep stem-side up at room temperature (12–15°C). Avoid refrigeration to preserve flavor volatiles."},
        "potato": {"display_name": "Potatoes", "category": "Vegetables", "base_days": 60, "ref_temp": 12.0, "ref_rh": 85.0, "q10": 1.6, "emoji": "🥔", "storage_advice": "Dark, cool, well-ventilated dry pantry (10–12°C). Never refrigerate to prevent starch-to-sugar conversion."},
        "onion": {"display_name": "Yellow & Red Onions", "category": "Vegetables", "base_days": 45, "ref_temp": 15.0, "ref_rh": 65.0, "q10": 1.5, "emoji": "🧅", "storage_advice": "Store in mesh bags in dry, cool, ventilated location away from potatoes."},
        "garlic": {"display_name": "Garlic Bulbs", "category": "Vegetables", "base_days": 90, "ref_temp": 15.0, "ref_rh": 65.0, "q10": 1.4, "emoji": "🧄", "storage_advice": "Keep in wire mesh or terra cotta keeper in dry ambient pantry. Avoid plastic bags."},
        "carrot": {"display_name": "Carrots", "category": "Vegetables", "base_days": 30, "ref_temp": 3.0, "ref_rh": 95.0, "q10": 2.0, "emoji": "🥕", "storage_advice": "Remove green tops, store in perforated bag in high-humidity crisper drawer."},
        "broccoli": {"display_name": "Broccoli Crowns", "category": "Vegetables", "base_days": 9, "ref_temp": 2.0, "ref_rh": 95.0, "q10": 2.6, "emoji": "🥦", "storage_advice": "Store loose in perforated bag in refrigerator crisper drawer. High ethylene sensitivity."},
        "spinach": {"display_name": "Fresh Spinach", "category": "Vegetables", "base_days": 6, "ref_temp": 2.0, "ref_rh": 95.0, "q10": 2.8, "emoji": "🥬", "storage_advice": "Line container with paper towels to absorb moisture; store at 1–3°C at 90–95% RH."},
        "lettuce": {"display_name": "Lettuce & Salad Greens", "category": "Vegetables", "base_days": 8, "ref_temp": 2.0, "ref_rh": 95.0, "q10": 2.7, "emoji": "🥬", "storage_advice": "Crisper drawer in breathable bag. Keep away from apples and stone fruits."},
        "cucumber": {"display_name": "Cucumbers", "category": "Vegetables", "base_days": 10, "ref_temp": 10.0, "ref_rh": 90.0, "q10": 2.2, "emoji": "🥒", "storage_advice": "Chilling sensitive; store in warmest refrigerator spot or cool pantry (10–12°C)."},
        "pepper": {"display_name": "Bell Peppers", "category": "Vegetables", "base_days": 12, "ref_temp": 8.0, "ref_rh": 90.0, "q10": 2.2, "emoji": "🫑", "storage_advice": "Store dry in crisper drawer (7–9°C). Green peppers last slightly longer than red/yellow."},
        "cabbage": {"display_name": "Green & Red Cabbage", "category": "Vegetables", "base_days": 35, "ref_temp": 2.0, "ref_rh": 95.0, "q10": 1.9, "emoji": "🥗", "storage_advice": "Keep whole head unwrapped in crisper drawer for maximum storage longevity."},
        "cauliflower": {"display_name": "Cauliflower", "category": "Vegetables", "base_days": 12, "ref_temp": 2.0, "ref_rh": 95.0, "q10": 2.4, "emoji": "🥦", "storage_advice": "Stem-down in perforated bag in refrigerator crisper drawer."},
        "mushroom": {"display_name": "Fresh Button / Cremini Mushrooms", "category": "Vegetables", "base_days": 6, "ref_temp": 2.0, "ref_rh": 90.0, "q10": 2.8, "emoji": "🍄", "storage_advice": "Store in brown paper bag in refrigerator to allow breathing without condensation."},

        # Dairy & Eggs
        "milk": {"display_name": "Fresh Whole Milk", "category": "Dairy", "base_days": 10, "ref_temp": 3.0, "ref_rh": 70.0, "q10": 2.6, "emoji": "🥛", "storage_advice": "Keep strictly at 2–4°C on middle/lower shelf, NOT in door compartments where temp fluctuates."},
        "yogurt": {"display_name": "Greek & Plain Yogurt", "category": "Dairy", "base_days": 18, "ref_temp": 4.0, "ref_rh": 70.0, "q10": 2.4, "emoji": "🥣", "storage_advice": "Keep sealed at 2–4°C. Once opened, consume within 7–10 days."},
        "cheese": {"display_name": "Cheddar & Hard Cheeses", "category": "Dairy", "base_days": 45, "ref_temp": 4.0, "ref_rh": 75.0, "q10": 2.0, "emoji": "🧀", "storage_advice": "Wrap in cheese paper or parchment, then loosely in plastic wrap in dairy bin."},
        "mozzarella": {"display_name": "Fresh Mozzarella", "category": "Dairy", "base_days": 14, "ref_temp": 4.0, "ref_rh": 75.0, "q10": 2.3, "emoji": "🧀", "storage_advice": "Keep submerged in brine/whey until used; consume within 3–5 days of opening."},
        "paneer": {"display_name": "Fresh Paneer / Cottage Cheese", "category": "Dairy", "base_days": 7, "ref_temp": 3.0, "ref_rh": 75.0, "q10": 2.8, "emoji": "🧀", "storage_advice": "Submerge block in fresh water in airtight container; change water every 2 days."},
        "butter": {"display_name": "Butter", "category": "Dairy", "base_days": 60, "ref_temp": 4.0, "ref_rh": 65.0, "q10": 1.8, "emoji": "🧈", "storage_advice": "Store wrapped in cold refrigerator compartment or freeze for up to 9 months."},
        "egg": {"display_name": "Grade A Eggs", "category": "Dairy", "base_days": 35, "ref_temp": 4.0, "ref_rh": 70.0, "q10": 2.0, "emoji": "🥚", "storage_advice": "Keep in original carton on middle refrigerator shelf to prevent moisture loss."},

        # Meat & Poultry
        "chicken": {"display_name": "Fresh Chicken Breast", "category": "Meat", "base_days": 5, "ref_temp": 1.5, "ref_rh": 75.0, "q10": 2.8, "emoji": "🍗", "storage_advice": "Bottom refrigerator shelf at 0–2°C on rimmed tray. Cook within 48h or freeze immediately."},
        "poultry": {"display_name": "Fresh Poultry", "category": "Meat", "base_days": 5, "ref_temp": 1.5, "ref_rh": 75.0, "q10": 2.8, "emoji": "🍗", "storage_advice": "Maintain continuous cold chain at 0–2°C. Keep isolated from ready-to-eat foods."},
        "beef": {"display_name": "Fresh Beef Steak", "category": "Meat", "base_days": 7, "ref_temp": 1.5, "ref_rh": 75.0, "q10": 2.6, "emoji": "🥩", "storage_advice": "Store at 0–2°C in bottom chiller drawer. Vacuum pack extends shelf life to 21+ days."},
        "pork": {"display_name": "Fresh Pork Chops", "category": "Meat", "base_days": 5, "ref_temp": 1.5, "ref_rh": 75.0, "q10": 2.7, "emoji": "🥩", "storage_advice": "Store tightly wrapped on lower cold shelf at 0–2°C."},
        "bacon": {"display_name": "Smoked Bacon", "category": "Meat", "base_days": 21, "ref_temp": 3.0, "ref_rh": 70.0, "q10": 2.0, "emoji": "🥓", "storage_advice": "Keep sealed at 2–4°C. Once opened, wrap tightly in foil and use within 7 days."},
        "sausage": {"display_name": "Fresh Sausages", "category": "Meat", "base_days": 7, "ref_temp": 2.0, "ref_rh": 70.0, "q10": 2.5, "emoji": "🌭", "storage_advice": "Refrigerate at 1–3°C or freeze for up to 3 months."},

        # Fish & Seafood
        "salmon": {"display_name": "Fresh Salmon Fillet", "category": "Fish", "base_days": 4, "ref_temp": 1.0, "ref_rh": 90.0, "q10": 3.0, "emoji": "🐟", "storage_advice": "Best kept over crushed ice in refrigerator at 0–1°C. Cook within 24–48 hours."},
        "fish": {"display_name": "Fresh Fish Fillet", "category": "Fish", "base_days": 4, "ref_temp": 1.0, "ref_rh": 90.0, "q10": 3.0, "emoji": "🐟", "storage_advice": "Ultra-perishable. Seal tightly over ice pack at 0–2°C. Prepare within 48h."},
        "tuna": {"display_name": "Fresh Tuna Steak", "category": "Fish", "base_days": 3, "ref_temp": 1.0, "ref_rh": 90.0, "q10": 3.2, "emoji": "🐟", "storage_advice": "Pat dry, wrap in parchment, store on ice tray in coldest section of refrigerator."},
        "shrimp": {"display_name": "Raw Shrimp / Prawns", "category": "Fish", "base_days": 3, "ref_temp": 0.5, "ref_rh": 90.0, "q10": 3.2, "emoji": "🦐", "storage_advice": "Keep on ice in refrigerator; consume within 24–36h or freeze at -18°C."},

        # Bakery
        "bread": {"display_name": "Artisan Bread / Sourdough", "category": "Bakery", "base_days": 6, "ref_temp": 20.0, "ref_rh": 55.0, "q10": 1.8, "emoji": "🍞", "storage_advice": "Room temp in bread box or paper bag. Never refrigerate (stales faster at 4°C). Freeze slices for long storage."},
        "bagel": {"display_name": "Fresh Bagels", "category": "Bakery", "base_days": 5, "ref_temp": 20.0, "ref_rh": 55.0, "q10": 1.8, "emoji": "🥯", "storage_advice": "Room temperature in paper bag for 2 days; slice and freeze thereafter."},
        "croissant": {"display_name": "Croissants & Pastries", "category": "Bakery", "base_days": 4, "ref_temp": 20.0, "ref_rh": 50.0, "q10": 1.9, "emoji": "🥐", "storage_advice": "Keep at room temp in paper bag. Re-crisp in 180°C oven for 3 minutes before serving."},
        "cake": {"display_name": "Sponge & Decorated Cake", "category": "Bakery", "base_days": 5, "ref_temp": 18.0, "ref_rh": 60.0, "q10": 1.9, "emoji": "🍰", "storage_advice": "Keep under cake dome. Refrigerate only if containing fresh cream, custard, or fruit."},

        # Grains
        "oats": {"display_name": "Rolled Oats", "category": "Grains", "base_days": 180, "ref_temp": 20.0, "ref_rh": 45.0, "q10": 1.4, "emoji": "🌾", "storage_advice": "Airtight container in cool, dark pantry away from heat and moisture."},
        "rice": {"display_name": "White & Brown Rice", "category": "Grains", "base_days": 365, "ref_temp": 20.0, "ref_rh": 45.0, "q10": 1.3, "emoji": "🍚", "storage_advice": "Store in sealed food-grade container with oxygen absorber in dry pantry."},
        "pasta": {"display_name": "Dry Semolina Pasta", "category": "Grains", "base_days": 365, "ref_temp": 20.0, "ref_rh": 45.0, "q10": 1.3, "emoji": "🍝", "storage_advice": "Store sealed in dry cupboard away from humidity and direct sunlight."}
    }

    def resolve_commodity(self, food_name: str, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Resolves food item name to commodity kinetics, optimal storage envelope, and baseline shelf life.
        """
        clean_name = (food_name or "").strip().lower()
        if not clean_name:
            cat = category if category and category != "auto" else "Fruits"
            kin = self.CATEGORY_KINETICS.get(cat, self.CATEGORY_KINETICS["Other"])
            return {
                "matched": False,
                "display_name": "Custom Food Item",
                "category": cat,
                "emoji": "🥗",
                "base_days": kin["default_days"],
                "ref_temp": kin["ref_temp"],
                "ref_rh": 75.0,
                "q10": kin["Q10"],
                "storage_advice": f"Store {cat} at recommended temperatures ({kin['ref_temp']}°C) to maximize shelf life."
            }

        # Exact / Substring lookup
        for key, prof in self.COMMODITY_DATABASE.items():
            if key in clean_name or clean_name in key:
                cat = category if category and category != "auto" else prof["category"]
                return {
                    "matched": True,
                    "display_name": prof["display_name"],
                    "category": cat,
                    "emoji": prof["emoji"],
                    "base_days": prof["base_days"],
                    "ref_temp": prof["ref_temp"],
                    "ref_rh": prof["ref_rh"],
                    "q10": prof["q10"],
                    "storage_advice": prof["storage_advice"]
                }

        # Category keyword inference
        cat = category if category and category != "auto" else self._infer_category(clean_name)
        kin = self.CATEGORY_KINETICS.get(cat, self.CATEGORY_KINETICS["Other"])
        return {
            "matched": False,
            "display_name": food_name.strip().title(),
            "category": cat,
            "emoji": self._category_emoji(cat),
            "base_days": kin["default_days"],
            "ref_temp": kin["ref_temp"],
            "ref_rh": 85.0 if cat in ["Fruits", "Vegetables", "Fish"] else 70.0 if cat in ["Dairy", "Meat"] else 50.0,
            "q10": kin["Q10"],
            "storage_advice": f"Store {cat} at recommended temperature ({kin['ref_temp']}°C) to maintain peak freshness."
        }

    def _infer_category(self, text: str) -> str:
        s = text.lower()
        if any(w in s for w in ["fruit", "apple", "berry", "citrus", "orange", "lemon", "lime", "banana", "mango", "grape", "peach", "plum", "pear", "melon", "watermelon", "cherry"]):
            return "Fruits"
        if any(w in s for w in ["veg", "salad", "spinach", "lettuce", "tomato", "potato", "onion", "garlic", "carrot", "broccoli", "cabbage", "cucumber", "pepper", "bean", "pea"]):
            return "Vegetables"
        if any(w in s for w in ["milk", "dairy", "cheese", "yogurt", "butter", "cream", "paneer", "curd", "egg"]):
            return "Dairy"
        if any(w in s for w in ["meat", "chicken", "beef", "pork", "poultry", "mutton", "lamb", "steak", "bacon", "sausage", "ham"]):
            return "Meat"
        if any(w in s for w in ["fish", "salmon", "tuna", "cod", "shrimp", "prawn", "seafood", "crab", "lobster", "tilapia"]):
            return "Fish"
        if any(w in s for w in ["bread", "bakery", "cake", "pastry", "croissant", "muffin", "bagel", "toast", "cookie", "pie"]):
            return "Bakery"
        if any(w in s for w in ["grain", "rice", "wheat", "oat", "flour", "pasta", "noodle", "cereal", "quinoa", "lentil"]):
            return "Grains"
        return "Other"

    def _category_emoji(self, cat: str) -> str:
        emojis = {
            "Fruits": "🍎",
            "Vegetables": "🥦",
            "Dairy": "🧀",
            "Meat": "🥩",
            "Fish": "🐟",
            "Bakery": "🍞",
            "Grains": "🌾",
            "Packaged Food": "📦",
            "Other": "🍽️"
        }
        return emojis.get(cat, "🥗")

    def predict_shelf_life(
        self,
        category: str,
        purchase_date_val: Union[str, date],
        expiry_date_val: Union[str, date],
        storage_temperature: Optional[float] = None,
        storage_humidity: Optional[float] = None,
        packaging_type: str = "Standard Pack",
        current_freshness_score: float = 85.0,
        standard_shelf_life_days: Optional[int] = None,
        food_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculates remaining consumable lifespan using Arrhenius kinetic temperature modeling.
        """
        today = date.today()

        # Parse dates
        if isinstance(purchase_date_val, str):
            try:
                p_date = datetime.strptime(purchase_date_val, "%Y-%m-%d").date()
            except Exception:
                p_date = today
        else:
            p_date = purchase_date_val

        if isinstance(expiry_date_val, str):
            try:
                e_date = datetime.strptime(expiry_date_val, "%Y-%m-%d").date()
            except Exception:
                e_date = today + timedelta(days=7)
        else:
            e_date = expiry_date_val

        commodity_res = self.resolve_commodity(food_name, category) if food_name else None
        if commodity_res and commodity_res.get("matched"):
            kinetics = {
                "Ea": 65.0,
                "Q10": commodity_res["q10"],
                "ref_temp": commodity_res["ref_temp"],
                "default_days": commodity_res["base_days"]
            }
        else:
            kinetics = self.CATEGORY_KINETICS.get(category, self.CATEGORY_KINETICS["Other"])

        pkg_multiplier = self.PACKAGING_FACTORS.get(packaging_type, 1.0)

        # Baseline days
        if standard_shelf_life_days and standard_shelf_life_days > 0:
            base_shelf_life = standard_shelf_life_days
        elif commodity_res and commodity_res.get("base_days") and not standard_shelf_life_days:
            base_shelf_life = commodity_res["base_days"]
        else:
            nominal_total = (e_date - p_date).days
            base_shelf_life = max(1, nominal_total if nominal_total > 0 else kinetics["default_days"])

        # Temperature Factor (Arrhenius / Q10)
        temp = storage_temperature if storage_temperature is not None else kinetics["ref_temp"]
        temp_delta = temp - kinetics["ref_temp"]
        temp_multiplier = math.pow(kinetics["Q10"], temp_delta / 10.0)
        temp_multiplier = max(0.2, min(8.0, temp_multiplier))

        # Humidity Factor
        humidity = storage_humidity if storage_humidity is not None else 65.0
        humidity_penalty = 1.0
        if humidity < 50.0:
            humidity_penalty += (50.0 - humidity) * 0.015
        elif humidity > 90.0:
            humidity_penalty += (humidity - 90.0) * 0.02

        # Daily degradation rate (%/day)
        base_daily_loss = 100.0 / base_shelf_life
        effective_decay_rate = round(base_daily_loss * (temp_multiplier * humidity_penalty / pkg_multiplier), 2)
        effective_decay_rate = max(0.4, effective_decay_rate)

        # Remaining days until score reaches spoilage cutoff (40%)
        points_to_spoilage = max(0.0, current_freshness_score - 40.0)
        predicted_remaining_days = round(points_to_spoilage / effective_decay_rate, 1)

        # Adjusted projected expiry
        adjusted_expiry = today + timedelta(days=math.ceil(predicted_remaining_days))

        # Deviation from nominal expiration
        nominal_days_left = max(0, (e_date - today).days)
        deviation_days = round(predicted_remaining_days - nominal_days_left, 1)

        # Confidence calculation
        confidence = 92.0
        if abs(temp_delta) > 8.0:
            confidence -= 10.0
        if humidity_penalty > 1.2:
            confidence -= 8.0
        confidence = round(max(55.0, min(98.0, confidence)), 1)

        # 7-day projection forecast
        forecast_7d = []
        tracker = current_freshness_score
        for i in range(1, 8):
            future_date = today + timedelta(days=i)
            tracker = max(0.0, round(tracker - effective_decay_rate, 1))

            if tracker >= 75.0:
                risk = "Low"
                status = "Fresh / Peak Quality"
            elif tracker >= 55.0:
                risk = "Moderate"
                status = "Acceptable / Good"
            elif tracker >= 40.0:
                risk = "High"
                status = "Near Spoilage"
            else:
                risk = "Critical"
                status = "Spoiled"

            forecast_7d.append({
                "day_offset": i,
                "date": future_date.isoformat(),
                "projected_freshness_score": tracker,
                "risk_level": risk,
                "status": status,
                "spoilage_probability": round(max(0.0, min(1.0, (100.0 - tracker) / 100.0)), 2)
            })

        stress_level = "High" if temp_multiplier > 1.8 else "Moderate" if temp_multiplier > 1.2 else "Optimal"

        return {
            "predicted_remaining_days": predicted_remaining_days,
            "adjusted_expiry_date": adjusted_expiry.isoformat(),
            "nominal_days_left": nominal_days_left,
            "deviation_from_nominal_days": deviation_days,
            "daily_degradation_rate_pct": effective_decay_rate,
            "temp_acceleration_factor": round(temp_multiplier, 2),
            "packaging_protection_factor": round(pkg_multiplier, 2),
            "confidence_score": confidence,
            "storage_stress_level": stress_level,
            "forecast_7_days": forecast_7d,
            "commodity": commodity_res,
            "food_name": commodity_res["display_name"] if commodity_res else food_name,
            "emoji": commodity_res["emoji"] if commodity_res else self._category_emoji(category),
            "optimal_temp": kinetics["ref_temp"],
            "optimal_rh": commodity_res["ref_rh"] if commodity_res else 85.0,
            "storage_advice": commodity_res["storage_advice"] if commodity_res else None,
        }


shelf_life_predictor = ShelfLifePredictor()
