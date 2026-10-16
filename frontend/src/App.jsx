import { useEffect, useState } from "react";

import "./App.css";
import "./FoodTraceUI.css";
import "./DashboardUI.css";

import FreshnessAnalysis from "./FreshnessAnalysis";
import StorageMonitoring from "./StorageMonitoring";
import ReportsCenter from "./ReportsCenter";
import ProfilePanel from "./ProfilePanel";
import AdminUsers from "./AdminUsers";
import { API } from "./api";


function App() {

  // =========================================================

  // LOGIN / REGISTER

  // =========================================================


  const [mode, setMode] = useState("landing");


  const [name, setName] = useState("");

const [email, setEmail] = useState("");

const [password, setPassword] = useState("");

const [confirmPassword, setConfirmPassword] = useState("");

const [role, setRole] = useState("");




  const [message, setMessage] = useState("");

  const [loggedInUser, setLoggedInUser] = useState(() => {
  try {
    const savedUser = localStorage.getItem("foodtrace_user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
});


  // =========================================================

  // FOOD ITEMS

  // =========================================================


  const [showFoodItems, setShowFoodItems] = useState(false);

  const [foodItems, setFoodItems] = useState([]);


  const [showAddFood, setShowAddFood] = useState(false);

  const [foodName, setFoodName] = useState("");

  const [foodCategory, setFoodCategory] = useState("Fruits");

const [editingFoodId, setEditingFoodId] = useState(null);
const [editFoodName, setEditFoodName] = useState("");
const [editFoodCategory, setEditFoodCategory] = useState("Fruits");


  // =========================================================

  // BATCHES

  // =========================================================


  const [showBatches, setShowBatches] = useState(false);

  const [batches, setBatches] = useState([]);


  const [showAddBatch, setShowAddBatch] = useState(false);

  const [batchFoodItem, setBatchFoodItem] = useState("");

  const [batchQuantity, setBatchQuantity] = useState("");

  const [batchExpiryDate, setBatchExpiryDate] = useState("");


  // =========================================================

  // INVENTORY

  // =========================================================


  const [showInventory, setShowInventory] = useState(false);

  const [editingBatchId, setEditingBatchId] = useState(null);

const [newQuantity, setNewQuantity] = useState("");


  // =========================================================

  // EXPIRY

  // =========================================================


const [showExpiry, setShowExpiry] = useState(false);
const [expiryOverview, setExpiryOverview] = useState(null);

const [showFreshness, setShowFreshness] = useState(false);


const [showAnalytics, setShowAnalytics] = useState(false);

const [analyticsData, setAnalyticsData] = useState(null);

const [showAlerts, setShowAlerts] = useState(false);
const [alertsData, setAlertsData] = useState(null);
const [showStorage, setShowStorage] = useState(false);

const [showWasteReduction, setShowWasteReduction] = useState(false);
const [wasteReductionData, setWasteReductionData] = useState(null);

const [showReportsCenter, setShowReportsCenter] = useState(false);
const [showProfile, setShowProfile] = useState(false);
const [showAdminUsers, setShowAdminUsers] = useState(false);


  // =========================================================

  // ROLES

  // =========================================================


  const roles = [

    {

      value: "consumer",

      label: "Consumer",

    },

    {

      value: "retail manager",

      label: "Retail Manager",

    },

    {

      value: "warehouse operator",

      label: "Warehouse Operator",

    },

    {

      value: "food quality inspector",

      label: "Food Quality Inspector",

    },

    {

      value: "administrator",

      label: "Administrator",

    },

  ];


  // =========================================================

  // FOOD CATEGORIES

  // =========================================================


  const foodCategories = [

    "Fruits",

    "Vegetables",

    "Dairy Products",

    "Meat & Poultry",

    "Seafood",

    "Bakery Products",

    "Packaged Foods",

    "Beverages",

  ];



  // =========================================================
  // LOAD DASHBOARD SNAPSHOT AFTER LOGIN
  // =========================================================

  useEffect(() => {
    if (!loggedInUser) return;

    let cancelled = false;

    const loadDashboardSnapshot = async () => {
      try {
        const [foodResult, batchResult, analyticsResult] =
          await Promise.allSettled([
            fetch(`${API}/food-items`),
            fetch(`${API}/batches`),
            fetch(`${API}/analytics/dashboard`),
          ]);

        if (cancelled) return;

        if (foodResult.status === "fulfilled" && foodResult.value.ok) {
          const data = await foodResult.value.json();
          if (!cancelled) setFoodItems(Array.isArray(data) ? data : []);
        }

        if (batchResult.status === "fulfilled" && batchResult.value.ok) {
          const data = await batchResult.value.json();
          if (!cancelled) setBatches(Array.isArray(data) ? data : []);
        }

        if (analyticsResult.status === "fulfilled" && analyticsResult.value.ok) {
          const data = await analyticsResult.value.json();
          if (!cancelled) setAnalyticsData(data);
        }
      } catch (error) {
        console.error("Dashboard snapshot error:", error);
      }
    };

    loadDashboardSnapshot();

    return () => {
      cancelled = true;
    };
  }, [loggedInUser]);



  // =========================================================
  // LOAD ROLE-BASED ALERT SNAPSHOT
  // =========================================================

  useEffect(() => {
    if (!loggedInUser) return;

    let cancelled = false;

    const loadAlertSnapshot = async () => {
      try {
        const roleValue = encodeURIComponent(
          String(loggedInUser.role || "consumer").trim().toLowerCase()
        );

        const response = await fetch(
          `${API}/alerts?role=${roleValue}`
        );

        if (!response.ok) {
          throw new Error("Failed to load alerts");
        }

        const data = await response.json();

        if (!cancelled) {
          setAlertsData(data);
        }
      } catch (error) {
        console.error("Alert snapshot error:", error);
      }
    };

    loadAlertSnapshot();

    return () => {
      cancelled = true;
    };
  }, [loggedInUser]);


  const loadAlerts = async () => {
    clearViews();
    setShowAlerts(true);
    setMessage("");

    try {
      const roleValue = encodeURIComponent(
        String(loggedInUser?.role || "consumer").trim().toLowerCase()
      );

      const response = await fetch(
        `${API}/alerts?role=${roleValue}`
      );

      if (!response.ok) {
        throw new Error("Failed to load alerts");
      }

      const data = await response.json();
      setAlertsData(data);

    } catch (error) {
      console.error(error);
      setMessage("Cannot load notifications.");
    }
  };


  // =========================================================
  // LOAD WASTE REDUCTION
  // =========================================================

  const loadWasteReduction = async () => {

    clearViews();
    setShowWasteReduction(true);
    setMessage("");

    try {

      const response = await fetch(
        `${API}/reports/waste-reduction`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load waste reduction insights"
        );
      }

      const data = await response.json();

      setWasteReductionData(data);

    } catch (error) {

      console.error(error);
      setMessage(
        "Cannot load waste reduction insights."
      );

    }
  };


  // =========================================================

  // CLEAR ALL DASHBOARD VIEWS

  // =========================================================


  const clearViews = () => {

    setShowFoodItems(false);

    setShowAddFood(false);


    setShowBatches(false);

    setShowAddBatch(false);


    setShowInventory(false);

setShowExpiry(false);

setShowFreshness(false);

setShowAnalytics(false);
setShowAlerts(false);
setShowStorage(false);
setShowWasteReduction(false);
setShowReportsCenter(false);
setShowProfile(false);
setShowAdminUsers(false);


setMessage("");

  };


  // =========================================================

  // LOAD FOOD ITEMS

  // =========================================================


  const loadFoodItems = async () => {

    clearViews();
    setShowFoodItems(true);

    try {

      const response = await fetch(

        `${API}/food-items`

      );


      if (!response.ok) {

        throw new Error("Failed to load food items");

      }


      const data = await response.json();


      setFoodItems(data);

    } catch (error) {

      console.error(error);

      setMessage("Cannot load food items.");

    }

  };


  // =========================================================

  // ADD FOOD ITEM

  // =========================================================


  const addFoodItem = async (e) => {

    e.preventDefault();


    if (!foodName.trim()) {

      setMessage("Please enter a food name.");

      return;

    }


    try {

      const response = await fetch(

        `${API}/food-items`,

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            name: foodName,

            category: foodCategory,

          }),

        }

      );


      const data = await response.json();


      if (response.ok) {

        setMessage("Food item added successfully!");


        setFoodName("");

        setFoodCategory("Fruits");

        setShowAddFood(false);


        await loadFoodItems();

      } else {

        setMessage(

          data.message ||

            "Failed to add food item."

        );

      }

    } catch (error) {

      console.error(error);

      setMessage("Cannot connect to backend.");

    }

  };


  // =========================================================
  // EDIT / DELETE FOOD ITEM
  // =========================================================

  const updateFoodItem = async (foodId) => {
    if (!editFoodName.trim()) {
      setMessage("Please enter a food name.");
      return;
    }

    try {
      const response = await fetch(`${API}/food-items/${foodId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editFoodName.trim(),
          category: editFoodCategory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
          data.message ||
          "Failed to update food item."
        );
        return;
      }

      setEditingFoodId(null);
      setEditFoodName("");
      setEditFoodCategory("Fruits");

      await loadFoodItems();
      setMessage("Food item updated successfully.");

    } catch (error) {
      console.error(error);
      setMessage("Cannot update food item.");
    }
  };


  const deleteFoodItem = async (foodId, foodNameValue) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${foodNameValue}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API}/food-items/${foodId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
          data.message ||
          "Failed to delete food item."
        );
        return;
      }

      await loadFoodItems();
      setMessage("Food item deleted successfully.");

    } catch (error) {
      console.error(error);
      setMessage("Cannot delete food item.");
    }
  };


  // =========================================================

  // LOAD BATCHES

  // =========================================================


  const loadBatches = async () => {

    clearViews();
    setShowBatches(true);


    try {

      const batchResponse = await fetch(

        `${API}/batches`

      );


      if (!batchResponse.ok) {

        throw new Error("Failed to load batches");

      }


      const batchData =

        await batchResponse.json();


      const foodResponse = await fetch(

        `${API}/food-items`

      );


      if (!foodResponse.ok) {

        throw new Error(

          "Failed to load food items"

        );

      }


      const foodData =

        await foodResponse.json();


      setBatches(batchData);

      setFoodItems(foodData);

    } catch (error) {

      console.error(error);

      setMessage("Cannot load batches.");

    }

  };


  // =========================================================

  // LOAD INVENTORY

  // =========================================================


  const loadInventory = async () => {

    clearViews();
    setShowInventory(true);

    try {

      const batchResponse = await fetch(

        `${API}/batches`

      );


      if (!batchResponse.ok) {

        throw new Error(

          "Failed to load inventory"

        );

      }


      const batchData =

        await batchResponse.json();


      const foodResponse = await fetch(

        `${API}/food-items`

      );


      if (!foodResponse.ok) {

        throw new Error(

          "Failed to load food items"

        );

      }


      const foodData =

        await foodResponse.json();


      const inventoryData =

        batchData.map((batch) => {

          const food = foodData.find(

            (item) =>

              item.id === batch.food_item_id

          );


          return {

            ...batch,

            food_name: food

              ? food.name

              : "Unknown Food",

            category: food

              ? food.category

              : "Unknown",

          };

        });


      setBatches(inventoryData);

    } catch (error) {

      console.error(error);

      setMessage("Cannot load inventory.");

    }

  };

  const updateBatchQuantity = async (batchId) => {

  if (newQuantity === "" || Number(newQuantity) < 0) {

    setMessage("Please enter a valid quantity.");

    return;

  }


  try {

    const response = await fetch(

      `${API}/batches/${batchId}?quantity=${Number(

        newQuantity

      )}`,

      {

        method: "PUT",

      }

    );


    const data = await response.json();


    if (!response.ok) {

      setMessage(

        data.message || "Failed to update quantity."

      );

      return;

    }


    setMessage("Inventory updated successfully!");


    setEditingBatchId(null);

    setNewQuantity("");


    await loadInventory();

  } catch (error) {

    console.error(error);

    setMessage("Cannot connect to backend.");

  }

};


  // =========================================================

  // LOAD EXPIRY MANAGEMENT

  // =========================================================


  const loadExpiry = async () => {

    clearViews();
    setShowExpiry(true);

    try {

      const response = await fetch(
        `${API}/expiry/overview`
      );

      if (!response.ok) {
        throw new Error("Failed to load expiry overview");
      }

      const data = await response.json();

      setExpiryOverview(data);

    } catch (error) {

      console.error(error);
      setMessage("Cannot load expiry information.");

    }
  };


  // =========================================================

// LOAD FRESHNESS ANALYTICS

// =========================================================


const loadAnalytics = async () => {

  clearViews();
  setShowAnalytics(true);

  try {

    const response = await fetch(

      `${API}/analytics/dashboard`

    );


    if (!response.ok) {

      throw new Error("Failed to load analytics");

    }


    const data = await response.json();


    setAnalyticsData(data);

  } catch (error) {

    console.error(error);

    setMessage("Cannot load freshness analytics.");

  }

};

  // =========================================================

  // CALCULATE DAYS REMAINING

  // =========================================================


  const getDaysRemaining = (expiryDate) => {

    const today = new Date();


    today.setHours(0, 0, 0, 0);


    const expiry = new Date(expiryDate);


    expiry.setHours(0, 0, 0, 0);


    const difference =

      expiry.getTime() -

      today.getTime();


    return Math.ceil(

      difference /

        (1000 * 60 * 60 * 24)

    );

  };


  // =========================================================

  // EXPIRY STATUS

  // =========================================================


  const getExpiryStatus = (expiryDate) => {

    const days =

      getDaysRemaining(expiryDate);


    if (days < 0) {

      return "Expired";

    }


    if (days <= 3) {

      return "Critical";

    }


    if (days <= 7) {

      return "Near Expiry";

    }


    return "Fresh";

  };


  // =========================================================
  // DELETE BATCH
  // =========================================================

  const deleteBatch = async (batchId) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Batch #${batchId}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API}/batches/${batchId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
          data.message ||
          "Failed to delete batch."
        );
        return;
      }

      await loadBatches();
      setMessage("Batch deleted successfully.");

    } catch (error) {
      console.error(error);
      setMessage("Cannot delete batch.");
    }
  };


  // =========================================================

  // ADD BATCH

  // =========================================================


  const addBatch = async (e) => {

    e.preventDefault();


    if (

      !batchFoodItem ||

      !batchQuantity ||

      !batchExpiryDate

    ) {

      setMessage(

        "Please fill in all batch details."

      );

      return;

    }


    try {

      const response = await fetch(

        `${API}/batches`,

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            food_item_id:

              Number(batchFoodItem),


            quantity:

              Number(batchQuantity),


            expiry_date:

              batchExpiryDate,

          }),

        }

      );


      const data = await response.json();


      if (response.ok) {

        setMessage(

          "Batch added successfully!"

        );


        setBatchFoodItem("");

        setBatchQuantity("");

        setBatchExpiryDate("");

        setShowAddBatch(false);


        await loadBatches();

      } else {

        setMessage(

          data.message ||

            "Failed to add batch."

        );

      }

    } catch (error) {

      console.error(error);

      setMessage(

        "Cannot connect to backend."

      );

    }

  };


  // =========================================================
  // BROWSER BACK BUTTON
  // =========================================================

  useEffect(() => {
    if (!loggedInUser) return;

    window.history.pushState(
      { foodtraceDashboard: true },
      "",
      window.location.href
    );

    const handleBack = () => {
      clearViews();

      window.history.pushState(
        { foodtraceDashboard: true },
        "",
        window.location.href
      );
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, [loggedInUser]);


  // =========================================================
// LOGIN / REGISTER
// =========================================================

const handleSubmit = async (e) => {
  e.preventDefault();

  if (mode === "register" && password !== confirmPassword) {
    setMessage("Passwords do not match.");
    return;
  }

  if (mode === "register" && !role) {
    setMessage("Please select a role.");
    return;
  }

  setMessage("Please wait...");

  try {
    const endpoint =
      mode === "login"
        ? `${API}/login`
        : `${API}/register`;

    const body =
      mode === "login"
        ? {
            email,
            password,
          }
        : {
            name,
            email,
            password,
            role,
          };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(
        data.detail ||
        data.message ||
        "Something went wrong."
      );
      return;
    }

    // Registration creates the account, then sends the user to Login.
    if (mode === "register") {
      localStorage.removeItem("foodtrace_token");
      setLoggedInUser(null);

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("");

      setMode("login");
      setMessage("Registration successful! Please log in.");
      return;
    }

    // Login
    const userData = data.user || data;

    const finalUser = {
      id: userData.id,
      name: userData.name || userData.username || "",
      email: userData.email || email,
      role: userData.role || role || "",
    };

    setLoggedInUser(finalUser);
    localStorage.setItem(
      "foodtrace_user",
      JSON.stringify(finalUser)
    );

    if (data.access_token) {
      localStorage.setItem(
        "foodtrace_token",
        data.access_token
      );
    }

    // Reset authentication form
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("");
    setMessage("");

    // Reset dashboard views
    setShowFoodItems(false);
    setShowAddFood(false);
    setShowBatches(false);
    setShowAddBatch(false);
    setShowInventory(false);
    setShowExpiry(false);
    setShowFreshness(false);
    setShowAnalytics(false);
    setShowAlerts(false);
    setShowStorage(false);
    setShowReportsCenter(false);
    setShowProfile(false);
    setShowAdminUsers(false);

    setFoodItems([]);
    setBatches([]);

  } catch (error) {
    console.error(error);
    setMessage("Cannot connect to backend.");
  }
};

  // =========================================================
  // DASHBOARD
  // =========================================================

  if (loggedInUser) {
    const currentRole = String(loggedInUser.role || "")
      .trim()
      .toLowerCase();

    // -------------------------------------------------------
    // ROLE CHECKS — preserved from previous milestones
    // -------------------------------------------------------

    const isConsumer = currentRole === "consumer";
    const isRetailManager = currentRole === "retail manager";
    const isWarehouse =
      currentRole === "warehouse operator" ||
      currentRole === "warehouse manager";
    const isInspector = currentRole === "food quality inspector";
    const isAdministrator = currentRole === "administrator";

    const isDashboardHome =
      !showFoodItems &&
      !showAddFood &&
      !showBatches &&
      !showAddBatch &&
      !showInventory &&
      !showExpiry &&
      !showFreshness &&
      !showAnalytics &&
      !showAlerts &&
      !showStorage &&
      !showWasteReduction &&
      !showReportsCenter &&
      !showProfile &&
      !showAdminUsers;

    const navClass = (active) =>
      `ft-db-nav-item${active ? " active" : ""}`;

    const nearExpiryCount = batches.filter((batch) => {
      const status = getExpiryStatus(batch.expiry_date);
      return status === "Near Expiry";
    }).length;

    const criticalCount = batches.filter((batch) => {
      const status = getExpiryStatus(batch.expiry_date);
      return status === "Critical" || status === "Expired";
    }).length;

    const freshCount = batches.filter(
      (batch) => getExpiryStatus(batch.expiry_date) === "Fresh"
    ).length;

    const attentionCount =
      analyticsData?.summary?.batches_requiring_attention ??
      criticalCount + nearExpiryCount;

    const averageFreshness =
      analyticsData?.summary?.average_freshness_score;

    const activeBatchCount = batches.filter(
      (batch) => Number(batch.quantity || 0) > 0
    ).length;

    const outOfStockCount = batches.filter(
      (batch) => Number(batch.quantity || 0) <= 0
    ).length;

    const totalQuantity = batches.reduce(
      (sum, batch) => sum + Number(batch.quantity || 0),
      0
    );

    const assessedBatchCount = batches.filter(
      (batch) => batch.freshness_score !== null && batch.freshness_score !== undefined
    ).length;

    const highSpoilageRiskCount = batches.filter((batch) => {
      const risk = String(batch.spoilage_risk || "").toLowerCase();
      const probability = Number(batch.spoilage_probability || 0);
      return risk === "high" || probability >= 60;
    }).length;

    const roleDashboardName = isConsumer
      ? "Consumer freshness workspace"
      : isRetailManager
      ? "Retail freshness control"
      : isWarehouse
      ? "Warehouse operations intelligence"
      : isInspector
      ? "Quality inspection workspace"
      : isAdministrator
      ? "Platform operations overview"
      : "FoodTrace intelligence";

    const roleDashboardSubtitle = isConsumer
      ? "Track freshness, shelf life and what needs attention before food becomes waste."
      : isRetailManager
      ? "Monitor product freshness, stock health, shelf-life risk and waste exposure."
      : isWarehouse
      ? "Track batches, inventory health, FEFO priority and freshness across operations."
      : isInspector
      ? "Review freshness assessments, spoilage risk and batches requiring quality attention."
      : isAdministrator
      ? "See platform inventory, freshness intelligence and operational exceptions in one place."
      : "Freshness, inventory and expiry insights — in one calm workspace.";

    const logout = () => {
      setLoggedInUser(null);
      localStorage.removeItem("foodtrace_user");
      localStorage.removeItem("foodtrace_token");
      clearViews();
      setFoodItems([]);
      setBatches([]);
      setAnalyticsData(null);
      setAlertsData(null);
      setEmail("");
      setPassword("");
      setMode("landing");
    };

    return (
      <div className="ft-dashboard-shell">
        {/* =====================================================
            SIDEBAR
        ===================================================== */}
        <aside className="ft-db-sidebar">
          <button
            className="ft-db-brand"
            type="button"
            onClick={clearViews}
            aria-label="Open FoodTrace dashboard"
          >
            <span className="ft-db-brand-mark" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </span>
            <span className="ft-db-brand-name">
              Food<span>Trace</span>
            </span>
          </button>

          <div className="ft-db-nav-label">WORKSPACE</div>

          <nav className="ft-db-nav" aria-label="FoodTrace dashboard navigation">
            <button
              className={navClass(isDashboardHome)}
              type="button"
              onClick={clearViews}
            >
              <span className="ft-db-nav-icon">⌂</span>
              Dashboard
            </button>

            {(isConsumer || isRetailManager || isWarehouse || isAdministrator) && (
              <button
                className={navClass(showFoodItems || showAddFood)}
                type="button"
                onClick={loadFoodItems}
              >
                <span className="ft-db-nav-icon">◇</span>
                Food Items
              </button>
            )}

            {(isWarehouse || isRetailManager || isAdministrator) && (
              <button
                className={navClass(showBatches || showAddBatch)}
                type="button"
                onClick={loadBatches}
              >
                <span className="ft-db-nav-icon">▱</span>
                Batches
              </button>
            )}

            {(isConsumer ||
              isRetailManager ||
              isWarehouse ||
              isAdministrator) && (
              <button
                className={navClass(showInventory)}
                type="button"
                onClick={loadInventory}
              >
                <span className="ft-db-nav-icon">▤</span>
                Inventory
              </button>
            )}

            {(isConsumer ||
              isRetailManager ||
              isWarehouse ||
              isInspector ||
              isAdministrator) && (
              <button
                className={navClass(showExpiry)}
                type="button"
                onClick={loadExpiry}
              >
                <span className="ft-db-nav-icon">◷</span>
                Expiry Management
              </button>
            )}

            {(isConsumer || isRetailManager || isWarehouse || isInspector || isAdministrator) && (
              <button
                className={navClass(showFreshness)}
                type="button"
                onClick={() => {
                  clearViews();
                  setShowFreshness(true);
                }}
              >
                <span className="ft-db-nav-icon">⌁</span>
                Freshness Analysis
              </button>
            )}

            {(isConsumer || isRetailManager || isWarehouse || isInspector || isAdministrator) && (
              <button
                className={navClass(showStorage)}
                type="button"
                onClick={() => { clearViews(); setShowStorage(true); }}
              >
                <span className="ft-db-nav-icon">S</span>
                Storage Monitoring
              </button>
            )}

            {(isRetailManager || isWarehouse || isAdministrator) && (
              <button
                className={navClass(showWasteReduction)}
                type="button"
                onClick={loadWasteReduction}
              >
                <span className="ft-db-nav-icon">W</span>
                Waste Reduction
              </button>
            )}

            <button
              className={navClass(showAlerts)}
              type="button"
              onClick={loadAlerts}
            >
              <span className="ft-db-nav-icon">A</span>
              Alerts
              {alertsData?.summary?.total_alerts > 0 && (
                <span className="ft-db-nav-badge">{alertsData.summary.total_alerts}</span>
              )}
            </button>

            <button
              className={navClass(showReportsCenter)}
              type="button"
              onClick={() => { clearViews(); setShowReportsCenter(true); }}
            >
              <span className="ft-db-nav-icon">R</span>
              Reports
            </button>

            <button
              className={navClass(showAnalytics)}
              type="button"
              onClick={loadAnalytics}
            >
              <span className="ft-db-nav-icon">D</span>
              Analytics
            </button>

            {isAdministrator && (
              <button
                className={navClass(showAdminUsers)}
                type="button"
                onClick={() => { clearViews(); setShowAdminUsers(true); }}
              >
                <span className="ft-db-nav-icon">U</span>
                User Management
              </button>
            )}
          </nav>

          <div className="ft-db-sidebar-bottom">
            <div className="ft-db-mini-profile">
              <div className="ft-db-avatar small">
                {(loggedInUser.name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{loggedInUser.name || "User"}</strong>
                <span>{loggedInUser.role || "User"}</span>
              </div>
            </div>

            <button className="ft-db-logout" type="button" onClick={logout}>
              <span>↪</span>
              Logout
            </button>
          </div>

          {/* Pure CSS technology pattern — no leaf artwork */}
          <div className="ft-db-tech-pattern" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
          </div>
        </aside>

        {/* =====================================================
            MAIN WORKSPACE
        ===================================================== */}
        <main className="ft-db-main">
          <header className="ft-db-header">
            <div className="ft-db-header-copy">
              <p className="ft-db-eyebrow">{roleDashboardName.toUpperCase()}</p>
              <h1>Welcome back, {loggedInUser.name || "User"}.</h1>
              <p>{roleDashboardSubtitle}</p>
            </div>

            <div className="ft-db-header-actions">
              <button
                className="ft-db-alert-bell ft-db-alert-text"
                type="button"
                onClick={loadAlerts}
                aria-label="Open alerts"
              >
                Alerts
                {alertsData?.summary?.total_alerts > 0 && (
                  <b>{alertsData.summary.total_alerts}</b>
                )}
              </button>

              <button className="ft-db-header-profile ft-db-profile-button" type="button" onClick={() => { clearViews(); setShowProfile(true); }}>
                <div className="ft-db-avatar">
                  {(loggedInUser.name || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong>{loggedInUser.name || "User"}</strong>
                  <span>{loggedInUser.role || "User"}</span>
                </div>
              </button>
            </div>
          </header>

          {!isConsumer &&
            !isRetailManager &&
            !isWarehouse &&
            !isInspector &&
            !isAdministrator && (
              <section className="ft-db-panel ft-db-access-warning">
                <h2>Access information</h2>
                <p>
                  Your account role is <strong>{loggedInUser.role || "Unknown"}</strong>.
                  Please make sure it matches one of the available FoodTrace roles.
                </p>
              </section>
            )}

          {isDashboardHome && (
            <>
              {/* =====================================================
                  ROLE-AWARE DASHBOARD HOME
              ===================================================== */}

              {isConsumer && (
                <>
                  <section className="ft-db-role-banner consumer">
                    <div>
                      <p>CONSUMER DASHBOARD</p>
                      <h2>Know what is fresh, what to use next, and what needs attention.</h2>
                    </div>
                    <button type="button" onClick={() => { clearViews(); setShowFreshness(true); }}>
                      Analyze food →
                    </button>
                  </section>

                  <section className="ft-db-kpis">
                    <button className="ft-db-kpi" type="button" onClick={loadFoodItems}>
                      <span className="ft-db-kpi-icon green">◇</span>
                      <span className="ft-db-kpi-copy"><small>Food items</small><strong>{foodItems.length}</strong><em>Available in catalogue</em></span>
                    </button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}>
                      <span className="ft-db-kpi-icon blue">✓</span>
                      <span className="ft-db-kpi-copy"><small>Fresh batches</small><strong>{freshCount}</strong><em>No immediate action</em></span>
                    </button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}>
                      <span className="ft-db-kpi-icon amber">◷</span>
                      <span className="ft-db-kpi-copy"><small>Near expiry</small><strong>{nearExpiryCount}</strong><em>Plan consumption soon</em></span>
                    </button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}>
                      <span className="ft-db-kpi-icon red">!</span>
                      <span className="ft-db-kpi-copy"><small>Needs attention</small><strong>{criticalCount}</strong><em>Critical or expired</em></span>
                    </button>
                  </section>

                  <section className="ft-db-insight-grid">
                    <article className="ft-db-panel ft-db-health-card">
                      <div className="ft-db-panel-heading"><div><p className="ft-db-panel-kicker">SHELF-LIFE VIEW</p><h2>What should you use first?</h2></div><button type="button" onClick={loadExpiry}>Open expiry →</button></div>
                      <div className="ft-db-health-layout">
                        <div className="ft-db-health-ring"><div><strong>{batches.length}</strong><span>Total batches</span></div></div>
                        <div className="ft-db-health-list">
                          <div><span className="ft-db-dot fresh"></span><p><strong>{freshCount}</strong><span>Fresh</span></p></div>
                          <div><span className="ft-db-dot near"></span><p><strong>{nearExpiryCount}</strong><span>Use soon</span></p></div>
                          <div><span className="ft-db-dot critical"></span><p><strong>{criticalCount}</strong><span>Attention</span></p></div>
                        </div>
                      </div>
                    </article>

                    <article className="ft-db-panel ft-db-intelligence-card">
                      <div className="ft-db-panel-heading"><div><p className="ft-db-panel-kicker">PERSONAL FRESHNESS</p><h2>Freshness intelligence</h2></div><button type="button" onClick={loadAnalytics}>View report →</button></div>
                      <div className="ft-db-intelligence-score">
                        <div><span>Average freshness</span><strong>{averageFreshness !== null && averageFreshness !== undefined ? `${averageFreshness}%` : "—"}</strong></div>
                        <div><span>Assessed batches</span><strong>{assessedBatchCount}</strong></div>
                      </div>
                      <p className="ft-db-intelligence-note">Use freshness analysis before consumption when a product is nearing expiry or its condition is uncertain.</p>
                    </article>
                  </section>
                </>
              )}

              {isRetailManager && (
                <>
                  <section className="ft-db-role-banner retail">
                    <div><p>RETAIL DASHBOARD</p><h2>Protect shelf quality while reducing expiry-driven waste.</h2></div>
                    <button type="button" onClick={loadAnalytics}>Open analytics →</button>
                  </section>

                  <section className="ft-db-kpis">
                    <button className="ft-db-kpi" type="button" onClick={loadFoodItems}><span className="ft-db-kpi-icon green">◇</span><span className="ft-db-kpi-copy"><small>Products</small><strong>{foodItems.length}</strong><em>Catalogue records</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadBatches}><span className="ft-db-kpi-icon blue">▱</span><span className="ft-db-kpi-copy"><small>Active batches</small><strong>{activeBatchCount}</strong><em>Stock currently available</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}><span className="ft-db-kpi-icon amber">◷</span><span className="ft-db-kpi-copy"><small>Shelf-life alerts</small><strong>{nearExpiryCount + criticalCount}</strong><em>Require planning</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadAnalytics}><span className="ft-db-kpi-icon red">!</span><span className="ft-db-kpi-copy"><small>Waste exposure</small><strong>{attentionCount}</strong><em>Batches requiring attention</em></span></button>
                  </section>

                  <section className="ft-db-role-panels">
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">PRODUCT FRESHNESS</p><h2>{averageFreshness !== null && averageFreshness !== undefined ? `${averageFreshness}% average freshness` : "Freshness assessment pending"}</h2><p>{assessedBatchCount} batches currently have freshness assessment data.</p><button type="button" onClick={loadAnalytics}>Product freshness analytics →</button></article>
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">INVENTORY QUALITY</p><h2>{outOfStockCount} out-of-stock batches</h2><p>{totalQuantity} kg is currently recorded across all tracked batches.</p><button type="button" onClick={loadInventory}>Review inventory →</button></article>
                    <article className="ft-db-panel ft-db-role-card attention"><p className="ft-db-panel-kicker">WASTE REDUCTION</p><h2>{nearExpiryCount + criticalCount} batches need expiry action</h2><p>Use FEFO priority and recommended actions to move higher-risk stock first.</p><button type="button" onClick={loadExpiry}>Open FEFO view →</button></article>
                  </section>
                </>
              )}

              {isWarehouse && (
                <>
                  <section className="ft-db-role-banner warehouse">
                    <div><p>WAREHOUSE DASHBOARD</p><h2>Keep every batch visible, prioritized and moving before quality drops.</h2></div>
                    <button type="button" onClick={loadExpiry}>Open FEFO priority →</button>
                  </section>

                  <section className="ft-db-kpis">
                    <button className="ft-db-kpi" type="button" onClick={loadBatches}><span className="ft-db-kpi-icon green">▱</span><span className="ft-db-kpi-copy"><small>Active batches</small><strong>{activeBatchCount}</strong><em>Currently available</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadInventory}><span className="ft-db-kpi-icon blue">▤</span><span className="ft-db-kpi-copy"><small>Total quantity</small><strong>{totalQuantity}</strong><em>kg recorded</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadInventory}><span className="ft-db-kpi-icon amber">□</span><span className="ft-db-kpi-copy"><small>Out of stock</small><strong>{outOfStockCount}</strong><em>Needs replenishment</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}><span className="ft-db-kpi-icon red">!</span><span className="ft-db-kpi-copy"><small>Expiry priority</small><strong>{nearExpiryCount + criticalCount}</strong><em>FEFO attention</em></span></button>
                  </section>

                  <section className="ft-db-role-panels">
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">INVENTORY HEALTH</p><h2>{activeBatchCount} active / {batches.length} tracked</h2><p>Monitor quantities and update stock as products move through the warehouse.</p><button type="button" onClick={loadInventory}>Manage stock →</button></article>
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">BATCH FRESHNESS</p><h2>{assessedBatchCount} assessed batches</h2><p>Connect food-image analysis with a batch to store shelf-life and spoilage predictions.</p><button type="button" onClick={() => { clearViews(); setShowFreshness(true); }}>Run assessment →</button></article>
                    <article className="ft-db-panel ft-db-role-card attention"><p className="ft-db-panel-kicker">FEFO ROTATION</p><h2>{criticalCount} critical / expired</h2><p>Use the earliest effective expiry first and act on recommended batch priorities.</p><button type="button" onClick={loadExpiry}>View rotation →</button></article>
                  </section>
                </>
              )}

              {isInspector && (
                <>
                  <section className="ft-db-role-banner inspector">
                    <div><p>QUALITY INSPECTOR DASHBOARD</p><h2>Focus inspection effort where freshness and spoilage risk need attention.</h2></div>
                    <button type="button" onClick={() => { clearViews(); setShowFreshness(true); }}>New assessment →</button>
                  </section>

                  <section className="ft-db-kpis">
                    <button className="ft-db-kpi" type="button" onClick={() => { clearViews(); setShowFreshness(true); }}><span className="ft-db-kpi-icon green">✓</span><span className="ft-db-kpi-copy"><small>Assessed batches</small><strong>{assessedBatchCount}</strong><em>With freshness data</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadAnalytics}><span className="ft-db-kpi-icon blue">%</span><span className="ft-db-kpi-copy"><small>Average freshness</small><strong>{averageFreshness !== null && averageFreshness !== undefined ? `${averageFreshness}%` : "—"}</strong><em>Across assessed stock</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadAnalytics}><span className="ft-db-kpi-icon amber">◔</span><span className="ft-db-kpi-copy"><small>High spoilage risk</small><strong>{highSpoilageRiskCount}</strong><em>Needs quality review</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}><span className="ft-db-kpi-icon red">!</span><span className="ft-db-kpi-copy"><small>Expiry attention</small><strong>{nearExpiryCount + criticalCount}</strong><em>Near expiry / critical</em></span></button>
                  </section>

                  <section className="ft-db-role-panels two">
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">QUALITY ASSESSMENT</p><h2>Image-to-decision workflow</h2><p>Review color degradation, texture, mold indicators, freshness score, shelf life and risk in one assessment.</p><button type="button" onClick={() => { clearViews(); setShowFreshness(true); }}>Inspect food →</button></article>
                    <article className="ft-db-panel ft-db-role-card attention"><p className="ft-db-panel-kicker">BATCH ATTENTION</p><h2>{attentionCount} batches require attention</h2><p>Use expiry intelligence and analysis reports to prioritize inspection.</p><button type="button" onClick={loadAnalytics}>Open quality report →</button></article>
                  </section>
                </>
              )}

              {isAdministrator && (
                <>
                  <section className="ft-db-role-banner admin">
                    <div><p>ADMINISTRATOR DASHBOARD</p><h2>Platform-wide visibility across inventory, freshness and operational risk.</h2></div>
                    <button type="button" onClick={loadAnalytics}>Platform analytics →</button>
                  </section>

                  <section className="ft-db-kpis">
                    <button className="ft-db-kpi" type="button" onClick={loadFoodItems}><span className="ft-db-kpi-icon green">◇</span><span className="ft-db-kpi-copy"><small>Food records</small><strong>{foodItems.length}</strong><em>Platform catalogue</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadBatches}><span className="ft-db-kpi-icon blue">▱</span><span className="ft-db-kpi-copy"><small>Total batches</small><strong>{batches.length}</strong><em>Tracked system-wide</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadAnalytics}><span className="ft-db-kpi-icon amber">✓</span><span className="ft-db-kpi-copy"><small>Assessed batches</small><strong>{assessedBatchCount}</strong><em>Prediction coverage</em></span></button>
                    <button className="ft-db-kpi" type="button" onClick={loadExpiry}><span className="ft-db-kpi-icon red">!</span><span className="ft-db-kpi-copy"><small>Operational alerts</small><strong>{attentionCount}</strong><em>Require attention</em></span></button>
                  </section>

                  <section className="ft-db-role-panels">
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">PLATFORM INVENTORY</p><h2>{totalQuantity} kg across {batches.length} batches</h2><p>Review catalogue, batches and stock health from the platform workspace.</p><button type="button" onClick={loadInventory}>Inventory overview →</button></article>
                    <article className="ft-db-panel ft-db-role-card"><p className="ft-db-panel-kicker">FRESHNESS COVERAGE</p><h2>{assessedBatchCount} / {batches.length} batches assessed</h2><p>Track how much of the current inventory has freshness and shelf-life prediction data.</p><button type="button" onClick={loadAnalytics}>View analytics →</button></article>
                    <article className="ft-db-panel ft-db-role-card attention"><p className="ft-db-panel-kicker">SYSTEM ATTENTION</p><h2>{nearExpiryCount + criticalCount} expiry exceptions</h2><p>Operational exceptions are ready to feed the notification and reporting modules next.</p><button type="button" onClick={loadExpiry}>Review exceptions →</button></article>
                  </section>
                </>
              )}

              <section className="ft-db-panel ft-db-quick-card ft-db-role-quick">
                <div><p className="ft-db-panel-kicker">QUICK ACTIONS</p><h2>Continue your FoodTrace workflow.</h2><p>Only actions relevant to your role are shown here.</p></div>
                <div className="ft-db-quick-actions">
                  {(isConsumer || isRetailManager || isWarehouse || isAdministrator) && <button type="button" onClick={loadFoodItems}><span>◇</span>Food catalogue</button>}
                  {(isRetailManager || isWarehouse || isAdministrator) && <button type="button" onClick={loadBatches}><span>▱</span>Batches</button>}
                  {(isConsumer || isRetailManager || isWarehouse || isAdministrator) && <button type="button" onClick={loadInventory}><span>▤</span>Inventory</button>}
                  <button type="button" onClick={loadExpiry}><span>◷</span>Expiry</button>
                  <button type="button" onClick={() => { clearViews(); setShowFreshness(true); }}><span>⌁</span>Freshness</button>
                  <button type="button" onClick={loadAnalytics}><span>▥</span>Reports</button>
                </div>
              </section>
            </>
          )}

          {/* =====================================================
              EXISTING MILESTONE MODULES
              The functionality below is preserved.
          ===================================================== */}
          <div className="ft-db-module-area">
{/* =================================================

    FRESHNESS ANALYSIS

\================================================= */}


{showFreshness && (


  <div className="food-items-section">

    <FreshnessAnalysis user={loggedInUser} />

  </div>


)}


{/* =================================================

    FOOD ITEMS DISPLAY

\================================================= */}


{showFoodItems && (


  <div className="food-items-section">


    <h2>

      Your Food Catalogue

    </h2>


    {foodItems.length === 0 ? (


      <p>

        No food items found.

      </p>


    ) : (


      foodItems.map(

        (food) => (


          <div

            className="food-item"

            key={food.id}

          >

            {editingFoodId === food.id ? (
              <div style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap"
              }}>

                <input
                  type="text"
                  value={editFoodName}
                  onChange={(e) =>
                    setEditFoodName(e.target.value)
                  }
                />

                <select
                  value={editFoodCategory}
                  onChange={(e) =>
                    setEditFoodCategory(e.target.value)
                  }
                >
                  {foodCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="submit-button"
                  onClick={() => updateFoodItem(food.id)}
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingFoodId(null);
                    setMessage("");
                  }}
                >
                  Cancel
                </button>

              </div>
            ) : (
              <>
                <strong>
                  {food.name}
                </strong>

                <span style={{ marginLeft: "15px" }}>
                  {food.category}
                </span>

                {(isWarehouse || isAdministrator) && (
                  <span style={{
                    marginLeft: "15px",
                    display: "inline-flex",
                    gap: "8px"
                  }}>
                    <button
                      type="button"
                      className="food-edit-button"
                      onClick={() => {
                        setEditingFoodId(food.id);
                        setEditFoodName(food.name);
                        setEditFoodCategory(food.category);
                        setMessage("");
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="food-delete-button"
                      onClick={() =>
                        deleteFoodItem(food.id, food.name)
                      }
                    >
                      Delete
                    </button>
                  </span>
                )}
              </>
            )}

          </div>

        )

      )

    )}


    {/* Warehouse can add food */}


    {isWarehouse && (


      <button

        className="submit-button"

        type="button"

        onClick={() => {

          setShowAddFood(

            !showAddFood

          );

          setMessage("");

        }}

      >

        {showAddFood

          ? "Cancel"

          : "+ Add Food Item"}

      </button>

    )}


  </div>

)}


{/* =========================================================

    FRESHNESS ANALYTICS DASHBOARD

\========================================================= */}



          {showStorage && (
            <StorageMonitoring role={loggedInUser.role} />
          )}

          {showWasteReduction && (
            <section className="ft-waste-page">

              <div className="ft-waste-heading">

                <div>
                  <p className="ft-db-panel-kicker">
                    WASTE REDUCTION INTELLIGENCE
                  </p>

                  <h2>
                    Waste Risk & Recommended Actions
                  </h2>

                  <p>
                    Prioritize batches that need attention and reduce
                    avoidable food loss using freshness, spoilage and
                    effective-expiry data.
                  </p>
                </div>

                <div className="ft-waste-actions">
                  <button
                    type="button"
                    onClick={loadWasteReduction}
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      window.open(
                        `${API}/reports/waste-reduction/pdf`,
                        "_blank"
                      )
                    }
                  >
                    PDF
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      window.open(
                        `${API}/reports/waste-reduction/excel`,
                        "_blank"
                      )
                    }
                  >
                    Excel
                  </button>
                </div>

              </div>

              {wasteReductionData && (
                <>
                  <div className="ft-waste-summary">

                    <article>
                      <span>Total Batches</span>
                      <strong>
                        {wasteReductionData.summary?.total_batches ?? 0}
                      </strong>
                    </article>

                    <article className="high">
                      <span>High Risk</span>
                      <strong>
                        {wasteReductionData.summary?.high_risk ?? 0}
                      </strong>
                    </article>

                    <article className="moderate">
                      <span>Moderate Risk</span>
                      <strong>
                        {wasteReductionData.summary?.moderate_risk ?? 0}
                      </strong>
                    </article>

                    <article className="low">
                      <span>Low Risk</span>
                      <strong>
                        {wasteReductionData.summary?.low_risk ?? 0}
                      </strong>
                    </article>

                  </div>

                  <div className="ft-waste-table-wrap">
                    <table className="ft-waste-table">

                      <thead>
                        <tr>
                          <th>Batch</th>
                          <th>Food</th>
                          <th>Quantity</th>
                          <th>Effective Expiry</th>
                          <th>Freshness</th>
                          <th>Spoilage Probability</th>
                          <th>Waste Risk</th>
                          <th>Recommended Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(wasteReductionData.records || []).map(
                          (item) => (
                            <tr key={item.batch_id}>

                              <td>
                                #{item.batch_id}
                              </td>

                              <td>
                                {item.food_name}
                              </td>

                              <td>
                                {item.quantity} kg
                              </td>

                              <td>
                                {item.effective_expiry}
                              </td>

                              <td>
                                {item.freshness_score === null ||
                                item.freshness_score === undefined
                                  ? "Not assessed"
                                  : `${Number(
                                      item.freshness_score
                                    ).toFixed(2)}%`}
                              </td>

                              <td>
                                {item.spoilage_probability === null ||
                                item.spoilage_probability === undefined
                                  ? "—"
                                  : `${Number(
                                      item.spoilage_probability
                                    ).toFixed(2)}%`}
                              </td>

                              <td>
                                <span
                                  className={`ft-waste-risk ${
                                    String(
                                      item.waste_risk || ""
                                    ).toLowerCase()
                                  }`}
                                >
                                  {item.waste_risk}
                                </span>
                              </td>

                              <td className="ft-waste-action-text">
                                {item.recommended_action}
                              </td>

                            </tr>
                          )
                        )}
                      </tbody>

                    </table>
                  </div>
                </>
              )}

            </section>
          )}

          {showReportsCenter && (
            <ReportsCenter role={loggedInUser.role} />
          )}

          {showProfile && (
            <ProfilePanel user={loggedInUser} onUpdate={setLoggedInUser} />
          )}

          {showAdminUsers && isAdministrator && (
            <AdminUsers />
          )}

          {/* =========================================================
              NOTIFICATIONS & ALERTS
          ========================================================= */}

          {showAlerts && (
            <section className="ft-alerts-page">

              <div className="ft-alerts-heading">
                <div>
                  <p className="ft-db-panel-kicker">NOTIFICATION CENTER</p>
                  <h2>Alerts & Recommended Actions</h2>
                  <p>
                    Role-based freshness, shelf-life, spoilage and inventory
                    notifications generated from your current FoodTrace data.
                  </p>
                </div>

                <button type="button" onClick={loadAlerts}>
                  Refresh alerts
                </button>
              </div>

              <div className="ft-alert-summary">

                <article>
                  <span>All Alerts</span>
                  <strong>{alertsData?.summary?.total_alerts ?? 0}</strong>
                </article>

                <article className="critical">
                  <span>Critical</span>
                  <strong>{alertsData?.summary?.critical ?? 0}</strong>
                </article>

                <article className="high">
                  <span>High</span>
                  <strong>{alertsData?.summary?.high ?? 0}</strong>
                </article>

                <article className="medium">
                  <span>Medium</span>
                  <strong>{alertsData?.summary?.medium ?? 0}</strong>
                </article>

              </div>

              <div className="ft-alert-type-strip">
                <span>
                  Shelf-life
                  <strong>{alertsData?.summary?.shelf_life ?? 0}</strong>
                </span>

                <span>
                  Freshness
                  <strong>{alertsData?.summary?.freshness ?? 0}</strong>
                </span>

                <span>
                  Spoilage
                  <strong>{alertsData?.summary?.spoilage ?? 0}</strong>
                </span>

                <span>
                  Inventory
                  <strong>{alertsData?.summary?.inventory ?? 0}</strong>
                </span>

                <span>
                  Storage
                  <strong>{alertsData?.summary?.storage ?? 0}</strong>
                </span>
              </div>

              {!alertsData ? (
                <div className="ft-alert-empty">
                  Loading notifications...
                </div>
              ) : alertsData.alerts?.length === 0 ? (
                <div className="ft-alert-empty good">
                  <strong>No active alerts.</strong>
                  <span>Your monitored food inventory currently has no warnings.</span>
                </div>
              ) : (
                <div className="ft-alert-list">
                  {alertsData.alerts.map((alert, index) => (
                    <article
                      className={`ft-alert-card ${alert.severity}`}
                      key={`${alert.type}-${alert.batch_id}-${index}`}
                    >
                      <div className="ft-alert-content">
                        <div className="ft-alert-title-row">
                          <div>
                            <span className={`ft-alert-severity ${alert.severity}`}>
                              {String(alert.severity || "").toUpperCase()}
                            </span>
                            <span className="ft-alert-type">
                              {String(alert.type || "").replace("_", " ")}
                            </span>
                          </div>

                          <small>Batch #{alert.batch_id}</small>
                        </div>

                        <h3>{alert.title}</h3>
                        <p>{alert.message}</p>

                        <div className="ft-alert-action">
                          <span>Recommended action</span>
                          <strong>{alert.action}</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {message && (
                <p className="message">{message}</p>
              )}

            </section>
          )}


{showAnalytics && analyticsData && (() => {
  const freshnessEntries = Object.entries(analyticsData.freshness_distribution || {});
  const expiryEntries = Object.entries(analyticsData.expiry_distribution || {});
  const spoilageEntries = Object.entries(analyticsData.spoilage_risk_distribution || {});
  const totalBatches = Math.max(Number(analyticsData.summary?.total_batches || 0), 1);
  const assessed = Number(analyticsData.summary?.assessed_batches || 0);
  const coverage = Math.round((assessed / totalBatches) * 100);
  const expiryTotal = Math.max(expiryEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0), 1);
  let expiryCursor = 0;
  const expiryColors = ["#15995a", "#efb23c", "#dd5259", "#e58a45"];
  const expiryStops = expiryEntries.map(([, value], index) => {
    const startPct = expiryCursor;
    const pct = (Number(value || 0) / expiryTotal) * 100;
    expiryCursor += pct;
    return `${expiryColors[index % expiryColors.length]} ${startPct}% ${expiryCursor}%`;
  });
  const expiryDonut = expiryStops.length ? `conic-gradient(${expiryStops.join(", ")})` : "#edf2ef";
  const foodNameFor = (id) => foodItems.find((item) => Number(item.id) === Number(id))?.name || `Item #${id}`;

  return (
    <div className="ft-analytics-page">
      <section className="ft-analytics-hero">
        <div>
          <p className="ft-analytics-kicker">EXECUTIVE FRESHNESS ANALYTICS</p>
          <h2>Freshness, expiry & waste intelligence</h2>
          <p>One decision view for quality coverage, expiry exposure, spoilage risk and batches that need action.</p>
        </div>
        <div className="ft-analytics-coverage">
          <strong>{coverage}%</strong>
          <span>assessment coverage</span>
          <small>{assessed} of {analyticsData.summary.total_batches} active batches assessed</small>
        </div>
      </section>

      <section className="ft-analytics-kpis">
  <article>
    <span>Active batches</span>
    <strong>{analyticsData.summary.total_batches}</strong>
    <small>currently available inventory batches</small>
  </article>

  <article>
    <span>Total quantity</span>
    <strong>{analyticsData.summary.total_quantity}</strong>
    <small>units currently recorded</small>
  </article>

  <article>
    <span>Average freshness</span>
    <strong>
      {analyticsData.summary.average_freshness_score !== null
        ? `${analyticsData.summary.average_freshness_score}%`
        : "—"}
    </strong>
    <small>across assessed batches</small>
  </article>

  <article className="attention">
    <span>Needs attention</span>
    <strong>{analyticsData.summary.batches_requiring_attention}</strong>
    <small>expiry or quality action</small>
  </article>
</section>

      <section className="ft-analytics-visual-grid">
        <article className="ft-analytics-panel">
          <div className="ft-analytics-panel-head">
            <div><span>FRESHNESS PROFILE</span><h3>Quality distribution</h3></div>
            <small>Assessed vs pending</small>
          </div>
          <div className="ft-analytics-bars">
            {freshnessEntries.map(([category, count]) => {
              const pct = Math.min((Number(count || 0) / totalBatches) * 100, 100);
              return (
                <div className="ft-analytics-bar-row" key={category}>
                  <div><span>{category}</span><strong>{count}</strong></div>
                  <div className="ft-analytics-track"><i style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="ft-analytics-panel ft-analytics-expiry-panel">
          <div className="ft-analytics-panel-head">
            <div><span>EXPIRY EXPOSURE</span><h3>Inventory status</h3></div>
            <small>effective expiry</small>
          </div>
          <div className="ft-analytics-donut-layout">
            <div className="ft-analytics-donut" style={{ background: expiryDonut }}>
              <div><strong>{analyticsData.summary.total_batches}</strong><span>batches</span></div>
            </div>
            <div className="ft-analytics-legend">
              {expiryEntries.map(([category, count], index) => (
                <div key={category}><i style={{ background: expiryColors[index % expiryColors.length] }} /><span>{category}</span><strong>{count}</strong></div>
              ))}
            </div>
          </div>
        </article>

        <article className="ft-analytics-panel">
          <div className="ft-analytics-panel-head">
            <div><span>RISK FORECAST</span><h3>Spoilage risk</h3></div>
            <small>available inventory</small>
          </div>
          <div className="ft-analytics-risk-list">
            {spoilageEntries.map(([category, count]) => {
              const pct = Math.min((Number(count || 0) / totalBatches) * 100, 100);
              return (
                <div key={category}>
                  <span>{category}</span>
                  <div className="ft-analytics-risk-track"><i style={{ width: `${pct}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="ft-analytics-panel ft-analytics-attention-panel">
        <div className="ft-analytics-panel-head">
          <div><span>ACTION QUEUE</span><h3>Batches requiring attention</h3></div>
          <small>{analyticsData.attention_batches.length} prioritized batch{analyticsData.attention_batches.length === 1 ? "" : "es"}</small>
        </div>

        {analyticsData.attention_batches.length === 0 ? (
          <div className="analytics-empty-state">No batches currently require attention.</div>
        ) : (
          <div className="ft-analytics-table-wrap">
            <table className="ft-analytics-table">
              <thead>
                <tr><th>Batch</th><th>Food</th><th>Qty</th><th>Freshness</th><th>Effective expiry</th><th>Time status</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {analyticsData.attention_batches.map((batch) => (
                  <tr key={batch.batch_id}>
                    <td><strong>#{batch.batch_id}</strong></td>
                    <td>{foodNameFor(batch.food_item_id)}</td>
                    <td>{batch.quantity}</td>
                    <td>{batch.freshness_score !== null ? `${batch.freshness_score}%` : <span className="ft-analytics-muted">Not assessed</span>}</td>
                    <td>{batch.effective_expiry_date}</td>
                    <td className={batch.days_until_expiry < 0 ? "overdue" : ""}>{batch.days_until_expiry < 0 ? `Expired ${Math.abs(batch.days_until_expiry)} day${Math.abs(batch.days_until_expiry) === 1 ? "" : "s"} ago` : batch.days_until_expiry === 0 ? "Expires today" : `${batch.days_until_expiry} days left`}</td>
                    <td><span className={`ft-analytics-risk-badge ${(batch.spoilage_risk || "unknown").toLowerCase().replaceAll(" ", "-")}`}>{batch.spoilage_risk || "Not assessed"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
})()}


{/* =================================================

    ADD FOOD FORM

\================================================= */}


{showAddFood &&

  isWarehouse && (


  <div className="food-items-section">


    <h2>

      Add Food Item

    </h2>


    <form

      onSubmit={

        addFoodItem

      }

    >


      <label>

        Food Name

      </label>


      <input

        type="text"

        placeholder="Enter food name"

        value={foodName}

        onChange={(e) =>

          setFoodName(

            e.target.value

          )

        }

        required

      />


      <label>

        Category

      </label>


      <select

        value={

          foodCategory

        }

        onChange={(e) =>

          setFoodCategory(

            e.target.value

          )

        }

        required

      >


        {foodCategories.map(

          (category) => (


            <option

              key={category}

              value={category}

            >

              {category}

            </option>


          )

        )}


      </select>


      <button

        className="submit-button"

        type="submit"

      >

        Add Food Item

      </button>


    </form>


  </div>

)}


{/* =================================================

    BATCHES DISPLAY

\================================================= */}


{showBatches && (


  <div className="food-items-section">


    <h2>

      Food Batches

    </h2>


    <p>

      Monitor individual

      food batches and

      their stock details.

    </p>


    {/* Add Batch */}


    {isWarehouse && (


      <button

        className="submit-button"

        type="button"

        onClick={() => {

          setShowAddBatch(

            !showAddBatch

          );

          setMessage("");

        }}

      >

        {showAddBatch

          ? "Cancel"

          : "+ Add Batch"}

      </button>

    )}


    {batches.length === 0 ? (


      <p>

        No batches found.

      </p>


    ) : (


      <div className="batch-table-container">


        <table className="batch-table">


          <thead>


            <tr>


              <th>

                S.No.

              </th>


              <th>

                Food Item

              </th>


              <th>

                Quantity

              </th>


              <th>

                Expiry Date

              </th>


              <th>

                Availability

              </th>

              <th>

                Actions

              </th>


            </tr>


          </thead>


          <tbody>


            {batches.map(

              (batch, index) => (


                <tr

                  key={

                    batch.id

                  }

                >


                  <td>

                    {index + 1}

                  </td>


                  <td>

                    {
                      foodItems.find(
                        (item) => item.id === batch.food_item_id
                      )?.name || `Food #${batch.food_item_id}`
                    }

                  </td>


                  <td>

                    {

                      batch.quantity

                    }{" "}

                    kg

                  </td>


                  <td>

                    {

                      batch.expiry_date

                    }

                  </td>


                  <td>

                    {

                      batch.availability

                    }

                  </td>

                  <td>
                    {(isWarehouse || isAdministrator) ? (
                      <button
                        type="button"
                        className="batch-delete-button"
                        onClick={() => deleteBatch(batch.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <span style={{ color: "#425a54", fontWeight: 600 }}>View only</span>
                    )}
                  </td>


                </tr>


              )

            )}


          </tbody>


        </table>


      </div>

    )}


  </div>

)}


{/* =================================================

    EXPIRY MANAGEMENT

\================================================= */}


{showExpiry && (
  <section className="ft-expiry-page">
    <div className="ft-expiry-heading">
      <div>
        <p className="ft-expiry-kicker">EXPIRY INTELLIGENCE</p>
        <h2>Expiry & Inventory Priority</h2>
        <p>
          Track expiry, predicted shelf life, FEFO rotation priority and waste risk from one view.
        </p>
      </div>

      <button
        type="button"
        className="ft-expiry-refresh"
        onClick={loadExpiry}
      >
        ↻ Refresh
      </button>
    </div>

    {!expiryOverview ? (
      <div className="ft-expiry-empty">Loading expiry information...</div>
    ) : (
      <>
        <div className="ft-expiry-summary-grid">
          <article className="ft-expiry-summary-card neutral">
            <span>Active Batches</span>
            <strong>{expiryOverview.summary.total_batches}</strong>
            <small>Tracked inventory batches</small>
          </article>

          <article className="ft-expiry-summary-card fresh">
            <span>Fresh</span>
            <strong>{expiryOverview.summary.fresh}</strong>
            <small>No immediate action</small>
          </article>

          <article className="ft-expiry-summary-card warning">
            <span>Near Expiry</span>
            <strong>{expiryOverview.summary.near_expiry}</strong>
            <small>Use within 7 days</small>
          </article>

          <article className="ft-expiry-summary-card critical">
            <span>Critical</span>
            <strong>{expiryOverview.summary.critical}</strong>
            <small>Use within 3 days</small>
          </article>

          <article className="ft-expiry-summary-card expired">
            <span>Expired</span>
            <strong>{expiryOverview.summary.expired}</strong>
            <small>Requires immediate action</small>
          </article>

          <article className="ft-expiry-summary-card risk">
            <span>High Waste Risk</span>
            <strong>{expiryOverview.summary.high_waste_risk}</strong>
            <small>Prioritize to reduce waste</small>
          </article>
        </div>

        {expiryOverview.batches.length === 0 ? (
          <div className="ft-expiry-empty">No expiry information available.</div>
        ) : (
          <>
            <div className="ft-expiry-attention">
              <div>
                <span className="ft-expiry-attention-icon">!</span>
                <div>
                  <strong>FEFO Inventory Rotation</strong>
                  <p>
                    Batches are automatically sorted by the earliest effective expiry date so the most urgent stock is handled first.
                  </p>
                </div>
              </div>
            </div>

            <div className="ft-expiry-table-wrap">
              <table className="ft-expiry-table">
                <thead>
                  <tr>
                    <th>Food / Batch</th>
                    <th>Quantity</th>
                    <th>Recorded Expiry</th>
                    <th>Predicted Expiry</th>
                    <th>Days Left</th>
                    <th>Freshness</th>
                    <th>Spoilage Risk</th>
                    <th>FEFO Priority</th>
                    <th>Waste Risk</th>
                    <th>Recommended Action</th>
                  </tr>
                </thead>

                <tbody>
                  {expiryOverview.batches.map((batch) => {
                    const daysLabel =
                      batch.days_remaining < 0
                        ? `${Math.abs(batch.days_remaining)} days ago`
                        : batch.days_remaining === 0
                        ? "Expires today"
                        : `${batch.days_remaining} days`;

                    const statusClass = String(batch.expiry_status || "")
                      .toLowerCase()
                      .replaceAll(" ", "-");

                    const priorityClass = String(batch.rotation_priority || "")
                      .toLowerCase()
                      .replaceAll(" ", "-");

                    const wasteClass = String(batch.waste_risk || "")
                      .toLowerCase();

                    return (
                      <tr key={batch.batch_id}>
                        <td className="ft-expiry-food-cell">
                          <strong>{batch.food_name}</strong>
                          <span>Batch #{batch.batch_id}</span>
                          <span className={`ft-expiry-status ${statusClass}`}>
                            {batch.expiry_status}
                          </span>
                        </td>

                        <td>
                          <strong>{batch.quantity} kg</strong>
                          <small>{batch.availability}</small>
                        </td>

                        <td>{batch.original_expiry_date}</td>

                        <td>
                          {batch.predicted_expiry_date ? (
                            <strong>{batch.predicted_expiry_date}</strong>
                          ) : (
                            <span className="ft-expiry-muted">Not assessed</span>
                          )}
                        </td>

                        <td>
                          <strong className={batch.days_remaining < 0 ? "ft-expiry-days-over" : ""}>
                            {daysLabel}
                          </strong>
                        </td>

                        <td>
                          {batch.freshness_score !== null ? (
                            <>
                              <strong>{batch.freshness_score}%</strong>
                              <small>
                                {batch.remaining_shelf_life !== null
                                  ? `${batch.remaining_shelf_life} predicted days`
                                  : ""}
                              </small>
                            </>
                          ) : (
                            <span className="ft-expiry-muted">Not assessed</span>
                          )}
                        </td>

                        <td>
                          {batch.spoilage_risk ? (
                            <>
                              <span className={`ft-risk-badge ${String(batch.spoilage_risk).toLowerCase()}`}>
                                {batch.spoilage_risk}
                              </span>
                              {batch.spoilage_probability !== null && (
                                <small>{batch.spoilage_probability}% probability</small>
                              )}
                            </>
                          ) : (
                            <span className="ft-expiry-muted">Not assessed</span>
                          )}
                        </td>

                        <td>
                          <span className={`ft-priority-badge ${priorityClass}`}>
                            {batch.rotation_priority}
                          </span>
                        </td>

                        <td>
                          <span className={`ft-waste-badge ${wasteClass}`}>
                            {batch.waste_risk}
                          </span>
                        </td>

                        <td className="ft-expiry-action-cell">
                          {batch.recommended_action}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </>
    )}
  </section>
)}


{/* =================================================

    INVENTORY

\================================================= */}


{showInventory && (


  <div className="food-items-section">


    <h2>

  Know Your Stock.

</h2>


<p>

  Everything in stock. One clear view.

</p>


    {batches.length === 0 ? (


      <p>

        No inventory available.

      </p>


    ) : (


      <div className="batch-table-container">


        <table className="batch-table">


          <thead>


            <tr>


              <th>

                Batch ID

              </th>


              <th>

                Food Item

              </th>


              <th>

                Category

              </th>


              <th>

                Quantity

              </th>


              <th>

  Availability

</th>


<th>

  Update Stock

</th>


            </tr>


          </thead>


          <tbody>


            {batches.map(

              (batch) => (


                <tr

                  key={

                    batch.id

                  }

                >


                  <td>

                    #{batch.id}

                  </td>


                  <td>

                    {

                      batch.food_name

                    }

                  </td>


                  <td>

                    {

                      batch.category

                    }

                  </td>


                  <td>

                    {

                      batch.quantity

                    }{" "}

                    kg

                  </td>


                 <td>

  <strong>
    {batch.availability}
  </strong>

</td>


<td>

  {editingBatchId === batch.id ? (

    <div>

      <input

        type="number"

        min="0"

        value={newQuantity}

        onChange={(e) =>

setNewQuantity(e.target.value)

        }

        placeholder="Quantity"

      />


      <button

        className="submit-button"

        type="button"

        onClick={() =>

updateBatchQuantity(batch.id)

        }

      >

        Save

      </button>


      <button

        className="submit-button"

        type="button"

        onClick={() => {

setEditingBatchId(null);

setNewQuantity("");

        }}

      >

        Cancel

      </button>

    </div>

  ) : (

    (isWarehouse || isAdministrator) ? (
      <button
        className="submit-button"
        type="button"
        onClick={() => {
          setEditingBatchId(batch.id);
          setNewQuantity(batch.quantity);
          setMessage("");
        }}
      >
        Update Stock
      </button>
    ) : (
      <span style={{ color: "#425a54", fontWeight: 600 }}>View only</span>
    )

  )}

</td>


                </tr>


              )

            )}


          </tbody>


        </table>


      </div>

    )}


  </div>

)}


{/* =================================================

    ADD BATCH FORM

\================================================= */}


{showAddBatch &&

  isWarehouse && (


  <div className="food-items-section">


    <h2>

      Add New Batch

    </h2>


    <form

      onSubmit={

        addBatch

      }

    >


      <label>

        Food Item

      </label>


      <select

        value={

          batchFoodItem

        }

        onChange={(e) =>

          setBatchFoodItem(

            e.target.value

          )

        }

        required

      >


        <option value="">

          Select food item

        </option>


        {foodItems.map(

          (food) => (


            <option

              key={food.id}

              value={food.id}

            >

              {food.name} -{" "}

              {food.category}

            </option>


          )

        )}


      </select>


      <label>

        Quantity (kg)

      </label>


      <input

        type="number"

        min="1"

        placeholder="Enter quantity"

        value={

          batchQuantity

        }

        onChange={(e) =>

          setBatchQuantity(

            e.target.value

          )

        }

        required

      />


      <label>

        Expiry Date

      </label>


      <input

        type="date"

        value={

          batchExpiryDate

        }

        onChange={(e) =>

          setBatchExpiryDate(

            e.target.value

          )

        }

        required

      />


      <button

        className="submit-button"

        type="submit"

      >

        Add Batch

      </button>


    </form>


  </div>

)}


          </div>

          {message && (
            <div className="ft-db-message" role="status">
              {message}
            </div>
          )}
        </main>
      </div>
    );
  }


// =========================================================
// LANDING PAGE — MATCHES THE APPROVED REFERENCE
// =========================================================

if (mode === "landing") {
  const goToSection = (id) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 10);
  };

  return (
    <div className="ft-reference-home">
      <section className="ft-reference-landing" id="home" aria-label="FoodTrace landing page">
        <button className="ft-hotspot ft-home-hot" type="button" aria-label="Home" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}></button>
        <button className="ft-hotspot ft-how-hot" type="button" aria-label="How It Works" onClick={() => goToSection("how")}></button>
        <button className="ft-hotspot ft-solutions-hot" type="button" aria-label="Solutions" onClick={() => goToSection("solutions")}></button>
        <button className="ft-hotspot ft-impact-hot" type="button" aria-label="Impact" onClick={() => goToSection("impact")}></button>
        <button className="ft-hotspot ft-features-hot" type="button" aria-label="Features" onClick={() => goToSection("features")}></button>
        <button className="ft-hotspot ft-signin-hot" type="button" aria-label="Sign In" onClick={() => { setMode("login"); setMessage(""); }}></button>
        <button className="ft-hotspot ft-getstarted-hot" type="button" aria-label="Get Started" onClick={() => { setMode("register"); setMessage(""); }}></button>
      </section>

      <section className="ft-info-section" id="how">
        <p className="ft-info-kicker">HOW IT WORKS</p>
        <h2>Freshness intelligence in three simple steps.</h2>
        <div className="ft-info-grid ft-three">
          <article><span>01</span><h3>Capture</h3><p>Upload or capture a food image and select the relevant food item or batch.</p></article>
          <article><span>02</span><h3>Analyze</h3><p>FoodTrace evaluates freshness signals and combines them with expiry and inventory information.</p></article>
          <article><span>03</span><h3>Act</h3><p>Receive freshness status, shelf-life guidance, storage recommendations and waste-reduction actions.</p></article>
        </div>
      </section>

      <section className="ft-info-section ft-soft-section" id="solutions">
        <p className="ft-info-kicker">SOLUTIONS</p>
        <h2>One platform for the food freshness workflow.</h2>
        <div className="ft-info-grid ft-four">
          <article><h3>AI Freshness Detection</h3><p>Image-based freshness assessment for faster quality checks.</p></article>
          <article><h3>Shelf-Life Prediction</h3><p>Estimate remaining freshness using food and batch information.</p></article>
          <article><h3>Smart Inventory</h3><p>Track quantities, batches and expiry dates from one place.</p></article>
          <article><h3>Storage Guidance</h3><p>Recommend suitable storage actions to preserve quality longer.</p></article>
        </div>
      </section>

      <section className="ft-info-section" id="impact">
        <p className="ft-info-kicker">IMPACT</p>
        <h2>Safer food. Less waste. Better decisions.</h2>
        <div className="ft-impact-row">
          <div><strong>Safer</strong><span>Earlier freshness awareness</span></div>
          <div><strong>Smarter</strong><span>Data-supported storage decisions</span></div>
          <div><strong>Greener</strong><span>Reduced avoidable food waste</span></div>
        </div>
      </section>

      <section className="ft-info-section ft-soft-section" id="features">
        <p className="ft-info-kicker">FEATURES</p>
        <h2>Everything shown on the FoodTrace home screen.</h2>
        <div className="ft-info-grid ft-four">
          <article><h3>Freshness Analysis</h3><p>Analyze food images for spoilage and quality indicators.</p></article>
          <article><h3>Expiry Management</h3><p>View batches by expiry status and identify items requiring attention.</p></article>
          <article><h3>Role-Based Access</h3><p>Consumer, retail, warehouse, inspector and administrator workflows.</p></article>
          <article><h3>Analytics</h3><p>Dashboard information for inventory, freshness and waste monitoring.</p></article>
        </div>
      </section>
    </div>
  );
}


// =========================================================
// REGISTER PAGE — CRISP DOM VERSION OF THE APPROVED REFERENCE
// =========================================================

if (mode === "register") {
  return (
    <div className="ft-register-page">
      <section className="ft-register-left">
        <button
          className="ft-register-brand"
          type="button"
          onClick={() => { setMode("landing"); setMessage(""); }}
          aria-label="Back to FoodTrace home"
        >
          <span className="ft-register-leaf">◆</span>
          <span>Food<span>Trace</span></span>
        </button>

        <div className="ft-register-copy">
          <h1>Join FoodTrace</h1>
          <p>Be a part of a smarter, safer<br />food future.</p>

          <div className="ft-register-benefits">
            <div><span>🌿</span><p>Monitor food freshness<br />with AI</p></div>
            <div><span>◒</span><p>Reduce food waste</p></div>
            <div><span>♥</span><p>Make better informed<br />choices</p></div>
            <div><span>♧</span><p>Contribute to a healthier<br />and sustainable world</p></div>
          </div>
        </div>

        <div className="ft-register-shape ft-register-shape-a"></div>
        <div className="ft-register-shape ft-register-shape-b"></div>
        <div className="ft-register-floating-leaf ft-leaf-a">◆</div>
        <div className="ft-register-floating-leaf ft-leaf-b">◆</div>
</section>

      <section className="ft-register-right">
        <div className="ft-register-card">
          <h2>Create Your Account</h2>
          <p className="ft-register-sub">Sign up to start your FoodTrace journey.</p>

          <form onSubmit={handleSubmit} className="ft-register-form">
            <label>
              <span>Full Name</span>
              <div className="ft-register-field">
                <b>♙</b>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </label>

            <label>
              <span>Email Address</span>
              <div className="ft-register-field">
                <b>✉</b>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="ft-register-field">
                <b>♙</b>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                />
                <i>◉</i>
              </div>
            </label>

            <label>
              <span>Confirm Password</span>
              <div className="ft-register-field">
                <b>♙</b>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
                <i>◉</i>
              </div>
            </label>

            <label>
              <span>Role</span>
              <div className="ft-register-field ft-role-field">
                <b>♙</b>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                >
                  <option value="" disabled>Select your role</option>
                  {roles.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </label>

            <button className="ft-register-submit" type="submit">
              Create Account <span>→</span>
            </button>
          </form>


          <p className="ft-register-switch">
            Already have an account?
            <button type="button" onClick={() => { setMode("login"); setMessage(""); }}>Sign In</button>
          </p>

          {message && <div className="ft-register-message">{message}</div>}
        </div>
      </section>
    </div>
  );
}



// =========================================================
// LOGIN PAGE — CRISP FOODTRACE DESIGN
// =========================================================

if (mode === "login") {
  return (
    <div className="ft-login-page">
      <section className="ft-login-left">
        <button
          className="ft-login-brand"
          type="button"
          onClick={() => { setMode("landing"); setMessage(""); }}
          aria-label="Back to FoodTrace home"
        >
          <span className="ft-login-brand-leaf">◆</span>
          <span>Food<span>Trace</span></span>
        </button>

        <div className="ft-login-copy">
          <h1>Welcome Back</h1>
          <p>Track freshness. Reduce waste. Build a healthier future.</p>

          <div className="ft-login-benefits">
            <div><span>✦</span><p>Monitor food freshness<br />with AI</p></div>
            <div><span>◒</span><p>Reduce food waste</p></div>
            <div><span>♥</span><p>Make better informed<br />choices</p></div>
            <div><span>♧</span><p>Contribute to a healthier<br />and sustainable world</p></div>
          </div>
        </div>

        <div className="ft-login-shape ft-login-shape-a"></div>
        <div className="ft-login-shape ft-login-shape-b"></div>
</section>

      <section className="ft-login-right">
        <div className="ft-login-card">
          <h2>Welcome Back</h2>
          <p className="ft-login-sub">Sign in to continue your FoodTrace journey.</p>

          <form onSubmit={handleSubmit} className="ft-login-form">
            <label>
              <span>Email Address</span>
              <div className="ft-login-field">
                <b>✉</b>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="ft-login-field">
                <b>♙</b>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </label>

            <div className="ft-login-options">
              <label className="ft-login-remember">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <button type="button">Forgot Password?</button>
            </div>

            <button className="ft-login-submit" type="submit">
              Sign In <span>→</span>
            </button>
          </form>


          {message && <div className="ft-login-message">{message}</div>}

          <p className="ft-login-switch">
            Don't have an account?
            <button
              type="button"
              onClick={() => { setMode("register"); setMessage(""); }}
            >
              Create Account
            </button>
          </p>

          <button
            className="ft-login-back"
            type="button"
            onClick={() => { setMode("landing"); setMessage(""); }}
          >
            ← Back to Home
          </button>
        </div>
      </section>
    </div>
  );
}

return null;
}

export default App;
