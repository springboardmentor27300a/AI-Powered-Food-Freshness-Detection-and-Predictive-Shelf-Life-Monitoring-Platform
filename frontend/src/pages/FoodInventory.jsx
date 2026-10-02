import { useEffect, useState } from "react";

import {
  getFoods,
  deleteFood,
} from "../api";


// ============================================================
// FOOD ICON
// ============================================================

function getFoodEmoji(category, foodName) {
  const categoryValue =
    (category || "").trim().toLowerCase();

  const foodValue =
    (foodName || "").trim().toLowerCase();


  // ==========================================================
  // SPECIFIC FOOD ICONS
  // ==========================================================

  const foodIcons = {

    // Fruits
    apple: "🍎",
    banana: "🍌",
    orange: "🍊",
    mango: "🥭",
    guava: "🍏",
    pineapple: "🍍",
    grape: "🍇",
    grapes: "🍇",
    watermelon: "🍉",
    strawberry: "🍓",
    strawberries: "🍓",
    papaya: "🧡",
    pomegranate: "🍎",
    pear: "🍐",
    peach: "🍑",
    cherry: "🍒",
    cherries: "🍒",
    kiwi: "🥝",
    coconut: "🥥",
    lemon: "🍋",
    lime: "🍋",

    // Vegetables
    cucumber: "🥒",
    tomato: "🍅",
    tomatoes: "🍅",
    potato: "🥔",
    potatoes: "🥔",
    carrot: "🥕",
    carrots: "🥕",
    onion: "🧅",
    onions: "🧅",
    cabbage: "🥬",
    broccoli: "🥦",
    spinach: "🥬",
    lettuce: "🥬",
    cauliflower: "🥦",
    peas: "🫛",
    pea: "🫛",
    corn: "🌽",
    capsicum: "🫑",
    pepper: "🌶️",
    chilli: "🌶️",
    chili: "🌶️",
    eggplant: "🍆",
    brinjal: "🍆",
    pumpkin: "🎃",
    beetroot: "🫜",
    radish: "🫜",

    // Dairy
    milk: "🥛",
    cheese: "🧀",
    yogurt: "🥛",
    yoghurt: "🥛",
    curd: "🥛",
    butter: "🧈",

    // Meat
    chicken: "🍗",
    mutton: "🥩",
    beef: "🥩",
    meat: "🥩",

    // Seafood
    fish: "🐟",
    prawn: "🍤",
    prawns: "🍤",
    shrimp: "🍤",
    shrimps: "🍤",

    // Eggs
    egg: "🥚",
    eggs: "🥚",

    // Bakery
    bread: "🍞",
    cake: "🍰",
    cookie: "🍪",
    cookies: "🍪",
    biscuit: "🍪",
    biscuits: "🍪",
    croissant: "🥐",

    // Packaged / Grains
    chips: "🍟",
    popcorn: "🍿",
    cereal: "🥣",
    noodles: "🍜",
    pasta: "🍝",
    rice: "🍚",

    // Beverages
    water: "💧",
    juice: "🧃",
    coffee: "☕",
    tea: "🍵",
    beverage: "🥤",
  };


  // ==========================================================
  // FOOD NAME BASED MATCH
  // ==========================================================

  for (
    const [food, icon] of Object.entries(foodIcons)
  ) {
    if (foodValue.includes(food)) {
      return icon;
    }
  }


  // ==========================================================
  // CATEGORY BASED FALLBACK
  // ==========================================================

  if (categoryValue.includes("fruit")) {
    return "🍎";
  }

  if (categoryValue.includes("vegetable")) {
    return "🥦";
  }

  if (categoryValue.includes("dairy")) {
    return "🥛";
  }

  if (
    categoryValue.includes("meat") ||
    categoryValue.includes("poultry")
  ) {
    return "🥩";
  }

  if (categoryValue.includes("seafood")) {
    return "🐟";
  }

  if (categoryValue.includes("bakery")) {
    return "🥖";
  }

  if (categoryValue.includes("beverage")) {
    return "🥤";
  }

  if (categoryValue.includes("packaged")) {
    return "📦";
  }


  // ==========================================================
  // DEFAULT
  // ==========================================================

  return "🍱";
}


// ============================================================
// CATEGORY CLASS
// ============================================================

function getCategoryClass(category) {
  const value =
    category?.toLowerCase() || "";

  if (value.includes("vegetable")) {
    return "category-vegetable";
  }

  if (value.includes("fruit")) {
    return "category-fruit";
  }

  if (value.includes("dairy")) {
    return "category-dairy";
  }

  if (value.includes("bakery")) {
    return "category-bakery";
  }

  return "";
}


// ============================================================
// FRESHNESS CLASS
// ============================================================

function getFreshnessClass(status) {
  const value =
    status?.toLowerCase() || "";

  if (value === "fresh") {
    return "fresh";
  }

  if (
    value === "expired" ||
    value === "spoiled"
  ) {
    return "expired";
  }

  return "medium";
}


