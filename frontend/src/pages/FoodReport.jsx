import { useEffect, useMemo, useState } from "react";
import { API_URL, predictFoodFreshness } from "../api";

// ============================================================
// FOOD ICON
// ============================================================

function getFoodEmoji(category, foodName) {
  const categoryValue =
    (category || "").trim().toLowerCase();

  const foodValue =
    (foodName || "").trim().toLowerCase();

  const foodIcons = {
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

    milk: "🥛",
    cheese: "🧀",
    yogurt: "🥛",
    yoghurt: "🥛",
    curd: "🥛",
    butter: "🧈",

    chicken: "🍗",
    mutton: "🥩",
    beef: "🥩",
    meat: "🥩",

    fish: "🐟",
    prawn: "🍤",
    prawns: "🍤",
    shrimp: "🍤",
    shrimps: "🍤",

    egg: "🥚",
    eggs: "🥚",

    bread: "🍞",
    cake: "🍰",
    cookie: "🍪",
    cookies: "🍪",
    biscuit: "🍪",
    biscuits: "🍪",
    croissant: "🥐",

    chips: "🍟",
    popcorn: "🍿",
    cereal: "🥣",
    noodles: "🍜",
    pasta: "🍝",
    rice: "🍚",

    water: "💧",
    juice: "🧃",
    coffee: "☕",
    tea: "🍵",
    beverage: "🥤",
  };

  for (const [food, icon] of Object.entries(foodIcons)) {
    if (foodValue.includes(food)) {
      return icon;
    }
  }

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

  return "🍱";
}

// ============================================================
// STATUS HELPERS
// ============================================================

function getStatusTheme(status) {
  const value = (status || "").toLowerCase();

  if (value === "fresh") {
    return {
      label: "Fresh",
      icon: "✓",
      className: "fresh",
      message:
        "The AI assessment indicates that this food item is currently in a good freshness condition.",
    };
  }

  if (value === "good") {
    return {
      label: "Good",
      icon: "✓",
      className: "good",
      message:
        "The food item is in good condition with a healthy freshness score.",
    };
  }

  if (value === "acceptable") {
    return {
      label: "Acceptable",
      icon: "◐",
      className: "acceptable",
      message:
        "The item remains acceptable, but freshness should be monitored regularly.",
    };
  }

  if (
    value.includes("near") ||
    value.includes("spoil")
  ) {
    return {
      label: "Near Spoilage",
      icon: "!",
      className: "danger",
      message:
        "Freshness is declining. Consider consuming the item soon and review its storage conditions.",
    };
  }

  if (value === "expired") {
    return {
      label: "Expired",
      icon: "!",
      className: "danger",
      message:
        "This item has reached its expiry date. Do not rely on freshness score alone when making a consumption decision.",
    };
  }

  return {
    label: status || "Pending",
    icon: "◌",
    className: "neutral",
    message:
      "Freshness analysis information is currently limited.",
  };
}

// ============================================================
// DATE HELPERS
// ============================================================

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) {
    return "Not provided";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysBetween(start, end) {
  if (!start || !end) {
    return null;
  }

  const difference =
    end.getTime() - start.getTime();

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

// ============================================================
// SCORE HELPERS
// ============================================================

function clampScore(score) {
  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) {
    return 0;
  }

  return Math.min(
    Math.max(numericScore, 0),
    100
  );
}

function getScoreLabel(score) {
  if (score >= 85) {
    return "Excellent";
  }

  if (score >= 70) {
    return "Healthy";
  }

  if (score >= 50) {
    return "Moderate";
  }

  if (score >= 30) {
    return "At Risk";
  }

  return "Critical";
}

function getScoreDescription(score) {
  if (score >= 85) {
    return "Very strong freshness condition.";
  }

  if (score >= 70) {
    return "Healthy freshness condition with good quality indicators.";
  }

  if (score >= 50) {
    return "Moderate freshness. Continue monitoring the item.";
  }

  if (score >= 30) {
    return "Freshness is declining and attention is recommended.";
  }

  return "High spoilage risk based on the current freshness score.";
}

// ============================================================
// STORAGE PROFILE
// ============================================================

function getStorageProfile(category, foodName) {
  const categoryValue =
    (category || "").trim().toLowerCase();

  const foodValue =
    (foodName || "").trim().toLowerCase();

  if (
    categoryValue.includes("meat") ||
    categoryValue.includes("poultry") ||
    categoryValue.includes("seafood") ||
    foodValue.includes("chicken") ||
    foodValue.includes("mutton") ||
    foodValue.includes("beef") ||
    foodValue.includes("fish") ||
    foodValue.includes("prawn") ||
    foodValue.includes("shrimp")
  ) {
    return {
      temperatureMin: 0,
      temperatureMax: 4,
      humidityMin: 60,
      humidityMax: 85,
      temperatureLabel: "0°C – 4°C",
      humidityLabel: "60% – 85%",
    };
  }

  if (
    categoryValue.includes("dairy") ||
    foodValue.includes("milk") ||
    foodValue.includes("curd") ||
    foodValue.includes("yogurt") ||
    foodValue.includes("cheese") ||
    foodValue.includes("butter")
  ) {
    return {
      temperatureMin: 1,
      temperatureMax: 7,
      humidityMin: 30,
      humidityMax: 70,
      temperatureLabel: "1°C – 7°C",
      humidityLabel: "30% – 70%",
    };
  }

  if (
    categoryValue.includes("fruit") ||
    categoryValue.includes("vegetable")
  ) {
    return {
      temperatureMin: 2,
      temperatureMax: 10,
      humidityMin: 50,
      humidityMax: 90,
      temperatureLabel: "2°C – 10°C",
      humidityLabel: "50% – 90%",
    };
  }

  if (
    categoryValue.includes("bakery")
  ) {
    return {
      temperatureMin: 15,
      temperatureMax: 25,
      humidityMin: 30,
      humidityMax: 70,
      temperatureLabel: "15°C – 25°C",
      humidityLabel: "30% – 70%",
    };
  }

  return {
    temperatureMin: 5,
    temperatureMax: 25,
    humidityMin: 30,
    humidityMax: 70,
    temperatureLabel: "5°C – 25°C",
    humidityLabel: "30% – 70%",
  };
}

// ============================================================
// NUMBER HELPERS
// ============================================================

function numericValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return null;
  }

  return number;
}

function formatNumber(value, decimals = 1) {
  const number = numericValue(value);

  if (number === null) {
    return "Not available";
  }

  return number.toFixed(decimals);
}

// ============================================================
// RECOMMENDATION TONE
// ============================================================

function getRecommendationTone(type) {
  if (type === "danger") {
    return {
      background: "#fff5f3",
      border: "#ffdcd6",
      iconBackground: "#ffe7e2",
      iconColor: "#bd4538",
      icon: "⚠️",
    };
  }

  if (type === "warning") {
    return {
      background: "#fffaf0",
      border: "#f4e7bd",
      iconBackground: "#fff1cb",
      iconColor: "#a36b00",
      icon: "!",
    };
  }

  if (type === "info") {
    return {
      background: "#f4f9ff",
      border: "#dbe9fa",
      iconBackground: "#e8f2ff",
      iconColor: "#3978b8",
      icon: "ℹ️",
    };
  }

  return {
    background: "#f2fff7",
    border: "#d8f1e2",
    iconBackground: "#e4faed",
    iconColor: "#078b43",
    icon: "✓",
  };
}

// ============================================================
// DEEP RECOMMENDATION ENGINE - FRONTEND PRESENTATION LAYER
// ============================================================

