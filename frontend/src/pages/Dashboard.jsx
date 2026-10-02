import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getCurrentUser,
  getFoods,
} from "../api";


// ============================================================
// ROLE CONFIGURATION
// ============================================================

const ROLE_CONFIG = {
  consumer: {
    label: "Consumer",
    icon: "👤",

    workspaceLabel:
      "PERSONAL FOOD MONITORING",

    heroTitle:
      "Keep your",

    heroHighlight:
      "fresh & healthy.",

    heroDescription:
      "Track your personal food inventory, monitor freshness status, and make smarter decisions before food goes to waste.",

    primaryAction:
      "Add Food",

    secondaryAction:
      "View Inventory",

    inventoryLabel:
      "PERSONAL INVENTORY",

    inventoryTitle:
      "Food Inventory",

    inventoryDescription:
      "View your saved food items, freshness information and shelf-life details.",

    focusTitle:
      "Personal Food Care",

    focusDescription:
      "Monitor the freshness, shelf-life and storage condition of the food in your inventory.",

    focusIcon:
      "🥗",
  },

  retail_manager: {
    label: "Retail Manager",
    icon: "🏪",

    workspaceLabel:
      "RETAIL FOOD MONITORING",

    heroTitle:
      "Manage your",

    heroHighlight:
      "retail freshness.",

    heroDescription:
      "Monitor retail food inventory, freshness status, shelf-life risk and storage information to support better inventory decisions.",

    primaryAction:
      "Add Food",

    secondaryAction:
      "View Inventory",

    inventoryLabel:
      "RETAIL INVENTORY",

    inventoryTitle:
      "Retail Food Inventory",

    inventoryDescription:
      "Monitor retail food items, freshness status, shelf-life information and storage conditions.",

    focusTitle:
      "Retail Inventory Monitoring",

    focusDescription:
      "Keep track of food quality, shelf-life risk and inventory conditions across your retail workspace.",

    focusIcon:
      "🏪",
  },

  warehouse_operator: {
    label: "Warehouse Operator",
    icon: "🏭",

    workspaceLabel:
      "WAREHOUSE FOOD MONITORING",

    heroTitle:
      "Protect your",

    heroHighlight:
      "stored food.",

    heroDescription:
      "Monitor warehouse food inventory, storage conditions, freshness status and shelf-life risk from one place.",

    primaryAction:
      "Add Food",

    secondaryAction:
      "View Inventory",

    inventoryLabel:
      "WAREHOUSE INVENTORY",

    inventoryTitle:
      "Warehouse Inventory",

    inventoryDescription:
      "Review stored food items, freshness information, shelf-life risk and storage-related data.",

    focusTitle:
      "Warehouse Storage Monitoring",

    focusDescription:
      "Monitor stored food and pay attention to freshness, shelf-life and storage compliance information.",

    focusIcon:
      "🏭",
  },

  food_quality_inspector: {
    label: "Food Quality Inspector",
    icon: "🔬",

    workspaceLabel:
      "FOOD QUALITY INSPECTION",

    heroTitle:
      "Inspect food",

    heroHighlight:
      "with confidence.",

    heroDescription:
      "Review food freshness, quality status, shelf-life information and storage indicators to support food quality monitoring.",

    primaryAction:
      "Add Food",

    secondaryAction:
      "View Inventory",

    inventoryLabel:
      "QUALITY MONITORING",

    inventoryTitle:
      "Food Quality Inventory",

    inventoryDescription:
      "Review food items, freshness classifications, shelf-life information and storage indicators.",

    focusTitle:
      "Food Quality Monitoring",

    focusDescription:
      "Focus on freshness classification, spoilage indicators, shelf-life risk and storage information.",

    focusIcon:
      "🔬",
  },

  administrator: {
    label: "Administrator",
    icon: "🛡️",

    workspaceLabel:
      "PLATFORM MONITORING",

    heroTitle:
      "Monitor your",

    heroHighlight:
      "FreshGuard platform.",

    heroDescription:
      "Review food inventory, freshness information, shelf-life data, storage indicators and platform reports.",

    primaryAction:
      "Add Food",

    secondaryAction:
      "View Inventory",

    inventoryLabel:
      "PLATFORM INVENTORY",

    inventoryTitle:
      "Food Inventory",

    inventoryDescription:
      "Review food inventory, freshness information, shelf-life details and storage conditions.",

    focusTitle:
      "Platform Monitoring",

    focusDescription:
      "Review the overall food monitoring information available through the FreshGuard platform.",

    focusIcon:
      "🛡️",
  },
};


// ============================================================
// ROLE HELPERS
// ============================================================

function normaliseRole(role) {
  return String(role || "consumer")
    .trim()
    .toLowerCase();
}


function getRoleConfig(role) {
  const normalisedRole =
    normaliseRole(role);

  return (
    ROLE_CONFIG[normalisedRole] ||
    ROLE_CONFIG.consumer
  );
}


// ============================================================
// DASHBOARD
// ============================================================