// ============================================================
// SCORE CLASS
// ============================================================

function getScoreClass(score) {
  if (
    score === null ||
    score === undefined
  ) {
    return "medium";
  }

  if (score >= 70) {
    return "fresh";
  }

  if (score >= 40) {
    return "medium";
  }

  return "expired";
}


// ============================================================
// NUMBER FORMATTER
// ============================================================

function formatNumber(value, decimals = 1) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return "—";
  }

  return number.toFixed(decimals);
}


// ============================================================
// FOOD INVENTORY
// ============================================================

function FoodInventory({
  onBack,
  onAddFood,
  onViewReport,
}) {

  const [foods, setFoods] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  // ==========================================================
  // LOAD FOODS
  // ==========================================================

  useEffect(() => {

    const loadFoods = async () => {

      try {

        const data =
          await getFoods();

        setFoods(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (err) {

        setError(
          err?.message ||
            "Failed to load food inventory."
        );

      } finally {

        setLoading(false);

      }
    };


    loadFoods();

  }, []);


  // ==========================================================
  // DELETE FOOD
  // ==========================================================

  const handleDeleteFood = async (
    foodId,
    foodName
  ) => {

    const confirmed =
      window.confirm(
        `Are you sure you want to permanently delete "${foodName}"?`
      );


    if (!confirmed) {
      return;
    }


    try {

      setError("");

      await deleteFood(foodId);


      // Remove immediately from UI
      setFoods((previousFoods) =>
        previousFoods.filter(
          (food) =>
            food.id !== foodId
        )
      );

    } catch (err) {

      setError(
        err?.message ||
          "Failed to delete food."
      );

    }
  };


  // ==========================================================
  // VIEW FOOD REPORT
  // ==========================================================

  const handleViewReport = (food) => {

    if (
      typeof onViewReport ===
      "function"
    ) {
      onViewReport(food);
    }

  };


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="inventory-page">


      {/* =====================================================
          DECORATIVE BACKGROUND
      ===================================================== */}

      <div className="floating-food food-one">
        🍓
      </div>

      <div className="floating-food food-two">
        🥑
      </div>

      <div className="floating-food food-three">
        🍋
      </div>


      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🍏
          </div>

          <div>

            <strong>
              FreshGuard
            </strong>

            <span>
              Food Inventory
            </span>

          </div>

        </div>

      </header>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="inventory-container">


        {/* ===================================================
            BACK BUTTON
        ==================================================== */}

        <button
          className="back-button"
          onClick={onBack}
          type="button"
        >
          ← Back to Dashboard
        </button>


        {/* ===================================================
            PAGE HEADER
        ==================================================== */}

        <div className="inventory-header">

          <div>

            <span className="mini-label">
              YOUR COLLECTION
            </span>

            <h1>
              Food Inventory
            </h1>

            <p>
              All your registered food items
              in one place.
            </p>

          </div>


          <button
            className="primary-button inventory-add-button"
            onClick={onAddFood}
            type="button"
          >
            + Add Food
          </button>

        </div>


        {/* ===================================================
            ERROR
        ==================================================== */}

        {error && (

          <div className="error-box">
            ⚠️ {error}
          </div>

        )}


        {/* ===================================================
            LOADING
        ==================================================== */}

        {loading ? (

          <div className="inventory-loading">

            <div className="loading-fruit">
              🍎
            </div>

            <p>
              Loading your food inventory...
            </p>

          </div>


        ) : foods.length === 0 ? (


          /* =================================================
             EMPTY STATE
          ================================================= */

          <div className="empty-state">

            <div className="empty-food">
              🧺
            </div>

            <h2>
              Your inventory is empty
            </h2>

            <p>
              Add your first food item to start
              monitoring freshness.
            </p>

            <button
              className="primary-button empty-button"
              onClick={onAddFood}
              type="button"
            >
              Add First Food →
            </button>

          </div>


        ) : (


          /* =================================================
             INVENTORY TABLE
          ================================================= */

          <div className="inventory-table-wrapper">

            <table className="inventory-table">

              <thead>

                <tr>

                  <th>
                    Food Item
                  </th>

                  <th>
                    Category
                  </th>

                  <th>
                    Freshness
                  </th>

                  <th>
                    Score
                  </th>

                  <th>
                    Added On
                  </th>

                  <th>
                  </th>

                </tr>

              </thead>


              <tbody>

                {foods.map((food) => {

                  const status =
                    food.freshness_status ||
                    "Pending";


                  const score =
                    food.freshness_score !==
                      null &&
                    food.freshness_score !==
                      undefined
                      ? Number(
                          food.freshness_score
                        )
                      : 0;


                  /*
                   * Category comes directly
                   * from backend/database.
                   *
                   * No default Vegetables.
                   */

                  const category =
                    food.category ||
                    "Other";


                  const freshnessClass =
                    getFreshnessClass(
                      status
                    );


                  const scoreClass =
                    getScoreClass(score);


                  const categoryClass =
                    getCategoryClass(
                      category
                    );


                  // ==================================================
                  // MILESTONE 3 VALUES
                  // ==================================================

                  const remainingShelfLife =
                    food.remaining_shelf_life;

                  const shelfLifeConfidence =
                    food.shelf_life_confidence;

                  const shelfLifeRisk =
                    food.shelf_life_risk;

                  const storageComplianceScore =
                    food.storage_compliance_score;

                  const overallHealthScore =
                    food.overall_health_score;


                  return (

                    <tr
                      key={food.id}
                    >


                      {/* =============================================
                          FOOD
                      ============================================== */}

                      <td>

                        <div className="food-name-cell">

                          <span className="food-icon">

                            {getFoodEmoji(
                              category,
                              food.food_name
                            )}

                          </span>


                          <strong>
                            {food.food_name}
                          </strong>

                        </div>

                      </td>


                      {/* =============================================
                          CATEGORY
                      ============================================== */}

                      <td>

                        <span
                          className={`category-badge ${categoryClass}`}
                        >
                          {category}
                        </span>

                      </td>


                      {/* =============================================
                          FRESHNESS
                      ============================================== */}

                      <td className="freshness-cell">

                        <div className="freshness-info">

                          <span
                            className={`freshness-status ${freshnessClass}`}
                          >
                            {status}
                          </span>


                          <div className="freshness-progress">

                            <div
                              className={`freshness-progress-bar ${freshnessClass}`}
                              style={{
                                width: `${Math.min(
                                  Math.max(
                                    score,
                                    0
                                  ),
                                  100
                                )}%`,
                              }}
                            />

                          </div>


                          <span
                            className={`freshness-percentage ${freshnessClass}`}
                          >
                            {formatNumber(
                              score,
                              2
                            )}%
                          </span>


                          {/* =========================================
                              MILESTONE 3 - SHELF LIFE
                          ========================================== */}

                          <div
                            style={{
                              marginTop: "8px",
                              fontSize: "12px",
                              lineHeight: "1.5",
                            }}
                          >

                            <div>
                              <strong>
                                Shelf Life:
                              </strong>{" "}
                              {formatNumber(
                                remainingShelfLife,
                                1
                              )}{" "}
                              days
                            </div>


                            <div>
                              <strong>
                                Risk:
                              </strong>{" "}
                              {shelfLifeRisk || "—"}
                            </div>


                            <div>
                              <strong>
                                Confidence:
                              </strong>{" "}
                              {formatNumber(
                                shelfLifeConfidence,
                                1
                              )}%
                            </div>

                          </div>

                        </div>

                      </td>


                      {/* =============================================
                          SCORE
                      ============================================== */}

                      <td className="score-cell">

                        <div
                          className={`score-ring ${scoreClass}`}
                          style={{
                            "--score": score,
                          }}
                        >

                          <div className="score-content">

                            <span className="score-number">
                              {formatNumber(
                                score,
                                2
                              )}
                            </span>

                            <span className="score-total">
                              / 100
                            </span>

                          </div>

                        </div>


                        {/* =========================================
                            MILESTONE 3 SCORES
                        ========================================== */}

                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "12px",
                            lineHeight: "1.5",
                            textAlign: "center",
                          }}
                        >

                          <div>
                            <strong>
                              Health:
                            </strong>{" "}
                            {formatNumber(
                              overallHealthScore,
                              1
                            )}
                          </div>


                          <div>
                            <strong>
                              Storage:
                            </strong>{" "}
                            {formatNumber(
                              storageComplianceScore,
                              1
                            )}
                          </div>

                        </div>

                      </td>


                      {/* =============================================
                          DATE
                      ============================================== */}

                      <td>

                        <span className="added-date">

                          {food.created_at
                            ? new Date(
                                food.created_at
                              ).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "—"}

                        </span>

                      </td>


                      {/* =============================================
                          REPORT + DELETE
                      ============================================== */}

                      <td>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                          }}
                        >


                          {/* VIEW REPORT */}

                          <button
                            className="food-menu"
                            type="button"
                            aria-label={`View report for ${food.food_name}`}
                            title="View Report"
                            onClick={() =>
                              handleViewReport(
                                food
                              )
                            }
                          >
                            📊
                          </button>


                          {/* DELETE */}

                          <button
                            className="food-menu"
                            type="button"
                            aria-label={`Delete ${food.food_name}`}
                            title="Delete food"
                            onClick={() =>
                              handleDeleteFood(
                                food.id,
                                food.food_name
                              )
                            }
                          >
                            🗑️
                          </button>

                        </div>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          </div>

        )}

      </main>

    </div>

  );
}


export default FoodInventory;