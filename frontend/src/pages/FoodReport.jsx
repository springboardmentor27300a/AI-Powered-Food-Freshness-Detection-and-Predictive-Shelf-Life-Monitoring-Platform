import { useMemo } from "react";


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


  for (
    const [food, icon]
    of Object.entries(foodIcons)
  ) {
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
  const value =
    (status || "").toLowerCase();


  if (
    value === "fresh"
  ) {
    return {
      label: "Fresh",
      icon: "✓",
      className: "fresh",
      message:
        "The AI assessment indicates that this food item is currently in a good freshness condition.",
    };
  }


  if (
    value === "good"
  ) {
    return {
      label: "Good",
      icon: "✓",
      className: "good",
      message:
        "The food item is in good condition with a healthy freshness score.",
    };
  }


  if (
    value === "acceptable"
  ) {
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


  if (
    value === "expired"
  ) {
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

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


function getDaysBetween(
  start,
  end
) {
  if (!start || !end) {
    return null;
  }

  const difference =
    end.getTime() -
    start.getTime();

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24)
  );
}


// ============================================================
// SCORE HELPERS
// ============================================================

function clampScore(score) {
  const numericScore =
    Number(score);

  if (
    Number.isNaN(numericScore)
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      numericScore,
      0
    ),
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


    const today =
      new Date();


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
  // SAFE GUARD
  // ==========================================================

  if (!food) {

    return (

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg,#effff5,#ffffff,#f7fff4)",
          padding: "30px",
        }}
      >

        <div
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
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 8% 10%, rgba(113,230,160,0.22), transparent 25%), radial-gradient(circle at 92% 15%, rgba(255,226,132,0.18), transparent 24%), linear-gradient(135deg,#f4fff8 0%,#ffffff 48%,#f4fff7 100%)",
        padding:
          "28px 5vw 70px",
        color: "#073b27",
        fontFamily:
          "inherit",
      }}
    >

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
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding:
                  "7px 12px",
                borderRadius: "30px",
                background:
                  "rgba(8,169,79,0.09)",
                color: "#078b43",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing:
                  "1.5px",
                marginBottom: "16px",
              }}
            >
              <span>✦</span>
              FRESHNESS INTELLIGENCE
            </div>


            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
              }}
            >

              <div
                style={{
                  width: "78px",
                  height: "78px",
                  borderRadius: "22px",
                  background:
                    "linear-gradient(145deg,#eafff2,#d7f9e6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "45px",
                  boxShadow:
                    "0 12px 30px rgba(8,169,79,0.10)",
                }}
              >
                {getFoodEmoji(
                  report.category,
                  food.food_name
                )}
              </div>


              <div>

                <h1
                  style={{
                    margin: 0,
                    fontSize:
                      "clamp(30px,4vw,48px)",
                    lineHeight: 1.05,
                    letterSpacing:
                      "-1.5px",
                    color: "#063b27",
                  }}
                >
                  {food.food_name}
                </h1>

                <p
                  style={{
                    margin:
                      "10px 0 0",
                    color: "#698078",
                    fontSize: "16px",
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
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "22px",
              }}
            >

              <span
                style={{
                  padding:
                    "9px 14px",
                  borderRadius: "999px",
                  background:
                    "rgba(8,169,79,0.09)",
                  color: "#078b43",
                  fontWeight: "700",
                  fontSize: "13px",
                }}
              >
                ● {statusTheme.label}
              </span>


              <span
                style={{
                  padding:
                    "9px 14px",
                  borderRadius: "999px",
                  background:
                    "#f3f7f5",
                  color: "#5c7068",
                  fontWeight: "700",
                  fontSize: "13px",
                }}
              >
                Category: {report.category}
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
                    fontWeight: "700",
                    fontSize: "13px",
                  }}
                >
                  ❄ {food.storage_condition}
                </span>

              )}

            </div>

          </div>


          {/* =================================================
              SCORE
          ================================================= */}

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
                borderRadius: "50%",
                background:
                  `conic-gradient(#08a94f ${report.score * 3.6}deg, #e6f2eb 0deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 20px 45px rgba(8,169,79,0.15)",
              }}
            >

              <div
                style={{
                  width: "176px",
                  height: "176px",
                  borderRadius: "50%",
                  background:
                    "#ffffff",
                  display: "flex",
                  flexDirection:
                    "column",
                  alignItems: "center",
                  justifyContent:
                    "center",
                  boxShadow:
                    "inset 0 0 0 1px rgba(8,169,79,0.06)",
                }}
              >

                <span
                  style={{
                    fontSize: "48px",
                    fontWeight: "850",
                    color: "#073b27",
                    lineHeight: 1,
                  }}
                >
                  {report.score}
                </span>

                <span
                  style={{
                    marginTop: "5px",
                    color: "#7b8e86",
                    fontSize: "13px",
                    fontWeight: "700",
                  }}
                >
                  / 100
                </span>

                <span
                  style={{
                    marginTop: "8px",
                    color: "#08a94f",
                    fontSize: "12px",
                    fontWeight: "800",
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
              report.remainingShelfLife !== null
                ? report.remainingShelfLife >= 0
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
        ].map(
          (item) => (

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
              }}
            >

              <div
                style={{
                  fontSize: "25px",
                }}
              >
                {item.icon}
              </div>

              <div
                style={{
                  marginTop: "13px",
                  color: "#70827b",
                  fontSize: "12px",
                  fontWeight: "800",
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
                  marginTop: "5px",
                  color: "#063b27",
                  fontSize: "21px",
                  fontWeight: "800",
                }}
              >
                {item.value}
              </div>

              <p
                style={{
                  margin:
                    "7px 0 0",
                  color: "#81918b",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                {item.description}
              </p>

            </div>

          )
        )}

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
        }}
      >

        {/* ===================================================
            FRESHNESS ANALYSIS
        =================================================== */}

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
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: "15px",
            }}
          >

            <div>

              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "850",
                  color: "#08a94f",
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
                  color: "#073b27",
                  fontSize: "25px",
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
                alignItems: "center",
                justifyContent:
                  "center",
                fontSize: "22px",
              }}
            >
              ✦
            </div>

          </div>


          <div
            style={{
              marginTop: "25px",
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
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "15px",
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#7a8c85",
                    fontWeight: "700",
                  }}
                >
                  Current freshness score
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "34px",
                    fontWeight: "850",
                    color: "#073b27",
                  }}
                >
                  {report.score}
                  <span
                    style={{
                      fontSize: "15px",
                      color: "#91a19a",
                    }}
                  >
                    {" "} / 100
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
                    color: "#08a94f",
                    fontWeight: "850",
                  }}
                >
                  {scoreLabel}
                </div>

                <div
                  style={{
                    color: "#81918b",
                    fontSize: "12px",
                    marginTop: "4px",
                  }}
                >
                  AI assessment
                </div>

              </div>

            </div>


            <div
              style={{
                marginTop: "18px",
                height: "11px",
                borderRadius:
                  "999px",
                background:
                  "#e8f2ec",
                overflow: "hidden",
              }}
            >

              <div
                style={{
                  height: "100%",
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
              marginTop: "20px",
              display: "grid",
              gap: "10px",
            }}
          >

            {[
              {
                name:
                  "Visual Condition Analysis",
                weight: "40%",
                icon: "👁️",
              },
              {
                name:
                  "Storage Conditions",
                weight: "25%",
                icon: "❄️",
              },
              {
                name:
                  "Shelf-Life Prediction",
                weight: "20%",
                icon: "⏳",
              },
              {
                name:
                  "Product Age",
                weight: "15%",
                icon: "📅",
              },
            ].map(
              (factor) => (

                <div
                  key={factor.name}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "12px",
                    padding:
                      "12px 14px",
                    borderRadius:
                      "14px",
                    background:
                      "#fafdfb",
                    border:
                      "1px solid #edf4ef",
                  }}
                >

                  <span
                    style={{
                      width: "35px",
                      height: "35px",
                      borderRadius:
                        "10px",
                      background:
                        "#edfff4",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >
                    {factor.icon}
                  </span>


                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      fontWeight: "700",
                      color:
                        "#41584e",
                    }}
                  >
                    {factor.name}
                  </span>


                  <strong
                    style={{
                      color:
                        "#08a94f",
                      fontSize: "13px",
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
            STATUS / RECOMMENDATION
        =================================================== */}

        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: "20px",
          }}
        >

          <div
            style={{
              background:
                "linear-gradient(145deg,#063b27,#0a583b)",
              color: "#ffffff",
              borderRadius:
                "26px",
              padding:
                "28px",
              boxShadow:
                "0 18px 45px rgba(0,70,35,0.16)",
              flex: 1,
            }}
          >

            <span
              style={{
                fontSize: "11px",
                fontWeight: "850",
                letterSpacing:
                  "1.5px",
                opacity: 0.75,
              }}
            >
              AI INSIGHT
            </span>


            <div
              style={{
                marginTop: "20px",
                width: "58px",
                height: "58px",
                borderRadius:
                  "18px",
                background:
                  "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize: "28px",
              }}
            >
              {statusTheme.icon}
            </div>


            <h2
              style={{
                margin:
                  "18px 0 8px",
                fontSize: "24px",
              }}
            >
              {statusTheme.label}
            </h2>


            <p
              style={{
                margin: 0,
                lineHeight: 1.65,
                color:
                  "rgba(255,255,255,0.76)",
                fontSize: "13px",
              }}
            >
              {statusTheme.message}
            </p>

          </div>


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
            }}
          >

            <span
              style={{
                fontSize: "11px",
                fontWeight: "850",
                color: "#08a94f",
                letterSpacing:
                  "1.5px",
              }}
            >
              SMART RECOMMENDATION
            </span>


            <h3
              style={{
                margin:
                  "10px 0 7px",
                color: "#073b27",
                fontSize: "20px",
              }}
            >
              {report.score >= 70
                ? "Maintain current storage"
                : report.score >= 40
                ? "Monitor and consume soon"
                : "Take immediate action"}
            </h3>


            <p
              style={{
                margin: 0,
                color: "#71827b",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              {report.score >= 70
                ? "The current freshness score is healthy. Continue monitoring storage conditions and expiry information."
                : report.score >= 40
                ? "Freshness is moderate. Review the storage condition and consider prioritising this item in your inventory."
                : "Freshness is low. Review storage conditions and consider consuming or safely disposing of the item based on applicable food-safety guidance."}
            </p>

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
        }}
      >

        {/* ===================================================
            SHELF LIFE
        =================================================== */}

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
          }}
        >

          <span
            style={{
              fontSize: "11px",
              fontWeight: "850",
              color: "#08a94f",
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
              color: "#073b27",
              fontSize: "24px",
            }}
          >
            Expiry intelligence
          </h2>


          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "12px",
            }}
          >

            <div
              style={{
                padding: "16px",
                borderRadius:
                  "16px",
                background:
                  "#f8fcf9",
              }}
            >

              <span
                style={{
                  color: "#84938d",
                  fontSize: "11px",
                  fontWeight: "800",
                }}
              >
                MANUFACTURING DATE
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "#073b27",
                }}
              >
                {formatDate(
                  report.manufacturingDate
                )}
              </strong>

            </div>


            <div
              style={{
                padding: "16px",
                borderRadius:
                  "16px",
                background:
                  "#f8fcf9",
              }}
            >

              <span
                style={{
                  color: "#84938d",
                  fontSize: "11px",
                  fontWeight: "800",
                }}
              >
                EXPIRY DATE
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "#073b27",
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
              marginTop: "18px",
              padding: "20px",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg,#f0fff6,#fbfffc)",
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >

              <span
                style={{
                  color: "#61756b",
                  fontSize: "13px",
                  fontWeight: "700",
                }}
              >
                Remaining shelf life
              </span>

              <strong
                style={{
                  color:
                    report.remainingShelfLife !== null &&
                    report.remainingShelfLife < 0
                      ? "#d94a4a"
                      : "#08a94f",
                  fontSize: "20px",
                }}
              >
                {report.remainingShelfLife !== null
                  ? report.remainingShelfLife >= 0
                    ? `${report.remainingShelfLife} days`
                    : "Expired"
                  : "Not available"}
              </strong>

            </div>


            {report.shelfLifePercentage !== null && (

              <div
                style={{
                  marginTop: "14px",
                  height: "9px",
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
                    height: "100%",
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
                display: "flex",
                justifyContent:
                  "space-between",
                marginTop: "9px",
                color: "#8a9993",
                fontSize: "11px",
              }}
            >

              <span>
                Product age:{" "}
                {report.elapsedAge !== null
                  ? `${Math.max(
                      report.elapsedAge,
                      0
                    )} days`
                  : "—"}
              </span>

              <span>
                Total shelf life:{" "}
                {report.totalShelfLife !== null
                  ? `${Math.max(
                      report.totalShelfLife,
                      0
                    )} days`
                  : "—"}
              </span>

            </div>

          </div>

        </div>


        {/* ===================================================
            STORAGE
        =================================================== */}

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
          }}
        >

          <span
            style={{
              fontSize: "11px",
              fontWeight: "850",
              color: "#08a94f",
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
              color: "#073b27",
              fontSize: "24px",
            }}
          >
            Storage intelligence
          </h2>


          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "14px",
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
                  width: "45px",
                  height: "45px",
                  borderRadius:
                    "13px",
                  background:
                    "#eafff2",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: "22px",
                }}
              >
                ❄️
              </div>

              <div>

                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    color: "#82928b",
                  }}
                >
                  STORAGE CONDITION
                </div>

                <strong
                  style={{
                    display: "block",
                    marginTop:
                      "4px",
                    color:
                      "#073b27",
                  }}
                >
                  {food.storage_condition ||
                    "Not recorded"}
                </strong>

              </div>

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
                  display: "flex",
                  gap: "10px",
                  alignItems:
                    "flex-start",
                }}
              >

                <span
                  style={{
                    fontSize:
                      "20px",
                  }}
                >
                  💡
                </span>

                <div>

                  <strong
                    style={{
                      color:
                        "#073b27",
                      fontSize:
                        "14px",
                    }}
                  >
                    Storage guidance
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
                    Maintain appropriate storage conditions for the selected food category and avoid unnecessary temperature or environmental fluctuations.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          REPORT FOOTER
      ===================================================== */}

      <section
        style={{
          maxWidth: "1250px",
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
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >

        <div>

          <strong
            style={{
              color:
                "#073b27",
              fontSize: "14px",
            }}
          >
            FreshGuard Intelligence Report
          </strong>

          <div
            style={{
              color:
                "#8a9993",
              fontSize: "11px",
              marginTop:
                "4px",
            }}
          >
            Generated from the food item's recorded inventory and freshness assessment data.
          </div>

        </div>


        <div
          style={{
            color:
              "#08a94f",
            fontSize: "12px",
            fontWeight:
              "800",
          }}
        >
          Freshness • Shelf Life • Storage • Recommendations
        </div>

      </section>

    </div>

  );
}


export default FoodReport;