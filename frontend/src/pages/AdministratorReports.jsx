import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "../api";

const ROLE_LABELS = {
  consumer: "Consumer",
  retail_manager: "Retail Manager",
  warehouse_operator: "Warehouse Operator",
  food_quality_inspector: "Food Quality Inspector",
  administrator: "Administrator",
};

const ROLE_ICONS = {
  consumer: "👤",
  retail_manager: "🏪",
  warehouse_operator: "🏭",
  food_quality_inspector: "🧪",
  administrator: "🛡️",
};

const getToken = () => localStorage.getItem("access_token");

const authHeaders = () => {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const fetchAdminData = async (endpoint) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (response.status === 401) {
    throw new Error(
      "Your administrator session has expired. Please login again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Administrator access is required to view this report."
    );
  }

  if (!response.ok) {
    let message = `Unable to load ${endpoint}.`;

    try {
      const data = await response.json();
      message = data?.detail || message;
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  return response.json();
};

const safeNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
};

const formatNumber = (value, decimals = 1) => {
  const number = safeNumber(value);

  if (number === null) {
    return "N/A";
  }

  return number.toFixed(decimals);
};

const formatPercent = (value, decimals = 1) => {
  const number = safeNumber(value);

  if (number === null) {
    return "N/A";
  }

  return `${number.toFixed(decimals)}%`;
};

const formatDate = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getFoodEmoji = (category, foodName) => {
  const text = `${normalize(category)} ${normalize(foodName)}`;

  if (text.includes("onion")) return "🧅";
  if (text.includes("mango")) return "🥭";
  if (text.includes("tomato")) return "🍅";
  if (text.includes("carrot")) return "🥕";
  if (text.includes("cucumber")) return "🥒";
  if (text.includes("potato")) return "🥔";
  if (text.includes("apple")) return "🍎";
  if (text.includes("banana")) return "🍌";
  if (text.includes("orange")) return "🍊";
  if (text.includes("lemon")) return "🍋";
  if (text.includes("grape")) return "🍇";
  if (text.includes("watermelon")) return "🍉";
  if (text.includes("pineapple")) return "🍍";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("broccoli")) return "🥦";
  if (text.includes("spinach")) return "🥬";
  if (text.includes("cabbage")) return "🥬";
  if (text.includes("corn")) return "🌽";
  if (text.includes("peas")) return "🫛";
  if (text.includes("egg")) return "🥚";
  if (text.includes("milk")) return "🥛";
  if (text.includes("cheese")) return "🧀";
  if (text.includes("bread")) return "🍞";
  if (text.includes("cake")) return "🍰";
  if (text.includes("cookie")) return "🍪";
  if (text.includes("chicken")) return "🍗";
  if (text.includes("meat")) return "🥩";
  if (text.includes("fish")) return "🐟";
  if (text.includes("seafood")) return "🦐";

  const categoryText = normalize(category);

  if (categoryText.includes("fruit")) return "🍎";
  if (categoryText.includes("vegetable")) return "🥬";
  if (categoryText.includes("dairy")) return "🥛";
  if (categoryText.includes("meat")) return "🥩";
  if (categoryText.includes("seafood")) return "🐟";
  if (categoryText.includes("bakery")) return "🍞";
  if (categoryText.includes("beverage")) return "🥤";

  return "📦";
};

const getQualityStatus = (food) => {
  const freshness = normalize(food?.freshness_status);

  if (
    freshness === "spoiled" ||
    freshness === "rotten" ||
    freshness === "expired"
  ) {
    return "Spoiled";
  }

  if (
    freshness === "near spoilage" ||
    freshness === "near_spoilage" ||
    freshness === "near-spoilage"
  ) {
    return "Near Spoilage";
  }

  if (freshness === "acceptable") {
    return "Acceptable";
  }

  if (freshness === "good") {
    return "Good";
  }

  if (freshness === "fresh") {
    return "Fresh";
  }

  return "Pending";
};

