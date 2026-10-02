import { useEffect, useMemo, useState } from "react";
import { getFoods } from "../api";


// ============================================================
// HELPERS
// ============================================================

function normalise(value) {
  return String(value ?? "").trim();
}


function lower(value) {
  return normalise(value).toLowerCase();
}


function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function formatNumber(value, digits = 1) {
  const number = toNumber(value);

  if (number === null) {
    return "N/A";
  }

  return number.toFixed(digits);
}


function getFoodEmoji(category, foodName) {
  const foodValue = lower(foodName);
  const categoryValue = lower(category);

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
    papaya: "🧡",
    pomegranate: "🍎",
    pear: "🍐",
    peach: "🍑",
    cherry: "🍒",
    kiwi: "🥝",

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
    corn: "🌽",
    capsicum: "🫑",
    pepper: "🌶️",
    chilli: "🌶️",
    chili: "🌶️",
    eggplant: "🍆",
    brinjal: "🍆",

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


function dateKey(value) {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}


function formatDate(value) {
  const date = parseDate(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


function getTodayKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getFreshnessScore(food) {
  const score = Number(
    food?.freshness_score
  );

  if (
    Number.isFinite(score) &&
    score >= 0
  ) {
    return Math.min(
      100,
      Math.max(0, score)
    );
  }

  return null;
}


function getOverallHealthScore(food) {
  const storedScore =
    toNumber(
      food?.overall_health_score
    );

  if (storedScore !== null) {
    return Math.min(
      100,
      Math.max(0, storedScore)
    );
  }

  return getFreshnessScore(food);
}


function getStorageComplianceScore(food) {
  const score =
    toNumber(
      food?.storage_compliance_score
    );

  if (score === null) {
    return null;
  }

  return Math.min(
    100,
    Math.max(0, score)
  );
}


function getShelfLifeConfidence(food) {
  const confidence =
    toNumber(
      food?.shelf_life_confidence
    );

  if (confidence === null) {
    return null;
  }

  return Math.min(
    100,
    Math.max(0, confidence)
  );
}


function getShelfLifeRisk(food) {
  const storedRisk =
    normalise(
      food?.shelf_life_risk
    );

  if (storedRisk) {
    return storedRisk;
  }

  const remaining =
    getRemainingShelfLife(food);

  if (remaining === null) {
    return "Unknown";
  }

  if (remaining <= 0) {
    return "Expired";
  }

  if (remaining <= 2) {
    return "Critical";
  }

  if (remaining <= 5) {
    return "High";
  }

  if (remaining <= 10) {
    return "Medium";
  }

  return "Low";
}


function getStatus(food) {
  const value = lower(
    food?.freshness_status
  );

  if (
    value.includes("expired")
  ) {
    return "Expired";
  }

  if (
    value.includes("rotten") ||
    value.includes("spoiled") ||
    value.includes("spoil")
  ) {
    return "Spoiled";
  }

  if (
    value.includes("near")
  ) {
    return "Near Spoilage";
  }

  if (value === "fresh") {
    return "Fresh";
  }

  if (value === "good") {
    return "Good";
  }

  if (value === "acceptable") {
    return "Acceptable";
  }

  if (value === "pending") {
    return "Pending";
  }

  return food?.freshness_status
    ? food.freshness_status
    : "Pending";
}


function isExpired(food) {
  if (
    lower(food?.freshness_status) ===
    "expired"
  ) {
    return true;
  }

  const expiry =
    dateKey(food?.expiry_date);

  if (!expiry) {
    return false;
  }

  return expiry < getTodayKey();
}


function isNearExpiry(food) {
  if (
    isExpired(food)
  ) {
    return false;
  }

  const expiry =
    parseDate(food?.expiry_date);

  if (!expiry) {
    return false;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const expiryDay =
    new Date(expiry);

  expiryDay.setHours(
    0,
    0,
    0,
    0
  );

  const difference =
    Math.ceil(
      (
        expiryDay.getTime() -
        today.getTime()
      ) /
        (1000 * 60 * 60 * 24)
    );

  return (
    difference >= 0 &&
    difference <= 3
  );
}


function getScoreLabel(score) {
  if (score === null) {
    return "Not analysed";
  }

  if (score >= 80) {
    return "Fresh";
  }

  if (score >= 60) {
    return "Good";
  }

  if (score >= 40) {
    return "Acceptable";
  }

  if (score >= 20) {
    return "Near Spoilage";
  }

  return "Spoiled";
}


function getScoreClass(score) {
  if (score === null) {
    return "neutral";
  }

  if (score >= 60) {
    return "good";
  }

  if (score >= 40) {
    return "warning";
  }

  return "danger";
}


function calculateShelfLife(food) {
  const manufacturing =
    parseDate(
      food?.manufacturing_date
    );

  const expiry =
    parseDate(
      food?.expiry_date
    );

  if (
    !manufacturing ||
    !expiry
  ) {
    return null;
  }

  const total =
    Math.ceil(
      (
        expiry.getTime() -
        manufacturing.getTime()
      ) /
        (1000 * 60 * 60 * 24)
    );

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const expiryDay =
    new Date(expiry);

  expiryDay.setHours(
    0,
    0,
    0,
    0
  );

  const remaining =
    Math.ceil(
      (
        expiryDay.getTime() -
        today.getTime()
      ) /
        (1000 * 60 * 60 * 24)
    );

  return {
    total: Math.max(
      0,
      total
    ),
    remaining,
  };
}


function getRemainingShelfLife(food) {
  const stored =
    toNumber(
      food?.remaining_shelf_life
    );

  if (stored !== null) {
    return stored;
  }

  const calculated =
    calculateShelfLife(food);

  if (!calculated) {
    return null;
  }

  return calculated.remaining;
}


function getTotalShelfLife(food) {
  const calculated =
    calculateShelfLife(food);

  if (calculated) {
    return calculated.total;
  }

  const remaining =
    getRemainingShelfLife(food);

  return remaining === null
    ? null
    : Math.max(
        0,
        remaining
      );
}


function getStorageStatus(food) {
  const storage =
    lower(
      food?.storage_condition
    );

  if (!storage) {
    return "Not specified";
  }

  if (
    storage.includes("freezer")
  ) {
    return "Freezer";
  }

  if (
    storage.includes("refrigerator") ||
    storage.includes("fridge")
  ) {
    return "Refrigerator";
  }

  if (
    storage.includes("room")
  ) {
    return "Room Temperature";
  }

  return food.storage_condition;
}


function getStorageCompliance(food) {
  const storage =
    lower(
      food?.storage_condition
    );

  if (!storage) {
    return "Unknown";
  }

  return "Recorded";
}


function getRiskTone(risk) {
  const value =
    lower(risk);

  if (
    value.includes("expired") ||
    value.includes("critical") ||
    value.includes("high")
  ) {
    return "red";
  }

  if (
    value.includes("medium") ||
    value.includes("near")
  ) {
    return "yellow";
  }

  if (
    value.includes("low")
  ) {
    return "green";
  }

  return "blue";
}


function getHealthTone(score) {
  if (score === null) {
    return "blue";
  }

  if (score >= 70) {
    return "green";
  }

  if (score >= 40) {
    return "yellow";
  }

  return "red";
}


function getEnvironmentalCompleteness(food) {
  const fields = [
    food?.storage_temperature,
    food?.storage_humidity,
    food?.packaging_type,
    food?.storage_duration,
    food?.air_circulation,
    food?.light_exposure,
  ];

  return fields.filter(
    (value) =>
      value !== null &&
      value !== undefined &&
      normalise(value) !== ""
  ).length;
}


function getRecommendationForFood(food) {
  const recommendations = [];

  const remaining =
    getRemainingShelfLife(food);

  const risk =
    lower(
      getShelfLifeRisk(food)
    );

  const storageScore =
    getStorageComplianceScore(food);

  const healthScore =
    getOverallHealthScore(food);

  const confidence =
    getShelfLifeConfidence(food);

  const temperature =
    toNumber(
      food?.storage_temperature
    );

  const humidity =
    toNumber(
      food?.storage_humidity
    );

  const packaging =
    normalise(
      food?.packaging_type
    );

  const duration =
    toNumber(
      food?.storage_duration
    );

  const air =
    normalise(
      food?.air_circulation
    );

  const light =
    normalise(
      food?.light_exposure
    );

  if (
    risk.includes("expired") ||
    isExpired(food)
  ) {
    recommendations.push(
      "Expiry has passed. Follow applicable food-safety handling guidance before consumption or disposal."
    );
  } else if (
    risk.includes("critical") ||
    remaining !== null &&
    remaining <= 2
  ) {
    recommendations.push(
      "Prioritize this item immediately because the remaining shelf-life is very limited."
    );
  } else if (
    risk.includes("high") ||
    remaining !== null &&
    remaining <= 5
  ) {
    recommendations.push(
      "Prioritize this item soon and use FEFO rotation to reduce expiry risk."
    );
  }

  if (
    storageScore !== null &&
    storageScore < 70
  ) {
    recommendations.push(
      "Review storage conditions because the recorded storage compliance score is below 70."
    );
  }

  if (
    temperature !== null
  ) {
    recommendations.push(
      `Recorded storage temperature is ${formatNumber(
        temperature,
        1
      )}°C; keep monitoring temperature stability for this food.`
    );
  }

  if (
    humidity !== null
  ) {
    recommendations.push(
      `Recorded humidity is ${formatNumber(
        humidity,
        1
      )}%; monitor humidity because environmental conditions affect food quality.`
    );
  }

  if (
    packaging
  ) {
    recommendations.push(
      `Packaging recorded as "${packaging}". Keep packaging appropriate, clean and properly sealed where required.`
    );
  }

  if (
    duration !== null
  ) {
    recommendations.push(
      `Recorded storage duration is ${formatNumber(
        duration,
        1
      )} days; avoid unnecessary additional storage as shelf-life decreases.`
    );
  }

  if (
    air
  ) {
    recommendations.push(
      `Air circulation is recorded as "${air}". Maintain suitable airflow for the food's storage environment.`
    );
  }

  if (
    light
  ) {
    recommendations.push(
      `Light exposure is recorded as "${light}". Keep light-sensitive foods protected where appropriate.`
    );
  }

  if (
    healthScore !== null &&
    healthScore < 50
  ) {
    recommendations.push(
      "Overall food health is low; increase inspection frequency and review storage and shelf-life factors."
    );
  }

  if (
    confidence !== null &&
    confidence < 70
  ) {
    recommendations.push(
      "Shelf-life confidence is below 70%; treat the estimate cautiously and continue monitoring the item."
    );
  }

  if (
    recommendations.length === 0
  ) {
    recommendations.push(
      "Continue freshness monitoring, maintain recorded storage conditions and use FEFO rotation based on expiry."
    );
  }

  return recommendations.slice(
    0,
    5
  );
}


// ============================================================
// EXPORT HELPERS
// ============================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function downloadBlob(content, mimeType, fileName) {
  const blob = new Blob([content], {
    type: mimeType,
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}


function buildExportRows(foods) {
  return foods.map((food) => {
    const score =
      getFreshnessScore(food);

    const shelf =
      calculateShelfLife(food);

    const remaining =
      getRemainingShelfLife(food);

    const health =
      getOverallHealthScore(food);

    const storageScore =
      getStorageComplianceScore(food);

    const confidence =
      getShelfLifeConfidence(food);

    return {
      food:
        normalise(food?.food_name) ||
        "Unnamed Food",

      category:
        normalise(food?.category) ||
        "Other",

      score:
        score === null
          ? "N/A"
          : score.toFixed(1),

      quality:
        getStatus(food),

      health:
        health === null
          ? "N/A"
          : health.toFixed(1),

      manufacturingDate:
        formatDate(
          food?.manufacturing_date
        ),

      expiryDate:
        formatDate(
          food?.expiry_date
        ),

      shelfLife:
        shelf === null
          ? "N/A"
          : `${shelf.total} days`,

      remainingShelfLife:
        remaining === null
          ? "N/A"
          : `${Math.max(
              0,
              remaining
            ).toFixed(1)} days`,

      shelfLifeRisk:
        getShelfLifeRisk(food),

      shelfLifeConfidence:
        confidence === null
          ? "N/A"
          : `${confidence.toFixed(1)}%`,

      storage:
        getStorageStatus(food),

      storageTemperature:
        toNumber(
          food?.storage_temperature
        ) === null
          ? "N/A"
          : `${formatNumber(
              food.storage_temperature,
              1
            )} °C`,

      humidity:
        toNumber(
          food?.storage_humidity
        ) === null
          ? "N/A"
          : `${formatNumber(
              food.storage_humidity,
              1
            )}%`,

      packaging:
        normalise(
          food?.packaging_type
        ) || "N/A",

      storageDuration:
        toNumber(
          food?.storage_duration
        ) === null
          ? "N/A"
          : `${formatNumber(
              food.storage_duration,
              1
            )} days`,

      airCirculation:
        normalise(
          food?.air_circulation
        ) || "N/A",

      lightExposure:
        normalise(
          food?.light_exposure
        ) || "N/A",

      storageCompliance:
        storageScore === null
          ? "N/A"
          : storageScore.toFixed(1),

      expired:
        isExpired(food)
          ? "Yes"
          : "No",

      nearExpiry:
        isNearExpiry(food)
          ? "Yes"
          : "No",
    };
  });
}


function buildExportDate() {
  const now = new Date();

  return now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function buildPdfHtml(reportData, foods) {
  const rows =
    buildExportRows(foods);

  const inventoryRows =
    rows.length
      ? rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.food)}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.score)}</td>
                <td>${escapeHtml(row.health)}</td>
                <td>${escapeHtml(row.quality)}</td>
                <td>${escapeHtml(row.remainingShelfLife)}</td>
                <td>${escapeHtml(row.shelfLifeRisk)}</td>
                <td>${escapeHtml(row.expiryDate)}</td>
                <td>${escapeHtml(row.storage)}</td>
                <td>${escapeHtml(row.storageTemperature)}</td>
                <td>${escapeHtml(row.humidity)}</td>
              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td colspan="11">
              No inventory items available.
            </td>
          </tr>
        `;

  const averageScore =
    reportData.averageScore === null
      ? "N/A"
      : reportData.averageScore.toFixed(1);

  const averageHealth =
    reportData.averageHealthScore === null
      ? "N/A"
      : reportData.averageHealthScore.toFixed(1);

  const averageStorage =
    reportData.averageStorageCompliance === null
      ? "N/A"
      : reportData.averageStorageCompliance.toFixed(1);

  const averageConfidence =
    reportData.averageShelfLifeConfidence === null
      ? "N/A"
      : reportData.averageShelfLifeConfidence.toFixed(1);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>FreshGuard Food Reports</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 28px;
            font-family: Arial, Helvetica, sans-serif;
            color: #073b27;
            background: #ffffff;
          }

          h1,
          h2,
          h3,
          p {
            margin-top: 0;
          }

          h1 {
            font-size: 30px;
            margin-bottom: 6px;
          }

          h2 {
            font-size: 20px;
            margin-bottom: 8px;
            color: #08783d;
          }

          .meta {
            color: #71827b;
            font-size: 12px;
            margin-bottom: 24px;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 22px;
          }

          .card {
            border: 1px solid #dcebe3;
            border-radius: 10px;
            padding: 12px;
          }

          .label {
            color: #71827b;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
          }

          .value {
            margin-top: 5px;
            font-size: 20px;
            font-weight: 800;
          }

          .section {
            margin-top: 22px;
            page-break-inside: avoid;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
          }

          th,
          td {
            border: 1px solid #dcebe3;
            padding: 6px;
            text-align: left;
          }

          th {
            background: #effaf4;
            color: #073b27;
          }

          .footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #dcebe3;
            color: #71827b;
            font-size: 10px;
          }

          @media print {
            body {
              padding: 12px;
            }

            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>

      <body>

        <h1>
          FreshGuard Food Quality & Intelligence Report
        </h1>

        <div class="meta">
          Generated:
          ${escapeHtml(buildExportDate())}
          <br />
          Source:
          Existing FreshGuard food inventory and stored
          freshness / shelf-life / storage analysis.
        </div>


        <div class="summary">

          <div class="card">
            <div class="label">
              Total Inventory
            </div>
            <div class="value">
              ${reportData.total}
            </div>
          </div>

          <div class="card">
            <div class="label">
              Fresh / Good
            </div>
            <div class="value">
              ${reportData.fresh}
            </div>
          </div>

          <div class="card">
            <div class="label">
              At Risk
            </div>
            <div class="value">
              ${reportData.nearSpoilage + reportData.spoiled}
            </div>
          </div>

          <div class="card">
            <div class="label">
              Near Expiry
            </div>
            <div class="value">
              ${reportData.nearExpiry}
            </div>
          </div>

          <div class="card">
            <div class="label">
              Expired
            </div>
            <div class="value">
              ${reportData.expired}
            </div>
          </div>

          <div class="card">
            <div class="label">
              Average AI Score
            </div>
            <div class="value">
              ${escapeHtml(averageScore)}
            </div>
          </div>

          <div class="card">
            <div class="label">
              Average Health
            </div>
            <div class="value">
              ${escapeHtml(averageHealth)}
            </div>
          </div>

          <div class="card">
            <div class="label">
              Storage Compliance
            </div>
            <div class="value">
              ${escapeHtml(averageStorage)}
            </div>
          </div>

        </div>


        <div class="section">
          <h2>
            Freshness Report
          </h2>

          <div class="grid">

            <div class="card">
              <div class="label">
                Fresh / Good
              </div>
              <div class="value">
                ${reportData.fresh}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Acceptable
              </div>
              <div class="value">
                ${reportData.acceptable}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Near Spoilage
              </div>
              <div class="value">
                ${reportData.nearSpoilage}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Spoiled / Expired
              </div>
              <div class="value">
                ${reportData.spoiled}
              </div>
            </div>

          </div>
        </div>


        <div class="section">
          <h2>
            Shelf-Life & Prediction Intelligence
          </h2>

          <div class="grid">

            <div class="card">
              <div class="label">
                Total Shelf-Life
              </div>
              <div class="value">
                ${reportData.totalShelfLifeDays} days
              </div>
            </div>

            <div class="card">
              <div class="label">
                Remaining Shelf-Life
              </div>
              <div class="value">
                ${reportData.remainingShelfLifeDays} days
              </div>
            </div>

            <div class="card">
              <div class="label">
                Average Confidence
              </div>
              <div class="value">
                ${escapeHtml(averageConfidence)}%
              </div>
            </div>

            <div class="card">
              <div class="label">
                High / Critical Risk
              </div>
              <div class="value">
                ${reportData.highRiskShelfLife}
              </div>
            </div>

          </div>
        </div>


        <div class="section">
          <h2>
            Storage & Environmental Monitoring
          </h2>

          <div class="grid">

            <div class="card">
              <div class="label">
                Storage Recorded
              </div>
              <div class="value">
                ${reportData.storageRecorded}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Temperature Recorded
              </div>
              <div class="value">
                ${reportData.temperatureRecorded}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Humidity Recorded
              </div>
              <div class="value">
                ${reportData.humidityRecorded}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Packaging Recorded
              </div>
              <div class="value">
                ${reportData.packagingRecorded}
              </div>
            </div>

          </div>
        </div>


        <div class="section">
          <h2>
            Waste Reduction Report
          </h2>

          <div class="grid">

            <div class="card">
              <div class="label">
                Expired Items
              </div>
              <div class="value">
                ${reportData.expired}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Expiry Risk
              </div>
              <div class="value">
                ${reportData.nearExpiry}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Low Freshness
              </div>
              <div class="value">
                ${reportData.nearSpoilage + reportData.spoiled}
              </div>
            </div>

            <div class="card">
              <div class="label">
                Action Opportunities
              </div>
              <div class="value">
                ${reportData.actionOpportunities}
              </div>
            </div>

          </div>
        </div>


        <div class="section">

          <h2>
            Inventory Quality & Milestone-3 Analysis
          </h2>

          <table>

            <thead>
              <tr>
                <th>Food</th>
                <th>Category</th>
                <th>AI Score</th>
                <th>Health</th>
                <th>Quality</th>
                <th>Remaining</th>
                <th>Risk</th>
                <th>Expiry</th>
                <th>Storage</th>
                <th>Temp</th>
                <th>Humidity</th>
              </tr>
            </thead>

            <tbody>
              ${inventoryRows}
            </tbody>

          </table>

        </div>


        <div class="footer">
          FreshGuard reporting uses the existing food inventory,
          freshness assessment, shelf-life prediction,
          storage information and stored Milestone-3 analysis.
          Existing prediction and inventory data flow is not
          changed by report export.
        </div>


        <script>
          window.addEventListener("load", function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          });
        </script>

      </body>
    </html>
  `;
}


function exportPdfReport(
  reportData,
  foods
) {
  const printWindow =
    window.open(
      "",
      "_blank",
      "width=1200,height=850"
    );

  if (!printWindow) {
    window.alert(
      "PDF export could not open the print window. Please allow pop-ups for FreshGuard and try again."
    );

    return;
  }

  printWindow.document.open();

  printWindow.document.write(
    buildPdfHtml(
      reportData,
      foods
    )
  );

  printWindow.document.close();
}


function exportExcelReport(
  reportData,
  foods
) {
  const rows =
    buildExportRows(foods);

  const tableRows =
    rows.length
      ? rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.food)}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.score)}</td>
                <td>${escapeHtml(row.health)}</td>
                <td>${escapeHtml(row.quality)}</td>
                <td>${escapeHtml(row.manufacturingDate)}</td>
                <td>${escapeHtml(row.expiryDate)}</td>
                <td>${escapeHtml(row.shelfLife)}</td>
                <td>${escapeHtml(row.remainingShelfLife)}</td>
                <td>${escapeHtml(row.shelfLifeRisk)}</td>
                <td>${escapeHtml(row.shelfLifeConfidence)}</td>
                <td>${escapeHtml(row.storage)}</td>
                <td>${escapeHtml(row.storageTemperature)}</td>
                <td>${escapeHtml(row.humidity)}</td>
                <td>${escapeHtml(row.packaging)}</td>
                <td>${escapeHtml(row.storageDuration)}</td>
                <td>${escapeHtml(row.airCirculation)}</td>
                <td>${escapeHtml(row.lightExposure)}</td>
                <td>${escapeHtml(row.storageCompliance)}</td>
                <td>${escapeHtml(row.expired)}</td>
                <td>${escapeHtml(row.nearExpiry)}</td>
              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td colspan="21">
              No inventory items available.
            </td>
          </tr>
        `;

  const averageScore =
    reportData.averageScore === null
      ? "N/A"
      : reportData.averageScore.toFixed(1);

  const averageHealth =
    reportData.averageHealthScore === null
      ? "N/A"
      : reportData.averageHealthScore.toFixed(1);

  const averageStorage =
    reportData.averageStorageCompliance === null
      ? "N/A"
      : reportData.averageStorageCompliance.toFixed(1);

  const averageConfidence =
    reportData.averageShelfLifeConfidence === null
      ? "N/A"
      : reportData.averageShelfLifeConfidence.toFixed(1);

  const html = `
    <html>

      <head>

        <meta charset="UTF-8" />

        <style>

          table {
            border-collapse: collapse;
            font-family: Arial, sans-serif;
          }

          th,
          td {
            border: 1px solid #b7cfc2;
            padding: 7px;
            font-size: 10px;
          }

          th {
            background: #dff5e8;
            font-weight: 700;
          }

          .title {
            font-size: 20px;
            font-weight: 700;
          }

          .label {
            font-weight: 700;
            background: #effaf4;
          }

        </style>

      </head>


      <body>

        <table>

          <tr>
            <td
              colspan="21"
              class="title"
            >
              FreshGuard Food Quality &
              Intelligence Report
            </td>
          </tr>


          <tr>
            <td class="label">
              Generated
            </td>

            <td colspan="20">
              ${escapeHtml(
                buildExportDate()
              )}
            </td>
          </tr>


          <tr>

            <td class="label">
              Total Inventory
            </td>

            <td>
              ${reportData.total}
            </td>

            <td class="label">
              Fresh / Good
            </td>

            <td>
              ${reportData.fresh}
            </td>

            <td class="label">
              At Risk
            </td>

            <td>
              ${
                reportData.nearSpoilage +
                reportData.spoiled
              }
            </td>

            <td class="label">
              Near Expiry
            </td>

            <td>
              ${reportData.nearExpiry}
            </td>

            <td class="label">
              Expired
            </td>

            <td>
              ${reportData.expired}
            </td>

            <td class="label">
              Average AI Score
            </td>

            <td>
              ${escapeHtml(
                averageScore
              )}
            </td>

            <td class="label">
              Average Health
            </td>

            <td>
              ${escapeHtml(
                averageHealth
              )}
            </td>

            <td class="label">
              Storage Compliance
            </td>

            <td>
              ${escapeHtml(
                averageStorage
              )}
            </td>

            <td class="label">
              Shelf-Life Confidence
            </td>

            <td>
              ${escapeHtml(
                averageConfidence
              )}
            </td>

            <td class="label">
              High/Critical Risk
            </td>

            <td>
              ${reportData.highRiskShelfLife}
            </td>

            <td></td>

          </tr>


          <tr>
            <td
              colspan="21"
            ></td>
          </tr>


          <tr>
            <td
              colspan="21"
              class="title"
            >
              Freshness Report
            </td>
          </tr>


          <tr>

            <td class="label">
              Fresh / Good
            </td>

            <td>
              ${reportData.fresh}
            </td>

            <td class="label">
              Acceptable
            </td>

            <td>
              ${reportData.acceptable}
            </td>

            <td class="label">
              Near Spoilage
            </td>

            <td>
              ${reportData.nearSpoilage}
            </td>

            <td class="label">
              Spoiled / Expired
            </td>

            <td>
              ${reportData.spoiled}
            </td>

            <td class="label">
              Pending
            </td>

            <td>
              ${reportData.pending}
            </td>

            <td colspan="11"></td>

          </tr>


          <tr>
            <td
              colspan="21"
            ></td>
          </tr>


          <tr>
            <td
              colspan="21"
              class="title"
            >
              Shelf-Life Report
            </td>
          </tr>


          <tr>

            <td class="label">
              Total Shelf-Life
            </td>

            <td>
              ${reportData.totalShelfLifeDays}
              days
            </td>

            <td class="label">
              Remaining Shelf-Life
            </td>

            <td>
              ${reportData.remainingShelfLifeDays}
              days
            </td>

            <td class="label">
              Near Expiry
            </td>

            <td>
              ${reportData.nearExpiry}
            </td>

            <td class="label">
              Expired
            </td>

            <td>
              ${reportData.expired}
            </td>

            <td class="label">
              High/Critical Risk
            </td>

            <td>
              ${reportData.highRiskShelfLife}
            </td>

            <td colspan="11"></td>

          </tr>


          <tr>
            <td
              colspan="21"
            ></td>
          </tr>


          <tr>
            <td
              colspan="21"
              class="title"
            >
              Storage & Environmental Monitoring
            </td>
          </tr>


          <tr>

            <td class="label">
              Storage Recorded
            </td>

            <td>
              ${reportData.storageRecorded}
            </td>

            <td class="label">
              Temperature Recorded
            </td>

            <td>
              ${reportData.temperatureRecorded}
            </td>

            <td class="label">
              Humidity Recorded
            </td>

            <td>
              ${reportData.humidityRecorded}
            </td>

            <td class="label">
              Packaging Recorded
            </td>

            <td>
              ${reportData.packagingRecorded}
            </td>

            <td class="label">
              Air Circulation
            </td>

            <td>
              ${reportData.airCirculationRecorded}
            </td>

            <td class="label">
              Light Exposure
            </td>

            <td>
              ${reportData.lightExposureRecorded}
            </td>

            <td colspan="9"></td>

          </tr>


          <tr>
            <td
              colspan="21"
            ></td>
          </tr>


          <tr>
            <td
              colspan="21"
              class="title"
            >
              Inventory Quality &
              Milestone-3 Analysis
            </td>
          </tr>


          <tr>

            <th>Food</th>
            <th>Category</th>
            <th>AI Score</th>
            <th>Health</th>
            <th>Quality</th>
            <th>Manufacturing Date</th>
            <th>Expiry Date</th>
            <th>Total Shelf-Life</th>
            <th>Remaining Shelf-Life</th>
            <th>Shelf-Life Risk</th>
            <th>Confidence</th>
            <th>Storage</th>
            <th>Temperature</th>
            <th>Humidity</th>
            <th>Packaging</th>
            <th>Storage Duration</th>
            <th>Air Circulation</th>
            <th>Light Exposure</th>
            <th>Storage Compliance</th>
            <th>Expired</th>
            <th>Near Expiry</th>

          </tr>


          ${tableRows}

        </table>

      </body>

    </html>
  `;

  downloadBlob(
    html,
    "application/vnd.ms-excel;charset=utf-8",
    `FreshGuard_Report_${getTodayKey()}.xls`
  );
}


// ============================================================
// REPORT CARD
// ============================================================

function ReportCard({
  icon,
  label,
  value,
  description,
  tone = "green",
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e3efe8",
        borderRadius: "20px",
        padding: "20px",
        boxShadow:
          "0 10px 28px rgba(0,70,35,0.05)",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            tone === "red"
              ? "#fff1f1"
              : tone === "yellow"
              ? "#fff8df"
              : tone === "blue"
              ? "#edf8ff"
              : "#e9fbf0",
          fontSize: "22px",
          marginBottom: "14px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "#71827b",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.7px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: "#073b27",
          fontSize: "28px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#71827b",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}


// ============================================================
// REPORT SECTION
// ============================================================

function ReportSection({
  eyebrow,
  title,
  description,
  children,
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e3efe8",
        borderRadius: "24px",
        padding: "24px",
        boxShadow:
          "0 12px 34px rgba(0,70,35,0.05)",
        marginTop: "22px",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            color: "#08a94f",
            fontSize: "11px",
            fontWeight: 850,
            letterSpacing: "1.5px",
          }}
        >
          {eyebrow}
        </div>

        <h2
          style={{
            margin:
              "7px 0 5px",
            color: "#073b27",
            fontSize: "24px",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#71827b",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}


// ============================================================
// MAIN REPORTS PAGE
// ============================================================

export default function Reports({
  onBack,
  role: roleProp,
}) {
  const [foods, setFoods] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [storageFilter, setStorageFilter] =
    useState("all");

  const userRole = (
    roleProp ||
    localStorage.getItem(
      "user_role"
    ) ||
    "consumer"
  ).toLowerCase();


  const roleConfig = {
    consumer: {
      label: "CONSUMER REPORTS",
      title:
        "Your food freshness intelligence.",
      description:
        "Review your food freshness, shelf-life, inventory quality, waste risk and storage information.",
      focus: [
        "Freshness",
        "Shelf-Life",
        "Inventory Quality",
        "Waste Reduction",
        "Storage",
      ],
    },

    retail_manager: {
      label:
        "RETAIL OPERATIONS REPORTS",
      title:
        "Retail freshness intelligence.",
      description:
        "Monitor product freshness, inventory quality, shelf-life risk and waste-reduction opportunities.",
      focus: [
        "Freshness",
        "Inventory Quality",
        "Shelf-Life",
        "Waste Reduction",
        "Storage Monitoring",
      ],
    },

    warehouse_operator: {
      label:
        "WAREHOUSE OPERATIONS REPORTS",
      title:
        "Warehouse storage intelligence.",
      description:
        "Monitor inventory health, batch freshness, shelf-life risk and recorded environmental storage conditions.",
      focus: [
        "Inventory Quality",
        "Shelf-Life",
        "Storage Compliance",
        "Environmental Monitoring",
        "Waste Reduction",
      ],
    },

    food_quality_inspector: {
      label:
        "QUALITY INSPECTION REPORTS",
      title:
        "Food quality inspection intelligence.",
      description:
        "Review freshness scores, quality classifications, spoilage indicators, expiry risk and inspection data.",
      focus: [
        "Freshness",
        "Inventory Quality",
        "Shelf-Life",
        "Storage Analysis",
        "Quality Risk",
      ],
    },

    administrator: {
      label:
        "PLATFORM ADMINISTRATION REPORTS",
      title:
        "FreshGuard platform intelligence.",
      description:
        "Review platform inventory, freshness, shelf-life, waste and storage reporting from the existing data source.",
      focus: [
        "Inventory Quality",
        "Freshness",
        "Shelf-Life",
        "Waste Reduction",
        "Storage",
        "Analytics",
      ],
    },
  };


  const currentRoleConfig =
    roleConfig[userRole] ||
    roleConfig.consumer;


  // ==========================================================
  // LOAD INVENTORY
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      try {
        setLoading(true);
        setError("");

        const data =
          await getFoods();

        if (!mounted) {
          return;
        }

        setFoods(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(
          err?.message ||
            "Unable to load report data."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      mounted = false;
    };
  }, []);


  // ==========================================================
  // REPORT CALCULATIONS
  // ==========================================================

  const reportData =
    useMemo(() => {

      const total =
        foods.length;


      const fresh =
        foods.filter((food) => {
          const status =
            getStatus(food);

          return (
            status === "Fresh" ||
            status === "Good"
          );
        }).length;


      const acceptable =
        foods.filter(
          (food) =>
            getStatus(food) ===
            "Acceptable"
        ).length;


      const nearSpoilage =
        foods.filter(
          (food) =>
            getStatus(food) ===
            "Near Spoilage"
        ).length;


      const spoiled =
        foods.filter((food) => {
          const status =
            getStatus(food);

          return (
            status === "Spoiled" ||
            status === "Expired"
          );
        }).length;


      const pending =
        foods.filter(
          (food) =>
            getStatus(food) ===
            "Pending"
        ).length;


      const expired =
        foods.filter(
          (food) =>
            isExpired(food)
        ).length;


      const nearExpiry =
        foods.filter(
          (food) =>
            isNearExpiry(food)
        ).length;


      const analysedScores =
        foods
          .map(
            getFreshnessScore
          )
          .filter(
            (score) =>
              score !== null
          );


      const averageScore =
        analysedScores.length
          ? analysedScores.reduce(
              (sum, score) =>
                sum + score,
              0
            ) /
            analysedScores.length
          : null;


      const healthScores =
        foods
          .map(
            getOverallHealthScore
          )
          .filter(
            (score) =>
              score !== null
          );


      const averageHealthScore =
        healthScores.length
          ? healthScores.reduce(
              (sum, score) =>
                sum + score,
              0
            ) /
            healthScores.length
          : null;


      const storageComplianceScores =
        foods
          .map(
            getStorageComplianceScore
          )
          .filter(
            (score) =>
              score !== null
          );


      const averageStorageCompliance =
        storageComplianceScores.length
          ? storageComplianceScores.reduce(
              (sum, score) =>
                sum + score,
              0
            ) /
            storageComplianceScores.length
          : null;


      const confidenceScores =
        foods
          .map(
            getShelfLifeConfidence
          )
          .filter(
            (score) =>
              score !== null
          );


      const averageShelfLifeConfidence =
        confidenceScores.length
          ? confidenceScores.reduce(
              (sum, score) =>
                sum + score,
              0
            ) /
            confidenceScores.length
          : null;


      const storageRecorded =
        foods.filter(
          (food) =>
            getStorageCompliance(
              food
            ) === "Recorded"
        ).length;


      const refrigerated =
        foods.filter((food) => {
          const storage =
            lower(
              food?.storage_condition
            );

          return (
            storage.includes(
              "refrigerator"
            ) ||
            storage.includes(
              "fridge"
            )
          );
        }).length;


      const frozen =
        foods.filter((food) =>
          lower(
            food?.storage_condition
          ).includes(
            "freezer"
          )
        ).length;


      const roomTemperature =
        foods.filter((food) =>
          lower(
            food?.storage_condition
          ).includes(
            "room"
          )
        ).length;


      const temperatureRecorded =
        foods.filter(
          (food) =>
            toNumber(
              food?.storage_temperature
            ) !== null
        ).length;


      const humidityRecorded =
        foods.filter(
          (food) =>
            toNumber(
              food?.storage_humidity
            ) !== null
        ).length;


      const packagingRecorded =
        foods.filter(
          (food) =>
            normalise(
              food?.packaging_type
            ) !== ""
        ).length;


      const storageDurationRecorded =
        foods.filter(
          (food) =>
            toNumber(
              food?.storage_duration
            ) !== null
        ).length;


      const airCirculationRecorded =
        foods.filter(
          (food) =>
            normalise(
              food?.air_circulation
            ) !== ""
        ).length;


      const lightExposureRecorded =
        foods.filter(
          (food) =>
            normalise(
              food?.light_exposure
            ) !== ""
        ).length;


      const environmentalComplete =
        foods.filter(
          (food) =>
            getEnvironmentalCompleteness(
              food
            ) === 6
        ).length;


      const totalShelfLifeDays =
        foods.reduce(
          (sum, food) => {
            const shelf =
              getTotalShelfLife(
                food
              );

            return (
              sum +
              (
                shelf === null
                  ? 0
                  : Math.max(
                      0,
                      shelf
                    )
              )
            );
          },
          0
        );


      const remainingShelfLifeDays =
        foods.reduce(
          (sum, food) => {
            const remaining =
              getRemainingShelfLife(
                food
              );

            if (
              remaining === null
            ) {
              return sum;
            }

            return (
              sum +
              Math.max(
                0,
                remaining
              )
            );
          },
          0
        );


      const riskCounts =
        foods.reduce(
          (accumulator, food) => {
            const risk =
              lower(
                getShelfLifeRisk(
                  food
                )
              );

            if (
              risk.includes(
                "expired"
              )
            ) {
              accumulator.expired += 1;
            } else if (
              risk.includes(
                "critical"
              )
            ) {
              accumulator.critical += 1;
            } else if (
              risk.includes(
                "high"
              )
            ) {
              accumulator.high += 1;
            } else if (
              risk.includes(
                "medium"
              )
            ) {
              accumulator.medium += 1;
            } else if (
              risk.includes(
                "low"
              )
            ) {
              accumulator.low += 1;
            }

            return accumulator;
          },
          {
            expired: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          }
        );


      const highRiskShelfLife =
        riskCounts.critical +
        riskCounts.high;


      const actionOpportunities =
        nearExpiry +
        nearSpoilage +
        highRiskShelfLife;


      const lowHealthItems =
        foods.filter(
          (food) => {
            const score =
              getOverallHealthScore(
                food
              );

            return (
              score !== null &&
              score < 50
            );
          }
        ).length;


      return {
        total,
        fresh,
        acceptable,
        nearSpoilage,
        spoiled,
        pending,
        expired,
        nearExpiry,
        averageScore,
        averageHealthScore,
        averageStorageCompliance,
        averageShelfLifeConfidence,
        storageRecorded,
        refrigerated,
        frozen,
        roomTemperature,
        temperatureRecorded,
        humidityRecorded,
        packagingRecorded,
        storageDurationRecorded,
        airCirculationRecorded,
        lightExposureRecorded,
        environmentalComplete,
        totalShelfLifeDays,
        remainingShelfLifeDays,
        riskCounts,
        highRiskShelfLife,
        actionOpportunities,
        lowHealthItems,
      };

    }, [foods]);


  // ==========================================================
  // FILTERED INVENTORY
  // ==========================================================

  const filteredFoods =
    useMemo(() => {

      const searchValue =
        lower(search);

      return foods.filter(
        (food) => {

          const matchesSearch =
            !searchValue ||
            lower(
              food?.food_name
            ).includes(
              searchValue
            ) ||
            lower(
              food?.category
            ).includes(
              searchValue
            );


          const status =
            getStatus(food);


          const matchesStatus =
            statusFilter === "all" ||
            lower(status) ===
              lower(statusFilter);


          const storage =
            getStorageStatus(food);


          const matchesStorage =
            storageFilter === "all" ||
            lower(storage) ===
              lower(storageFilter);


          return (
            matchesSearch &&
            matchesStatus &&
            matchesStorage
          );
        }
      );

    }, [
      foods,
      search,
      statusFilter,
      storageFilter,
    ]);


  // ==========================================================
  // TOP AI / MILESTONE 3 INSIGHTS
  // ==========================================================

  const intelligenceInsights =
    useMemo(() => {

      const insights = [];

      if (
        reportData.highRiskShelfLife >
        0
      ) {
        insights.push({
          icon: "⚠️",
          title:
            "Shelf-Life Risk Detected",
          value:
            reportData.highRiskShelfLife,
          description:
            "Items have high or critical shelf-life risk and should be prioritised for review.",
          tone: "yellow",
        });
      }

      if (
        reportData.lowHealthItems >
        0
      ) {
        insights.push({
          icon: "🩺",
          title:
            "Low Health Items",
          value:
            reportData.lowHealthItems,
          description:
            "Items have an overall food health score below 50.",
          tone: "red",
        });
      }

      if (
        reportData.temperatureRecorded <
        reportData.total
      ) {
        insights.push({
          icon: "🌡️",
          title:
            "Temperature Data",
          value:
            `${reportData.temperatureRecorded}/${reportData.total}`,
          description:
            "Inventory items with recorded storage temperature data.",
          tone: "blue",
        });
      }

      if (
        reportData.humidityRecorded <
        reportData.total
      ) {
        insights.push({
          icon: "💧",
          title:
            "Humidity Data",
          value:
            `${reportData.humidityRecorded}/${reportData.total}`,
          description:
            "Inventory items with recorded humidity data.",
          tone: "blue",
        });
      }

      if (
        reportData.averageStorageCompliance !==
          null &&
        reportData.averageStorageCompliance <
          70
      ) {
        insights.push({
          icon: "❄️",
          title:
            "Storage Review",
          value:
            reportData.averageStorageCompliance.toFixed(
              1
            ),
          description:
            "Average stored storage-compliance score indicates that storage conditions need review.",
          tone: "yellow",
        });
      }

      if (
        insights.length === 0
      ) {
        insights.push({
          icon: "🤖",
          title:
            "AI Monitoring",
          value:
            "Active",
          description:
            "Freshness, shelf-life and storage analysis data is available for the current inventory.",
          tone: "green",
        });
      }

      return insights.slice(
        0,
        4
      );

    }, [reportData]);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg,#effff5,#fffef5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#073b27",
          fontSize: "16px",
          fontWeight: 800,
        }}
      >
        Loading reports...
      </div>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg,#effff5 0%,#ffffff 55%,#fffdf1 100%)",
        padding:
          "28px 24px 60px",
        boxSizing: "border-box",
      }}
    >

      <div
        style={{
          maxWidth: "1250px",
          margin: "0 auto",
        }}
      >

        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >

          <button
            type="button"
            onClick={onBack}
            style={{
              border:
                "1px solid #dcece3",
              background:
                "#ffffff",
              color:
                "#08783d",
              borderRadius:
                "12px",
              padding:
                "10px 16px",
              fontWeight: 800,
              cursor:
                "pointer",
            }}
          >
            ← Back to Dashboard
          </button>


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
                fontSize:
                  "11px",
                fontWeight:
                  850,
                letterSpacing:
                  "1.5px",
              }}
            >
              {
                currentRoleConfig.label
              }
            </div>


            <div
              style={{
                color:
                  "#073b27",
                fontSize:
                  "12px",
                marginTop:
                  "4px",
              }}
            >
              {
                currentRoleConfig.description
              }
            </div>

          </div>

        </div>


        {/* ====================================================
            HERO
        ==================================================== */}

        <section
          style={{
            marginTop:
              "24px",
            background:
              "linear-gradient(120deg,#ffffff,#effff5)",
            border:
              "1px solid #dcefe4",
            borderRadius:
              "28px",
            padding:
              "34px",
            boxShadow:
              "0 18px 50px rgba(0,70,35,0.07)",
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
                "25px",
              flexWrap:
                "wrap",
            }}
          >

            <div>

              <div
                style={{
                  color:
                    "#08a94f",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                  letterSpacing:
                    "1.7px",
                }}
              >
                {
                  currentRoleConfig.label
                }
              </div>


              <h1
                style={{
                  margin:
                    "8px 0 10px",
                  color:
                    "#073b27",
                  fontSize:
                    "clamp(32px,5vw,54px)",
                  lineHeight:
                    1.02,
                }}
              >

                {
                  currentRoleConfig.title
                    .split(" ")
                    .slice(0, 2)
                    .join(" ")
                }

                <br />

                <span
                  style={{
                    color:
                      "#08a94f",
                  }}
                >
                  {
                    currentRoleConfig.title
                      .split(" ")
                      .slice(2)
                      .join(" ")
                  }
                </span>

              </h1>


              <p
                style={{
                  maxWidth:
                    "650px",
                  margin:
                    0,
                  color:
                    "#71827b",
                  fontSize:
                    "14px",
                  lineHeight:
                    1.7,
                }}
              >
                {
                  currentRoleConfig.description
                }
              </p>

            </div>


            <div
              style={{
                width:
                  "125px",
                height:
                  "125px",
                borderRadius:
                  "50%",
                background:
                  "#ffffff",
                border:
                  "12px solid #dff5e8",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                flexDirection:
                  "column",
                boxShadow:
                  "0 12px 30px rgba(0,70,35,0.08)",
              }}
            >

              <span
                style={{
                  fontSize:
                    "30px",
                }}
              >
                📊
              </span>

              <span
                style={{
                  color:
                    "#08783d",
                  fontSize:
                    "11px",
                  fontWeight:
                    850,
                }}
              >
                REPORTS
              </span>

            </div>

          </div>

        </section>


        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px 16px",
              borderRadius:
                "14px",
              background:
                "#fff4f3",
              border:
                "1px solid #f4d6d2",
              color:
                "#a33a2e",
              fontSize:
                "13px",
              fontWeight:
                700,
            }}
          >
            {error}
          </div>
        )}


        {/* ====================================================
            ROLE-SPECIFIC REPORT FOCUS
        ==================================================== */}

        <section
          style={{
            marginTop:
              "22px",
            padding:
              "20px",
            background:
              "rgba(255,255,255,.82)",
            border:
              "1px solid #e3efe8",
            borderRadius:
              "22px",
            boxShadow:
              "0 12px 30px rgba(0,70,35,0.05)",
          }}
        >

          <div
            style={{
              color:
                "#08a94f",
              fontSize:
                "11px",
              fontWeight:
                900,
              letterSpacing:
                "1.5px",
            }}
          >
            ROLE-SPECIFIC WORKSPACE
          </div>


          <div
            style={{
              marginTop:
                "12px",
              display:
                "flex",
              flexWrap:
                "wrap",
              gap:
                "10px",
            }}
          >

            {
              currentRoleConfig.focus.map(
                (item) => (
                  <span
                    key={item}
                    style={{
                      padding:
                        "9px 13px",
                      borderRadius:
                        "999px",
                      background:
                        "#e9fbf0",
                      border:
                        "1px solid #d2efde",
                      color:
                        "#08783d",
                      fontSize:
                        "12px",
                      fontWeight:
                        850,
                    }}
                  >
                    ✓ {item}
                  </span>
                )
              )
            }

          </div>

        </section>


        {/* ====================================================
            SUMMARY CARDS
        ==================================================== */}

        <section
          style={{
            marginTop:
              "22px",
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(190px,1fr))",
            gap:
              "16px",
          }}
        >

          <ReportCard
            icon="🍱"
            label="Total Inventory"
            value={
              reportData.total
            }
            description="Total food items currently stored in the inventory."
          />


          <ReportCard
            icon="🌱"
            label="Fresh / Good"
            value={
              reportData.fresh
            }
            description="Items currently classified as fresh or good."
          />


          <ReportCard
            icon="⚠️"
            label="At Risk"
            value={
              reportData.nearSpoilage +
              reportData.spoiled
            }
            description="Items requiring attention because freshness is declining."
            tone="yellow"
          />


          <ReportCard
            icon="⏳"
            label="Near Expiry"
            value={
              reportData.nearExpiry
            }
            description="Items reaching expiry within the next three days."
            tone="yellow"
          />


          <ReportCard
            icon="🚨"
            label="Expired"
            value={
              reportData.expired
            }
            description="Inventory items whose expiry date has passed."
            tone="red"
          />


          <ReportCard
            icon="🧠"
            label="Average AI Score"
            value={
              reportData.averageScore ===
              null
                ? "N/A"
                : reportData.averageScore.toFixed(
                    1
                  )
            }
            description="Average freshness score from analysed inventory items."
            tone="blue"
          />

        </section>


        {/* ====================================================
            MILESTONE 3 INTELLIGENCE
        ==================================================== */}

        <ReportSection
          eyebrow="MILESTONE 3"
          title="AI Freshness & Storage Intelligence"
          description="Current inventory-level analytics using stored freshness, shelf-life, storage and environmental prediction outputs."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(190px,1fr))",
              gap:
                "14px",
            }}
          >

            <ReportCard
              icon="🩺"
              label="Average Food Health"
              value={
                reportData.averageHealthScore ===
                null
                  ? "N/A"
                  : `${reportData.averageHealthScore.toFixed(
                      1
                    )}%`
              }
              description="Average overall food health score from stored analysis."
              tone={
                getHealthTone(
                  reportData.averageHealthScore
                )
              }
            />


            <ReportCard
              icon="❄️"
              label="Storage Compliance"
              value={
                reportData.averageStorageCompliance ===
                null
                  ? "N/A"
                  : `${reportData.averageStorageCompliance.toFixed(
                      1
                    )}%`
              }
              description="Average stored storage-compliance score."
              tone={
                getHealthTone(
                  reportData.averageStorageCompliance
                )
              }
            />


            <ReportCard
              icon="🎯"
              label="Shelf-Life Confidence"
              value={
                reportData.averageShelfLifeConfidence ===
                null
                  ? "N/A"
                  : `${reportData.averageShelfLifeConfidence.toFixed(
                      1
                    )}%`
              }
              description="Average confidence of stored shelf-life predictions."
              tone="blue"
            />


            <ReportCard
              icon="⚠️"
              label="High / Critical Risk"
              value={
                reportData.highRiskShelfLife
              }
              description="Items with high or critical shelf-life risk."
              tone={
                reportData.highRiskShelfLife >
                0
                  ? "red"
                  : "green"
              }
            />

          </div>


          <div
            style={{
              marginTop:
                "18px",
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(190px,1fr))",
              gap:
                "12px",
            }}
          >

            {intelligenceInsights.map(
              (insight) => (
                <div
                  key={
                    insight.title
                  }
                  style={{
                    padding:
                      "16px",
                    borderRadius:
                      "16px",
                    background:
                      insight.tone ===
                      "red"
                        ? "#fff4f3"
                        : insight.tone ===
                          "yellow"
                        ? "#fffaf0"
                        : insight.tone ===
                          "blue"
                        ? "#f2f9ff"
                        : "#f3fff7",
                    border:
                      insight.tone ===
                      "red"
                        ? "1px solid #f4d6d2"
                        : insight.tone ===
                          "yellow"
                        ? "1px solid #f1e4ba"
                        : insight.tone ===
                          "blue"
                        ? "1px solid #dcecf7"
                        : "1px solid #dcefe4",
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        "22px",
                    }}
                  >
                    {
                      insight.icon
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "9px",
                      color:
                        "#71827b",
                      fontSize:
                        "10px",
                      fontWeight:
                        850,
                      letterSpacing:
                        ".6px",
                      textTransform:
                        "uppercase",
                    }}
                  >
                    {
                      insight.title
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      color:
                        "#073b27",
                      fontSize:
                        "22px",
                      fontWeight:
                        900,
                    }}
                  >
                    {
                      insight.value
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "5px",
                      color:
                        "#71827b",
                      fontSize:
                        "11px",
                      lineHeight:
                        1.5,
                    }}
                  >
                    {
                      insight.description
                    }
                  </div>

                </div>
              )
            )}

          </div>


          <div
            style={{
              marginTop:
                "18px",
              padding:
                "16px",
              borderRadius:
                "16px",
              background:
                "#f8fcfa",
              border:
                "1px solid #e3efe8",
              color:
                "#60756b",
              fontSize:
                "12px",
              lineHeight:
                1.65,
            }}
          >
            <strong
              style={{
                color:
                  "#08783d",
              }}
            >
              AI monitoring inputs:
            </strong>{" "}
            freshness score, overall food health,
            remaining shelf-life, shelf-life confidence,
            shelf-life risk, storage compliance,
            temperature, humidity, packaging,
            storage duration, air circulation and
            light exposure.
          </div>

        </ReportSection>


        {/* ====================================================
            FRESHNESS REPORT
        ==================================================== */}

        <ReportSection
          eyebrow="REPORT 01"
          title="Freshness Report"
          description="Overview of the current freshness condition of food items in the inventory."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(180px,1fr))",
              gap:
                "14px",
            }}
          >

            {[
              [
                "Fresh / Good",
                reportData.fresh,
                "🌱",
              ],
              [
                "Acceptable",
                reportData.acceptable,
                "✓",
              ],
              [
                "Near Spoilage",
                reportData.nearSpoilage,
                "⚠️",
              ],
              [
                "Spoiled / Expired",
                reportData.spoiled,
                "🚨",
              ],
              [
                "Pending",
                reportData.pending,
                "⏳",
              ],
            ].map(
              (item) => (
                <div
                  key={
                    item[0]
                  }
                  style={{
                    padding:
                      "18px",
                    borderRadius:
                      "17px",
                    background:
                      "#f8fcfa",
                    border:
                      "1px solid #e5f0e9",
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        "22px",
                    }}
                  >
                    {
                      item[2]
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "10px",
                      color:
                        "#6f8078",
                      fontSize:
                        "11px",
                      fontWeight:
                        800,
                      textTransform:
                        "uppercase",
                    }}
                  >
                    {
                      item[0]
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      color:
                        "#073b27",
                      fontSize:
                        "27px",
                      fontWeight:
                        900,
                    }}
                  >
                    {
                      item[1]
                    }
                  </div>

                </div>
              )
            )}

          </div>

        </ReportSection>


        {/* ====================================================
            SHELF LIFE REPORT
        ==================================================== */}

        <ReportSection
          eyebrow="REPORT 02"
          title="Shelf-Life Report"
          description="Expiry, remaining shelf-life, prediction confidence and risk information from the current inventory."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(210px,1fr))",
              gap:
                "15px",
            }}
          >

            <ReportCard
              icon="📅"
              label="Total Shelf-Life"
              value={`${reportData.totalShelfLifeDays} days`}
              description="Combined recorded shelf-life duration across inventory."
            />


            <ReportCard
              icon="⏱️"
              label="Remaining Shelf-Life"
              value={`${reportData.remainingShelfLifeDays} days`}
              description="Combined non-negative remaining shelf-life from stored prediction or expiry dates."
              tone="blue"
            />


            <ReportCard
              icon="🎯"
              label="Prediction Confidence"
              value={
                reportData.averageShelfLifeConfidence ===
                null
                  ? "N/A"
                  : `${reportData.averageShelfLifeConfidence.toFixed(
                      1
                    )}%`
              }
              description="Average shelf-life prediction confidence."
              tone="blue"
            />


            <ReportCard
              icon="⚠️"
              label="High / Critical Risk"
              value={
                reportData.highRiskShelfLife
              }
              description="Items requiring priority review because shelf-life risk is high or critical."
              tone={
                reportData.highRiskShelfLife >
                0
                  ? "red"
                  : "green"
              }
            />


            <ReportCard
              icon="⏳"
              label="Near Expiry"
              value={
                reportData.nearExpiry
              }
              description="Items with expiry approaching within three days."
              tone="yellow"
            />


            <ReportCard
              icon="🚨"
              label="Expired"
              value={
                reportData.expired
              }
              description="Items whose registered expiry date has passed."
              tone="red"
            />

          </div>


          <div
            style={{
              marginTop:
                "18px",
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(170px,1fr))",
              gap:
                "10px",
            }}
          >

            {[
              [
                "Low Risk",
                reportData.riskCounts.low,
                "🟢",
              ],
              [
                "Medium Risk",
                reportData.riskCounts.medium,
                "🟡",
              ],
              [
                "High Risk",
                reportData.riskCounts.high,
                "🟠",
              ],
              [
                "Critical Risk",
                reportData.riskCounts.critical,
                "🔴",
              ],
            ].map(
              (item) => (
                <div
                  key={
                    item[0]
                  }
                  style={{
                    padding:
                      "14px",
                    borderRadius:
                      "14px",
                    background:
                      "#f8fcfa",
                    border:
                      "1px solid #e3efe8",
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        "20px",
                    }}
                  >
                    {
                      item[2]
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "7px",
                      color:
                        "#71827b",
                      fontSize:
                        "10px",
                      fontWeight:
                        850,
                      textTransform:
                        "uppercase",
                    }}
                  >
                    {
                      item[0]
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      color:
                        "#073b27",
                      fontSize:
                        "22px",
                      fontWeight:
                        900,
                    }}
                  >
                    {
                      item[1]
                    }
                  </div>

                </div>
              )
            )}

          </div>

        </ReportSection>


        {/* ====================================================
            INVENTORY QUALITY REPORT
        ==================================================== */}

        <ReportSection
          eyebrow="REPORT 03"
          title="Inventory Quality Report"
          description="Food-by-food quality, freshness, health, shelf-life and storage intelligence using the existing stored analysis."
        >

          {/* FILTERS */}

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(210px,1fr))",
              gap:
                "12px",
              marginBottom:
                "18px",
            }}
          >

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search food or category..."
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding:
                  "12px 14px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #dcebe3",
                outline:
                  "none",
                fontSize:
                  "13px",
              }}
            />


            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              style={{
                padding:
                  "12px 14px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #dcebe3",
                background:
                  "#fff",
                color:
                  "#073b27",
                fontSize:
                  "13px",
                fontWeight:
                  700,
              }}
            >

              <option value="all">
                All quality statuses
              </option>

              <option value="Fresh">
                Fresh
              </option>

              <option value="Good">
                Good
              </option>

              <option value="Acceptable">
                Acceptable
              </option>

              <option value="Near Spoilage">
                Near Spoilage
              </option>

              <option value="Spoiled">
                Spoiled
              </option>

              <option value="Expired">
                Expired
              </option>

              <option value="Pending">
                Pending
              </option>

            </select>


            <select
              value={
                storageFilter
              }
              onChange={(event) =>
                setStorageFilter(
                  event.target.value
                )
              }
              style={{
                padding:
                  "12px 14px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #dcebe3",
                background:
                  "#fff",
                color:
                  "#073b27",
                fontSize:
                  "13px",
                fontWeight:
                  700,
              }}
            >

              <option value="all">
                All storage
              </option>

              <option value="Refrigerator">
                Refrigerator
              </option>

              <option value="Freezer">
                Freezer
              </option>

              <option value="Room Temperature">
                Room Temperature
              </option>

            </select>

          </div>


          {/* INVENTORY TABLE */}

          {filteredFoods.length ===
          0 ? (
            <div
              style={{
                padding:
                  "35px",
                textAlign:
                  "center",
                borderRadius:
                  "18px",
                background:
                  "#f7fcf9",
                color:
                  "#71827b",
                fontSize:
                  "13px",
              }}
            >
              No inventory items match
              the selected filters.
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
                border:
                  "1px solid #e3efe8",
                borderRadius:
                  "17px",
              }}
            >

              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "1500px",
                }}
              >

                <thead>

                  <tr
                    style={{
                      background:
                        "#f4fbf7",
                    }}
                  >

                    {[
                      "Food",
                      "Category",
                      "AI Score",
                      "Health",
                      "Quality",
                      "Remaining",
                      "Risk",
                      "Confidence",
                      "Expiry",
                      "Storage",
                      "Temp",
                      "Humidity",
                      "Packaging",
                      "Duration",
                      "Air",
                      "Light",
                      "Storage Score",
                    ].map(
                      (heading) => (
                        <th
                          key={
                            heading
                          }
                          style={{
                            textAlign:
                              "left",
                            padding:
                              "13px 14px",
                            fontSize:
                              "10px",
                            color:
                              "#60756b",
                            letterSpacing:
                              ".5px",
                            textTransform:
                              "uppercase",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            heading
                          }
                        </th>
                      )
                    )}

                  </tr>

                </thead>


                <tbody>

                  {filteredFoods.map(
                    (food) => {

                      const score =
                        getFreshnessScore(
                          food
                        );

                      const health =
                        getOverallHealthScore(
                          food
                        );

                      const storageScore =
                        getStorageComplianceScore(
                          food
                        );

                      const confidence =
                        getShelfLifeConfidence(
                          food
                        );

                      const remaining =
                        getRemainingShelfLife(
                          food
                        );

                      const status =
                        getStatus(
                          food
                        );

                      const risk =
                        getShelfLifeRisk(
                          food
                        );

                      const expired =
                        isExpired(
                          food
                        );

                      const temperature =
                        toNumber(
                          food?.storage_temperature
                        );

                      const humidity =
                        toNumber(
                          food?.storage_humidity
                        );

                      const packaging =
                        normalise(
                          food?.packaging_type
                        );

                      const duration =
                        toNumber(
                          food?.storage_duration
                        );

                      const air =
                        normalise(
                          food?.air_circulation
                        );

                      const light =
                        normalise(
                          food?.light_exposure
                        );

                      return (
                        <tr
                          key={
                            food.id
                          }
                          style={{
                            borderTop:
                              "1px solid #edf3ef",
                          }}
                        >

                          {/* FOOD */}

                          <td
                            style={{
                              padding:
                                "14px",
                            }}
                          >

                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap:
                                  "10px",
                              }}
                            >

                              <span
                                style={{
                                  width:
                                    "38px",
                                  height:
                                    "38px",
                                  borderRadius:
                                    "11px",
                                  background:
                                    "#e9fbf0",
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
                                {
                                  getFoodEmoji(
                                    food.category,
                                    food.food_name
                                  )
                                }
                              </span>


                              <strong
                                style={{
                                  color:
                                    "#073b27",
                                  fontSize:
                                    "13px",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {
                                  food.food_name
                                }
                              </strong>

                            </div>

                          </td>


                          {/* CATEGORY */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                "#71827b",
                              fontSize:
                                "12px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              food.category ||
                              "Other"
                            }
                          </td>


                          {/* AI SCORE */}

                          <td
                            style={{
                              padding:
                                "14px",
                            }}
                          >

                            <span
                              style={{
                                fontWeight:
                                  900,
                                color:
                                  score ===
                                  null
                                    ? "#71827b"
                                    : score >=
                                      60
                                    ? "#08783d"
                                    : score >=
                                      40
                                    ? "#a56b00"
                                    : "#c23b30",
                              }}
                            >
                              {score ===
                              null
                                ? "N/A"
                                : score.toFixed(
                                    1
                                  )}
                            </span>

                          </td>


                          {/* HEALTH */}

                          <td
                            style={{
                              padding:
                                "14px",
                            }}
                          >

                            <span
                              style={{
                                fontWeight:
                                  900,
                                color:
                                  health ===
                                  null
                                    ? "#71827b"
                                    : health >=
                                      70
                                    ? "#08783d"
                                    : health >=
                                      40
                                    ? "#a56b00"
                                    : "#c23b30",
                              }}
                            >
                              {health ===
                              null
                                ? "N/A"
                                : health.toFixed(
                                    1
                                  )}
                            </span>

                          </td>


                          {/* QUALITY */}

                          <td
                            style={{
                              padding:
                                "14px",
                            }}
                          >

                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "6px 9px",
                                borderRadius:
                                  "999px",
                                background:
                                  status ===
                                    "Fresh" ||
                                  status ===
                                    "Good"
                                    ? "#e9fbf0"
                                    : status ===
                                        "Expired" ||
                                      status ===
                                        "Spoiled"
                                    ? "#fff0ef"
                                    : "#fff8df",
                                color:
                                  status ===
                                    "Fresh" ||
                                  status ===
                                    "Good"
                                    ? "#08783d"
                                    : status ===
                                        "Expired" ||
                                      status ===
                                        "Spoiled"
                                    ? "#b52e24"
                                    : "#9a6500",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  850,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                status
                              }
                            </span>

                          </td>


                          {/* REMAINING */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                remaining !==
                                  null &&
                                remaining <=
                                  2
                                  ? "#c23b30"
                                  : remaining !==
                                      null &&
                                    remaining <=
                                      5
                                  ? "#a56b00"
                                  : "#08783d",
                              fontSize:
                                "12px",
                              fontWeight:
                                850,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              remaining ===
                              null
                                ? "N/A"
                                : `${Math.max(
                                    0,
                                    remaining
                                  ).toFixed(
                                    1
                                  )} d`
                            }
                          </td>


                          {/* RISK */}

                          <td
                            style={{
                              padding:
                                "14px",
                            }}
                          >

                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "6px 9px",
                                borderRadius:
                                  "999px",
                                background:
                                  getRiskTone(
                                    risk
                                  ) ===
                                  "red"
                                    ? "#fff0ef"
                                    : getRiskTone(
                                        risk
                                      ) ===
                                      "yellow"
                                    ? "#fff8df"
                                    : getRiskTone(
                                        risk
                                      ) ===
                                      "green"
                                    ? "#e9fbf0"
                                    : "#edf8ff",
                                color:
                                  getRiskTone(
                                    risk
                                  ) ===
                                  "red"
                                    ? "#b52e24"
                                    : getRiskTone(
                                        risk
                                      ) ===
                                      "yellow"
                                    ? "#9a6500"
                                    : getRiskTone(
                                        risk
                                      ) ===
                                      "green"
                                    ? "#08783d"
                                    : "#2e6f9e",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  850,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                risk
                              }
                            </span>

                          </td>


                          {/* CONFIDENCE */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                confidence ===
                                null
                                  ? "#71827b"
                                  : confidence >=
                                    70
                                  ? "#08783d"
                                  : confidence >=
                                    50
                                  ? "#a56b00"
                                  : "#c23b30",
                              fontSize:
                                "12px",
                              fontWeight:
                                850,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              confidence ===
                              null
                                ? "N/A"
                                : `${confidence.toFixed(
                                    1
                                  )}%`
                            }
                          </td>


                          {/* EXPIRY */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                expired
                                  ? "#c23b30"
                                  : "#073b27",
                              fontSize:
                                "12px",
                              fontWeight:
                                expired
                                  ? 800
                                  : 600,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              formatDate(
                                food.expiry_date
                              )
                            }
                          </td>


                          {/* STORAGE */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                "#71827b",
                              fontSize:
                                "12px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              getStorageStatus(
                                food
                              )
                            }
                          </td>


                          {/* TEMPERATURE */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                temperature ===
                                null
                                  ? "#71827b"
                                  : "#073b27",
                              fontSize:
                                "12px",
                              fontWeight:
                                temperature ===
                                null
                                  ? 500
                                  : 800,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              temperature ===
                              null
                                ? "N/A"
                                : `${temperature.toFixed(
                                    1
                                  )}°C`
                            }
                          </td>


                          {/* HUMIDITY */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                humidity ===
                                null
                                  ? "#71827b"
                                  : "#073b27",
                              fontSize:
                                "12px",
                              fontWeight:
                                humidity ===
                                null
                                  ? 500
                                  : 800,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              humidity ===
                              null
                                ? "N/A"
                                : `${humidity.toFixed(
                                    1
                                  )}%`
                            }
                          </td>


                          {/* PACKAGING */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                "#71827b",
                              fontSize:
                                "12px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              packaging ||
                              "N/A"
                            }
                          </td>


                          {/* DURATION */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                "#71827b",
                              fontSize:
                                "12px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              duration ===
                              null
                                ? "N/A"
                                : `${duration.toFixed(
                                    1
                                  )} d`
                            }
                          </td>


                          {/* AIR */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                "#71827b",
                              fontSize:
                                "12px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              air ||
                              "N/A"
                            }
                          </td>


                          {/* LIGHT */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                "#71827b",
                              fontSize:
                                "12px",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              light ||
                              "N/A"
                            }
                          </td>


                          {/* STORAGE SCORE */}

                          <td
                            style={{
                              padding:
                                "14px",
                              color:
                                storageScore ===
                                null
                                  ? "#71827b"
                                  : storageScore >=
                                    70
                                  ? "#08783d"
                                  : storageScore >=
                                    40
                                  ? "#a56b00"
                                  : "#c23b30",
                              fontSize:
                                "12px",
                              fontWeight:
                                850,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              storageScore ===
                              null
                                ? "N/A"
                                : storageScore.toFixed(
                                    1
                                  )
                            }
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </ReportSection>


        {/* ====================================================
            AI ACTION INSIGHTS
        ==================================================== */}

        <ReportSection
          eyebrow="AI ACTION PLAN"
          title="Inventory Recommendations"
          description="Action-oriented insights generated from the currently stored freshness, shelf-life and storage analysis."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(250px,1fr))",
              gap:
                "14px",
            }}
          >

            {filteredFoods
              .slice(0, 8)
              .map((food) => {

                const recommendations =
                  getRecommendationForFood(
                    food
                  );

                const health =
                  getOverallHealthScore(
                    food
                  );

                const risk =
                  getShelfLifeRisk(
                    food
                  );

                return (
                  <div
                    key={
                      food.id
                    }
                    style={{
                      padding:
                        "18px",
                      borderRadius:
                        "18px",
                      background:
                        "#f8fcfa",
                      border:
                        "1px solid #e3efe8",
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

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap:
                            "10px",
                        }}
                      >

                        <span
                          style={{
                            width:
                              "38px",
                            height:
                              "38px",
                            borderRadius:
                              "11px",
                            background:
                              "#e9fbf0",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize:
                              "20px",
                          }}
                        >
                          {
                            getFoodEmoji(
                              food.category,
                              food.food_name
                            )
                          }
                        </span>

                        <div>

                          <strong
                            style={{
                              color:
                                "#073b27",
                              fontSize:
                                "13px",
                            }}
                          >
                            {
                              food.food_name
                            }
                          </strong>

                          <div
                            style={{
                              marginTop:
                                "3px",
                              color:
                                "#8a9993",
                              fontSize:
                                "10px",
                            }}
                          >
                            {
                              food.category ||
                              "Other"
                            }
                          </div>

                        </div>

                      </div>


                      <span
                        style={{
                          padding:
                            "5px 8px",
                          borderRadius:
                            "999px",
                          background:
                            getRiskTone(
                              risk
                            ) ===
                            "red"
                              ? "#fff0ef"
                              : getRiskTone(
                                  risk
                                ) ===
                                "yellow"
                              ? "#fff8df"
                              : "#e9fbf0",
                          color:
                            getRiskTone(
                              risk
                            ) ===
                            "red"
                              ? "#b52e24"
                              : getRiskTone(
                                  risk
                                ) ===
                                "yellow"
                              ? "#9a6500"
                              : "#08783d",
                          fontSize:
                            "10px",
                          fontWeight:
                            850,
                        }}
                      >
                        {
                          risk
                        }
                      </span>

                    </div>


                    <div
                      style={{
                        marginTop:
                          "13px",
                        display:
                          "flex",
                        gap:
                          "8px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <span
                        style={{
                          padding:
                            "5px 8px",
                          borderRadius:
                            "8px",
                          background:
                            "#ffffff",
                          border:
                            "1px solid #e3efe8",
                          color:
                            "#60756b",
                          fontSize:
                            "10px",
                          fontWeight:
                            700,
                        }}
                      >
                        Health:{" "}
                        {
                          health ===
                          null
                            ? "N/A"
                            : health.toFixed(
                                1
                              )
                        }
                      </span>


                      <span
                        style={{
                          padding:
                            "5px 8px",
                          borderRadius:
                            "8px",
                          background:
                            "#ffffff",
                          border:
                            "1px solid #e3efe8",
                          color:
                            "#60756b",
                          fontSize:
                            "10px",
                          fontWeight:
                            700,
                        }}
                      >
                        Remaining:{" "}
                        {
                          getRemainingShelfLife(
                            food
                          ) ===
                          null
                            ? "N/A"
                            : `${Math.max(
                                0,
                                getRemainingShelfLife(
                                  food
                                )
                              ).toFixed(
                                1
                              )}d`
                        }
                      </span>

                    </div>


                    <div
                      style={{
                        marginTop:
                          "14px",
                      }}
                    >

                      {
                        recommendations.map(
                          (
                            recommendation,
                            index
                          ) => (
                            <div
                              key={
                                `${food.id}-${index}`
                              }
                              style={{
                                display:
                                  "flex",
                                gap:
                                  "8px",
                                alignItems:
                                  "flex-start",
                                marginTop:
                                  index ===
                                  0
                                    ? 0
                                    : "8px",
                              }}
                            >

                              <span
                                style={{
                                  color:
                                    "#08a94f",
                                  fontSize:
                                    "12px",
                                  lineHeight:
                                    1.5,
                                }}
                              >
                                ✓
                              </span>

                              <span
                                style={{
                                  color:
                                    "#60756b",
                                  fontSize:
                                    "11px",
                                  lineHeight:
                                    1.55,
                                }}
                              >
                                {
                                  recommendation
                                }
                              </span>

                            </div>
                          )
                        )
                      }

                    </div>

                  </div>
                );
              })}

          </div>


          {filteredFoods.length ===
            0 && (
            <div
              style={{
                padding:
                  "20px",
                borderRadius:
                  "14px",
                background:
                  "#f8fcfa",
                color:
                  "#71827b",
                fontSize:
                  "12px",
                textAlign:
                  "center",
              }}
            >
              No inventory items are
              available for recommendation
              analysis.
            </div>
          )}

        </ReportSection>


        {/* ====================================================
            WASTE REDUCTION REPORT
        ==================================================== */}

        <ReportSection
          eyebrow="REPORT 04"
          title="Waste Reduction Report"
          description="Identifies expired, near-expiry, high-risk and low-health inventory that may require action."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap:
                "15px",
            }}
          >

            <ReportCard
              icon="🚨"
              label="Expired Items"
              value={
                reportData.expired
              }
              description="Items that have already passed their expiry date."
              tone="red"
            />


            <ReportCard
              icon="⏳"
              label="Expiry Risk"
              value={
                reportData.nearExpiry
              }
              description="Items approaching their registered expiry date."
              tone="yellow"
            />


            <ReportCard
              icon="⚠️"
              label="Shelf-Life Risk"
              value={
                reportData.highRiskShelfLife
              }
              description="Items with high or critical shelf-life risk."
              tone="red"
            />


            <ReportCard
              icon="♻️"
              label="Low Freshness"
              value={
                reportData.nearSpoilage +
                reportData.spoiled
              }
              description="Items with declining or poor freshness classification."
              tone="red"
            />


            <ReportCard
              icon="🩺"
              label="Low Health"
              value={
                reportData.lowHealthItems
              }
              description="Items with an overall health score below 50."
              tone="yellow"
            />


            <ReportCard
              icon="💡"
              label="Action Opportunities"
              value={
                reportData.actionOpportunities
              }
              description="Items that may benefit from timely consumption, rotation or storage review."
              tone="blue"
            />

          </div>


          <div
            style={{
              marginTop:
                "18px",
              padding:
                "16px",
              borderRadius:
                "16px",
              background:
                "#f3fff7",
              border:
                "1px solid #dcefe4",
              color:
                "#45665a",
              fontSize:
                "13px",
              lineHeight:
                1.6,
            }}
          >
            💡{" "}
            <strong>
              Waste reduction insight:
            </strong>{" "}
            Prioritise expired, high-risk,
            near-expiry and low-health items
            for review and inventory rotation.
            FEFO-based rotation can help
            prioritise items with earlier
            expiry dates.
          </div>

        </ReportSection>


        {/* ====================================================
            STORAGE COMPLIANCE REPORT
        ==================================================== */}

        <ReportSection
          eyebrow="REPORT 05"
          title="Storage Compliance & Environmental Report"
          description="Overview of recorded storage conditions and Milestone-3 environmental parameters."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(190px,1fr))",
              gap:
                "14px",
            }}
          >

            <ReportCard
              icon="📋"
              label="Storage Recorded"
              value={
                reportData.storageRecorded
              }
              description="Inventory items with a registered storage condition."
            />


            <ReportCard
              icon="❄️"
              label="Refrigerated"
              value={
                reportData.refrigerated
              }
              description="Items recorded under refrigerator storage."
              tone="blue"
            />


            <ReportCard
              icon="🧊"
              label="Frozen"
              value={
                reportData.frozen
              }
              description="Items recorded under freezer storage."
              tone="blue"
            />


            <ReportCard
              icon="🌡️"
              label="Temperature Data"
              value={
                `${reportData.temperatureRecorded}/${reportData.total}`
              }
              description="Items containing recorded storage temperature."
              tone="blue"
            />


            <ReportCard
              icon="💧"
              label="Humidity Data"
              value={
                `${reportData.humidityRecorded}/${reportData.total}`
              }
              description="Items containing recorded humidity."
              tone="blue"
            />


            <ReportCard
              icon="📦"
              label="Packaging Data"
              value={
                `${reportData.packagingRecorded}/${reportData.total}`
              }
              description="Items containing recorded packaging information."
            />


            <ReportCard
              icon="💨"
              label="Air Circulation"
              value={
                `${reportData.airCirculationRecorded}/${reportData.total}`
              }
              description="Items containing recorded air-circulation information."
            />


            <ReportCard
              icon="💡"
              label="Light Exposure"
              value={
                `${reportData.lightExposureRecorded}/${reportData.total}`
              }
              description="Items containing recorded light-exposure information."
            />

          </div>


          <div
            style={{
              marginTop:
                "18px",
              padding:
                "18px",
              borderRadius:
                "18px",
              background:
                "linear-gradient(135deg,#f3fff7,#f8fcff)",
              border:
                "1px solid #dcefe4",
            }}
          >

            <div
              style={{
                color:
                  "#08a94f",
                fontSize:
                  "10px",
                fontWeight:
                  900,
                letterSpacing:
                  "1.3px",
              }}
            >
              ENVIRONMENTAL DATA COMPLETENESS
            </div>


            <div
              style={{
                marginTop:
                  "8px",
                color:
                  "#073b27",
                fontSize:
                  "22px",
                fontWeight:
                  900,
              }}
            >
              {
                reportData.environmentalComplete
              }
              {" "}
              /{" "}
              {
                reportData.total
              }
            </div>


            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#71827b",
                fontSize:
                  "12px",
                lineHeight:
                  1.6,
              }}
            >
              Inventory items containing all six
              environmental inputs:
              temperature, humidity, packaging,
              storage duration, air circulation and
              light exposure.
            </div>

          </div>


          <div
            style={{
              marginTop:
                "18px",
              padding:
                "16px",
              borderRadius:
                "16px",
              background:
                "#f8fcfa",
              border:
                "1px solid #e3efe8",
              color:
                "#60756b",
              fontSize:
                "12px",
              lineHeight:
                1.65,
            }}
          >
            The storage report now reads the stored
            prediction outputs and
            environmental inputs from the inventory.
            It does not change the existing food
            prediction or inventory workflow.
          </div>

        </ReportSection>


        {/* ====================================================
            REPORT EXPORT
        ==================================================== */}

        <ReportSection
          eyebrow="REPORT EXPORT"
          title="Export Reports"
          description="Download the current FreshGuard reporting data without changing the existing inventory or prediction workflow."
        >

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(260px,1fr))",
              gap:
                "16px",
            }}
          >

            {/* PDF */}

            <div
              style={{
                padding:
                  "20px",
                borderRadius:
                  "18px",
                background:
                  "#f8fcfa",
                border:
                  "1px solid #e3efe8",
              }}
            >

              <div
                style={{
                  fontSize:
                    "30px",
                }}
              >
                📄
              </div>


              <div
                style={{
                  marginTop:
                    "10px",
                  color:
                    "#073b27",
                  fontSize:
                    "18px",
                  fontWeight:
                    900,
                }}
              >
                PDF Report
              </div>


              <div
                style={{
                  marginTop:
                    "6px",
                  color:
                    "#71827b",
                  fontSize:
                    "12px",
                  lineHeight:
                    1.6,
                }}
              >
                Opens a print-ready FreshGuard
                report containing freshness,
                shelf-life, risk, storage,
                environmental monitoring and
                inventory quality information.
              </div>


              <button
                type="button"
                onClick={() =>
                  exportPdfReport(
                    reportData,
                    filteredFoods
                  )
                }
                style={{
                  marginTop:
                    "15px",
                  border:
                    "none",
                  background:
                    "#08a94f",
                  color:
                    "#ffffff",
                  borderRadius:
                    "12px",
                  padding:
                    "11px 16px",
                  fontWeight:
                    850,
                  cursor:
                    "pointer",
                }}
              >
                📄 Export PDF
              </button>

            </div>


            {/* EXCEL */}

            <div
              style={{
                padding:
                  "20px",
                borderRadius:
                  "18px",
                background:
                  "#f8fcfa",
                border:
                  "1px solid #e3efe8",
              }}
            >

              <div
                style={{
                  fontSize:
                    "30px",
                }}
              >
                📊
              </div>


              <div
                style={{
                  marginTop:
                    "10px",
                  color:
                    "#073b27",
                  fontSize:
                    "18px",
                  fontWeight:
                    900,
                }}
              >
                Excel Report
              </div>


              <div
                style={{
                  marginTop:
                    "6px",
                  color:
                    "#71827b",
                  fontSize:
                    "12px",
                  lineHeight:
                    1.6,
                }}
              >
                Downloads an Excel-compatible
                report containing freshness,
                shelf-life, risk, confidence,
                health, storage and all recorded
                environmental parameters.
              </div>


              <button
                type="button"
                onClick={() =>
                  exportExcelReport(
                    reportData,
                    filteredFoods
                  )
                }
                style={{
                  marginTop:
                    "15px",
                  border:
                    "1px solid #bfe8d0",
                  background:
                    "#e9fbf0",
                  color:
                    "#08783d",
                  borderRadius:
                    "12px",
                  padding:
                    "11px 16px",
                  fontWeight:
                    850,
                  cursor:
                    "pointer",
                }}
              >
                📊 Export Excel
              </button>

            </div>

          </div>


          <div
            style={{
              marginTop:
                "16px",
              padding:
                "14px 16px",
              borderRadius:
                "14px",
              background:
                "#fffdf1",
              border:
                "1px solid #f1e6bd",
              color:
                "#75622c",
              fontSize:
                "12px",
              lineHeight:
                1.6,
            }}
          >
            Export uses the current report view.
            If filters are applied in the Inventory
            Quality Report, the PDF and Excel
            inventory table contains the matching
            filtered items while the summary metrics
            remain based on the complete loaded
            inventory.
          </div>

        </ReportSection>


        {/* ====================================================
            REPORT FOOTER
        ==================================================== */}

        <div
          style={{
            marginTop:
              "25px",
            padding:
              "18px",
            borderRadius:
              "18px",
            background:
              "rgba(255,255,255,.75)",
            border:
              "1px solid #e3efe8",
            color:
              "#71827b",
            fontSize:
              "12px",
            lineHeight:
              1.6,
            textAlign:
              "center",
          }}
        >
          FreshGuard reporting now combines
          freshness assessment, shelf-life prediction,
          prediction confidence, food health,
          storage compliance and environmental
          storage information while preserving the
          existing inventory and prediction workflow.
        </div>

      </div>
    </div>
  );
}