function buildDeepRecommendations(
  food,
  report,
  prediction
) {
  const storageProfile =
    getStorageProfile(
      report.category,
      food?.food_name
    );

  const intelligence =
    prediction?.storage_intelligence ||
    prediction?.recommendation_engine?.storage_intelligence ||
    {};

  const temperature =
    numericValue(
      food?.storage_temperature ??
        prediction?.storage_temperature ??
        intelligence?.storage_temperature
    );

  const humidity =
    numericValue(
      food?.storage_humidity ??
        prediction?.storage_humidity ??
        intelligence?.storage_humidity
    );

  const duration =
    numericValue(
      food?.storage_duration ??
        prediction?.storage_duration ??
        intelligence?.storage_duration
    );

  const packaging =
    food?.packaging_type ??
    prediction?.packaging_type ??
    intelligence?.packaging_type ??
    "";

  const circulation =
    food?.air_circulation ??
    prediction?.air_circulation ??
    intelligence?.air_circulation ??
    "";

  const light =
    food?.light_exposure ??
    prediction?.light_exposure ??
    intelligence?.light_exposure ??
    "";

  const temperatureStatus =
    prediction?.storage_temperature_advice ||
    intelligence?.temperature_status ||
    "";

  const humidityStatus =
    prediction?.storage_humidity_advice ||
    intelligence?.humidity_status ||
    "";

  const packagingStatus =
    intelligence?.packaging_status ||
    "";

  const circulationStatus =
    intelligence?.air_circulation_status ||
    "";

  const lightStatus =
    intelligence?.light_exposure_status ||
    "";

  const durationStatus =
    intelligence?.storage_duration_status ||
    "";

  const temperatureOut =
    temperature !== null &&
    (
      temperature <
        storageProfile.temperatureMin ||
      temperature >
        storageProfile.temperatureMax
    );

  const humidityOut =
    humidity !== null &&
    (
      humidity <
        storageProfile.humidityMin ||
      humidity >
        storageProfile.humidityMax
    );

  const cards = [];

  if (temperature === null) {
    cards.push({
      title: "Temperature",
      icon: "🌡️",
      type: "info",
      value:
        `Recommended ${storageProfile.temperatureLabel}`,
      detail:
        `Current temperature is not recorded. For ${food?.food_name || "this item"}, keep the storage temperature within ${storageProfile.temperatureLabel}.`,
      meta:
        `Target range: ${storageProfile.temperatureLabel}`,
    });
  } else if (temperatureOut) {
    cards.push({
      title: "Temperature",
      icon: "🌡️",
      type: "danger",
      value:
        `${formatNumber(temperature)}°C • Outside range`,
      detail:
        `Current temperature is ${formatNumber(temperature)}°C, while the analysis target for this food is ${storageProfile.temperatureLabel}. ${temperatureStatus}`,
      meta:
        `Recommended: ${storageProfile.temperatureLabel}`,
    });
  } else {
    cards.push({
      title: "Temperature",
      icon: "🌡️",
      type: "success",
      value:
        `${formatNumber(temperature)}°C • Within range`,
      detail:
        `Current temperature is within the analysis target for this food. Continue maintaining a stable ${storageProfile.temperatureLabel} range.`,
      meta:
        `Recommended: ${storageProfile.temperatureLabel}`,
    });
  }

  if (humidity === null) {
    cards.push({
      title: "Humidity",
      icon: "💧",
      type: "info",
      value:
        `Recommended ${storageProfile.humidityLabel}`,
      detail:
        `Humidity has not been recorded. The analysis target for this food category is ${storageProfile.humidityLabel}.`,
      meta:
        `Target range: ${storageProfile.humidityLabel}`,
    });
  } else if (humidityOut) {
    cards.push({
      title: "Humidity",
      icon: "💧",
      type: "warning",
      value:
        `${formatNumber(humidity)}% • Outside range`,
      detail:
        `Current humidity is ${formatNumber(humidity)}%, compared with the analysis target of ${storageProfile.humidityLabel}. ${humidityStatus}`,
      meta:
        `Recommended: ${storageProfile.humidityLabel}`,
    });
  } else {
    cards.push({
      title: "Humidity",
      icon: "💧",
      type: "success",
      value:
        `${formatNumber(humidity)}% • Within range`,
      detail:
        `Current humidity is inside the expected range. Continue controlling moisture and condensation around the food.`,
      meta:
        `Recommended: ${storageProfile.humidityLabel}`,
    });
  }

  if (packaging) {
    const packagingText =
      String(packaging).toLowerCase();

    const protective =
      /sealed|airtight|vacuum|container|covered|reusable/.test(
        packagingText
      );

    cards.push({
      title: "Packaging",
      icon: "📦",
      type: protective
        ? "success"
        : "warning",
      value:
        String(packaging),
      detail: protective
        ? `${packagingStatus || "Protective packaging is detected."} Continue keeping the item covered and protected from contamination and moisture exposure.`
        : `${packagingStatus || "The selected packaging may provide limited protection."} Consider sealed, covered or food-safe protective packaging where appropriate.`,
      meta:
        protective
          ? "Protective packaging"
          : "Packaging improvement suggested",
    });
  } else {
    cards.push({
      title: "Packaging",
      icon: "📦",
      type: "warning",
      value: "Not recorded",
      detail:
        "Packaging information is missing. Use suitable sealed or covered food-safe packaging where appropriate.",
      meta:
        "Packaging data required for stronger analysis",
    });
  }

  if (duration !== null) {
    const durationRisk =
      durationStatus.toLowerCase().includes("exceed") ||
      durationStatus.toLowerCase().includes("close");

    cards.push({
      title: "Storage Duration",
      icon: "⏱️",
      type: durationRisk
        ? "warning"
        : "success",
      value:
        `${formatNumber(duration)} days`,
      detail:
        durationStatus ||
        "Storage duration is being considered against the estimated shelf-life profile.",
      meta:
        "Duration is part of storage compliance",
    });
  } else {
    cards.push({
      title: "Storage Duration",
      icon: "⏱️",
      type: "info",
      value: "Not recorded",
      detail:
        "Enter storage duration during food registration for more precise shelf-life and storage-risk analysis.",
      meta:
        "More data improves recommendation precision",
    });
  }

  if (circulation) {
    const circulationText =
      String(circulation).toLowerCase();

    const poor =
      /poor|low|none|blocked/.test(
        circulationText
      );

    cards.push({
      title: "Air Circulation",
      icon: "🌬️",
      type: poor
        ? "warning"
        : "success",
      value:
        String(circulation),
      detail:
        circulationStatus ||
        (
          poor
            ? "Improve ventilation around the stored food."
            : "Air circulation appears suitable."
        ),
      meta:
        poor
          ? "Ventilation improvement suggested"
          : "Suitable circulation",
    });
  } else {
    cards.push({
      title: "Air Circulation",
      icon: "🌬️",
      type: "info",
      value: "Not recorded",
      detail:
        "Record air circulation quality to improve storage-condition analysis.",
      meta:
        "Good circulation helps maintain stable storage conditions",
    });
  }

  if (light) {
    const lightText =
      String(light).toLowerCase();

    const highLight =
      /direct|high|sunlight/.test(
        lightText
      );

    cards.push({
      title: "Light Exposure",
      icon: "☀️",
      type: highLight
        ? "warning"
        : "success",
      value:
        String(light),
      detail:
        lightStatus ||
        (
          highLight
            ? "Reduce direct or excessive light exposure."
            : "Light exposure is not showing a major storage concern."
        ),
      meta:
        highLight
          ? "Reduce light exposure"
          : "Suitable light condition",
    });
  } else {
    cards.push({
      title: "Light Exposure",
      icon: "☀️",
      type: "info",
      value: "Not recorded",
      detail:
        "Record light exposure to improve the environmental-risk analysis.",
      meta:
        "Environmental factor",
    });
  }

  const remaining =
    numericValue(
      report.storedRemainingShelfLife
    ) ??
    numericValue(
      report.remainingShelfLife
    );

  const shelfRisk =
    report.shelfLifeRisk ||
    prediction?.shelf_life_risk ||
    "";

  if (remaining !== null) {
    let shelfType = "success";

    if (
      remaining <= 0 ||
      /critical|expired/i.test(
        shelfRisk
      )
    ) {
      shelfType = "danger";
    } else if (
      remaining <= 5 ||
      /high|moderate/i.test(
        shelfRisk
      )
    ) {
      shelfType = "warning";
    }

    cards.push({
      title: "Shelf Life",
      icon: "⏳",
      type: shelfType,
      value:
        remaining >= 0
          ? `${formatNumber(remaining)} days remaining`
          : "Expired",
      detail:
        remaining <= 0
          ? "The estimated remaining shelf-life has reached its limit. Follow the application's food-safety guidance and verify the expiry condition."
          : `Estimated remaining shelf-life is ${formatNumber(remaining)} days. Prioritize monitoring as this window decreases.`,
      meta:
        `Risk: ${shelfRisk || "Not available"}`,
    });
  }

  const visualAnalysis =
    prediction?.image_analysis ||
    prediction?.analysis ||
    prediction?.visual_analysis ||
    {};

  const visualScore =
    numericValue(
      visualAnalysis?.overall_visual_score
    ) ??
    numericValue(
      visualAnalysis?.visual_condition_score
    ) ??
    numericValue(
      visualAnalysis?.overall_score
    );

  if (visualScore !== null) {
    const visualDanger =
      visualScore < 50;

    const visualWarning =
      visualScore < 75;

    cards.push({
      title: "Visual AI",
      icon: "👁️",
      type: visualDanger
        ? "danger"
        : visualWarning
        ? "warning"
        : "success",
      value:
        `${formatNumber(visualScore)} / 100`,
      detail:
        visualDanger
          ? "The visual analysis indicates significant visible quality concerns. Increase inspection frequency and review the image findings before consumption."
          : visualWarning
          ? "The visual analysis shows some quality indicators that should be monitored closely."
          : "The visual analysis indicates a comparatively healthy visible condition. Continue periodic inspection.",
      meta:
        "Colour • Texture • Spoilage indicators",
    });
  }

  const consumption =
    prediction?.consumption_recommendations?.[0] ||
    prediction?.recommendation_engine
      ?.consumption_recommendations?.[0];

  cards.push({
    title: "Consumption",
    icon: "🍽️",
    type:
      remaining !== null &&
      remaining <= 2
        ? "danger"
        : "info",
    value:
      remaining !== null &&
      remaining <= 2
        ? "Prioritize soon"
        : "Monitor freshness",
    detail:
      consumption ||
      (
        remaining !== null &&
        remaining <= 5
          ? "Prioritize this item before the remaining shelf-life decreases further."
          : "Continue monitoring freshness, storage conditions and expiry information."
      ),
    meta:
      "Based on freshness + shelf-life",
  });

  const rotation =
    prediction?.inventory_rotation_recommendations?.[0] ||
    prediction?.recommendation_engine
      ?.inventory_rotation_recommendations?.[0];

  cards.push({
    title: "FEFO Rotation",
    icon: "🔄",
    type:
      remaining !== null &&
      remaining <= 5
        ? "warning"
        : "success",
    value:
      remaining !== null &&
      remaining <= 5
        ? "High priority"
        : "Normal rotation",
    detail:
      rotation ||
      (
        remaining !== null &&
        remaining <= 5
          ? "Move this item toward the front and prioritize it using First Expire, First Out."
          : "Maintain normal FEFO rotation and prioritize products with earlier expiry dates."
      ),
    meta:
      report.expiryDate
        ? `Expiry: ${formatDate(
            report.expiryDate
          )}`
        : "Expiry date not available",
  });

  const waste =
    prediction?.waste_reduction_recommendations?.[0] ||
    prediction?.recommendation_engine
      ?.waste_reduction_recommendations?.[0];

  cards.push({
    title: "Waste Reduction",
    icon: "♻️",
    type:
      remaining !== null &&
      remaining <= 5
        ? "warning"
        : "success",
    value:
      "Reduce avoidable loss",
    detail:
      waste ||
      (
        remaining !== null &&
        remaining <= 5
          ? "Prioritize consumption or appropriate processing before further quality loss occurs."
          : "Continue condition monitoring and FEFO-based inventory rotation to reduce unnecessary waste."
      ),
    meta:
      "Shelf-life + storage driven",
  });

  const quality =
    prediction?.quality_improvement_recommendations?.[0] ||
    prediction?.recommendation_engine
      ?.quality_improvement_recommendations?.[0];

  const overallHealth =
    numericValue(
      report.overallHealthScore
    );

  cards.push({
    title: "Quality Monitoring",
    icon: "🛡️",
    type:
      overallHealth !== null &&
      overallHealth < 60
        ? "danger"
        : overallHealth !== null &&
          overallHealth < 75
        ? "warning"
        : "success",
    value:
      overallHealth !== null
        ? `${formatNumber(
            overallHealth
          )} / 100`
        : "Monitor",
    detail:
      quality ||
      (
        overallHealth !== null &&
        overallHealth < 60
          ? "Increase inspection frequency because the combined health indicators require closer monitoring."
          : "Maintain current handling practices and continue periodic visual inspection."
      ),
    meta:
      "Overall health + visual evidence",
  });

  return {
    cards,
    summary:
      prediction?.recommendation_summary ||
      prediction?.recommendation_engine
        ?.recommendation_summary ||
      `AI recommendations generated for ${
        food?.food_name || "this food item"
      } using freshness, storage and shelf-life indicators.`,
    priority:
      prediction?.recommendation_priority ||
      prediction?.recommendation_engine
        ?.recommendation_priority ||
      "Low",
  };
}

// ============================================================
// FOOD REPORT
// ============================================================