const getRisk = (food) => {
  const storedRisk =
    food?.shelf_life_risk ??
    food?.shelfLifeRisk ??
    food?.risk ??
    "";

  const normalizedRisk = normalize(storedRisk);

  if (
    normalizedRisk === "critical" ||
    normalizedRisk === "high" ||
    normalizedRisk === "medium" ||
    normalizedRisk === "low"
  ) {
    return (
      normalizedRisk.charAt(0).toUpperCase() +
      normalizedRisk.slice(1)
    );
  }

  if (food?.expiry_date) {
    const expiry = new Date(food.expiry_date);
    const today = new Date();

    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const difference = Math.ceil(
      (expiry.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (difference < 0) {
      return "Expired";
    }

    if (difference <= 3) {
      return "High";
    }
  }

  return "Low";
};

const getRemainingShelfLife = (food) => {
  const storedValue =
    food?.remaining_shelf_life ??
    food?.remainingShelfLife ??
    food?.shelf_life_remaining;

  const number = safeNumber(storedValue);

  if (number !== null) {
    return Math.max(0, number);
  }

  if (food?.expiry_date) {
    const expiry = new Date(food.expiry_date);
    const today = new Date();

    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return Math.max(
      0,
      Math.ceil(
        (expiry.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  return null;
};

const getTotalShelfLife = (food) => {
  const manufacturing = food?.manufacturing_date
    ? new Date(food.manufacturing_date)
    : null;

  const expiry = food?.expiry_date
    ? new Date(food.expiry_date)
    : null;

  if (
    manufacturing &&
    expiry &&
    !Number.isNaN(manufacturing.getTime()) &&
    !Number.isNaN(expiry.getTime())
  ) {
    return Math.max(
      0,
      Math.ceil(
        (expiry.getTime() - manufacturing.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  return getRemainingShelfLife(food);
};

const getHealthScore = (food) => {
  const value =
    food?.overall_health_score ??
    food?.overallHealthScore ??
    food?.freshness_score;

  return safeNumber(value);
};

const getAiScore = (food) => {
  const value =
    food?.freshness_score ??
    food?.overall_health_score ??
    food?.overallHealthScore;

  return safeNumber(value);
};

const getStorageScore = (food) => {
  return safeNumber(
    food?.storage_compliance_score ??
      food?.storageComplianceScore
  );
};

const getConfidence = (food) => {
  return safeNumber(
    food?.shelf_life_confidence ??
      food?.shelfLifeConfidence
  );
};

const isExpired = (food) => {
  if (!food?.expiry_date) {
    return false;
  }

  const expiry = new Date(food.expiry_date);
  const today = new Date();

  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return expiry < today;
};

const isNearExpiry = (food) => {
  if (!food?.expiry_date) {
    return false;
  }

  const expiry = new Date(food.expiry_date);
  const today = new Date();

  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const days = Math.ceil(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return days >= 0 && days <= 3;
};

const isLowHealth = (food) => {
  const health = getHealthScore(food);

  return health !== null && health < 50;
};

const isHighRisk = (food) => {
  const risk = normalize(getRisk(food));

  return risk === "high" || risk === "critical";
};

const isActionRequired = (food) => {
  const quality = normalize(getQualityStatus(food));

  return (
    isExpired(food) ||
    isNearExpiry(food) ||
    isHighRisk(food) ||
    quality === "spoiled" ||
    quality === "near spoilage" ||
    isLowHealth(food)
  );
};

const hasValue = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "";

const normalizeFoodRecord = (food, userMap) => {
  const ownerId =
    food?.user_id ??
    food?.userId ??
    food?.owner_id ??
    food?.ownerId;

  const owner = ownerId
    ? userMap[String(ownerId)]
    : null;

  return {
    ...food,

    owner_id: ownerId,

    owner_name:
      food?.user_name ||
      food?.owner_name ||
      owner?.name ||
      owner?.full_name ||
      owner?.username ||
      "Unknown User",

    owner_email:
      food?.user_email ||
      food?.owner_email ||
      owner?.email ||
      "N/A",

    owner_role:
      food?.user_role ||
      food?.owner_role ||
      owner?.role ||
      "consumer",

    owner_active:
      typeof food?.user_is_active === "boolean"
        ? food.user_is_active
        : typeof owner?.is_active === "boolean"
        ? owner.is_active
        : true,
  };
};

const StatCard = ({
  icon,
  label,
  value,
  description,
}) => (
  <div className="admin-report-stat-card">
    <div className="admin-report-stat-icon">
      {icon}
    </div>

    <div className="admin-report-stat-content">
      <div className="admin-report-stat-label">
        {label}
      </div>

      <div className="admin-report-stat-value">
        {value}
      </div>

      <div className="admin-report-stat-description">
        {description}
      </div>
    </div>
  </div>
);

const SectionTitle = ({
  report,
  title,
  description,
}) => (
  <div className="admin-report-section-heading">
    <div>
      <div className="admin-report-section-number">
        {report}
      </div>

      <h2>{title}</h2>

      <p>{description}</p>
    </div>
  </div>
);

const RoleBadge = ({ role }) => (
  <span
    className={`admin-report-role role-${
      role || "consumer"
    }`}
  >
    {ROLE_ICONS[role] || "👤"}{" "}
    {ROLE_LABELS[role] || "Consumer"}
  </span>
);

const QualityBadge = ({ quality }) => (
  <span
    className={`admin-report-quality quality-${normalize(
      quality
    ).replace(/\s+/g, "-")}`}
  >
    {quality}
  </span>
);

const RiskBadge = ({ risk }) => (
  <span
    className={`admin-report-risk risk-${normalize(
      risk
    ).replace(/\s+/g, "-")}`}
  >
    {risk}
  </span>
);

const AdministratorReports = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [foods, setFoods] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadAdministratorReport = async (
    showRefresh = false
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [usersData, foodsData] =
        await Promise.all([
          fetchAdminData("/admin/users"),
          fetchAdminData("/admin/foods"),
        ]);

      setUsers(
        Array.isArray(usersData)
          ? usersData
          : []
      );

      setFoods(
        Array.isArray(foodsData)
          ? foodsData
          : []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load administrator report."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdministratorReport();
  }, []);

  const userMap = useMemo(() => {
    const map = {};

    users.forEach((user) => {
      if (
        user?.id !== undefined &&
        user?.id !== null
      ) {
        map[String(user.id)] = user;
      }
    });

    return map;
  }, [users]);

  const enrichedFoods = useMemo(
    () =>
      foods.map((food) =>
        normalizeFoodRecord(food, userMap)
      ),
    [foods, userMap]
  );

  const roleCounts = useMemo(() => {
    const counts = {
      consumer: 0,
      retail_manager: 0,
      warehouse_operator: 0,
      food_quality_inspector: 0,
      administrator: 0,
    };

    users.forEach((user) => {
      const role = normalize(user?.role);

      if (counts[role] !== undefined) {
        counts[role] += 1;
      }
    });

    return counts;
  }, [users]);

  const activeUsers = useMemo(
    () =>
      users.filter(
        (user) => user?.is_active !== false
      ).length,
    [users]
  );

  const inactiveUsers = useMemo(
    () =>
      users.filter(
        (user) => user?.is_active === false
      ).length,
    [users]
  );

  const foodRoleCounts = useMemo(() => {
    const counts = {
      consumer: 0,
      retail_manager: 0,
      warehouse_operator: 0,
      food_quality_inspector: 0,
      administrator: 0,
    };

    enrichedFoods.forEach((food) => {
      const role = food.owner_role;

      if (counts[role] !== undefined) {
        counts[role] += 1;
      }
    });

    return counts;
  }, [enrichedFoods]);

  const filteredFoods = useMemo(() => {
    const query = normalize(search);

    return enrichedFoods.filter((food) => {
      const roleMatch =
        selectedRole === "all" ||
        food.owner_role === selectedRole;

      const userMatch =
        selectedUser === "all" ||
        String(food.owner_id) ===
          String(selectedUser);

      const quality = getQualityStatus(food);

      const qualityMatch =
        qualityFilter === "all" ||
        normalize(quality) ===
          normalize(qualityFilter);

      const risk = getRisk(food);

      const riskMatch =
        riskFilter === "all" ||
        normalize(risk) ===
          normalize(riskFilter);

      const searchMatch =
        !query ||
        normalize(food.food_name).includes(
          query
        ) ||
        normalize(food.category).includes(
          query
        ) ||
        normalize(food.owner_name).includes(
          query
        ) ||
        normalize(food.owner_email).includes(
          query
        );

      return (
        roleMatch &&
        userMatch &&
        qualityMatch &&
        riskMatch &&
        searchMatch
      );
    });
  }, [
    enrichedFoods,
    selectedRole,
    selectedUser,
    qualityFilter,
    riskFilter,
    search,
  ]);

  const metrics = useMemo(() => {
    const total = enrichedFoods.length;

    let freshGood = 0;
    let acceptable = 0;
    let nearSpoilage = 0;
    let spoiled = 0;
    let pending = 0;

    let scoreTotal = 0;
    let scoreCount = 0;

    let healthTotal = 0;
    let healthCount = 0;

    let storageTotal = 0;
    let storageCount = 0;

    let confidenceTotal = 0;
    let confidenceCount = 0;

    let remainingTotal = 0;
    let remainingCount = 0;

    let totalShelfLife = 0;
    let shelfLifeCount = 0;

    let lowHealth = 0;
    let highRisk = 0;
    let expired = 0;
    let nearExpiry = 0;
    let actionItems = 0;

    let storageRecorded = 0;
    let refrigerated = 0;
    let frozen = 0;

    let temperatureData = 0;
    let humidityData = 0;
    let packagingData = 0;
    let durationData = 0;
    let airData = 0;
    let lightData = 0;

    enrichedFoods.forEach((food) => {
      const quality =
        getQualityStatus(food);

      if (
        quality === "Fresh" ||
        quality === "Good"
      ) {
        freshGood += 1;
      } else if (quality === "Acceptable") {
        acceptable += 1;
      } else if (
        quality === "Near Spoilage"
      ) {
        nearSpoilage += 1;
      } else if (quality === "Spoiled") {
        spoiled += 1;
      } else {
        pending += 1;
      }

      const score = getAiScore(food);

      if (score !== null) {
        scoreTotal += score;
        scoreCount += 1;
      }

      const health =
        getHealthScore(food);

      if (health !== null) {
        healthTotal += health;
        healthCount += 1;

        if (health < 50) {
          lowHealth += 1;
        }
      }

      const storageScore =
        getStorageScore(food);

      if (storageScore !== null) {
        storageTotal += storageScore;
        storageCount += 1;
      }

      const confidence =
        getConfidence(food);

      if (confidence !== null) {
        confidenceTotal += confidence;
        confidenceCount += 1;
      }

      const remaining =
        getRemainingShelfLife(food);

      if (remaining !== null) {
        remainingTotal += remaining;
        remainingCount += 1;
      }

      const shelfLife =
        getTotalShelfLife(food);

      if (shelfLife !== null) {
        totalShelfLife += shelfLife;
        shelfLifeCount += 1;
      }

      if (isExpired(food)) {
        expired += 1;
      }

      if (isNearExpiry(food)) {
        nearExpiry += 1;
      }

      if (isHighRisk(food)) {
        highRisk += 1;
      }

      if (isActionRequired(food)) {
        actionItems += 1;
      }

      const storage = normalize(
        food.storage_condition
      );

      if (storage) {
        storageRecorded += 1;
      }

      if (
        storage.includes("refrigerator") ||
        storage.includes("refrigerated") ||
        storage.includes("fridge")
      ) {
        refrigerated += 1;
      }

      if (
        storage.includes("freezer") ||
        storage.includes("frozen")
      ) {
        frozen += 1;
      }

      if (
        hasValue(
          food.storage_temperature
        )
      ) {
        temperatureData += 1;
      }

      if (
        hasValue(food.storage_humidity)
      ) {
        humidityData += 1;
      }

      if (
        hasValue(food.packaging_type)
      ) {
        packagingData += 1;
      }

      if (
        hasValue(food.storage_duration)
      ) {
        durationData += 1;
      }

      if (
        hasValue(food.air_circulation)
      ) {
        airData += 1;
      }

      if (
        hasValue(food.light_exposure)
      ) {
        lightData += 1;
      }
    });

    const completeEnvironmental =
      enrichedFoods.filter(
        (food) =>
          hasValue(
            food.storage_temperature
          ) &&
          hasValue(
            food.storage_humidity
          ) &&
          hasValue(
            food.packaging_type
          ) &&
          hasValue(
            food.storage_duration
          ) &&
          hasValue(
            food.air_circulation
          ) &&
          hasValue(
            food.light_exposure
          )
      ).length;

    return {
      total,

      freshGood,
      acceptable,
      nearSpoilage,
      spoiled,
      pending,

      averageScore:
        scoreCount > 0
          ? scoreTotal / scoreCount
          : null,

      averageHealth:
        healthCount > 0
          ? healthTotal / healthCount
          : null,

      averageStorage:
        storageCount > 0
          ? storageTotal / storageCount
          : null,

      averageConfidence:
        confidenceCount > 0
          ? confidenceTotal /
            confidenceCount
          : null,

      remainingTotal,
      remainingCount,

      totalShelfLife,
      shelfLifeCount,

      lowHealth,
      highRisk,
      expired,
      nearExpiry,
      actionItems,

      storageRecorded,
      refrigerated,
      frozen,

      temperatureData,
      humidityData,
      packagingData,
      durationData,
      airData,
      lightData,

      completeEnvironmental,
    };
  }, [enrichedFoods]);

  const roleAnalytics = useMemo(() => {
    return Object.keys(ROLE_LABELS).map(
      (role) => {
        const roleFoods =
          enrichedFoods.filter(
            (food) =>
              food.owner_role === role
          );

        const total = roleFoods.length;

        const fresh = roleFoods.filter(
          (food) => {
            const quality =
              getQualityStatus(food);

            return (
              quality === "Fresh" ||
              quality === "Good"
            );
          }
        ).length;

        const expired =
          roleFoods.filter((food) =>
            isExpired(food)
          ).length;

        const actions =
          roleFoods.filter((food) =>
            isActionRequired(food)
          ).length;

        const healthValues =
          roleFoods
            .map((food) =>
              getHealthScore(food)
            )
            .filter(
              (value) => value !== null
            );

        const scoreValues =
          roleFoods
            .map((food) =>
              getAiScore(food)
            )
            .filter(
              (value) => value !== null
            );

        const storageValues =
          roleFoods
            .map((food) =>
              getStorageScore(food)
            )
            .filter(
              (value) => value !== null
            );

        const averageHealth =
          healthValues.length > 0
            ? healthValues.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
              healthValues.length
            : null;

        const averageScore =
          scoreValues.length > 0
            ? scoreValues.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
              scoreValues.length
            : null;

        const averageStorage =
          storageValues.length > 0
            ? storageValues.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
              storageValues.length
            : null;

        return {
          role,
          users:
            roleCounts[role] || 0,
          inventory: total,
          fresh,
          expired,
          actions,
          averageHealth,
          averageScore,
          averageStorage,
        };
      }
    );
  }, [enrichedFoods, roleCounts]);

  const userInventoryAnalytics =
    useMemo(() => {
      return users
        .map((user) => {
          const userFoods =
            enrichedFoods.filter(
              (food) =>
                String(food.owner_id) ===
                String(user.id)
            );

          const scores =
            userFoods
              .map((food) =>
                getAiScore(food)
              )
              .filter(
                (value) => value !== null
              );

          const health =
            userFoods
              .map((food) =>
                getHealthScore(food)
              )
              .filter(
                (value) => value !== null
              );

          const storage =
            userFoods
              .map((food) =>
                getStorageScore(food)
              )
              .filter(
                (value) => value !== null
              );

          const averageScore =
            scores.length > 0
              ? scores.reduce(
                  (sum, value) =>
                    sum + value,
                  0
                ) / scores.length
              : null;

          const averageHealth =
            health.length > 0
              ? health.reduce(
                  (sum, value) =>
                    sum + value,
                  0
                ) / health.length
              : null;

          const averageStorage =
            storage.length > 0
              ? storage.reduce(
                  (sum, value) =>
                    sum + value,
                  0
                ) / storage.length
              : null;

          return {
            user,
            inventory: userFoods.length,
            averageScore,
            averageHealth,
            averageStorage,
            expired:
              userFoods.filter(
                (food) =>
                  isExpired(food)
              ).length,
            actions:
              userFoods.filter(
                (food) =>
                  isActionRequired(food)
              ).length,
          };
        })
        .sort(
          (a, b) =>
            b.inventory - a.inventory
        );
    }, [users, enrichedFoods]);

  const roleFilteredUsers = useMemo(() => {
    if (selectedRole === "all") {
      return users;
    }

    return users.filter(
      (user) =>
        user.role === selectedRole
    );
  }, [users, selectedRole]);

  const reportTitle =
    selectedRole === "all"
      ? "All Roles"
      : ROLE_LABELS[selectedRole] ||
        "Selected Role";

  const exportRows = filteredFoods.map(
    (food) => ({
      ID: food.id ?? "N/A",
      Food: food.food_name || "Unknown",
      Category: food.category || "N/A",
      Owner: food.owner_name,
      Email: food.owner_email,
      Role:
        ROLE_LABELS[food.owner_role] ||
        food.owner_role,
      Status:
        food.owner_active
          ? "Active"
          : "Inactive",
      "AI Score":
        getAiScore(food) ?? "N/A",
      Health:
        getHealthScore(food) ?? "N/A",
      Quality:
        getQualityStatus(food),
      "Remaining Shelf Life":
        getRemainingShelfLife(food) ??
        "N/A",
      Risk: getRisk(food),
      Confidence:
        getConfidence(food) ?? "N/A",
      "Manufacturing Date":
        formatDate(
          food.manufacturing_date
        ),
      "Expiry Date":
        formatDate(food.expiry_date),
      "Added Date":
        formatDate(food.created_at),
      Storage:
        food.storage_condition ||
        "N/A",
      Temperature:
        food.storage_temperature ??
        "N/A",
      Humidity:
        food.storage_humidity ??
        "N/A",
      Packaging:
        food.packaging_type ||
        "N/A",
      "Storage Duration":
        food.storage_duration ??
        "N/A",
      "Air Circulation":
        food.air_circulation ??
        "N/A",
      "Light Exposure":
        food.light_exposure ??
        "N/A",
      "Storage Compliance":
        getStorageScore(food) ??
        "N/A",
    })
  );

  const exportCsv = () => {
    if (exportRows.length === 0) {
      return;
    }

    const headers = Object.keys(
      exportRows[0]
    );

    const escapeCsv = (value) => {
      const text = String(
        value ?? ""
      );

      if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
      ) {
        return `"${text.replace(
          /"/g,
          '""'
        )}"`;
      }

      return text;
    };

    const csv = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((header) =>
            escapeCsv(row[header])
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `FreshGuard_Administrator_Report_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="admin-report-page">
        <div className="admin-report-loading">
          <div className="admin-report-loading-icon">
            🛡️
          </div>

          <h2>
            Loading Administrator Reports...
          </h2>

          <p>
            Collecting complete platform
            inventory, user and role-level
            reporting data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-report-page">
      <style>{`
        .admin-report-page {
          min-height: 100vh;
          padding: 24px;
          background: #f5f7fb;
          color: #172033;
          box-sizing: border-box;
        }

        .admin-report-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .admin-report-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .admin-report-back {
          border: 0;
          background: transparent;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          color: #26364f;
          padding: 8px 0;
        }

        .admin-report-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .admin-report-button {
          border: 1px solid #d9dfeb;
          background: #fff;
          color: #26364f;
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-report-button.primary {
          background: #172033;
          color: #fff;
          border-color: #172033;
        }

        .admin-report-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .admin-report-hero {
          background: linear-gradient(
            135deg,
            #172033,
            #263b62
          );
          color: white;
          border-radius: 22px;
          padding: 30px;
          margin-bottom: 22px;
          box-shadow: 0 12px 30px rgba(
            23,
            32,
            51,
            .14
          );
        }

        .admin-report-kicker {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 1.5px;
          opacity: .78;
          margin-bottom: 8px;
        }

        .admin-report-hero h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.15;
        }

        .admin-report-hero p {
          margin: 12px 0 0;
          max-width: 900px;
          line-height: 1.6;
          opacity: .88;
        }

        .admin-report-alert {
          border: 1px solid #f2b8b5;
          background: #fff4f3;
          color: #8c2722;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 20px;
          font-weight: 600;
        }

        .admin-report-section {
          background: #fff;
          border: 1px solid #e2e7ef;
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 20px;
          box-shadow: 0 5px 18px rgba(
            24,
            39,
            75,
            .045
          );
        }

        .admin-report-section-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .admin-report-section-number {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
          color: #64748b;
          margin-bottom: 5px;
        }

        .admin-report-section h2 {
          margin: 0;
          font-size: 22px;
        }

        .admin-report-section-heading p {
          margin: 7px 0 0;
          color: #657086;
          line-height: 1.5;
        }

        .admin-report-stat-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 14px;
        }

        .admin-report-stat-card {
          border: 1px solid #e4e8ef;
          border-radius: 14px;
          padding: 16px;
          display: flex;
          gap: 12px;
          min-width: 0;
          background: #fbfcfe;
        }

        .admin-report-stat-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef2f8;
          font-size: 21px;
          flex: 0 0 auto;
        }

        .admin-report-stat-label {
          font-size: 12px;
          color: #69758a;
          font-weight: 700;
        }

        .admin-report-stat-value {
          font-size: 24px;
          font-weight: 900;
          margin: 3px 0;
        }

        .admin-report-stat-description {
          color: #7b8494;
          font-size: 11px;
          line-height: 1.4;
        }

        .admin-report-role-grid {
          display: grid;
          grid-template-columns: repeat(
            5,
            minmax(0, 1fr)
          );
          gap: 12px;
        }

        .admin-report-role-card {
          border: 1px solid #e2e7ef;
          border-radius: 14px;
          padding: 16px;
          background: #fbfcfe;
        }

        .admin-report-role-card h3 {
          margin: 10px 0 3px;
          font-size: 15px;
        }

        .admin-report-role-card p {
          margin: 0;
          color: #707b8e;
          font-size: 12px;
        }

        .admin-report-role-icon {
          font-size: 25px;
        }

        .admin-report-role-metrics {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 8px;
          margin-top: 13px;
        }

        .admin-report-role-metric {
          border-radius: 9px;
          background: #fff;
          border: 1px solid #e9edf3;
          padding: 8px;
        }

        .admin-report-role-metric small {
          display: block;
          color: #7a8495;
          font-size: 10px;
          font-weight: 700;
        }

        .admin-report-role-metric strong {
          display: block;
          margin-top: 2px;
          font-size: 14px;
        }

        .admin-report-role {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 999px;
          padding: 5px 9px;
          background: #eef2f8;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .admin-report-filter-bar {
          display: grid;
          grid-template-columns:
            1.6fr
            repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        .admin-report-filter-bar input,
        .admin-report-filter-bar select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9dfeb;
          border-radius: 10px;
          padding: 11px 12px;
          background: #fff;
          color: #1f2937;
          outline: none;
        }

        .admin-report-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e2e7ef;
          border-radius: 13px;
        }

        .admin-report-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1650px;
        }

        .admin-report-table th {
          background: #f6f8fb;
          color: #657086;
          font-size: 11px;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #e2e7ef;
          white-space: nowrap;
        }

        .admin-report-table td {
          padding: 12px;
          border-bottom: 1px solid #edf0f4;
          font-size: 12px;
          white-space: nowrap;
          vertical-align: middle;
        }

        .admin-report-table tr:last-child td {
          border-bottom: 0;
        }

        .admin-report-food {
          display: flex;
          align-items: center;
          gap: 9px;
          font-weight: 800;
        }

        .admin-report-food-icon {
          font-size: 22px;
        }

        .admin-report-quality,
        .admin-report-risk {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
        }

        .quality-fresh,
        .quality-good {
          background: #eaf8ef;
          color: #176b38;
        }

        .quality-acceptable {
          background: #fff8df;
          color: #846400;
        }

        .quality-near-spoilage {
          background: #fff0db;
          color: #995a00;
        }

        .quality-spoiled {
          background: #ffe7e7;
          color: #a12626;
        }

        .quality-pending {
          background: #eef1f5;
          color: #596579;
        }

        .risk-low {
          background: #eaf8ef;
          color: #176b38;
        }

        .risk-medium {
          background: #fff8df;
          color: #846400;
        }

        .risk-high {
          background: #fff0db;
          color: #995a00;
        }

        .risk-critical,
        .risk-expired {
          background: #ffe7e7;
          color: #a12626;
        }

        .admin-report-user-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        .admin-report-user-table th {
          text-align: left;
          background: #f6f8fb;
          color: #657086;
          font-size: 11px;
          padding: 12px;
        }

        .admin-report-user-table td {
          padding: 12px;
          border-top: 1px solid #edf0f4;
          font-size: 12px;
        }

        .admin-report-user-name {
          font-weight: 800;
        }

        .admin-report-user-email {
          color: #788396;
          margin-top: 2px;
        }

        .admin-report-empty {
          padding: 34px !important;
          text-align: center;
          color: #7b8494;
        }

        .admin-report-completeness {
          display: grid;
          grid-template-columns: repeat(
            6,
            minmax(0, 1fr)
          );
          gap: 10px;
        }

        .admin-report-completeness-card {
          border: 1px solid #e2e7ef;
          border-radius: 12px;
          padding: 13px;
          background: #fbfcfe;
        }

        .admin-report-completeness-card strong {
          display: block;
          font-size: 20px;
          margin-bottom: 4px;
        }

        .admin-report-completeness-card span {
          color: #6e788a;
          font-size: 11px;
          font-weight: 700;
        }

        .admin-report-note {
          margin-top: 15px;
          padding: 13px 15px;
          background: #f5f8fc;
          border: 1px solid #e3e9f1;
          border-radius: 11px;
          color: #596579;
          font-size: 12px;
          line-height: 1.55;
        }

        .admin-report-loading {
          min-height: 70vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .admin-report-loading-icon {
          font-size: 46px;
          margin-bottom: 10px;
        }

        .admin-report-loading h2 {
          margin: 0 0 7px;
        }

        .admin-report-loading p {
          color: #707b8e;
        }

        .admin-report-footer {
          text-align: center;
          color: #7b8494;
          font-size: 12px;
          padding: 12px 0 30px;
        }

        @media (max-width: 1200px) {
          .admin-report-stat-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .admin-report-role-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .admin-report-filter-bar {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .admin-report-completeness {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 700px) {
          .admin-report-page {
            padding: 14px;
          }

          .admin-report-hero {
            padding: 22px;
          }

          .admin-report-hero h1 {
            font-size: 25px;
          }

          .admin-report-stat-grid,
          .admin-report-role-grid,
          .admin-report-filter-bar,
          .admin-report-completeness {
            grid-template-columns: 1fr;
          }

          .admin-report-section {
            padding: 16px;
          }
        }

        @media print {
          .admin-report-topbar,
          .admin-report-actions,
          .admin-report-filter-bar {
            display: none !important;
          }

          .admin-report-page {
            background: #fff;
            padding: 0;
          }

          .admin-report-section {
            box-shadow: none;
            break-inside: avoid;
          }

          .admin-report-hero {
            box-shadow: none;
          }
        }
      `}</style>

      <div className="admin-report-container">
        <div className="admin-report-topbar">
          <button
            className="admin-report-back"
            onClick={onBack}
          >
            ← Back to Dashboard
          </button>

          <div className="admin-report-actions">
            <button
              className="admin-report-button"
              onClick={() =>
                loadAdministratorReport(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh Report"}
            </button>

            <button
              className="admin-report-button"
              onClick={printReport}
            >
              📄 Export PDF
            </button>

            <button
              className="admin-report-button primary"
              onClick={exportCsv}
              disabled={
                filteredFoods.length === 0
              }
            >
              📊 Export Excel
            </button>
          </div>
        </div>

        <section className="admin-report-hero">
          <div className="admin-report-kicker">
            PLATFORM ADMINISTRATION REPORTS
          </div>

          <h1>
            Complete Platform Inventory
            Intelligence
          </h1>

          <p>
            Administrator-only reporting across
            all registered roles, users, current
            inventory, historical food records,
            freshness, shelf-life, health,
            storage, environmental monitoring,
            risk and waste-reduction indicators.
          </p>
        </section>

        {error && (
          <div className="admin-report-alert">
            {error}
          </div>
        )}

        <section className="admin-report-section">
          <SectionTitle
            report="ADMINISTRATOR OVERVIEW"
            title="Complete Platform Analytics"
            description="Unlike role-specific reports, this administrator report reads the complete platform inventory so the administrator can review food records belonging to every role."
          />

          <div className="admin-report-stat-grid">
            <StatCard
              icon="👥"
              label="Registered Users"
              value={users.length}
              description="All registered platform accounts."
            />

            <StatCard
              icon="🟢"
              label="Active Users"
              value={activeUsers}
              description="Currently active platform accounts."
            />

            <StatCard
              icon="🔴"
              label="Inactive Users"
              value={inactiveUsers}
              description="Currently inactive platform accounts."
            />

            <StatCard
              icon="📦"
              label="Total Inventory"
              value={metrics.total}
              description="All current and stored food records available to the administrator."
            />

            <StatCard
              icon="🧠"
              label="Average AI Score"
              value={
                metrics.averageScore === null
                  ? "N/A"
                  : formatNumber(
                      metrics.averageScore
                    )
              }
              description="Average freshness/AI score across all roles."
            />

            <StatCard
              icon="🩺"
              label="Average Food Health"
              value={
                metrics.averageHealth === null
                  ? "N/A"
                  : `${formatNumber(
                      metrics.averageHealth
                    )}%`
              }
              description="Average overall health score across complete platform inventory."
            />

            <StatCard
              icon="❄️"
              label="Storage Compliance"
              value={
                metrics.averageStorage === null
                  ? "N/A"
                  : `${formatNumber(
                      metrics.averageStorage
                    )}%`
              }
              description="Average stored storage-compliance score."
            />

            <StatCard
              icon="🎯"
              label="Shelf-Life Confidence"
              value={
                metrics.averageConfidence ===
                null
                  ? "N/A"
                  : `${formatNumber(
                      metrics.averageConfidence
                    )}%`
              }
              description="Average confidence of stored shelf-life predictions."
            />

            <StatCard
              icon="⚠️"
              label="High / Critical Risk"
              value={metrics.highRisk}
              description="Items requiring priority shelf-life review."
            />

            <StatCard
              icon="♻️"
              label="Action Opportunities"
              value={metrics.actionItems}
              description="Items requiring freshness, expiry, health or storage action."
            />
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="ROLE OVERVIEW"
            title="All Roles & Inventory Access"
            description="Administrator-level role analytics across Consumer, Retail Manager, Warehouse Operator, Food Quality Inspector and Administrator accounts."
          />

          <div className="admin-report-role-grid">
            {Object.keys(ROLE_LABELS).map(
              (role) => {
                const analytics =
                  roleAnalytics.find(
                    (item) =>
                      item.role === role
                  );

                return (
                  <div
                    className="admin-report-role-card"
                    key={role}
                  >
                    <div className="admin-report-role-icon">
                      {ROLE_ICONS[role]}
                    </div>

                    <h3>
                      {ROLE_LABELS[role]}
                    </h3>

                    <p>
                      {analytics?.users || 0}{" "}
                      registered user
                      {(analytics?.users || 0) !==
                      1
                        ? "s"
                        : ""}
                    </p>

                    <div className="admin-report-role-metrics">
                      <div className="admin-report-role-metric">
                        <small>
                          Inventory
                        </small>
                        <strong>
                          {analytics?.inventory ||
                            0}
                        </strong>
                      </div>

                      <div className="admin-report-role-metric">
                        <small>
                          Fresh / Good
                        </small>
                        <strong>
                          {analytics?.fresh ||
                            0}
                        </strong>
                      </div>

                      <div className="admin-report-role-metric">
                        <small>
                          Expired
                        </small>
                        <strong>
                          {analytics?.expired ||
                            0}
                        </strong>
                      </div>

                      <div className="admin-report-role-metric">
                        <small>
                          Actions
                        </small>
                        <strong>
                          {analytics?.actions ||
                            0}
                        </strong>
                      </div>

                      <div className="admin-report-role-metric">
                        <small>
                          Avg Health
                        </small>
                        <strong>
                          {analytics?.averageHealth ===
                            null ||
                          analytics?.averageHealth ===
                            undefined
                            ? "N/A"
                            : `${formatNumber(
                                analytics.averageHealth
                              )}%`}
                        </strong>
                      </div>

                      <div className="admin-report-role-metric">
                        <small>
                          Avg Storage
                        </small>
                        <strong>
                          {analytics?.averageStorage ===
                            null ||
                          analytics?.averageStorage ===
                            undefined
                            ? "N/A"
                            : `${formatNumber(
                                analytics.averageStorage
                              )}%`}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="admin-report-note">
            Administrator reporting includes food
            records associated with every registered
            role. Normal role-specific inventory
            restrictions are not applied to this
            administrator report.
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="USER-WISE INVENTORY"
            title="User & Food History Overview"
            description="Administrator can review which user owns each inventory record, the user's role, inventory count, health, freshness, expiry and action status."
          />

          <div className="admin-report-table-wrap">
            <table className="admin-report-user-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Inventory</th>
                  <th>Avg AI Score</th>
                  <th>Avg Health</th>
                  <th>Storage Score</th>
                  <th>Expired</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {userInventoryAnalytics.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="admin-report-empty"
                    >
                      No user data available.
                    </td>
                  </tr>
                ) : (
                  userInventoryAnalytics.map(
                    (item) => (
                      <tr
                        key={item.user.id}
                      >
                        <td>
                          <div className="admin-report-user-name">
                            {item.user.name ||
                              item.user.email ||
                              "Unknown User"}
                          </div>

                          <div className="admin-report-user-email">
                            {item.user.email ||
                              "N/A"}
                          </div>
                        </td>

                        <td>
                          <RoleBadge
                            role={
                              item.user.role
                            }
                          />
                        </td>

                        <td>
                          {item.user
                            .is_active
                            ? "Active"
                            : "Inactive"}
                        </td>

                        <td>
                          <strong>
                            {item.inventory}
                          </strong>
                        </td>

                        <td>
                          {item.averageScore ===
                          null
                            ? "N/A"
                            : formatNumber(
                                item.averageScore
                              )}
                        </td>

                        <td>
                          {item.averageHealth ===
                          null
                            ? "N/A"
                            : `${formatNumber(
                                item.averageHealth
                              )}%`}
                        </td>

                        <td>
                          {item.averageStorage ===
                          null
                            ? "N/A"
                            : `${formatNumber(
                                item.averageStorage
                              )}%`}
                        </td>

                        <td>
                          {item.expired}
                        </td>

                        <td>
                          {item.actions}
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="INVENTORY QUALITY"
            title={`Complete Inventory — ${reportTitle}`}
            description="Food-by-food administrator view containing ownership, role, freshness, AI score, health, shelf-life, expiry, risk, storage and environmental information."
          />

          <div className="admin-report-filter-bar">
            <input
              type="text"
              placeholder="Search food, category, user or email..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            <select
              value={selectedRole}
              onChange={(event) => {
                setSelectedRole(
                  event.target.value
                );
                setSelectedUser("all");
              }}
            >
              <option value="all">
                All Roles
              </option>

              {Object.entries(
                ROLE_LABELS
              ).map(
                ([role, label]) => (
                  <option
                    value={role}
                    key={role}
                  >
                    {label}
                  </option>
                )
              )}
            </select>

            <select
              value={selectedUser}
              onChange={(event) =>
                setSelectedUser(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Users
              </option>

              {roleFilteredUsers.map(
                (user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name ||
                      user.email ||
                      `User ${user.id}`}
                  </option>
                )
              )}
            </select>

            <select
              value={qualityFilter}
              onChange={(event) =>
                setQualityFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Quality Statuses
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
              <option value="Pending">
                Pending
              </option>
            </select>

            <select
              value={riskFilter}
              onChange={(event) =>
                setRiskFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Risks
              </option>
              <option value="Low">
                Low
              </option>
              <option value="Medium">
                Medium
              </option>
              <option value="High">
                High
              </option>
              <option value="Critical">
                Critical
              </option>
              <option value="Expired">
                Expired
              </option>
            </select>
          </div>

          <div className="admin-report-note">
            Showing{" "}
            <strong>
              {filteredFoods.length}
            </strong>{" "}
            of{" "}
            <strong>
              {enrichedFoods.length}
            </strong>{" "}
            administrator-visible food records.
          </div>

          <div className="admin-report-table-wrap">
            <table className="admin-report-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Food</th>
                  <th>Owner</th>
                  <th>Role</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>AI Score</th>
                  <th>Health</th>
                  <th>Quality</th>
                  <th>Remaining</th>
                  <th>Risk</th>
                  <th>Confidence</th>
                  <th>Manufactured</th>
                  <th>Expiry</th>
                  <th>Added</th>
                  <th>Storage</th>
                  <th>Temp</th>
                  <th>Humidity</th>
                  <th>Packaging</th>
                  <th>Duration</th>
                  <th>Air</th>
                  <th>Light</th>
                  <th>Storage Score</th>
                </tr>
              </thead>

              <tbody>
                {filteredFoods.length === 0 ? (
                  <tr>
                    <td
                      colSpan="23"
                      className="admin-report-empty"
                    >
                      No inventory records
                      match the selected
                      filters.
                    </td>
                  </tr>
                ) : (
                  filteredFoods.map(
                    (food) => {
                      const quality =
                        getQualityStatus(
                          food
                        );

                      const risk =
                        getRisk(food);

                      const remaining =
                        getRemainingShelfLife(
                          food
                        );

                      return (
                        <tr key={food.id}>
                          <td>
                            {food.id ??
                              "N/A"}
                          </td>

                          <td>
                            <div className="admin-report-food">
                              <span className="admin-report-food-icon">
                                {getFoodEmoji(
                                  food.category,
                                  food.food_name
                                )}
                              </span>

                              <span>
                                {food.food_name ||
                                  "Unknown"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="admin-report-user-name">
                              {
                                food.owner_name
                              }
                            </div>

                            <div className="admin-report-user-email">
                              {
                                food.owner_email
                              }
                            </div>
                          </td>

                          <td>
                            <RoleBadge
                              role={
                                food.owner_role
                              }
                            />
                          </td>

                          <td>
                            {food.category ||
                              "N/A"}
                          </td>

                          <td>
                            {food.owner_active
                              ? "Active"
                              : "Inactive"}
                          </td>

                          <td>
                            {getAiScore(
                              food
                            ) === null
                              ? "N/A"
                              : formatNumber(
                                  getAiScore(
                                    food
                                  )
                                )}
                          </td>

                          <td>
                            {getHealthScore(
                              food
                            ) === null
                              ? "N/A"
                              : `${formatNumber(
                                  getHealthScore(
                                    food
                                  )
                                )}%`}
                          </td>

                          <td>
                            <QualityBadge
                              quality={
                                quality
                              }
                            />
                          </td>

                          <td>
                            {remaining ===
                            null
                              ? "N/A"
                              : `${formatNumber(
                                  remaining
                                )} d`}
                          </td>

                          <td>
                            <RiskBadge
                              risk={risk}
                            />
                          </td>

                          <td>
                            {getConfidence(
                              food
                            ) === null
                              ? "N/A"
                              : `${formatNumber(
                                  getConfidence(
                                    food
                                  )
                                )}%`}
                          </td>

                          <td>
                            {formatDate(
                              food.manufacturing_date
                            )}
                          </td>

                          <td>
                            {formatDate(
                              food.expiry_date
                            )}
                          </td>

                          <td>
                            {formatDate(
                              food.created_at
                            )}
                          </td>

                          <td>
                            {food.storage_condition ||
                              "N/A"}
                          </td>

                          <td>
                            {food.storage_temperature ??
                              "N/A"}
                          </td>

                          <td>
                            {food.storage_humidity ??
                              "N/A"}
                          </td>

                          <td>
                            {food.packaging_type ||
                              "N/A"}
                          </td>

                          <td>
                            {food.storage_duration ??
                              "N/A"}
                          </td>

                          <td>
                            {food.air_circulation ??
                              "N/A"}
                          </td>

                          <td>
                            {food.light_exposure ??
                              "N/A"}
                          </td>

                          <td>
                            {getStorageScore(
                              food
                            ) === null
                              ? "N/A"
                              : `${formatNumber(
                                  getStorageScore(
                                    food
                                  )
                                )}%`}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="SHELF-LIFE & FRESHNESS"
            title="Platform-Wide Shelf-Life Intelligence"
            description="Complete shelf-life, expiry, prediction confidence and risk information across all role-owned food records."
          />

          <div className="admin-report-stat-grid">
            <StatCard
              icon="🌱"
              label="Fresh / Good"
              value={metrics.freshGood}
              description="Items currently classified as Fresh or Good."
            />

            <StatCard
              icon="🟡"
              label="Acceptable"
              value={metrics.acceptable}
              description="Inventory in acceptable freshness condition."
            />

            <StatCard
              icon="⚠️"
              label="Near Spoilage"
              value={metrics.nearSpoilage}
              description="Items requiring freshness attention."
            />

            <StatCard
              icon="🚨"
              label="Spoiled"
              value={metrics.spoiled}
              description="Spoiled or rotten inventory records."
            />

            <StatCard
              icon="📅"
              label="Total Shelf-Life"
              value={
                metrics.shelfLifeCount >
                0
                  ? `${formatNumber(
                      metrics.totalShelfLife,
                      0
                    )} days`
                  : "N/A"
              }
              description="Combined recorded shelf-life duration."
            />

            <StatCard
              icon="⏱️"
              label="Remaining Shelf-Life"
              value={
                metrics.remainingCount >
                0
                  ? `${formatNumber(
                      metrics.remainingTotal,
                      0
                    )} days`
                  : "N/A"
              }
              description="Combined non-negative remaining shelf-life."
            />

            <StatCard
              icon="🎯"
              label="Prediction Confidence"
              value={
                metrics.averageConfidence ===
                null
                  ? "N/A"
                  : `${formatNumber(
                      metrics.averageConfidence
                    )}%`
              }
              description="Average stored shelf-life prediction confidence."
            />

            <StatCard
              icon="📆"
              label="Near Expiry"
              value={metrics.nearExpiry}
              description="Items approaching expiry within three days."
            />

            <StatCard
              icon="🚨"
              label="Expired"
              value={metrics.expired}
              description="Items whose registered expiry date has passed."
            />

            <StatCard
              icon="⚠️"
              label="High / Critical Risk"
              value={metrics.highRisk}
              description="Items requiring priority shelf-life review."
            />
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="STORAGE & ENVIRONMENT"
            title="Platform Storage Compliance"
            description="Administrator view of recorded storage conditions and all Milestone-3 environmental inputs across every role."
          />

          <div className="admin-report-stat-grid">
            <StatCard
              icon="📋"
              label="Storage Recorded"
              value={
                metrics.storageRecorded
              }
              description={`of ${metrics.total} inventory records contain a storage condition.`}
            />

            <StatCard
              icon="❄️"
              label="Refrigerated"
              value={
                metrics.refrigerated
              }
              description="Items recorded under refrigerator storage."
            />

            <StatCard
              icon="🧊"
              label="Frozen"
              value={metrics.frozen}
              description="Items recorded under freezer/frozen storage."
            />

            <StatCard
              icon="🌡️"
              label="Temperature Data"
              value={`${metrics.temperatureData}/${metrics.total}`}
              description="Items containing recorded storage temperature."
            />

            <StatCard
              icon="💧"
              label="Humidity Data"
              value={`${metrics.humidityData}/${metrics.total}`}
              description="Items containing recorded humidity."
            />

            <StatCard
              icon="📦"
              label="Packaging Data"
              value={`${metrics.packagingData}/${metrics.total}`}
              description="Items containing packaging information."
            />

            <StatCard
              icon="💨"
              label="Air Circulation"
              value={`${metrics.airData}/${metrics.total}`}
              description="Items containing air-circulation information."
            />

            <StatCard
              icon="💡"
              label="Light Exposure"
              value={`${metrics.lightData}/${metrics.total}`}
              description="Items containing light-exposure information."
            />

            <StatCard
              icon="⏳"
              label="Storage Duration"
              value={`${metrics.durationData}/${metrics.total}`}
              description="Items containing storage-duration information."
            />
          </div>

          <div className="admin-report-note">
            Environmental completeness:{" "}
            <strong>
              {metrics.completeEnvironmental}
            </strong>{" "}
            /{" "}
            <strong>
              {metrics.total}
            </strong>{" "}
            inventory items contain all six
            environmental inputs: temperature,
            humidity, packaging, storage duration,
            air circulation and light exposure.
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="ENVIRONMENTAL DATA COMPLETENESS"
            title="Milestone-3 Monitoring Coverage"
            description="Administrator can identify where platform-wide environmental monitoring data is complete or missing."
          />

          <div className="admin-report-completeness">
            <div className="admin-report-completeness-card">
              <strong>
                {metrics.temperatureData}/
                {metrics.total}
              </strong>

              <span>
                Storage Temperature
              </span>
            </div>

            <div className="admin-report-completeness-card">
              <strong>
                {metrics.humidityData}/
                {metrics.total}
              </strong>

              <span>
                Humidity
              </span>
            </div>

            <div className="admin-report-completeness-card">
              <strong>
                {metrics.packagingData}/
                {metrics.total}
              </strong>

              <span>
                Packaging
              </span>
            </div>

            <div className="admin-report-completeness-card">
              <strong>
                {metrics.durationData}/
                {metrics.total}
              </strong>

              <span>
                Storage Duration
              </span>
            </div>

            <div className="admin-report-completeness-card">
              <strong>
                {metrics.airData}/
                {metrics.total}
              </strong>

              <span>
                Air Circulation
              </span>
            </div>

            <div className="admin-report-completeness-card">
              <strong>
                {metrics.lightData}/
                {metrics.total}
              </strong>

              <span>
                Light Exposure
              </span>
            </div>
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="WASTE REDUCTION"
            title="Platform-Level Waste Reduction"
            description="Administrator-level identification of expired, near-expiry, risky and low-health inventory across every role."
          />

          <div className="admin-report-stat-grid">
            <StatCard
              icon="🚨"
              label="Expired Items"
              value={metrics.expired}
              description="Items already past their registered expiry date."
            />

            <StatCard
              icon="⏳"
              label="Expiry Risk"
              value={metrics.nearExpiry}
              description="Items approaching their registered expiry date."
            />

            <StatCard
              icon="⚠️"
              label="Shelf-Life Risk"
              value={metrics.highRisk}
              description="Items with high or critical shelf-life risk."
            />

            <StatCard
              icon="🩺"
              label="Low Health"
              value={metrics.lowHealth}
              description="Items with overall health below 50."
            />

            <StatCard
              icon="♻️"
              label="Action Opportunities"
              value={metrics.actionItems}
              description="Items requiring possible consumption, rotation, quality or storage action."
            />
          </div>

          <div className="admin-report-note">
            Waste-reduction priority should focus
            on expired, near-expiry, high-risk and
            low-health inventory. FEFO-based inventory
            rotation can help prioritize food with
            earlier expiry dates.
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="ROLE ANALYTICS"
            title="Cross-Role Platform Comparison"
            description="Compare inventory volume, freshness, health, expiry and storage performance across all platform roles."
          />

          <div className="admin-report-table-wrap">
            <table className="admin-report-user-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Users</th>
                  <th>Inventory</th>
                  <th>Fresh / Good</th>
                  <th>Expired</th>
                  <th>Actions</th>
                  <th>Avg AI Score</th>
                  <th>Avg Health</th>
                  <th>Avg Storage</th>
                </tr>
              </thead>

              <tbody>
                {roleAnalytics.map(
                  (analytics) => (
                    <tr
                      key={
                        analytics.role
                      }
                    >
                      <td>
                        <RoleBadge
                          role={
                            analytics.role
                          }
                        />
                      </td>

                      <td>
                        {analytics.users}
                      </td>

                      <td>
                        {analytics.inventory}
                      </td>

                      <td>
                        {analytics.fresh}
                      </td>

                      <td>
                        {analytics.expired}
                      </td>

                      <td>
                        {analytics.actions}
                      </td>

                      <td>
                        {analytics.averageScore ===
                        null
                          ? "N/A"
                          : formatNumber(
                              analytics.averageScore
                            )}
                      </td>

                      <td>
                        {analytics.averageHealth ===
                        null
                          ? "N/A"
                          : `${formatNumber(
                              analytics.averageHealth
                            )}%`}
                      </td>

                      <td>
                        {analytics.averageStorage ===
                        null
                          ? "N/A"
                          : `${formatNumber(
                              analytics.averageStorage
                            )}%`}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="PLATFORM COVERAGE"
            title="Administrator Reporting Coverage"
            description="The administrator report intentionally provides a broader view than Consumer, Retail Manager, Warehouse Operator and Food Quality Inspector reports."
          />

          <div className="admin-report-stat-grid">
            <StatCard
              icon="👥"
              label="Consumer Users"
              value={roleCounts.consumer}
              description={`${foodRoleCounts.consumer} inventory records currently associated with Consumer accounts.`}
            />

            <StatCard
              icon="🏪"
              label="Retail Managers"
              value={
                roleCounts.retail_manager
              }
              description={`${foodRoleCounts.retail_manager} inventory records currently associated with Retail Manager accounts.`}
            />

            <StatCard
              icon="🏭"
              label="Warehouse Operators"
              value={
                roleCounts.warehouse_operator
              }
              description={`${foodRoleCounts.warehouse_operator} inventory records currently associated with Warehouse Operator accounts.`}
            />

            <StatCard
              icon="🧪"
              label="Quality Inspectors"
              value={
                roleCounts.food_quality_inspector
              }
              description={`${foodRoleCounts.food_quality_inspector} inventory records currently associated with Food Quality Inspector accounts.`}
            />

            <StatCard
              icon="🛡️"
              label="Administrators"
              value={
                roleCounts.administrator
              }
              description={`${foodRoleCounts.administrator} inventory records currently associated with Administrator accounts.`}
            />
          </div>

          <div className="admin-report-note">
            This report is designed specifically
            for the Administrator role. It does not
            replace the existing role-specific
            Reports.jsx workflow. It provides a
            separate complete-platform reporting
            layer so administrator reporting remains
            independent from the large existing report
            file.
          </div>
        </section>

        <section className="admin-report-section">
          <SectionTitle
            report="REPORT EXPORT"
            title="Administrator Report Export"
            description="Export the administrator's current complete-platform inventory view without modifying the existing prediction or inventory workflow."
          />

          <div className="admin-report-stat-grid">
            <StatCard
              icon="📄"
              label="PDF Report"
              value="Print"
              description="Use the browser print dialog to save the complete administrator report as PDF."
            />

            <StatCard
              icon="📊"
              label="Excel-Compatible"
              value="CSV"
              description="Download the current filtered inventory dataset in spreadsheet-compatible CSV format."
            />

            <StatCard
              icon="🔎"
              label="Filtered Records"
              value={
                filteredFoods.length
              }
              description="Current records matching administrator filters."
            />

            <StatCard
              icon="🛡️"
              label="Access Scope"
              value="All Roles"
              description="Administrator report includes inventory associated with all registered roles."
            />
          </div>
        </section>

        <div className="admin-report-footer">
          FreshGuard Administrator Reporting •
          Complete platform inventory, role
          analytics, freshness, shelf-life, health,
          storage, environmental monitoring and
          waste-reduction intelligence.
        </div>
      </div>
    </div>
  );
};

export default AdministratorReports;