function Dashboard({
  onLogout,
  onAddFood,
  onInventory,
  onProfile,
  onReports,
}) {

  const [user, setUser] =
    useState(null);

  const [foods, setFoods] =
    useState([]);

  const [foodAlerts, setFoodAlerts] =
    useState([]);

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [alertSoundEnabled, setAlertSoundEnabled] =
    useState(true);

  const notificationRef =
    useRef(null);

  const audioContextRef =
    useRef(null);

  const previousAlertCountRef =
    useRef(0);

  const alertsInitializedRef =
    useRef(false);


  // ==========================================================
  // LOAD USER + FOOD DATA
  // ==========================================================

  useEffect(() => {

    const loadData = async () => {

      try {

        const [
          userData,
          foodData,
        ] = await Promise.all([

          getCurrentUser(),

          getFoods(),

        ]);


        setUser(userData);

        setFoods(
          Array.isArray(foodData)
            ? foodData
            : []
        );

      } catch (error) {

        console.error(error);

      }

    };


    loadData();

  }, []);


  // ==========================================================
  // ROLE INFORMATION
  // ==========================================================

  const userRole =
    normaliseRole(
      user?.role
    );

  const roleConfig =
    getRoleConfig(
      userRole
    );


  // ==========================================================
  // AUDIO CONTEXT
  // ==========================================================

  const getAudioContext = () => {

    try {

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        return null;
      }


      if (!audioContextRef.current) {

        audioContextRef.current =
          new AudioContext();

      }


      return audioContextRef.current;

    } catch (error) {

      console.error(
        "Audio context error:",
        error
      );

      return null;

    }

  };


  // ==========================================================
  // UNLOCK AUDIO AFTER USER INTERACTION
  // ==========================================================

  const unlockAlertSound = async () => {

    try {

      const context =
        getAudioContext();

      if (!context) {
        return;
      }


      if (
        context.state === "suspended"
      ) {

        await context.resume();

      }

    } catch (error) {

      console.error(
        "Unable to unlock alert sound:",
        error
      );

    }

  };


  // ==========================================================
  // PREMIUM POP ALERT SOUND
  // ==========================================================

  const playAlertSound = async () => {

    try {

      const context =
        getAudioContext();

      if (!context) {
        return;
      }


      if (
        context.state === "suspended"
      ) {

        await context.resume();

      }


      const oscillator =
        context.createOscillator();

      const gainNode =
        context.createGain();


      oscillator.type =
        "sine";


      oscillator.frequency.setValueAtTime(
        880,
        context.currentTime
      );


      oscillator.frequency.exponentialRampToValueAtTime(
        620,
        context.currentTime + 0.16
      );


      gainNode.gain.setValueAtTime(
        0.0001,
        context.currentTime
      );


      gainNode.gain.exponentialRampToValueAtTime(
        0.13,
        context.currentTime + 0.015
      );


      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.20
      );


      oscillator.connect(
        gainNode
      );

      gainNode.connect(
        context.destination
      );


      oscillator.start();

      oscillator.stop(
        context.currentTime + 0.21
      );


      const oscillatorTwo =
        context.createOscillator();

      const gainNodeTwo =
        context.createGain();


      oscillatorTwo.type =
        "sine";


      oscillatorTwo.frequency.setValueAtTime(
        1180,
        context.currentTime + 0.08
      );


      oscillatorTwo.frequency.exponentialRampToValueAtTime(
        820,
        context.currentTime + 0.23
      );


      gainNodeTwo.gain.setValueAtTime(
        0.0001,
        context.currentTime + 0.08
      );


      gainNodeTwo.gain.exponentialRampToValueAtTime(
        0.075,
        context.currentTime + 0.095
      );


      gainNodeTwo.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.25
      );


      oscillatorTwo.connect(
        gainNodeTwo
      );

      gainNodeTwo.connect(
        context.destination
      );


      oscillatorTwo.start(
        context.currentTime + 0.08
      );

      oscillatorTwo.stop(
        context.currentTime + 0.26
      );

    } catch (error) {

      console.error(
        "Alert sound error:",
        error
      );

    }

  };


  // ==========================================================
  // AUTOMATIC FOOD ALERTS
  // ==========================================================

  useEffect(() => {

    if (
      !foods ||
      foods.length === 0
    ) {

      setFoodAlerts([]);

      previousAlertCountRef.current = 0;

      return;

    }


    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );


    const alerts = [];


    foods.forEach((food) => {

      if (!food) {
        return;
      }


      const foodName =
        food.food_name ||
        "Food item";


      const freshnessStatus =
        String(
          food.freshness_status || ""
        )
          .toLowerCase()
          .trim();


      const shelfLifeRisk =
        String(
          food.shelf_life_risk || ""
        )
          .toLowerCase()
          .trim();


      const storageCompliance =
        Number(
          food.storage_compliance_score
        );


      let expiryDate =
        null;


      if (food.expiry_date) {

        const parsedExpiry =
          new Date(
            `${food.expiry_date}T00:00:00`
          );


        if (
          !Number.isNaN(
            parsedExpiry.getTime()
          )
        ) {

          expiryDate =
            parsedExpiry;

        }

      }


      let daysUntilExpiry =
        null;


      if (expiryDate) {

        daysUntilExpiry =
          Math.ceil(
            (
              expiryDate.getTime() -
              today.getTime()
            ) /
            (
              1000 *
              60 *
              60 *
              24
            )
          );

      }


      // ======================================================
      // PRIORITY 1 — EXPIRED
      // ======================================================

      if (
        expiryDate &&
        daysUntilExpiry < 0
      ) {

        alerts.push({

          id:
            `${food.id}-expired`,

          food,

          type:
            "expired",

          title:
            "Expired",

          description:
            `Expired on ${food.expiry_date}`,

          icon:
            "🚨",

          color:
            "#ef4444",

          background:
            "linear-gradient(135deg, #fff1f2, #fff7f7)",

          border:
            "rgba(239,68,68,0.13)",

          priority:
            1,

        });

        return;

      }


      // ======================================================
      // PRIORITY 2 — SPOILED
      // ======================================================

      if (
        freshnessStatus ===
        "spoiled"
      ) {

        alerts.push({

          id:
            `${food.id}-spoiled`,

          food,

          type:
            "spoiled",

          title:
            "Spoiled",

          description:
            "Freshness analysis indicates spoilage.",

          icon:
            "🦠",

          color:
            "#dc2626",

          background:
            "linear-gradient(135deg, #fff1f2, #fff7f7)",

          border:
            "rgba(220,38,38,0.13)",

          priority:
            2,

        });

        return;

      }


      // ======================================================
      // PRIORITY 3 — NEAR EXPIRY
      // ======================================================

      if (
        expiryDate &&
        daysUntilExpiry >= 0 &&
        daysUntilExpiry <= 3
      ) {

        let expiryMessage =
          "Expires soon.";


        if (
          daysUntilExpiry === 0
        ) {

          expiryMessage =
            "Expires today.";

        } else if (
          daysUntilExpiry === 1
        ) {

          expiryMessage =
            "Expires tomorrow.";

        } else {

          expiryMessage =
            `Expires in ${daysUntilExpiry} days.`;

        }


        alerts.push({

          id:
            `${food.id}-near-expiry`,

          food,

          type:
            "near-expiry",

          title:
            "Near Expiry",

          description:
            expiryMessage,

          icon:
            "⏳",

          color:
            "#d97706",

          background:
            "linear-gradient(135deg, #fffbeb, #fffdf5)",

          border:
            "rgba(217,119,6,0.14)",

          priority:
            3,

        });

        return;

      }


      // ======================================================
      // PRIORITY 4 — NEAR SPOILAGE
      // ======================================================

      if (
        freshnessStatus ===
          "near spoilage" ||
        freshnessStatus ===
          "near-spoilage" ||
        freshnessStatus ===
          "near_spoilage"
      ) {

        alerts.push({

          id:
            `${food.id}-near-spoilage`,

          food,

          type:
            "near-spoilage",

          title:
            "Near Spoilage",

          description:
            "Freshness is declining and needs attention.",

          icon:
            "⚠️",

          color:
            "#ea580c",

          background:
            "linear-gradient(135deg, #fff7ed, #fffaf5)",

          border:
            "rgba(234,88,12,0.14)",

          priority:
            4,

        });

        return;

      }


      // ======================================================
      // PRIORITY 5 — HIGH SHELF-LIFE RISK
      // ======================================================

      if (
        shelfLifeRisk ===
        "high"
      ) {

        alerts.push({

          id:
            `${food.id}-high-risk`,

          food,

          type:
            "high-risk",

          title:
            "High Shelf-Life Risk",

          description:
            "Shelf-life prediction indicates higher spoilage risk.",

          icon:
            "📉",

          color:
            "#dc2626",

          background:
            "linear-gradient(135deg, #fff1f2, #fff8f8)",

          border:
            "rgba(220,38,38,0.12)",

          priority:
            5,

        });

        return;

      }


      // ======================================================
      // PRIORITY 6 — LOW STORAGE COMPLIANCE
      // ======================================================

      if (
        Number.isFinite(
          storageCompliance
        ) &&
        storageCompliance < 60
      ) {

        alerts.push({

          id:
            `${food.id}-storage`,

          food,

          type:
            "storage",

          title:
            "Storage Alert",

          description:
            `Storage compliance is ${storageCompliance.toFixed(1)}%.`,

          icon:
            "🌡️",

          color:
            "#ca8a04",

          background:
            "linear-gradient(135deg, #fefce8, #fffdf2)",

          border:
            "rgba(202,138,4,0.14)",

          priority:
            6,

        });

      }

    });


    // ========================================================
    // SORT ALERTS BY PRIORITY
    // ========================================================

    alerts.sort(
      (a, b) =>
        a.priority - b.priority
    );


    setFoodAlerts(
      alerts
    );


    // ========================================================
    // PLAY SOUND ONLY WHEN NEW ALERT ARRIVES
    // ========================================================

    if (
      alertsInitializedRef.current
    ) {

      if (
        alerts.length >
          previousAlertCountRef.current &&
        alertSoundEnabled
      ) {

        playAlertSound();

      }

    } else {

      alertsInitializedRef.current =
        true;

    }


    previousAlertCountRef.current =
      alerts.length;


  }, [
    foods,
    alertSoundEnabled,
  ]);


  // ==========================================================
  // CLOSE NOTIFICATION POPUP ON OUTSIDE CLICK
  // ==========================================================

  useEffect(() => {

    const handleOutsideClick =
      (event) => {

        if (
          notificationRef.current &&
          !notificationRef.current.contains(
            event.target
          )
        ) {

          setShowNotifications(
            false
          );

        }

      };


    const handleEscape =
      (event) => {

        if (
          event.key === "Escape"
        ) {

          setShowNotifications(
            false
          );

        }

      };


    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );


    return () => {

      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );

    };

  }, []);


  // ==========================================================
  // CLEAN AUDIO CONTEXT
  // ==========================================================

  useEffect(() => {

    return () => {

      if (
        audioContextRef.current
      ) {

        try {

          audioContextRef.current.close();

        } catch (error) {

          console.error(
            error
          );

        }

      }

    };

  }, []);


  // ==========================================================
  // FOOD COUNTS
  // ==========================================================

  const freshCount =
    foods.filter(
      (food) =>
        food.freshness_status
          ?.toLowerCase() ===
        "fresh"
    ).length;


  const pendingCount =
    foods.filter(
      (food) =>
        food.freshness_status
          ?.toLowerCase() ===
        "pending"
    ).length;


  // ==========================================================
  // USER INITIAL
  // ==========================================================

  const userInitial =
    user?.name
      ?.charAt(0)
      ?.toUpperCase() ||
    "U";


  // ==========================================================
  // BELL CLICK
  // ==========================================================

  const handleNotificationClick =
    async () => {

      await unlockAlertSound();

      setShowNotifications(
        (previous) =>
          !previous
      );

    };


  // ==========================================================
  // SOUND TOGGLE
  // ==========================================================

  const handleSoundToggle =
    async () => {

      await unlockAlertSound();

      setAlertSoundEnabled(
        (previous) =>
          !previous
      );

    };


  return (

    <div
      className="dashboard-page"
      style={{
        position: "relative",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >

      <div
        className="ambient ambient-one"
      />

      <div
        className="ambient ambient-two"
      />


      <div
        className="floating-food dashboard-food-one"
      >
        🍎
      </div>


      <div
        className="floating-food dashboard-food-two"
      >
        🥕
      </div>


      <div
        className="floating-food dashboard-food-three"
      >
        🥦
      </div>


      {/* ====================================================
          ALERT ANIMATIONS
      ===================================================== */}

      <style>
        {`

          @keyframes freshGuardBellPulse {

            0%,
            100% {
              transform: scale(1);
              box-shadow:
                0 0 0 0 rgba(239,68,68,0.22);
            }

            50% {
              transform: scale(1.04);
              box-shadow:
                0 0 0 7px rgba(239,68,68,0.03);
            }

          }


          @keyframes freshGuardBellRing {

            0%,
            100% {
              transform: rotate(0deg);
            }

            20% {
              transform: rotate(9deg);
            }

            40% {
              transform: rotate(-8deg);
            }

            60% {
              transform: rotate(6deg);
            }

            80% {
              transform: rotate(-4deg);
            }

          }


          @keyframes freshGuardNotificationIn {

            from {
              opacity: 0;
              transform:
                translate3d(0, -12px, 0)
                scale(0.97);

              filter: blur(3px);
            }

            to {
              opacity: 1;
              transform:
                translate3d(0, 0, 0)
                scale(1);

              filter: blur(0);
            }

          }


          @keyframes freshGuardNotificationItemIn {

            from {
              opacity: 0;
              transform:
                translate3d(12px, 0, 0);
            }

            to {
              opacity: 1;
              transform:
                translate3d(0, 0, 0);
            }

          }


          @keyframes freshGuardBadgePulse {

            0%,
            100% {
              transform: scale(1);
            }

            50% {
              transform: scale(1.13);
            }

          }


          @keyframes freshGuardDotPulse {

            0%,
            100% {
              opacity: 1;
              transform: scale(1);
            }

            50% {
              opacity: 0.5;
              transform: scale(0.72);
            }

          }


          @media (max-width: 900px) {

            .freshguard-notification-dropdown {
              right: -80px !important;
            }

          }


          @media (max-width: 650px) {

            .freshguard-notification-dropdown {
              position: fixed !important;
              top: 88px !important;
              left: 12px !important;
              right: 12px !important;
              width: auto !important;
              max-width: none !important;
            }

            .freshguard-user-pill {
              display: none !important;
            }

            .freshguard-topbar-right {
              gap: 6px !important;
            }

          }


          @media (max-width: 480px) {

            .freshguard-reports-button {
              display: none !important;
            }

          }

        `}
      </style>


      {/* ====================================================
          PREMIUM TOPBAR
      ===================================================== */}

      <header
        className="topbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,

          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",

          minHeight: "82px",

          padding:
            "14px clamp(20px, 5vw, 72px)",

          background:
            "rgba(255, 255, 255, 0.88)",

          backdropFilter:
            "blur(18px)",

          WebkitBackdropFilter:
            "blur(18px)",

          borderBottom:
            "1px solid rgba(16, 185, 129, 0.12)",

          boxShadow:
            "0 8px 30px rgba(16, 72, 45, 0.06)",
        }}
      >

        {/* ==================================================
            BRAND
        ================================================== */}

        <div
          className="brand"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >

          <div
            className="brand-icon"
            style={{
              width: "50px",
              height: "50px",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              borderRadius: "16px",

              background:
                "linear-gradient(145deg, #dcfce7, #bbf7d0)",

              boxShadow:
                "0 8px 22px rgba(22, 163, 74, 0.16)",

              fontSize: "27px",

              border:
                "1px solid rgba(34, 197, 94, 0.14)",
            }}
          >
            🍏
          </div>


          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >

            <strong
              style={{
                fontSize: "19px",
                fontWeight: 800,

                color: "#063b25",

                letterSpacing: "-0.3px",

                lineHeight: 1.1,
              }}
            >
              FreshGuard
            </strong>


            <span
              style={{
                fontSize: "11px",

                color: "#71857b",

                fontWeight: 500,

                letterSpacing: "0.2px",
              }}
            >
              {roleConfig.workspaceLabel}
            </span>

          </div>

        </div>


        {/* ==================================================
            RIGHT SIDE
        ================================================== */}

        <div
          className="freshguard-topbar-right topbar-right"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >

          {/* ==================================================
              NOTIFICATION BELL
          ================================================== */}

          <div
            ref={notificationRef}
            style={{
              position: "relative",
              flexShrink: 0,
            }}
          >

            <button
              type="button"
              onClick={
                handleNotificationClick
              }

              aria-label="Food notifications"

              title={
                foodAlerts.length > 0
                  ? `${foodAlerts.length} food alert${foodAlerts.length > 1 ? "s" : ""}`
                  : "No food alerts"
              }

              style={{
                position: "relative",

                width: "56px",
                height: "56px",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                borderRadius: "17px",

                border:
                  foodAlerts.length > 0
                    ? "1px solid rgba(239,68,68,0.22)"
                    : "1px solid rgba(34,197,94,0.16)",

                background:
                  foodAlerts.length > 0
                    ? "linear-gradient(145deg, #fff7f7, #fffafa)"
                    : "linear-gradient(145deg, #f0fdf4, #ecfdf5)",

                color:
                  foodAlerts.length > 0
                    ? "#dc2626"
                    : "#087443",

                cursor: "pointer",

                boxShadow:
                  foodAlerts.length > 0
                    ? "0 8px 24px rgba(239,68,68,0.10)"
                    : "0 8px 24px rgba(22,101,52,0.07)",

                transition:
                  "all 0.25s ease",

                animation:
                  foodAlerts.length > 0
                    ? "freshGuardBellPulse 2s ease-in-out infinite"
                    : "none",
              }}

              onMouseEnter={(e) => {

                e.currentTarget.style.transform =
                  "translateY(-2px)";

                e.currentTarget.style.boxShadow =
                  foodAlerts.length > 0
                    ? "0 12px 28px rgba(239,68,68,0.15)"
                    : "0 12px 28px rgba(22,101,52,0.11)";

              }}

              onMouseLeave={(e) => {

                e.currentTarget.style.transform =
                  "translateY(0)";

                e.currentTarget.style.boxShadow =
                  foodAlerts.length > 0
                    ? "0 8px 24px rgba(239,68,68,0.10)"
                    : "0 8px 24px rgba(22,101,52,0.07)";

              }}
            >

              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"

                style={{
                  animation:
                    foodAlerts.length > 0
                      ? "freshGuardBellRing 1.8s ease-in-out infinite"
                      : "none",
                }}
              >

                <path
                  d="M18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 12.5 4 14 4 16H20C20 14 18 12.5 18 8Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M9.5 20C10.1 21.2 11 22 12 22C13 22 13.9 21.2 14.5 20"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

              </svg>


              {foodAlerts.length > 0 && (

                <span
                  style={{
                    position: "absolute",

                    top: "-5px",
                    right: "-5px",

                    minWidth:
                      foodAlerts.length > 9
                        ? "24px"
                        : "21px",

                    height: "21px",

                    padding:
                      "0 5px",

                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",

                    borderRadius: "999px",

                    background:
                      "linear-gradient(135deg, #ef4444, #dc2626)",

                    color: "#ffffff",

                    border:
                      "3px solid #ffffff",

                    fontSize: "9px",

                    fontWeight: 900,

                    boxShadow:
                      "0 5px 13px rgba(220,38,38,0.30)",

                    animation:
                      "freshGuardBadgePulse 1.8s ease-in-out infinite",

                    zIndex: 4,
                  }}
                >
                  {foodAlerts.length > 99
                    ? "99+"
                    : foodAlerts.length}
                </span>

              )}


              {foodAlerts.length === 0 && (

                <span
                  style={{
                    position: "absolute",

                    top: "9px",
                    right: "9px",

                    width: "7px",
                    height: "7px",

                    borderRadius: "50%",

                    background:
                      "#22c55e",

                    border:
                      "2px solid #f0fdf4",

                    animation:
                      "freshGuardDotPulse 2s ease-in-out infinite",
                  }}
                />

              )}

            </button>


            {/* ==================================================
                NOTIFICATION DROPDOWN
            ================================================== */}

            {showNotifications && (

              <div
                className="freshguard-notification-dropdown"

                style={{
                  position: "absolute",

                  top: "calc(100% + 13px)",
                  right: 0,

                  width: "390px",
                  maxWidth:
                    "calc(100vw - 24px)",

                  padding: "8px",

                  borderRadius: "25px",

                  background:
                    "rgba(255,255,255,0.97)",

                  border:
                    "1px solid rgba(16,185,129,0.14)",

                  boxShadow:
                    "0 28px 75px rgba(9,62,39,0.18), 0 10px 28px rgba(9,62,39,0.08)",

                  backdropFilter:
                    "blur(28px)",

                  WebkitBackdropFilter:
                    "blur(28px)",

                  animation:
                    "freshGuardNotificationIn 0.35s cubic-bezier(0.22,1,0.36,1) both",

                  overflow: "hidden",
                }}
              >

                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",

                    padding:
                      "15px 15px 14px",

                    borderRadius: "19px",

                    background:
                      foodAlerts.length > 0
                        ? "linear-gradient(135deg, #073b27 0%, #0b5a3b 55%, #0d7650 100%)"
                        : "linear-gradient(135deg, #064e3b 0%, #047857 55%, #059669 100%)",

                    boxShadow:
                      "0 12px 24px rgba(7,59,39,0.18)",
                  }}
                >

                  <div
                    style={{
                      position: "relative",

                      display: "flex",

                      alignItems: "center",

                      justifyContent:
                        "space-between",

                      gap: "12px",
                    }}
                  >

                    <div
                      style={{
                        display: "flex",

                        alignItems: "center",

                        gap: "11px",

                        minWidth: 0,
                      }}
                    >

                      <div
                        style={{
                          width: "43px",
                          height: "43px",

                          flexShrink: 0,

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          borderRadius: "14px",

                          background:
                            "rgba(255,255,255,0.13)",

                          border:
                            "1px solid rgba(255,255,255,0.16)",

                          fontSize: "19px",
                        }}
                      >

                        {foodAlerts.length > 0
                          ? "🔔"
                          : "✓"}

                      </div>


                      <div
                        style={{
                          display: "flex",

                          flexDirection:
                            "column",

                          gap: "3px",

                          minWidth: 0,
                        }}
                      >

                        <span
                          style={{
                            color:
                              "rgba(255,255,255,0.62)",

                            fontSize: "9px",

                            fontWeight: 850,

                            letterSpacing:
                              "1px",

                            textTransform:
                              "uppercase",
                          }}
                        >
                          FreshGuard Alert Center
                        </span>


                        <strong
                          style={{
                            color: "#ffffff",

                            fontSize: "15px",

                            fontWeight: 850,

                            letterSpacing:
                              "-0.25px",
                          }}
                        >

                          {foodAlerts.length > 0
                            ? `${foodAlerts.length} ${
                                foodAlerts.length === 1
                                  ? "alert"
                                  : "alerts"
                              } need attention`
                            : "You're all clear"}

                        </strong>

                      </div>

                    </div>


                    <div
                      style={{
                        flexShrink: 0,

                        width: "43px",
                        height: "43px",

                        display: "flex",

                        alignItems: "center",

                        justifyContent: "center",

                        borderRadius: "14px",

                        background:
                          "rgba(255,255,255,0.10)",

                        border:
                          "1px solid rgba(255,255,255,0.13)",

                        color: "#ffffff",

                        fontSize: "15px",

                        fontWeight: 850,
                      }}
                    >

                      {foodAlerts.length}

                    </div>

                  </div>

                </div>


                {foodAlerts.length > 0 ? (

                  <div
                    style={{
                      display: "flex",

                      flexDirection:
                        "column",

                      gap: "8px",

                      marginTop: "9px",

                      maxHeight:
                        "min(430px, calc(100vh - 270px))",

                      overflowY: "auto",

                      padding:
                        "1px 1px 2px",

                      scrollbarWidth:
                        "thin",
                    }}
                  >

                    {foodAlerts.map(
                      (alert, index) => (

                        <div
                          key={alert.id}

                          style={{
                            position: "relative",

                            overflow: "hidden",

                            display: "flex",

                            alignItems: "center",

                            gap: "11px",

                            minHeight: "68px",

                            padding:
                              "10px 12px 10px 14px",

                            borderRadius:
                              "17px",

                            background:
                              alert.background,

                            border:
                              `1px solid ${alert.border}`,

                            boxShadow:
                              "0 7px 20px rgba(7,59,39,0.055), inset 0 1px 0 rgba(255,255,255,0.95)",

                            animation:
                              "freshGuardNotificationItemIn 0.38s cubic-bezier(0.22,1,0.36,1) both",

                            animationDelay:
                              `${index * 55}ms`,
                          }}
                        >

                          <span
                            style={{
                              position: "absolute",

                              left: 0,
                              top: "10px",
                              bottom: "10px",

                              width: "3px",

                              borderRadius:
                                "0 5px 5px 0",

                              background:
                                alert.color,
                            }}
                          />


                          <div
                            style={{
                              width: "41px",
                              height: "41px",

                              flexShrink: 0,

                              display: "flex",

                              alignItems: "center",

                              justifyContent:
                                "center",

                              borderRadius:
                                "13px",

                              background:
                                "rgba(255,255,255,0.78)",

                              border:
                                `1px solid ${alert.border}`,

                              fontSize: "18px",

                              boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.95)",
                            }}
                          >
                            {alert.icon}
                          </div>


                          <div
                            style={{
                              minWidth: 0,

                              flex: 1,

                              display: "flex",

                              flexDirection:
                                "column",

                              gap: "4px",
                            }}
                          >

                            <div
                              style={{
                                display: "flex",

                                alignItems:
                                  "center",

                                gap: "6px",

                                minWidth: 0,
                              }}
                            >

                              <strong
                                style={{
                                  minWidth: 0,

                                  color: "#123c29",

                                  fontSize: "12px",

                                  fontWeight: 850,

                                  whiteSpace:
                                    "nowrap",

                                  overflow:
                                    "hidden",

                                  textOverflow:
                                    "ellipsis",
                                }}
                              >
                                {alert.food?.food_name ||
                                  "Food item"}
                              </strong>


                              <span
                                style={{
                                  flexShrink: 0,

                                  padding:
                                    "3px 6px",

                                  borderRadius:
                                    "999px",

                                  background:
                                    "rgba(255,255,255,0.72)",

                                  border:
                                    `1px solid ${alert.border}`,

                                  color:
                                    alert.color,

                                  fontSize: "7px",

                                  fontWeight: 900,

                                  letterSpacing:
                                    "0.3px",

                                  textTransform:
                                    "uppercase",
                                }}
                              >
                                {alert.title}
                              </span>

                            </div>


                            <span
                              style={{
                                color: "#7f9088",

                                fontSize: "9.5px",

                                fontWeight: 650,

                                lineHeight: 1.4,
                              }}
                            >
                              {alert.description}
                            </span>

                          </div>


                          <span
                            style={{
                              width: "8px",
                              height: "8px",

                              flexShrink: 0,

                              borderRadius:
                                "50%",

                              background:
                                alert.color,

                              boxShadow:
                                `0 0 0 4px ${alert.border}`,
                            }}
                          />

                        </div>

                      )
                    )}

                  </div>

                ) : (

                  <div
                    style={{
                      padding:
                        "34px 18px 30px",

                      textAlign:
                        "center",
                    }}
                  >

                    <div
                      style={{
                        width: "58px",
                        height: "58px",

                        margin:
                          "0 auto 13px",

                        display: "flex",

                        alignItems: "center",

                        justifyContent:
                          "center",

                        borderRadius:
                          "18px",

                        background:
                          "linear-gradient(145deg, #dcfce7, #bbf7d0)",

                        border:
                          "1px solid rgba(34,197,94,0.15)",

                        color: "#087443",

                        fontSize: "23px",

                        boxShadow:
                          "0 10px 24px rgba(22,101,52,0.08)",
                      }}
                    >
                      🌿
                    </div>


                    <strong
                      style={{
                        display: "block",

                        color: "#164e37",

                        fontSize: "14px",

                        fontWeight: 850,
                      }}
                    >
                      No food alerts
                    </strong>


                    <span
                      style={{
                        display: "block",

                        marginTop: "5px",

                        color: "#8a9a93",

                        fontSize: "10px",

                        fontWeight: 600,
                      }}
                    >
                      Your food inventory looks good.
                    </span>

                  </div>

                )}


                <div
                  style={{
                    display: "flex",

                    alignItems: "center",

                    justifyContent:
                      "space-between",

                    gap: "8px",

                    marginTop: "8px",

                    padding:
                      "10px 5px 3px",

                    borderTop:
                      "1px solid rgba(12,120,77,0.09)",
                  }}
                >

                  <button
                    type="button"

                    onClick={() => {

                      setShowNotifications(
                        false
                      );

                      onInventory();

                    }}

                    style={{
                      border: "none",

                      background:
                        "transparent",

                      color:
                        "#087443",

                      padding: "4px 0",

                      fontSize: "9px",

                      fontWeight: 800,

                      cursor: "pointer",
                    }}
                  >
                    Review Inventory →
                  </button>


                  <button
                    type="button"

                    onClick={
                      handleSoundToggle
                    }

                    style={{
                      display: "flex",

                      alignItems: "center",

                      gap: "5px",

                      border: "none",

                      background:
                        "transparent",

                      color: "#81918a",

                      padding: "4px 0",

                      fontSize: "9px",

                      fontWeight: 750,

                      cursor: "pointer",
                    }}
                  >

                    {alertSoundEnabled
                      ? "🔊 Sound On"
                      : "🔇 Sound Off"}

                  </button>

                </div>

              </div>

            )}

          </div>


          {/* ==================================================
              USER PROFILE PILL
          ================================================== */}

          {user && (

            <div
              className="freshguard-user-pill user-pill"

              style={{
                display: "flex",

                alignItems: "center",

                gap: "10px",

                padding:
                  "7px 13px 7px 7px",

                borderRadius: "15px",

                background:
                  "rgba(240,253,244,0.85)",

                border:
                  "1px solid rgba(34,197,94,0.13)",

                boxShadow:
                  "0 5px 18px rgba(22,101,52,0.06)",

                minWidth: "145px",
              }}
            >

              <div
                className="user-avatar"
                style={{
                  width: "38px",
                  height: "38px",

                  flexShrink: 0,

                  display: "flex",

                  alignItems: "center",

                  justifyContent:
                    "center",

                  borderRadius: "12px",

                  background:
                    "linear-gradient(145deg, #dcfce7, #bbf7d0)",

                  color: "#087443",

                  fontSize: "16px",

                  fontWeight: 800,

                  border:
                    "1px solid rgba(34,197,94,0.14)",
                }}
              >
                {userInitial}
              </div>


              <div
                className="user-info"
                style={{
                  display: "flex",

                  flexDirection:
                    "column",

                  minWidth: 0,

                  lineHeight: 1.15,
                }}
              >

                <strong
                  style={{
                    color: "#073b27",

                    fontSize: "13px",

                    fontWeight: 750,

                    whiteSpace:
                      "nowrap",

                    overflow:
                      "hidden",

                    textOverflow:
                      "ellipsis",

                    maxWidth: "105px",
                  }}
                >
                  {user.name}
                </strong>


                <span
                  style={{
                    marginTop: "4px",

                    color: "#779087",

                    fontSize: "10px",

                    fontWeight: 600,
                  }}
                >
                  {roleConfig.label}
                </span>

              </div>

            </div>

          )}


          {/* ==================================================
              REPORTS
          ================================================== */}

          <button
            className="freshguard-reports-button"

            onClick={onReports}

            type="button"

            style={{
              border:
                "1px solid #d8eadf",

              background:
                "rgba(255,255,255,0.95)",

              color: "#086337",

              padding:
                "11px 19px",

              borderRadius:
                "13px",

              fontSize:
                "13px",

              fontWeight:
                750,

              cursor:
                "pointer",

              boxShadow:
                "0 5px 15px rgba(22,101,52,0.04)",

              transition:
                "all 0.25s ease",
            }}

            onMouseEnter={(e) => {

              e.currentTarget.style.background =
                "#f0fdf4";

              e.currentTarget.style.borderColor =
                "#a7d9ba";

              e.currentTarget.style.transform =
                "translateY(-1px)";

            }}

            onMouseLeave={(e) => {

              e.currentTarget.style.background =
                "rgba(255,255,255,0.95)";

              e.currentTarget.style.borderColor =
                "#d8eadf";

              e.currentTarget.style.transform =
                "translateY(0)";

            }}
          >
            📊 Reports
          </button>


          {/* ==================================================
              PROFILE
          ================================================== */}

          <button
            onClick={onProfile}

            type="button"

            style={{
              border:
                "1px solid #d8eadf",

              background:
                "rgba(255,255,255,0.95)",

              color:
                "#086337",

              padding:
                "11px 19px",

              borderRadius:
                "13px",

              fontSize:
                "13px",

              fontWeight:
                750,

              cursor:
                "pointer",

              boxShadow:
                "0 5px 15px rgba(22,101,52,0.04)",

              transition:
                "all 0.25s ease",
            }}

            onMouseEnter={(e) => {

              e.currentTarget.style.background =
                "#f0fdf4";

              e.currentTarget.style.borderColor =
                "#a7d9ba";

              e.currentTarget.style.transform =
                "translateY(-1px)";

            }}

            onMouseLeave={(e) => {

              e.currentTarget.style.background =
                "rgba(255,255,255,0.95)";

              e.currentTarget.style.borderColor =
                "#d8eadf";

              e.currentTarget.style.transform =
                "translateY(0)";

            }}
          >
            Profile
          </button>


          {/* ==================================================
              LOGOUT
          ================================================== */}

          <button
            onClick={onLogout}

            type="button"

            style={{
              border:
                "1px solid rgba(239,68,68,0.12)",

              background:
                "#fff7f7",

              color:
                "#d43d3d",

              padding:
                "11px 17px",

              borderRadius:
                "13px",

              fontSize:
                "13px",

              fontWeight:
                750,

              cursor:
                "pointer",

              transition:
                "all 0.25s ease",
            }}

            onMouseEnter={(e) => {

              e.currentTarget.style.background =
                "#feecec";

              e.currentTarget.style.borderColor =
                "rgba(239,68,68,0.22)";

              e.currentTarget.style.transform =
                "translateY(-1px)";

            }}

            onMouseLeave={(e) => {

              e.currentTarget.style.background =
                "#fff7f7";

              e.currentTarget.style.borderColor =
                "rgba(239,68,68,0.12)";

              e.currentTarget.style.transform =
                "translateY(0)";

            }}
          >
            Logout
          </button>

        </div>

      </header>


      {/* ====================================================
          MAIN CONTENT
      ===================================================== */}

      <main
        className="dashboard-content"
        style={{
          position: "relative",
          zIndex: 1,
        }}
      >

        {/* ==================================================
            ROLE WORKSPACE STRIP
        ================================================== */}

        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "20px",
            padding: "13px 17px",
            borderRadius: "17px",
            background:
              "linear-gradient(135deg, rgba(240,253,244,0.95), rgba(236,253,245,0.92))",
            border:
              "1px solid rgba(34,197,94,0.12)",
            boxShadow:
              "0 8px 24px rgba(9,62,39,0.045)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "11px",
              minWidth: 0,
            }}
          >

            <div
              style={{
                width: "39px",
                height: "39px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "12px",
                background:
                  "linear-gradient(145deg, #dcfce7, #bbf7d0)",
                border:
                  "1px solid rgba(34,197,94,0.14)",
                fontSize: "18px",
              }}
            >
              {roleConfig.icon}
            </div>

            <div
              style={{
                minWidth: 0,
              }}
            >

              <span
                style={{
                  display: "block",
                  color: "#7b8f85",
                  fontSize: "8px",
                  fontWeight: 850,
                  letterSpacing: "1px",
                }}
              >
                CURRENT WORKSPACE
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#164e37",
                  fontSize: "12px",
                  fontWeight: 850,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {roleConfig.label}
              </strong>

            </div>

          </div>


          <span
            style={{
              flexShrink: 0,
              padding: "7px 11px",
              borderRadius: "999px",
              background:
                "rgba(255,255,255,0.80)",
              border:
                "1px solid rgba(34,197,94,0.12)",
              color: "#087443",
              fontSize: "8px",
              fontWeight: 850,
              letterSpacing: "0.5px",
            }}
          >
            {roleConfig.workspaceLabel}
          </span>

        </section>


        {/* ==================================================
            HERO
        ================================================== */}

        <section
          className="dashboard-hero"
          style={{
            position: "relative",
          }}
        >

          <div className="hero-copy">

            <span className="mini-label">
              {roleConfig.workspaceLabel}
            </span>


            <h1>

              {roleConfig.heroTitle}

              <br />

              <span>
                {roleConfig.heroHighlight}
              </span>

            </h1>


            <p className="dashboard-subtitle">

              {roleConfig.heroDescription}

            </p>


            <div className="hero-actions">

              <button
                className="primary-button hero-button"

                onClick={onAddFood}

                type="button"
              >
                + {roleConfig.primaryAction}
              </button>


              <button
                className="secondary-button"

                onClick={onInventory}

                type="button"
              >
                {roleConfig.secondaryAction} →
              </button>

            </div>

          </div>


          {/* ==================================================
              HERO VISUAL
          ================================================== */}

          <div className="hero-visual">

            <div
              className="fruit-orbit orbit-one"
            >
              🍎
            </div>


            <div
              className="fruit-orbit orbit-two"
            >
              🥕
            </div>


            <div
              className="fruit-orbit orbit-three"
            >
              🥦
            </div>


            <div className="hero-fruit">
              🥑
            </div>


            <div className="fresh-ring">

              <span>
                FRESH
              </span>

            </div>

          </div>

        </section>


        {/* ==================================================
            STATISTICS
        ================================================== */}

        <section className="stats-grid">


          {/* TOTAL FOOD */}

          <div className="stat-card">

            <div className="stat-icon green">
              🧺
            </div>


            <div>

              <p>
                Total Food Items
              </p>

              <strong>
                {foods.length}
              </strong>

            </div>


            <span className="stat-decoration">
              🍎
            </span>

          </div>


          {/* FRESH */}

          <div className="stat-card">

            <div className="stat-icon mint">
              🌱
            </div>


            <div>

              <p>
                Fresh Items
              </p>

              <strong>
                {freshCount}
              </strong>

            </div>


            <span className="stat-decoration">
              🥬
            </span>

          </div>


          {/* PENDING */}

          <div className="stat-card">

            <div className="stat-icon yellow">
              ⏳
            </div>


            <div>

              <p>
                Pending Analysis
              </p>

              <strong>
                {pendingCount}
              </strong>

            </div>


            <span className="stat-decoration">
              🍋
            </span>

          </div>

        </section>


        {/* ==================================================
            ROLE FOCUS CARD
        ================================================== */}

        <section
          style={{
            marginTop: "18px",
            display: "flex",
            alignItems: "center",
            gap: "15px",
            padding: "17px 18px",
            borderRadius: "18px",
            background:
              "rgba(255,255,255,0.82)",
            border:
              "1px solid rgba(30,160,90,0.10)",
            boxShadow:
              "0 8px 24px rgba(9,62,39,0.045)",
          }}
        >

          <div
            style={{
              width: "43px",
              height: "43px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "13px",
              background:
                "linear-gradient(145deg, #effcf4, #dcf6e7)",
              border:
                "1px solid rgba(30,170,90,0.10)",
              fontSize: "20px",
            }}
          >
            {roleConfig.focusIcon}
          </div>


          <div
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >

            <span
              style={{
                display: "block",
                color: "#7b8f85",
                fontSize: "8px",
                fontWeight: 850,
                letterSpacing: "1px",
              }}
            >
              ROLE FOCUS
            </span>

            <strong
              style={{
                display: "block",
                marginTop: "3px",
                color: "#164e37",
                fontSize: "13px",
                fontWeight: 850,
              }}
            >
              {roleConfig.focusTitle}
            </strong>

            <p
              style={{
                margin: "4px 0 0",
                color: "#81918a",
                fontSize: "10px",
                lineHeight: 1.45,
              }}
            >
              {roleConfig.focusDescription}
            </p>

          </div>

        </section>


        {/* ==================================================
            ALERT STATUS STRIP
        ================================================== */}

        <section
          style={{
            marginTop: "18px",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "space-between",

            gap: "14px",

            padding:
              "13px 16px",

            borderRadius:
              "17px",

            background:
              foodAlerts.length > 0
                ? "linear-gradient(135deg, rgba(255,247,247,0.94), rgba(255,251,235,0.94))"
                : "linear-gradient(135deg, rgba(240,253,244,0.94), rgba(236,253,245,0.94))",

            border:
              foodAlerts.length > 0
                ? "1px solid rgba(239,68,68,0.10)"
                : "1px solid rgba(34,197,94,0.10)",

            boxShadow:
              "0 8px 24px rgba(9,62,39,0.045)",
          }}
        >

          <div
            style={{
              display: "flex",

              alignItems: "center",

              gap: "10px",
            }}
          >

            <div
              style={{
                width: "35px",
                height: "35px",

                display: "flex",

                alignItems: "center",

                justifyContent:
                  "center",

                borderRadius:
                  "11px",

                background:
                  foodAlerts.length > 0
                    ? "#fff1f2"
                    : "#dcfce7",

                fontSize:
                  "15px",
              }}
            >
              {foodAlerts.length > 0
                ? "🔔"
                : "🌿"}
            </div>


            <div>

              <strong
                style={{
                  display: "block",

                  color:
                    "#164e37",

                  fontSize:
                    "11.5px",

                  fontWeight:
                    850,
                }}
              >
                {foodAlerts.length > 0
                  ? `${foodAlerts.length} food ${
                      foodAlerts.length === 1
                        ? "item needs"
                        : "items need"
                    } your attention`
                  : "Your food inventory is healthy"}
              </strong>


              <span
                style={{
                  display: "block",

                  marginTop:
                    "3px",

                  color:
                    "#81918a",

                  fontSize:
                    "9px",

                  fontWeight:
                    600,
                }}
              >
                {foodAlerts.length > 0
                  ? "Open the bell to review alerts."
                  : "FreshGuard is monitoring your inventory."}
              </span>

            </div>

          </div>


          <button
            type="button"

            onClick={
              handleNotificationClick
            }

            style={{
              flexShrink: 0,

              border: "none",

              background:
                "#fff",

              color:
                "#087443",

              padding:
                "8px 11px",

              borderRadius:
                "10px",

              fontSize:
                "9px",

              fontWeight:
                800,

              cursor:
                "pointer",

              boxShadow:
                "0 4px 12px rgba(9,62,39,0.06)",
            }}
          >
            {foodAlerts.length > 0
              ? "View Alerts"
              : "Alert Center"}
          </button>

        </section>


        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section className="action-section">


          <div className="section-heading">

            <div>

              <span className="mini-label">
                QUICK ACTIONS
              </span>


              <h2>
                Manage your food
              </h2>

            </div>


            <span className="section-emoji">
              {roleConfig.focusIcon}
            </span>

          </div>


          <div className="action-grid">


            {/* ADD FOOD */}

            <button
              className="action-card add-card"

              onClick={onAddFood}

              type="button"
            >

              <div className="action-illustration">
                🍎🥕
              </div>


              <div>

                <span className="action-label">
                  {roleConfig.inventoryLabel}
                </span>


                <h3>
                  {roleConfig.primaryAction}
                </h3>


                <p>
                  Register food products and
                  provide the information needed
                  for freshness monitoring.
                </p>

              </div>


              <span className="action-arrow">
                →
              </span>

            </button>


            {/* INVENTORY */}

            <button
              className="action-card inventory-card"

              onClick={onInventory}

              type="button"
            >

              <div className="action-illustration">
                🥦🍅
              </div>


              <div>

                <span className="action-label">
                  {roleConfig.inventoryLabel}
                </span>


                <h3>
                  {roleConfig.inventoryTitle}
                </h3>


                <p>
                  {roleConfig.inventoryDescription}
                </p>

              </div>


              <span className="action-arrow">
                →
              </span>

            </button>

          </div>

        </section>


        {/* ==================================================
            FRESHNESS BANNER
        ================================================== */}

        <section className="fresh-banner">


          <div className="banner-food">
            🍓 🥑 🍊
          </div>


          <div>

            <span className="mini-label">
              FRESHNESS MATTERS
            </span>


            <h2>
              Less waste. Better food.
            </h2>


            <p>
              Smart monitoring helps you
              understand what is fresh
              and what needs attention.
            </p>

          </div>


          <div className="banner-badge">

            <span>
              🌿
            </span>

            Smart

            <br />

            Monitoring

          </div>

        </section>

      </main>

    </div>

  );
}


export default Dashboard;