function FoodReport({
  food,
  onBack,
}) {
  // ==========================================================
  // REPORT DATA
  // ==========================================================

  const report = useMemo(() => {
    const score =
      clampScore(
        food?.freshness_score
      );

    const status =
      food?.freshness_status ||
      "Pending";

    const category =
      food?.category ||
      "Other";

    const manufacturingDate =
      parseDate(
        food?.manufacturing_date
      );

    const expiryDate =
      parseDate(
        food?.expiry_date
      );

    const createdDate =
      parseDate(
        food?.created_at
      );

    const today = new Date();

    const totalShelfLife =
      manufacturingDate &&
      expiryDate
        ? getDaysBetween(
            manufacturingDate,
            expiryDate
          )
        : null;

    const remainingShelfLife =
      expiryDate
        ? getDaysBetween(
            today,
            expiryDate
          )
        : null;

    const elapsedAge =
      manufacturingDate
        ? getDaysBetween(
            manufacturingDate,
            today
          )
        : null;

    let shelfLifePercentage =
      null;

    if (
      totalShelfLife !== null &&
      totalShelfLife > 0 &&
      remainingShelfLife !== null
    ) {
      shelfLifePercentage =
        Math.min(
          Math.max(
            (
              remainingShelfLife /
              totalShelfLife
            ) * 100,
            0
          ),
          100
        );
    }

    return {
      score,
      status,
      category,
      manufacturingDate,
      expiryDate,
      createdDate,
      totalShelfLife,
      remainingShelfLife,
      elapsedAge,
      shelfLifePercentage,

      storedRemainingShelfLife:
        food?.remaining_shelf_life,

      shelfLifeConfidence:
        food?.shelf_life_confidence,

      shelfLifeRisk:
        food?.shelf_life_risk,

      storageComplianceScore:
        food?.storage_compliance_score,

      overallHealthScore:
        food?.overall_health_score,
    };
  }, [food]);

  const statusTheme =
    getStatusTheme(
      report.status
    );

  const scoreLabel =
    getScoreLabel(
      report.score
    );

  const scoreDescription =
    getScoreDescription(
      report.score
    );

  // ==========================================================
  // LIVE VISUAL + DEEP AI ANALYSIS
  // ==========================================================

  const [visualPrediction, setVisualPrediction] =
    useState(null);

  const [visualAnalysisLoading, setVisualAnalysisLoading] =
    useState(false);

  const [visualAnalysisError, setVisualAnalysisError] =
    useState("");

  useEffect(() => {
    let active = true;

    const runVisualAnalysis = async () => {
      if (
        !food?.food_name ||
        !food?.image_path
      ) {
        if (active) {
          setVisualPrediction(null);
          setVisualAnalysisLoading(false);

          setVisualAnalysisError(
            "Food image is not available for visual analysis."
          );
        }

        return;
      }

      setVisualAnalysisLoading(true);
      setVisualAnalysisError("");

      try {
        const result =
          await predictFoodFreshness(
            food.food_name,
            food.image_path,
            food.category || null,
            food.storage_temperature ??
              null,
            food.storage_humidity ??
              null,
            food.packaging_type ??
              null,
            food.storage_duration ??
              null,
            food.air_circulation ??
              null,
            food.light_exposure ??
              null,
            food.manufacturing_date ||
              null,
            food.expiry_date ||
              null
          );

        if (active) {
          setVisualPrediction(
            result
          );
        }
      } catch (error) {
        console.error(
          "Visual/deep AI analysis failed:",
          error
        );

        if (active) {
          setVisualAnalysisError(
            error?.message ||
              "AI visual and storage analysis could not be completed."
          );
        }
      } finally {
        if (active) {
          setVisualAnalysisLoading(
            false
          );
        }
      }
    };

    runVisualAnalysis();

    return () => {
      active = false;
    };
  }, [
    food?.food_name,
    food?.image_path,
    food?.category,
    food?.storage_temperature,
    food?.storage_humidity,
    food?.packaging_type,
    food?.storage_duration,
    food?.air_circulation,
    food?.light_exposure,
    food?.manufacturing_date,
    food?.expiry_date,
  ]);

  // ==========================================================
  // DEEP RECOMMENDATIONS
  // ==========================================================

  const deepRecommendations =
    useMemo(() => {
      return buildDeepRecommendations(
        food,
        report,
        visualPrediction
      );
    }, [
      food,
      report,
      visualPrediction,
    ]);

  // ==========================================================
  // SAFE GUARD
  // ==========================================================

  if (!food) {
    return (
      <div
        className="food-report-safe-page"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg,#effff5,#ffffff,#f7fff4)",
          padding: "30px",
          boxSizing: "border-box",
        }}
      >
        <style>{`
          .food-report-safe-page {
            overflow-x: hidden;
          }

          .food-report-safe-card {
            width: min(100%, 520px);
            box-sizing: border-box;
          }

          @media (max-width: 520px) {
            .food-report-safe-page {
              padding: 16px !important;
            }

            .food-report-safe-card {
              padding: 30px 20px !important;
              border-radius: 22px !important;
            }

            .food-report-safe-card h2 {
              font-size: 22px !important;
            }

            .food-report-safe-card p {
              font-size: 13px !important;
              line-height: 1.55 !important;
            }

            .food-report-safe-card button {
              width: 100%;
              min-height: 46px;
            }
          }

          @media (max-width: 360px) {
            .food-report-safe-card {
              padding: 25px 16px !important;
            }
          }
        `}</style>

        <div
          className="food-report-safe-card"
          style={{
            background: "#ffffff",
            borderRadius: "28px",
            padding: "50px",
            textAlign: "center",
            boxShadow:
              "0 20px 60px rgba(0,80,40,0.10)",
          }}
        >
          <div
            style={{
              fontSize: "56px",
              marginBottom: "15px",
            }}
          >
            📊
          </div>

          <h2>
            Food report unavailable
          </h2>

          <p>
            No food item was selected
            for analysis.
          </p>

          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: "20px",
              padding:
                "13px 24px",
              border: "none",
              borderRadius: "12px",
              background:
                "#08a94f",
              color: "#fff",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            ← Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN REPORT UI
  // ==========================================================

  return (
    <div
      className="food-report-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 8% 10%, rgba(113,230,160,0.22), transparent 25%), radial-gradient(circle at 92% 15%, rgba(255,226,132,0.18), transparent 24%), linear-gradient(135deg,#f4fff8 0%,#ffffff 48%,#f4fff7 100%)",
        padding:
          "28px 5vw 70px",
        color: "#073b27",
        fontFamily:
          "inherit",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <style>{`
        /* =====================================================
           FOOD REPORT - COMPLETE RESPONSIVE SYSTEM
           Existing inline design is preserved.
           Responsive rules only adjust layout/spacing/sizing.
           ===================================================== */

        .food-report-page,
        .food-report-page *,
        .food-report-page *::before,
        .food-report-page *::after {
          box-sizing: border-box;
        }

        .food-report-page {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .food-report-page img {
          max-width: 100%;
        }

        .food-report-page button {
          font: inherit;
        }

        .food-report-page p,
        .food-report-page h1,
        .food-report-page h2,
        .food-report-page h3 {
          overflow-wrap: anywhere;
        }

        /* Main max-width containers */
        .food-report-page > section,
        .food-report-page > div {
          max-width: 1250px;
        }

        /* =====================================================
           DESKTOP / LARGE DESKTOP
           ===================================================== */

        @media (min-width: 1440px) {
          .food-report-page {
            padding-left: 48px !important;
            padding-right: 48px !important;
          }
        }

        /* =====================================================
           TABLET
           ===================================================== */

        @media (max-width: 1100px) {
          .food-report-page {
            padding:
              24px 24px 60px !important;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] {
            grid-template-columns:
              minmax(0, 1fr) 220px !important;
            gap: 24px !important;
          }

          .food-report-page [style*="grid-template-columns: 1.15fr 0.85fr"] {
            grid-template-columns:
              minmax(0, 1fr) !important;
          }

          .food-report-page [style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }

          .food-report-page [style*="repeat(5,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(3, minmax(0, 1fr)) !important;
          }

          .food-report-page [style*="minmax(310px, 0.95fr) minmax(0, 1.7fr)"] {
            grid-template-columns:
              minmax(280px, 0.8fr)
              minmax(0, 1.2fr) !important;
          }

          .food-report-page [style*="repeat(4,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        /* =====================================================
           900px
           ===================================================== */

        @media (max-width: 900px) {
          .food-report-page {
            padding:
              20px 18px 55px !important;
          }

          .food-report-page > div[style*="max-width: 1250px"],
          .food-report-page > section[style*="max-width: 1250px"] {
            width: 100%;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] {
            grid-template-columns:
              1fr !important;
            text-align: center;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] > div:first-child {
            width: 100%;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] > div:first-child > div:nth-child(2) {
            justify-content: center;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] > div:first-child > div:nth-child(3) {
            justify-content: center;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] > div:last-child {
            margin: 0 auto;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] [style*="width: 220px"] {
            width: 190px !important;
            height: 190px !important;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] [style*="width: 176px"] {
            width: 152px !important;
            height: 152px !important;
          }

          .food-report-page [style*="grid-template-columns: 1fr 270px"] [style*="font-size: 48px"] {
            font-size: 40px !important;
          }

          .food-report-page [style*="grid-template-columns: 1.15fr 0.85fr"] {
            grid-template-columns:
              1fr !important;
          }

          .food-report-page [style*="minmax(310px, 0.95fr) minmax(0, 1.7fr)"] {
            grid-template-columns:
              1fr !important;
          }

          .food-report-page [style*="min-height: 520px"] {
            min-height: 420px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 420px !important;
          }

          .food-report-page [style*="repeat(5,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(3, minmax(0, 1fr)) !important;
          }

          .food-report-page [style*="repeat(4,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        /* =====================================================
           MOBILE - 700px
           ===================================================== */

        @media (max-width: 700px) {
          .food-report-page {
            padding:
              14px 12px 42px !important;
          }

          .food-report-page > div:first-child {
            margin-bottom: 16px !important;
          }

          /* Top navigation */
          .food-report-page > div:first-child {
            gap: 10px !important;
          }

          .food-report-page > div:first-child button {
            padding:
              10px 13px !important;
            font-size: 12px !important;
            white-space: normal !important;
          }

          .food-report-page > div:first-child > div {
            font-size: 10px !important;
            letter-spacing: 1px !important;
            text-align: right;
          }

          /* Main hero */
          .food-report-page > section {
            border-radius:
              22px !important;
          }

          .food-report-page [style*="padding: 34px 38px"] {
            padding:
              24px 20px !important;
          }

          .food-report-page h1 {
            font-size:
              clamp(28px, 8vw, 38px) !important;
          }

          .food-report-page h2 {
            font-size:
              21px !important;
          }

          .food-report-page h3 {
            font-size:
              19px !important;
          }

          .food-report-page [style*="width: 78px"] {
            width: 62px !important;
            height: 62px !important;
            font-size: 34px !important;
            border-radius: 17px !important;
            flex-shrink: 0 !important;
          }

          /* All major multi-column layouts */
          .food-report-page [style*="grid-template-columns: 1.15fr 0.85fr"],
          .food-report-page [style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns:
              1fr !important;
          }

          /* Four overview cards */
          .food-report-page [style*="repeat(4,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }

          /* AI intelligence cards */
          .food-report-page [style*="repeat(5,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }

          /* Visual analysis cards */
          .food-report-page [style*="repeat(2,minmax(0,1fr))"] {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }

          /* Section cards */
          .food-report-page [style*="padding: 28px"] {
            padding:
              21px !important;
          }

          .food-report-page [style*="padding: 30px"] {
            padding:
              21px !important;
          }

          /* Score circle */
          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 175px !important;
            height: 175px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 140px !important;
            height: 140px !important;
          }

          /* Avoid text squeezing */
          .food-report-page [style*="display: flex"] {
            max-width: 100%;
          }

          /* Recommendation header */
          .food-report-page [style*="white-space: nowrap"] {
            white-space: normal !important;
          }

          /* Visual image */
          .food-report-page [style*="min-height: 520px"] {
            min-height: 350px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 350px !important;
          }

          /* Long recommendation area */
          .food-report-page [style*="max-height: 640px"] {
            max-height: none !important;
            overflow-y: visible !important;
          }

          /* Footer */
          .food-report-page > section:last-child {
            padding:
              18px !important;
          }
        }

        /* =====================================================
           560px
           ===================================================== */

        @media (max-width: 560px) {
          .food-report-page {
            padding:
              10px 9px 35px !important;
          }

          .food-report-page > div:first-child {
            align-items:
              flex-start !important;
          }

          .food-report-page > div:first-child button {
            min-height: 42px;
            max-width: 62%;
          }

          .food-report-page > div:first-child > div {
            max-width: 38%;
          }

          .food-report-page [style*="padding: 34px 38px"] {
            padding:
              21px 16px !important;
          }

          .food-report-page [style*="padding: 28px"],
          .food-report-page [style*="padding: 30px"] {
            padding:
              17px !important;
          }

          .food-report-page [style*="width: 78px"] {
            width: 56px !important;
            height: 56px !important;
            font-size: 30px !important;
          }

          .food-report-page [style*="gap: 18px"] {
            gap: 12px !important;
          }

          .food-report-page [style*="repeat(4,minmax(0,1fr))"],
          .food-report-page [style*="repeat(5,minmax(0,1fr))"] {
            grid-template-columns:
              1fr !important;
          }

          .food-report-page [style*="repeat(2,minmax(0,1fr))"] {
            grid-template-columns:
              1fr !important;
          }

          /* Make overview cards compact */
          .food-report-page [style*="min-height: 125px"] {
            min-height: auto !important;
          }

          /* Score */
          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 155px !important;
            height: 155px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 123px !important;
            height: 123px !important;
          }

          .food-report-page [style*="font-size: 48px"] {
            font-size: 34px !important;
          }

          /* Hero information */
          .food-report-page [style*="font-size: 16px"] {
            font-size: 13px !important;
          }

          /* Visual image */
          .food-report-page [style*="min-height: 520px"] {
            min-height: 290px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 290px !important;
          }

          /* Footer */
          .food-report-page > section:last-child > div:last-child {
            width: 100%;
            line-height: 1.5;
          }
        }

        /* =====================================================
           430px
           ===================================================== */

        @media (max-width: 430px) {
          .food-report-page {
            padding:
              8px 7px 30px !important;
          }

          .food-report-page > div:first-child {
            gap: 7px !important;
          }

          .food-report-page > div:first-child button {
            padding:
              9px 10px !important;
            font-size:
              11px !important;
          }

          .food-report-page > div:first-child > div {
            font-size:
              8px !important;
            letter-spacing:
              .7px !important;
          }

          .food-report-page [style*="padding: 34px 38px"] {
            padding:
              18px 13px !important;
          }

          .food-report-page [style*="padding: 28px"],
          .food-report-page [style*="padding: 30px"] {
            padding:
              15px !important;
          }

          .food-report-page [style*="width: 78px"] {
            width: 50px !important;
            height: 50px !important;
            font-size: 27px !important;
            border-radius: 14px !important;
          }

          .food-report-page h1 {
            font-size:
              27px !important;
            letter-spacing:
              -0.8px !important;
          }

          .food-report-page h2 {
            font-size:
              19px !important;
          }

          .food-report-page h3 {
            font-size:
              17px !important;
          }

          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 140px !important;
            height: 140px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 112px !important;
            height: 112px !important;
          }

          .food-report-page [style*="font-size: 48px"] {
            font-size: 31px !important;
          }

          .food-report-page [style*="min-height: 520px"] {
            min-height: 250px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 250px !important;
          }

          .food-report-page [style*="padding: 17px"] {
            padding: 13px !important;
          }

          .food-report-page [style*="padding: 16px"] {
            padding: 13px !important;
          }

          .food-report-page [style*="padding: 20px"] {
            padding: 15px !important;
          }
        }

        /* =====================================================
           390px
           ===================================================== */

        @media (max-width: 390px) {
          .food-report-page {
            padding:
              7px 6px 26px !important;
          }

          .food-report-page > div:first-child button {
            font-size:
              10px !important;
            padding:
              8px 9px !important;
          }

          .food-report-page > div:first-child > div {
            font-size:
              7px !important;
          }

          .food-report-page [style*="padding: 34px 38px"] {
            padding:
              16px 11px !important;
          }

          .food-report-page [style*="width: 78px"] {
            width: 46px !important;
            height: 46px !important;
            font-size: 24px !important;
          }

          .food-report-page h1 {
            font-size:
              24px !important;
          }

          .food-report-page h2 {
            font-size:
              18px !important;
          }

          .food-report-page p {
            font-size:
              11px !important;
          }

          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 125px !important;
            height: 125px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 100px !important;
            height: 100px !important;
          }

          .food-report-page [style*="font-size: 48px"] {
            font-size: 27px !important;
          }

          .food-report-page [style*="min-height: 520px"] {
            min-height: 225px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 225px !important;
          }
        }

        /* =====================================================
           360px
           ===================================================== */

        @media (max-width: 360px) {
          .food-report-page {
            padding:
              6px 5px 24px !important;
          }

          .food-report-page > div:first-child button {
            max-width:
              70%;
            font-size:
              9px !important;
          }

          .food-report-page > div:first-child > div {
            display:
              none;
          }

          .food-report-page [style*="padding: 34px 38px"] {
            padding:
              14px 9px !important;
          }

          .food-report-page [style*="padding: 28px"],
          .food-report-page [style*="padding: 30px"] {
            padding:
              13px !important;
          }

          .food-report-page [style*="width: 78px"] {
            width: 42px !important;
            height: 42px !important;
            font-size: 22px !important;
          }

          .food-report-page h1 {
            font-size:
              22px !important;
          }

          .food-report-page h2 {
            font-size:
              17px !important;
          }

          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 112px !important;
            height: 112px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 90px !important;
            height: 90px !important;
          }

          .food-report-page [style*="font-size: 48px"] {
            font-size: 24px !important;
          }

          .food-report-page [style*="min-height: 520px"] {
            min-height: 200px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 200px !important;
          }
        }

        /* =====================================================
           340px - EXTRA SMALL DEVICES
           ===================================================== */

        @media (max-width: 340px) {
          .food-report-page {
            padding:
              5px 4px 20px !important;
          }

          .food-report-page > div:first-child button {
            padding:
              7px 8px !important;
            font-size:
              8px !important;
          }

          .food-report-page [style*="padding: 34px 38px"] {
            padding:
              12px 8px !important;
          }

          .food-report-page [style*="width: 78px"] {
            width: 38px !important;
            height: 38px !important;
            font-size: 19px !important;
          }

          .food-report-page h1 {
            font-size:
              20px !important;
          }

          .food-report-page h2 {
            font-size:
              16px !important;
          }

          .food-report-page h3 {
            font-size:
              15px !important;
          }

          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 100px !important;
            height: 100px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 80px !important;
            height: 80px !important;
          }

          .food-report-page [style*="font-size: 48px"] {
            font-size: 21px !important;
          }

          .food-report-page [style*="min-height: 520px"] {
            min-height: 180px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 180px !important;
          }
        }

        /* =====================================================
           LANDSCAPE MOBILE
           ===================================================== */

        @media (max-width: 900px) and (orientation: landscape) and (max-height: 600px) {
          .food-report-page {
            padding:
              12px 18px 35px !important;
          }

          .food-report-page [style*="width: 220px"][style*="height: 220px"] {
            width: 150px !important;
            height: 150px !important;
          }

          .food-report-page [style*="width: 176px"][style*="height: 176px"] {
            width: 120px !important;
            height: 120px !important;
          }

          .food-report-page [style*="min-height: 520px"] {
            min-height: 280px !important;
          }

          .food-report-page img[alt*="visual analysis"] {
            min-height: 280px !important;
          }
        }

        /* =====================================================
           TOUCH DEVICES
           ===================================================== */

        @media (hover: none) and (pointer: coarse) {
          .food-report-page button {
            min-height: 44px;
          }

          .food-report-page button,
          .food-report-page [role="button"] {
            -webkit-tap-highlight-color:
              transparent;
          }

          .food-report-page img {
            -webkit-user-drag: none;
          }
        }

        /* =====================================================
           REDUCED MOTION
           ===================================================== */

        @media (prefers-reduced-motion: reduce) {
          .food-report-page *,
          .food-report-page *::before,
          .food-report-page *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* =====================================================
          TOP NAV
      ===================================================== */}

      <div
        style={{
          maxWidth: "1250px",
          margin:
            "0 auto 28px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "20px",
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border: "none",
            background:
              "rgba(255,255,255,0.78)",
            padding:
              "11px 18px",
            borderRadius: "12px",
            color: "#078b43",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow:
              "0 8px 24px rgba(0,80,40,0.07)",
          }}
        >
          ← Back to Inventory
        </button>

        <div
          style={{
            fontSize: "13px",
            fontWeight: "800",
            letterSpacing:
              "2px",
            color: "#08a94f",
          }}
        >
          AI FRESHNESS REPORT
        </div>
      </div>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section
        style={{
          maxWidth: "1250px",
          margin: "0 auto",
          borderRadius: "32px",
          padding:
            "34px 38px",
          background:
            "linear-gradient(135deg,rgba(255,255,255,0.97),rgba(239,255,246,0.96))",
          border:
            "1px solid rgba(8,169,79,0.13)",
          boxShadow:
            "0 25px 70px rgba(0,70,35,0.10)",
          position: "relative",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background:
              "rgba(39,210,111,0.08)",
            right: "-80px",
            top: "-110px",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns:
              "1fr 270px",
            gap: "35px",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
                gap: "8px",
                padding:
                  "7px 12px",
                borderRadius:
                  "30px",
                background:
                  "rgba(8,169,79,0.09)",
                color: "#078b43",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing:
                  "1.5px",
                marginBottom:
                  "16px",
                maxWidth: "100%",
              }}
            >
              <span>✦</span>
              FRESHNESS INTELLIGENCE
            </div>

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "18px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: "78px",
                  height: "78px",
                  borderRadius:
                    "22px",
                  background:
                    "linear-gradient(145deg,#eafff2,#d7f9e6)",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: "45px",
                  boxShadow:
                    "0 12px 30px rgba(8,169,79,0.10)",
                  flexShrink: 0,
                }}
              >
                {getFoodEmoji(
                  report.category,
                  food.food_name
                )}
              </div>

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize:
                      "clamp(30px,4vw,48px)",
                    lineHeight: 1.05,
                    letterSpacing:
                      "-1.5px",
                    color:
                      "#063b27",
                  }}
                >
                  {food.food_name}
                </h1>

                <p
                  style={{
                    margin:
                      "10px 0 0",
                    color:
                      "#698078",
                    fontSize:
                      "16px",
                  }}
                >
                  {report.category}
                  {" • "}
                  Added{" "}
                  {formatDate(
                    report.createdDate
                  )}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap:
                  "wrap",
                gap: "10px",
                marginTop:
                  "22px",
              }}
            >
              <span
                style={{
                  padding:
                    "9px 14px",
                  borderRadius:
                    "999px",
                  background:
                    "rgba(8,169,79,0.09)",
                  color:
                    "#078b43",
                  fontWeight:
                    "700",
                  fontSize:
                    "13px",
                }}
              >
                ●{" "}
                {statusTheme.label}
              </span>

              <span
                style={{
                  padding:
                    "9px 14px",
                  borderRadius:
                    "999px",
                  background:
                    "#f3f7f5",
                  color:
                    "#5c7068",
                  fontWeight:
                    "700",
                  fontSize:
                    "13px",
                  maxWidth: "100%",
                  overflowWrap:
                    "anywhere",
                }}
              >
                Category:{" "}
                {report.category}
              </span>

              {food.storage_condition && (
                <span
                  style={{
                    padding:
                      "9px 14px",
                    borderRadius:
                      "999px",
                    background:
                      "#f3f7f5",
                    color:
                      "#5c7068",
                    fontWeight:
                      "700",
                    fontSize:
                      "13px",
                    maxWidth: "100%",
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  ❄{" "}
                  {
                    food.storage_condition
                  }
                </span>
              )}
            </div>
          </div>

          {/* SCORE */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
            }}
          >
            <div
              style={{
                width: "220px",
                height: "220px",
                borderRadius:
                  "50%",
                background:
                  `conic-gradient(#08a94f ${report.score * 3.6}deg, #e6f2eb 0deg)`,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                boxShadow:
                  "0 20px 45px rgba(8,169,79,0.15)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "176px",
                  height: "176px",
                  borderRadius:
                    "50%",
                  background:
                    "#ffffff",
                  display: "flex",
                  flexDirection:
                    "column",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  boxShadow:
                    "inset 0 0 0 1px rgba(8,169,79,0.06)",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "48px",
                    fontWeight:
                      "850",
                    color:
                      "#073b27",
                    lineHeight: 1,
                  }}
                >
                  {report.score}
                </span>

                <span
                  style={{
                    marginTop:
                      "5px",
                    color:
                      "#7b8e86",
                    fontSize:
                      "13px",
                    fontWeight:
                      "700",
                  }}
                >
                  / 100
                </span>

                <span
                  style={{
                    marginTop:
                      "8px",
                    color:
                      "#08a94f",
                    fontSize:
                      "12px",
                    fontWeight:
                      "800",
                  }}
                >
                  {scoreLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ANALYSIS OVERVIEW
      ===================================================== */}

      <section
        style={{
          maxWidth: "1250px",
          margin:
            "25px auto 0",
          display: "grid",
          gridTemplateColumns:
            "repeat(4,minmax(0,1fr))",
          gap: "15px",
          width: "100%",
        }}
      >
        {[
          {
            icon: "🧠",
            title: "AI Score",
            value:
              `${report.score}/100`,
            description:
              scoreDescription,
          },
          {
            icon: "🥬",
            title: "Quality",
            value:
              statusTheme.label,
            description:
              "Current freshness classification.",
          },
          {
            icon: "⏳",
            title: "Shelf Life",
            value:
              report.remainingShelfLife !==
              null
                ? report.remainingShelfLife >=
                  0
                  ? `${report.remainingShelfLife} days`
                  : "Expired"
                : "—",
            description:
              "Estimated time relative to expiry date.",
          },
          {
            icon: "❄️",
            title: "Storage",
            value:
              food.storage_condition ||
              "Not recorded",
            description:
              "Registered storage condition.",
          },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              background:
                "rgba(255,255,255,0.92)",
              border:
                "1px solid rgba(8,169,79,0.09)",
              borderRadius:
                "22px",
              padding:
                "20px",
              boxShadow:
                "0 12px 35px rgba(0,70,35,0.06)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize:
                  "25px",
              }}
            >
              {item.icon}
            </div>

            <div
              style={{
                marginTop:
                  "13px",
                color:
                  "#70827b",
                fontSize:
                  "12px",
                fontWeight:
                  "800",
                textTransform:
                  "uppercase",
                letterSpacing:
                  "1px",
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#063b27",
                fontSize:
                  "21px",
                fontWeight:
                  "800",
                overflowWrap:
                  "anywhere",
              }}
            >
              {item.value}
            </div>

            <p
              style={{
                margin:
                  "7px 0 0",
                color:
                  "#81918b",
                fontSize:
                  "12px",
                lineHeight:
                  1.5,
              }}
            >
              {item.description}
            </p>
          </div>
        ))}
      </section>

      {/* =====================================================
          MAIN ANALYTICS GRID
      ===================================================== */}

      <section
        style={{
          maxWidth: "1250px",
          margin:
            "25px auto 0",
          display: "grid",
          gridTemplateColumns:
            "1.15fr 0.85fr",
          gap: "20px",
          width: "100%",
        }}
      >
        {/* FRESHNESS ANALYSIS */}

        <div
          style={{
            background:
              "#ffffff",
            borderRadius:
              "26px",
            padding:
              "28px",
            border:
              "1px solid rgba(8,169,79,0.09)",
            boxShadow:
              "0 15px 45px rgba(0,70,35,0.06)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              gap: "15px",
            }}
          >
            <div
              style={{
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize:
                    "11px",
                  fontWeight:
                    "850",
                  color:
                    "#08a94f",
                  letterSpacing:
                    "1.5px",
                }}
              >
                FRESHNESS ASSESSMENT
              </span>

              <h2
                style={{
                  margin:
                    "7px 0 0",
                  color:
                    "#073b27",
                  fontSize:
                    "25px",
                }}
              >
                Quality intelligence
              </h2>
            </div>

            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius:
                  "14px",
                background:
                  "#edfff4",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize:
                  "22px",
                flexShrink: 0,
              }}
            >
              ✦
            </div>
          </div>

          <div
            style={{
              marginTop:
                "25px",
              padding:
                "22px",
              borderRadius:
                "20px",
              background:
                "linear-gradient(135deg,#f4fff8,#ffffff)",
              border:
                "1px solid #e6f4eb",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "15px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "13px",
                    color:
                      "#7a8c85",
                    fontWeight:
                      "700",
                  }}
                >
                  Current freshness score
                </div>

                <div
                  style={{
                    marginTop:
                      "5px",
                    fontSize:
                      "34px",
                    fontWeight:
                      "850",
                    color:
                      "#073b27",
                  }}
                >
                  {report.score}

                  <span
                    style={{
                      fontSize:
                        "15px",
                      color:
                        "#91a19a",
                    }}
                  >
                    {" "}
                    / 100
                  </span>
                </div>
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                <div
                  style={{
                    color:
                      "#08a94f",
                    fontWeight:
                      "850",
                  }}
                >
                  {scoreLabel}
                </div>

                <div
                  style={{
                    color:
                      "#81918b",
                    fontSize:
                      "12px",
                    marginTop:
                      "4px",
                  }}
                >
                  AI assessment
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop:
                  "18px",
                height:
                  "11px",
                borderRadius:
                  "999px",
                background:
                  "#e8f2ec",
                overflow:
                  "hidden",
              }}
            >
              <div
                style={{
                  height:
                    "100%",
                  width:
                    `${report.score}%`,
                  borderRadius:
                    "999px",
                  background:
                    "linear-gradient(90deg,#13bd61,#08a94f)",
                  transition:
                    "width 0.5s ease",
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop:
                "20px",
              display:
                "grid",
              gap:
                "10px",
            }}
          >
            {[
              {
                name:
                  "Visual Condition Analysis",
                weight:
                  "40%",
                icon:
                  "👁️",
              },
              {
                name:
                  "Storage Conditions",
                weight:
                  "25%",
                icon:
                  "❄️",
              },
              {
                name:
                  "Shelf-Life Prediction",
                weight:
                  "20%",
                icon:
                  "⏳",
              },
              {
                name:
                  "Product Age",
                weight:
                  "15%",
                icon:
                  "📅",
              },
            ].map(
              (factor) => (
                <div
                  key={
                    factor.name
                  }
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "12px",
                    padding:
                      "12px 14px",
                    borderRadius:
                      "14px",
                    background:
                      "#fafdfb",
                    border:
                      "1px solid #edf4ef",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width:
                        "35px",
                      height:
                        "35px",
                      borderRadius:
                        "10px",
                      background:
                        "#edfff4",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      flexShrink: 0,
                    }}
                  >
                    {factor.icon}
                  </span>

                  <span
                    style={{
                      flex:
                        1,
                      minWidth:
                        0,
                      fontSize:
                        "13px",
                      fontWeight:
                        "700",
                      color:
                        "#41584e",
                      overflowWrap:
                        "anywhere",
                    }}
                  >
                    {factor.name}
                  </span>

                  <strong
                    style={{
                      color:
                        "#08a94f",
                      fontSize:
                        "13px",
                      flexShrink: 0,
                    }}
                  >
                    {factor.weight}
                  </strong>
                </div>
              )
            )}
          </div>
        </div>

        {/* ===================================================
            AI INSIGHT + DEEP RECOMMENDATIONS
        =================================================== */}

        <div
          style={{
            display:
              "flex",
            flexDirection:
              "column",
            gap:
              "20px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(145deg,#063b27,#0a583b)",
              color:
                "#ffffff",
              borderRadius:
                "26px",
              padding:
                "28px",
              boxShadow:
                "0 18px 45px rgba(0,70,35,0.16)",
            }}
          >
            <span
              style={{
                fontSize:
                  "11px",
                fontWeight:
                  "850",
                letterSpacing:
                  "1.5px",
                opacity:
                  0.75,
              }}
            >
              AI INSIGHT
            </span>

            <div
              style={{
                marginTop:
                  "20px",
                width:
                  "58px",
                height:
                  "58px",
                borderRadius:
                  "18px",
                background:
                  "rgba(255,255,255,0.12)",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize:
                  "28px",
              }}
            >
              {statusTheme.icon}
            </div>

            <h2
              style={{
                margin:
                  "18px 0 8px",
                fontSize:
                  "24px",
              }}
            >
              {statusTheme.label}
            </h2>

            <p
              style={{
                margin: 0,
                lineHeight:
                  1.65,
                color:
                  "rgba(255,255,255,0.76)",
                fontSize:
                  "13px",
              }}
            >
              {statusTheme.message}
            </p>
          </div>

          {/* =================================================
              SMART RECOMMENDATIONS
          ================================================= */}

          <div
            style={{
              background:
                "#ffffff",
              borderRadius:
                "26px",
              padding:
                "25px",
              border:
                "1px solid rgba(8,169,79,0.09)",
              boxShadow:
                "0 15px 45px rgba(0,70,35,0.06)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap:
                  "15px",
                flexWrap:
                  "wrap",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontSize:
                      "11px",
                    fontWeight:
                      "850",
                    color:
                      "#08a94f",
                    letterSpacing:
                      "1.5px",
                  }}
                >
                  SMART RECOMMENDATIONS
                </span>

                <h3
                  style={{
                    margin:
                      "10px 0 7px",
                    color:
                      "#073b27",
                    fontSize:
                      "22px",
                  }}
                >
                  Freshness action plan
                </h3>

                <p
                  style={{
                    margin: 0,
                    color:
                      "#71827b",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.6,
                  }}
                >
                  Recommendations are generated from the current
                  freshness score, shelf-life, storage parameters
                  and visual inspection results.
                </p>
              </div>

              <div
                style={{
                  padding:
                    "8px 12px",
                  borderRadius:
                    "999px",
                  background:
                    deepRecommendations.priority ===
                    "Critical"
                      ? "#fff0ee"
                      : deepRecommendations.priority ===
                        "High"
                      ? "#fff8e8"
                      : "#edfff4",
                  color:
                    deepRecommendations.priority ===
                    "Critical"
                      ? "#b63c31"
                      : deepRecommendations.priority ===
                        "High"
                      ? "#a36b00"
                      : "#078b43",
                  fontSize:
                    "11px",
                  fontWeight:
                    "850",
                  whiteSpace:
                    "nowrap",
                }}
              >
                {deepRecommendations.priority} Priority
              </div>
            </div>

            <div
              style={{
                marginTop:
                  "18px",
                padding:
                  "14px 16px",
                borderRadius:
                  "15px",
                background:
                  "#f4fff8",
                border:
                  "1px solid #dcefe4",
                color:
                  "#476257",
                fontSize:
                  "12px",
                lineHeight:
                  1.55,
              }}
            >
              <strong
                style={{
                  color:
                    "#073b27",
                }}
              >
                AI Summary:
              </strong>{" "}
              {deepRecommendations.summary}
            </div>

            <div
              style={{
                marginTop:
                  "18px",
                display:
                  "grid",
                gap:
                  "10px",
                maxHeight:
                  "640px",
                overflowY:
                  "auto",
                paddingRight:
                  "2px",
              }}
            >
              {deepRecommendations.cards.map(
                (item, index) => {
                  const tone =
                    getRecommendationTone(
                      item.type
                    );

                  return (
                    <div
                      key={`${item.title}-${index}`}
                      style={{
                        padding:
                          "14px",
                        borderRadius:
                          "16px",
                        background:
                          tone.background,
                        border:
                          `1px solid ${tone.border}`,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "flex-start",
                          gap:
                            "12px",
                        }}
                      >
                        <div
                          style={{
                            width:
                              "42px",
                            height:
                              "42px",
                            borderRadius:
                              "13px",
                            background:
                              tone.iconBackground,
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize:
                              "20px",
                            flexShrink:
                              0,
                          }}
                        >
                          {item.icon}
                        </div>

                        <div
                          style={{
                            flex:
                              1,
                            minWidth:
                              0,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "space-between",
                              gap:
                                "10px",
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  "#073b27",
                                fontSize:
                                  "13px",
                                minWidth: 0,
                              }}
                            >
                              {item.title}
                            </strong>

                            <span
                              style={{
                                width:
                                  "24px",
                                height:
                                  "24px",
                                borderRadius:
                                  "50%",
                                background:
                                  "rgba(255,255,255,.8)",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                color:
                                  tone.iconColor,
                                fontSize:
                                  "12px",
                                fontWeight:
                                  "900",
                                flexShrink: 0,
                              }}
                            >
                              {tone.icon}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop:
                                "4px",
                              color:
                                tone.iconColor,
                              fontSize:
                                "13px",
                              fontWeight:
                                "800",
                              overflowWrap:
                                "anywhere",
                            }}
                          >
                            {item.value}
                          </div>

                          <p
                            style={{
                              margin:
                                "5px 0 0",
                              color:
                                "#71827b",
                              fontSize:
                                "11px",
                              lineHeight:
                                1.5,
                            }}
                          >
                            {item.detail}
                          </p>

                          <div
                            style={{
                              marginTop:
                                "7px",
                              color:
                                "#91a09a",
                              fontSize:
                                "10px",
                              fontWeight:
                                "700",
                            }}
                          >
                            {item.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          SHELF LIFE + STORAGE
      ===================================================== */}

      <section
        style={{
          maxWidth: "1250px",
          margin:
            "20px auto 0",
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "20px",
          width: "100%",
        }}
      >
        {/* SHELF LIFE */}

        <div
          style={{
            background:
              "#ffffff",
            borderRadius:
              "26px",
            padding:
              "28px",
            border:
              "1px solid rgba(8,169,79,0.09)",
            boxShadow:
              "0 15px 45px rgba(0,70,35,0.06)",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize:
                "11px",
              fontWeight:
                "850",
              color:
                "#08a94f",
              letterSpacing:
                "1.5px",
            }}
          >
            SHELF-LIFE ANALYSIS
          </span>

          <h2
            style={{
              margin:
                "8px 0 22px",
              color:
                "#073b27",
              fontSize:
                "24px",
            }}
          >
            Expiry intelligence
          </h2>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap:
                "12px",
            }}
          >
            <div
              style={{
                padding:
                  "16px",
                borderRadius:
                  "16px",
                background:
                  "#f8fcf9",
              }}
            >
              <span
                style={{
                  color:
                    "#84938d",
                  fontSize:
                    "11px",
                  fontWeight:
                    "800",
                }}
              >
                MANUFACTURING DATE
              </span>

              <strong
                style={{
                  display:
                    "block",
                  marginTop:
                    "6px",
                  color:
                    "#073b27",
                  overflowWrap:
                    "anywhere",
                }}
              >
                {formatDate(
                  report.manufacturingDate
                )}
              </strong>
            </div>

            <div
              style={{
                padding:
                  "16px",
                borderRadius:
                  "16px",
                background:
                  "#f8fcf9",
              }}
            >
              <span
                style={{
                  color:
                    "#84938d",
                  fontSize:
                    "11px",
                  fontWeight:
                    "800",
                }}
              >
                EXPIRY DATE
              </span>

              <strong
                style={{
                  display:
                    "block",
                  marginTop:
                    "6px",
                  color:
                    "#073b27",
                  overflowWrap:
                    "anywhere",
                }}
              >
                {formatDate(
                  report.expiryDate
                )}
              </strong>
            </div>
          </div>

          <div
            style={{
              marginTop:
                "18px",
              padding:
                "20px",
              borderRadius:
                "18px",
              background:
                "linear-gradient(135deg,#f0fff6,#fbfffc)",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "12px",
                flexWrap:
                  "wrap",
              }}
            >
              <span
                style={{
                  color:
                    "#61756b",
                  fontSize:
                    "13px",
                  fontWeight:
                    "700",
                }}
              >
                Remaining shelf life
              </span>

              <strong
                style={{
                  color:
                    report.remainingShelfLife !==
                      null &&
                    report.remainingShelfLife <
                      0
                      ? "#d94a4a"
                      : "#08a94f",
                  fontSize:
                    "20px",
                  overflowWrap:
                    "anywhere",
                }}
              >
                {report.remainingShelfLife !==
                null
                  ? report.remainingShelfLife >=
                    0
                    ? `${report.remainingShelfLife} days`
                    : "Expired"
                  : "Not available"}
              </strong>
            </div>

            {report.shelfLifePercentage !==
              null && (
              <div
                style={{
                  marginTop:
                    "14px",
                  height:
                    "9px",
                  borderRadius:
                    "999px",
                  background:
                    "#dfeee5",
                  overflow:
                    "hidden",
                }}
              >
                <div
                  style={{
                    height:
                      "100%",
                    width:
                      `${report.shelfLifePercentage}%`,
                    borderRadius:
                      "999px",
                    background:
                      "linear-gradient(90deg,#18bd63,#08a94f)",
                  }}
                />
              </div>
            )}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                gap: "10px",
                marginTop:
                  "9px",
                color:
                  "#8a9993",
                fontSize:
                  "11px",
                flexWrap:
                  "wrap",
              }}
            >
              <span>
                Product age:{" "}
                {report.elapsedAge !==
                null
                  ? `${Math.max(
                      report.elapsedAge,
                      0
                    )} days`
                  : "—"}
              </span>

              <span>
                Total shelf life:{" "}
                {report.totalShelfLife !==
                null
                  ? `${Math.max(
                      report.totalShelfLife,
                      0
                    )} days`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* STORAGE */}

        <div
          style={{
            background:
              "#ffffff",
            borderRadius:
              "26px",
            padding:
              "28px",
            border:
              "1px solid rgba(8,169,79,0.09)",
            boxShadow:
              "0 15px 45px rgba(0,70,35,0.06)",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize:
                "11px",
              fontWeight:
                "850",
              color:
                "#08a94f",
              letterSpacing:
                "1.5px",
            }}
          >
            STORAGE MONITORING
          </span>

          <h2
            style={{
              margin:
                "8px 0 22px",
              color:
                "#073b27",
              fontSize:
                "24px",
            }}
          >
            Storage intelligence
          </h2>

          <div
            style={{
              display:
                "grid",
              gap:
                "12px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "14px",
                padding:
                  "17px",
                borderRadius:
                  "17px",
                background:
                  "#f8fcf9",
              }}
            >
              <div
                style={{
                  width:
                    "45px",
                  height:
                    "45px",
                  borderRadius:
                    "13px",
                  background:
                    "#eafff2",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize:
                    "22px",
                  flexShrink: 0,
                }}
              >
                ❄️
              </div>

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize:
                      "11px",
                    fontWeight:
                      "800",
                    color:
                      "#82928b",
                  }}
                >
                  STORAGE CONDITION
                </div>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      "4px",
                    color:
                      "#073b27",
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  {food.storage_condition ||
                    "Not recorded"}
                </strong>
              </div>
            </div>

            {/* STORAGE PARAMETERS */}

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap:
                  "10px",
              }}
            >
              {[
                {
                  title:
                    "Temperature",
                  value:
                    food.storage_temperature !==
                    null &&
                    food.storage_temperature !==
                      undefined
                      ? `${food.storage_temperature}°C`
                      : "Not recorded",
                  icon:
                    "🌡️",
                },
                {
                  title:
                    "Humidity",
                  value:
                    food.storage_humidity !==
                    null &&
                    food.storage_humidity !==
                      undefined
                      ? `${food.storage_humidity}%`
                      : "Not recorded",
                  icon:
                    "💧",
                },
                {
                  title:
                    "Packaging",
                  value:
                    food.packaging_type ||
                    "Not recorded",
                  icon:
                    "📦",
                },
                {
                  title:
                    "Duration",
                  value:
                    food.storage_duration !==
                    null &&
                    food.storage_duration !==
                      undefined
                      ? `${food.storage_duration} days`
                      : "Not recorded",
                  icon:
                    "⏱️",
                },
                {
                  title:
                    "Air",
                  value:
                    food.air_circulation ||
                    "Not recorded",
                  icon:
                    "🌬️",
                },
                {
                  title:
                    "Light",
                  value:
                    food.light_exposure ||
                    "Not recorded",
                  icon:
                    "☀️",
                },
              ].map(
                (item) => (
                  <div
                    key={
                      item.title
                    }
                    style={{
                      padding:
                        "14px",
                      borderRadius:
                        "15px",
                      background:
                        "#f8fcf9",
                      border:
                        "1px solid #e7f3eb",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        gap:
                          "8px",
                        alignItems:
                          "center",
                      }}
                    >
                      <span>
                        {item.icon}
                      </span>

                      <span
                        style={{
                          color:
                            "#82928b",
                          fontSize:
                            "10px",
                          fontWeight:
                            "850",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {item.title}
                      </span>
                    </div>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "6px",
                        color:
                          "#073b27",
                        fontSize:
                          "12px",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {item.value}
                    </strong>
                  </div>
                )
              )}
            </div>

            <div
              style={{
                padding:
                  "18px",
                borderRadius:
                  "17px",
                background:
                  "linear-gradient(135deg,#f5fff8,#ffffff)",
                border:
                  "1px solid #e7f3eb",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  alignItems:
                    "flex-start",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "20px",
                    flexShrink: 0,
                  }}
                >
                  🤖
                </span>

                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <strong
                    style={{
                      color:
                        "#073b27",
                      fontSize:
                        "14px",
                    }}
                  >
                    AI storage assessment
                  </strong>

                  <p
                    style={{
                      margin:
                        "6px 0 0",
                      color:
                        "#71827b",
                      fontSize:
                        "12px",
                      lineHeight:
                        1.55,
                    }}
                  >
                    {visualPrediction?.storage_compliance_status ||
                      visualPrediction?.recommendation_summary ||
                      "Storage parameters are being evaluated using temperature, humidity, packaging, duration, air circulation and light exposure."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          AI FRESHNESS INTELLIGENCE
      ===================================================== */}

      <section
        style={{
          maxWidth:
            "1250px",
          margin:
            "20px auto 0",
          background:
            "#ffffff",
          borderRadius:
            "26px",
          padding:
            "28px",
          border:
            "1px solid rgba(8,169,79,0.09)",
          boxShadow:
            "0 15px 45px rgba(0,70,35,0.06)",
          width: "100%",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap:
              "15px",
            flexWrap:
              "wrap",
          }}
        >
          <div
            style={{
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize:
                  "11px",
                fontWeight:
                  "850",
                color:
                  "#08a94f",
                letterSpacing:
                  "1.5px",
              }}
            >
              AI FRESHNESS INTELLIGENCE
            </span>

            <h2
              style={{
                margin:
                  "8px 0 6px",
                color:
                  "#073b27",
                fontSize:
                  "24px",
              }}
            >
              Prediction insights
            </h2>

            <p
              style={{
                margin: 0,
                color:
                  "#71827b",
                fontSize:
                  "12px",
                lineHeight:
                  1.55,
              }}
            >
              Stored Milestone-3 prediction results combined with
              the live food image and storage assessment.
            </p>
          </div>

          <div
            style={{
              padding:
                "9px 14px",
              borderRadius:
                "999px",
              background:
                "#edfff4",
              color:
                "#078b43",
              fontSize:
                "12px",
              fontWeight:
                "800",
              flexShrink: 0,
            }}
          >
            ✦ AI Prediction
          </div>
        </div>

        <div
          style={{
            marginTop:
              "20px",
            display:
              "grid",
            gridTemplateColumns:
              "repeat(5,minmax(0,1fr))",
            gap:
              "12px",
          }}
        >
          {[
            {
              title:
                "Remaining Shelf Life",
              value:
                report.storedRemainingShelfLife !==
                  null &&
                report.storedRemainingShelfLife !==
                  undefined
                  ? `${Number(
                      report.storedRemainingShelfLife
                    ).toFixed(1)} days`
                  : "Not available",
              icon:
                "⏳",
            },
            {
              title:
                "Shelf-Life Confidence",
              value:
                report.shelfLifeConfidence !==
                  null &&
                report.shelfLifeConfidence !==
                  undefined
                  ? `${Number(
                      report.shelfLifeConfidence
                    ).toFixed(1)}%`
                  : "Not available",
              icon:
                "🎯",
            },
            {
              title:
                "Shelf-Life Risk",
              value:
                report.shelfLifeRisk ||
                "Not available",
              icon:
                "⚠️",
            },
            {
              title:
                "Storage Compliance",
              value:
                report.storageComplianceScore !==
                  null &&
                report.storageComplianceScore !==
                  undefined
                  ? `${Number(
                      report.storageComplianceScore
                    ).toFixed(1)}/100`
                  : "Not available",
              icon:
                "❄️",
            },
            {
              title:
                "Overall Health Score",
              value:
                report.overallHealthScore !==
                  null &&
                report.overallHealthScore !==
                  undefined
                  ? `${Number(
                      report.overallHealthScore
                    ).toFixed(1)}/100`
                  : "Not available",
              icon:
                "💚",
            },
          ].map(
            (item) => (
              <div
                key={
                  item.title
                }
                style={{
                  padding:
                    "17px",
                  borderRadius:
                    "18px",
                  background:
                    "#f8fcf9",
                  border:
                    "1px solid #e7f3eb",
                  minHeight:
                    "125px",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize:
                      "23px",
                  }}
                >
                  {item.icon}
                </div>

                <div
                  style={{
                    marginTop:
                      "11px",
                    color:
                      "#82928b",
                    fontSize:
                      "10px",
                    fontWeight:
                      "850",
                    letterSpacing:
                      ".7px",
                    textTransform:
                      "uppercase",
                  }}
                >
                  {item.title}
                </div>

                <div
                  style={{
                    marginTop:
                      "6px",
                    color:
                      "#073b27",
                    fontSize:
                      "17px",
                    fontWeight:
                      "850",
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  {item.value}
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================================
          AI IMAGE ANALYSIS
      ===================================================== */}

      {(() => {
        const fallbackAnalysis =
          food?.image_analysis ||
          food?.analysis ||
          food?.visual_analysis ||
          {};

        const liveAnalysis =
          visualPrediction?.image_analysis ||
          visualPrediction?.analysis ||
          visualPrediction?.visual_analysis ||
          {};

        const analysis = {
          ...fallbackAnalysis,
          ...liveAnalysis,
        };

        const originalImagePath =
          visualPrediction?.image_path ||
          food?.image_path ||
          analysis?.original_image_path ||
          null;

        const annotatedImagePath =
          analysis?.image_url ||
          analysis?.annotated_image_url ||
          null;

        const imagePath =
          annotatedImagePath ||
          originalImagePath;

        const apiBase = API_URL;

        const toImageUrl = (
          path
        ) => {
          if (!path) {
            return null;
          }

          const value =
            String(path);

          if (
            value.startsWith(
              "http://"
            ) ||
            value.startsWith(
              "https://"
            ) ||
            value.startsWith(
              "blob:"
            ) ||
            value.startsWith(
              "data:"
            )
          ) {
            return value;
          }

          return `${apiBase}/${value
          .replace(/\\/g, "/")
          .replace(/^\/+/, "")}`;
        };

        const imageSrc =
          toImageUrl(
            imagePath
          );

        const originalImageSrc =
          toImageUrl(
            originalImagePath
          );

        const pick = (
          ...keys
        ) => {
          for (
            const key of keys
          ) {
            const value =
              analysis?.[key];

            if (
              value !==
                undefined &&
              value !== null &&
              value !== ""
            ) {
              return value;
            }
          }

          return null;
        };

        const normalise = (
          value
        ) => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return null;
          }

          if (
            typeof value ===
            "object"
          ) {
            return (
              value.status ||
              value.label ||
              value.result ||
              value.value ||
              value.condition ||
              null
            );
          }

          return String(value);
        };

        const score = (
          value
        ) => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return null;
          }

          const numericValue =
            Number(value);

          if (
            Number.isNaN(
              numericValue
            )
          ) {
            return null;
          }

          return Math.min(
            Math.max(
              numericValue,
              0
            ),
            100
          );
        };

        const tone = (
          value
        ) => {
          const text =
            String(
              value || ""
            ).toLowerCase();

          if (
            /detected|high|severe|poor|critical|spoiled|damage|deterioration|moderate visual/.test(
              text
            )
          ) {
            return {
              bg:
                "#fff3f1",
              bd:
                "#ffd9d4",
              ib:
                "#ffe5e1",
              tx:
                "#b33b2e",
              ic:
                "!",
            };
          }

          if (
            /possible|mild|slight|moderate|warning|less|variation|change/.test(
              text
            )
          ) {
            return {
              bg:
                "#fffaf0",
              bd:
                "#f5e7bd",
              ib:
                "#fff3cf",
              tx:
                "#a56a00",
              ic:
                "~",
            };
          }

          return {
            bg:
              "#f2fff7",
            bd:
              "#d8f1e2",
            ib:
              "#e4faed",
            tx:
              "#078b43",
            ic:
              "✓",
          };
        };

        const items = [
          [
            "Color Analysis",
            "🎨",
            [
              "color_analysis",
              "color_condition",
              "color_status",
              "color",
            ],
            [
              "color_score",
              "color_confidence",
              "color_quality",
            ],
            "Evaluates visible colour characteristics of the uploaded food image as a freshness indicator.",
          ],
          [
            "Color Degradation",
            "📉",
            [
              "color_degradation",
              "color_degradation_status",
              "discoloration",
            ],
            [
              "color_degradation_score",
              "color_degradation_confidence",
            ],
            "Checks for browning, fading, darkening and abnormal colour changes associated with deterioration.",
          ],
          [
            "Texture Analysis",
            "🔬",
            [
              "texture_analysis",
              "texture_condition",
              "texture_status",
              "texture",
            ],
            [
              "texture_score",
              "texture_confidence",
            ],
            "Examines visible surface characteristics and texture patterns in the uploaded image.",
          ],
          [
            "Surface Texture Changes",
            "🧬",
            [
              "surface_texture_changes",
              "surface_texture",
              "texture_changes",
            ],
            [
              "surface_texture_score",
              "surface_texture_confidence",
            ],
            "Looks for visible wrinkling, softening, roughness and other surface deterioration indicators.",
          ],
          [
            "Mold Detection",
            "🦠",
            [
              "mold_detection",
              "mold_status",
              "mold",
            ],
            [
              "mold_score",
              "mold_confidence",
            ],
            "Checks the uploaded image for visible mold-like colour and surface patterns.",
          ],
          [
            "Bruising Detection",
            "🟤",
            [
              "bruising_detection",
              "bruising_status",
              "bruising",
            ],
            [
              "bruising_score",
              "bruising_confidence",
            ],
            "Identifies dark patches and visual marks that may indicate bruising or impact damage.",
          ],
          [
            "Physical Damage",
            "⚠️",
            [
              "physical_damage_detection",
              "physical_damage",
              "damage_detection",
              "damage_status",
            ],
            [
              "physical_damage_score",
              "physical_damage_confidence",
              "damage_confidence",
            ],
            "Checks for visible cuts, cracks, tears, punctures and other physical damage patterns.",
          ],
          [
            "Spoilage Identification",
            "🚨",
            [
              "spoilage_identification",
              "spoilage_status",
              "spoilage",
              "spoilage_risk",
            ],
            [
              "spoilage_score",
              "spoilage_confidence",
              "spoilage_risk_score",
            ],
            "Summarises visible spoilage-related indicators detected from the food image.",
          ],
        ].map(
          ([
            title,
            icon,
            keys,
            scoreKeys,
            description,
          ]) => ({
            title,
            icon,
            value:
              normalise(
                pick(
                  ...keys
                )
              ),
            score:
              score(
                pick(
                  ...scoreKeys
                )
              ),
            description,
          })
        );

        return (
          <section
            style={{
              maxWidth:
                "1250px",
              margin:
                "25px auto 0",
              background:
                "#fff",
              borderRadius:
                "28px",
              padding:
                "30px",
              border:
                "1px solid rgba(8,169,79,0.09)",
              boxShadow:
                "0 15px 45px rgba(0,70,35,0.06)",
              width: "100%",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap:
                  "20px",
                flexWrap:
                  "wrap",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize:
                      "11px",
                    fontWeight:
                      "850",
                    color:
                      "#08a94f",
                    letterSpacing:
                      "1.5px",
                  }}
                >
                  AI IMAGE ANALYSIS
                </span>

                <h2
                  style={{
                    margin:
                      "8px 0 7px",
                    color:
                      "#073b27",
                    fontSize:
                      "26px",
                  }}
                >
                  Visual freshness intelligence
                </h2>

                <p
                  style={{
                    margin: 0,
                    color:
                      "#71827b",
                    fontSize:
                      "13px",
                    lineHeight:
                      1.6,
                    maxWidth:
                      "760px",
                  }}
                >
                  The uploaded food image is analysed using colour,
                  texture and visible spoilage-related computer-vision
                  indicators. Detected regions are highlighted directly
                  on the image.
                </p>
              </div>

              <div
                style={{
                  padding:
                    "9px 14px",
                  borderRadius:
                    "999px",
                  background:
                    "#edfff4",
                  color:
                    "#078b43",
                  fontSize:
                    "12px",
                  fontWeight:
                    "800",
                  flexShrink: 0,
                }}
              >
                🤖 AI Visual Inspection
              </div>
            </div>

            {visualAnalysisLoading && (
              <div
                style={{
                  marginTop:
                    "18px",
                  padding:
                    "12px 15px",
                  borderRadius:
                    "14px",
                  background:
                    "#f3fff7",
                  border:
                    "1px solid #dcefe4",
                  color:
                    "#078b43",
                  fontSize:
                    "12px",
                  fontWeight:
                    "750",
                }}
              >
                🔍 Analysing uploaded image and storage conditions with the AI inspection engine...
              </div>
            )}

            {visualAnalysisError && (
              <div
                style={{
                  marginTop:
                    "18px",
                  padding:
                    "12px 15px",
                  borderRadius:
                    "14px",
                  background:
                    "#fff8f6",
                  border:
                    "1px solid #f4ddd8",
                  color:
                    "#a33a2e",
                  fontSize:
                    "12px",
                  fontWeight:
                    "700",
                  overflowWrap:
                    "anywhere",
                }}
              >
                {visualAnalysisError}
              </div>
            )}

            <div
              style={{
                marginTop:
                  "25px",
                display:
                  "grid",
                gridTemplateColumns:
                  imageSrc
                    ? "minmax(310px, 0.95fr) minmax(0, 1.7fr)"
                    : "1fr",
                gap:
                  "24px",
                alignItems:
                  "stretch",
              }}
            >
              {imageSrc && (
                <div
                  style={{
                    borderRadius:
                      "22px",
                    overflow:
                      "hidden",
                    background:
                      "#f3fff7",
                    border:
                      "1px solid #e2f1e7",
                    minHeight:
                      "520px",
                    position:
                      "relative",
                    boxShadow:
                      "0 12px 32px rgba(0,70,35,0.08)",
                  }}
                >
                  <img
                    src={imageSrc}
                    alt={`${food.food_name || "Food"} visual analysis`}
                    style={{
                      width:
                        "100%",
                      height:
                        "100%",
                      minHeight:
                        "520px",
                      objectFit:
                        "cover",
                      objectPosition:
                        "center",
                      display:
                        "block",
                    }}
                    onError={(
                      event
                    ) => {
                      if (
                        originalImageSrc &&
                        event
                          .currentTarget
                          .src !==
                          originalImageSrc
                      ) {
                        event
                          .currentTarget
                          .src =
                          originalImageSrc;
                      }
                    }}
                  />

                  <div
                    style={{
                      position:
                        "absolute",
                      left:
                        "12px",
                      right:
                        "12px",
                      bottom:
                        "12px",
                      padding:
                        "10px 13px",
                      borderRadius:
                        "13px",
                      background:
                        "rgba(255,255,255,.94)",
                      color:
                        "#073b27",
                      fontSize:
                        "11px",
                      fontWeight:
                        "850",
                      boxShadow:
                        "0 8px 20px rgba(0,0,0,.08)",
                      overflowWrap:
                        "anywhere",
                    }}
                  >
                    {annotatedImagePath
                      ? "🔎 Annotated food image • detected regions highlighted"
                      : "📷 Uploaded food image"}
                  </div>
                </div>
              )}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(2,minmax(0,1fr))",
                  gap:
                    "12px",
                  minWidth: 0,
                }}
              >
                {items.map(
                  (item) => {
                    const theme =
                      tone(
                        item.value
                      );

                    const displayValue =
                      item.value ||
                      (visualAnalysisLoading
                        ? "Analysing..."
                        : "No visual result returned");

                    return (
                      <div
                        key={
                          item.title
                        }
                        style={{
                          padding:
                            "17px",
                          borderRadius:
                            "18px",
                          background:
                            theme.bg,
                          border:
                            `1px solid ${theme.bd}`,
                          minHeight:
                            "160px",
                          position:
                            "relative",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              width:
                                "42px",
                              height:
                                "42px",
                              borderRadius:
                                "13px",
                              background:
                                theme.ib,
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              fontSize:
                                "21px",
                              flexShrink: 0,
                            }}
                          >
                            {item.icon}
                          </div>

                          <span
                            style={{
                              width:
                                "30px",
                              height:
                                "30px",
                              borderRadius:
                                "50%",
                              background:
                                "rgba(255,255,255,.82)",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              color:
                                theme.tx,
                              fontWeight:
                                "900",
                              fontSize:
                                "16px",
                              flexShrink: 0,
                            }}
                          >
                            {theme.ic}
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop:
                              "12px",
                            fontSize:
                              "11px",
                            fontWeight:
                              "850",
                            color:
                              "#60756b",
                            letterSpacing:
                              ".7px",
                            textTransform:
                              "uppercase",
                            overflowWrap:
                              "anywhere",
                          }}
                        >
                          {item.title}
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            color:
                              theme.tx,
                            fontSize:
                              "16px",
                            fontWeight:
                              "850",
                            lineHeight:
                              1.25,
                            overflowWrap:
                              "anywhere",
                          }}
                        >
                          {displayValue}
                        </div>

                        {item.score !==
                          null && (
                          <div
                            style={{
                              marginTop:
                                "9px",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap:
                                "8px",
                            }}
                          >
                            <div
                              style={{
                                flex:
                                  1,
                                height:
                                  "6px",
                                borderRadius:
                                  "999px",
                                background:
                                  "rgba(0,0,0,.07)",
                                overflow:
                                  "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width:
                                    `${item.score}%`,
                                  height:
                                    "100%",
                                  borderRadius:
                                    "999px",
                                  background:
                                    theme.tx,
                                }}
                              />
                            </div>

                            <span
                              style={{
                                fontSize:
                                  "10px",
                                fontWeight:
                                  "850",
                                color:
                                  theme.tx,
                                flexShrink: 0,
                              }}
                            >
                              {Math.round(
                                item.score
                              )}
                              %
                            </span>
                          </div>
                        )}

                        <p
                          style={{
                            margin:
                              "8px 0 0",
                            color:
                              "#778981",
                            fontSize:
                              "10px",
                            lineHeight:
                              1.45,
                          }}
                        >
                          {
                            item.description
                          }
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div
              style={{
                marginTop:
                  "18px",
                padding:
                  "15px 17px",
                borderRadius:
                  "16px",
                background:
                  "#f8fcf9",
                border:
                  "1px solid #e8f2eb",
                display:
                  "flex",
                gap:
                  "10px",
                alignItems:
                  "flex-start",
              }}
            >
              <span>
                ℹ️
              </span>

              <p
                style={{
                  margin: 0,
                  color:
                    "#71827b",
                  fontSize:
                    "11px",
                  lineHeight:
                    1.55,
                }}
              >
                The existing trained freshness model remains the source
                of the main freshness score. OpenCV visual analysis adds
                image-based evidence for colour degradation, texture
                changes, mold-like patterns, bruising, physical damage
                and spoilage indicators. Storage recommendations additionally
                use the recorded temperature, humidity, packaging, duration,
                air circulation and light exposure.
              </p>
            </div>
          </section>
        );
      })()}

      {/* =====================================================
          REPORT FOOTER
      ===================================================== */}

      <section
        style={{
          maxWidth:
            "1250px",
          margin:
            "25px auto 0",
          padding:
            "20px 24px",
          borderRadius:
            "18px",
          background:
            "rgba(255,255,255,0.70)",
          border:
            "1px solid rgba(8,169,79,0.08)",
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap:
            "20px",
          flexWrap:
            "wrap",
          width: "100%",
        }}
      >
        <div
          style={{
            minWidth: 0,
          }}
        >
          <strong
            style={{
              color:
                "#073b27",
              fontSize:
                "14px",
            }}
          >
            FreshGuard Intelligence Report
          </strong>

          <div
            style={{
              color:
                "#8a9993",
              fontSize:
                "11px",
              marginTop:
                "4px",
              lineHeight:
                1.5,
            }}
          >
            Generated from the food item's recorded inventory,
            freshness assessment, visual analysis and storage intelligence.
          </div>
        </div>

        <div
          style={{
            color:
              "#08a94f",
            fontSize:
              "12px",
            fontWeight:
              "800",
            overflowWrap:
              "anywhere",
          }}
        >
          Freshness • Shelf Life • Storage • AI Recommendations
        </div>
      </section>
    </div>
  );
}

export default FoodReport;