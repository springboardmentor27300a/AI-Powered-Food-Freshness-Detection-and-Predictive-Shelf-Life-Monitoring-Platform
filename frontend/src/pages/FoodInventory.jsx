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

    <div
      className="inventory-page"
      style={{
        width: "100%",
        minHeight: "100vh",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >

      {/* =====================================================
          RESPONSIVE INVENTORY STYLES
      ===================================================== */}

      <style>
        {`

          .inventory-page {
            width: 100%;
            min-height: 100vh;
            box-sizing: border-box;
          }


          .inventory-page *,
          .inventory-page *::before,
          .inventory-page *::after {
            box-sizing: border-box;
          }


          .inventory-container {
            width: min(
              calc(100% - 40px),
              1400px
            );
            max-width: 1400px;
            margin-left: auto;
            margin-right: auto;
          }


          .inventory-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
          }


          .inventory-header > div {
            min-width: 0;
          }


          .inventory-header h1,
          .inventory-header p {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .inventory-add-button {
            flex-shrink: 0;
            white-space: nowrap;
            touch-action: manipulation;
          }


          .back-button {
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
            touch-action: manipulation;
          }


          .error-box {
            max-width: 100%;
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          /* ==================================================
             TABLE WRAPPER
          ================================================== */

          .inventory-table-wrapper {
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
            overscroll-behavior-x: contain;
          }


          .inventory-table {
            width: 100%;
            min-width: 920px;
            border-collapse: separate;
            border-spacing: 0;
          }


          .inventory-table th,
          .inventory-table td {
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .inventory-table th:first-child,
          .inventory-table td:first-child {
            min-width: 180px;
          }


          .inventory-table th:nth-child(2),
          .inventory-table td:nth-child(2) {
            min-width: 120px;
          }


          .inventory-table th:nth-child(3),
          .inventory-table td:nth-child(3) {
            min-width: 250px;
          }


          .inventory-table th:nth-child(4),
          .inventory-table td:nth-child(4) {
            min-width: 125px;
          }


          .inventory-table th:nth-child(5),
          .inventory-table td:nth-child(5) {
            min-width: 125px;
          }


          .inventory-table th:last-child,
          .inventory-table td:last-child {
            min-width: 105px;
          }


          /* ==================================================
             FOOD NAME
          ================================================== */

          .food-name-cell {
            min-width: 0;
            max-width: 260px;
          }


          .food-name-cell strong {
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .food-icon {
            flex-shrink: 0;
          }


          /* ==================================================
             FRESHNESS
          ================================================== */

          .freshness-cell {
            min-width: 0;
          }


          .freshness-info {
            min-width: 0;
            width: 100%;
          }


          .freshness-progress {
            max-width: 100%;
          }


          .freshness-progress-bar {
            max-width: 100%;
          }


          /* ==================================================
             SCORE
          ================================================== */

          .score-cell {
            min-width: 110px;
          }


          .score-ring {
            flex-shrink: 0;
          }


          /* ==================================================
             ACTION BUTTONS
          ================================================== */

          .inventory-page .food-menu {
            flex: 0 0 auto;
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            touch-action: manipulation;
          }


          /* ==================================================
             LOADING / EMPTY
          ================================================== */

          .inventory-loading,
          .empty-state {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }


          .empty-state p,
          .empty-state h2 {
            overflow-wrap: anywhere;
            word-break: break-word;
          }


          .empty-button {
            max-width: 100%;
            touch-action: manipulation;
          }


          /* ==================================================
             TABLET
          ================================================== */

          @media (max-width: 900px) {

            .inventory-container {
              width: min(
                calc(100% - 32px),
                100%
              );
            }


            .inventory-header {
              gap: 18px;
            }


            .inventory-header h1 {
              font-size: clamp(
                28px,
                5vw,
                42px
              );
            }


            .inventory-header p {
              font-size: 13px;
            }


            .inventory-table {
              min-width: 880px;
            }

          }


          /* ==================================================
             MOBILE
          ================================================== */

          @media (max-width: 700px) {

            .inventory-container {
              width: calc(100% - 24px);
            }


            .inventory-header {
              align-items: stretch;
              flex-direction: column;
              gap: 16px;
            }


            .inventory-add-button {
              width: 100%;
              min-height: 48px;
              justify-content: center;
            }


            .back-button {
              margin-bottom: 18px;
            }


            .inventory-table-wrapper {
              margin-left: 0;
              margin-right: 0;
              border-radius: 14px;
            }


            .inventory-table {
              min-width: 850px;
            }


            .inventory-table th,
            .inventory-table td {
              padding-left: 12px;
              padding-right: 12px;
            }

          }


          /* ==================================================
             SMALL MOBILE
          ================================================== */

          @media (max-width: 520px) {

            .inventory-container {
              width: calc(100% - 20px);
            }


            .inventory-header h1 {
              font-size: 28px;
              line-height: 1.15;
            }


            .inventory-header p {
              font-size: 12px;
              line-height: 1.55;
            }


            .inventory-add-button {
              min-height: 47px;
              font-size: 13px;
            }


            .back-button {
              font-size: 12px;
            }


            .inventory-table {
              min-width: 820px;
            }


            .inventory-table th,
            .inventory-table td {
              padding-top: 12px;
              padding-bottom: 12px;
              font-size: 12px;
            }


            .food-name-cell {
              max-width: 190px;
            }


            .food-name-cell strong {
              font-size: 12px;
            }


            .category-badge {
              font-size: 10px;
              white-space: nowrap;
            }


            .freshness-status {
              font-size: 10px;
            }


            .freshness-percentage {
              font-size: 11px;
            }


            .freshness-info > div[style] {
              font-size: 10px !important;
            }


            .score-cell > div[style] {
              font-size: 10px !important;
            }


            .inventory-page .food-menu {
              width: 38px;
              height: 38px;
              min-width: 38px;
              min-height: 38px;
            }


            .added-date {
              font-size: 11px;
              white-space: nowrap;
            }


            .empty-state {
              padding-left: 16px !important;
              padding-right: 16px !important;
            }


            .empty-state h2 {
              font-size: 21px;
            }


            .empty-state p {
              font-size: 12px;
              line-height: 1.55;
            }


            .empty-button {
              width: 100%;
              min-height: 47px;
            }

          }


          /* ==================================================
             VERY SMALL MOBILE
          ================================================== */

          @media (max-width: 390px) {

            .inventory-container {
              width: calc(100% - 16px);
            }


            .inventory-header h1 {
              font-size: 25px;
            }


            .inventory-header p {
              font-size: 11px;
            }


            .inventory-table {
              min-width: 790px;
            }


            .inventory-table th,
            .inventory-table td {
              padding-left: 10px;
              padding-right: 10px;
              font-size: 11px;
            }


            .food-name-cell {
              max-width: 175px;
            }


            .inventory-page .food-menu {
              width: 36px;
              height: 36px;
              min-width: 36px;
              min-height: 36px;
              font-size: 13px;
            }


            .empty-state h2 {
              font-size: 19px;
            }

          }


          /* ==================================================
             320PX DEVICES
          ================================================== */

          @media (max-width: 340px) {

            .inventory-container {
              width: calc(100% - 12px);
            }


            .inventory-header h1 {
              font-size: 23px;
            }


            .inventory-header p {
              font-size: 10px;
            }


            .inventory-table {
              min-width: 760px;
            }


            .inventory-table th,
            .inventory-table td {
              padding-left: 8px;
              padding-right: 8px;
            }


            .food-name-cell {
              max-width: 155px;
            }


            .inventory-page .food-menu {
              width: 34px;
              height: 34px;
              min-width: 34px;
              min-height: 34px;
            }

          }


          /* ==================================================
             LANDSCAPE MOBILE
          ================================================== */

          @media (orientation: landscape)
            and (max-height: 600px) {

            .inventory-container {
              padding-top: 10px;
              padding-bottom: 20px;
            }


            .inventory-header {
              flex-direction: row;
              align-items: center;
            }


            .inventory-add-button {
              width: auto;
            }


            .inventory-table-wrapper {
              max-height: 70vh;
              overflow: auto;
            }

          }


          /* ==================================================
             REDUCED MOTION
          ================================================== */

          @media (prefers-reduced-motion: reduce) {

            .inventory-page *,
            .inventory-page *::before,
            .inventory-page *::after {
              animation-duration:
                0.01ms !important;

              animation-iteration-count:
                1 !important;

              transition-duration:
                0.01ms !important;

              scroll-behavior:
                auto !important;
            }

          }

        `}
      </style>


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
                            flexWrap: "nowrap",
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