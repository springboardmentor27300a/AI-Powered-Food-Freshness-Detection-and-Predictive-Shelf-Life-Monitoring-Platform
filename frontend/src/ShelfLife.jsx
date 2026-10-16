import { useEffect, useState } from "react";

import "./ShelfLife.css";

import {
  analyzeFoodImage,
  predictShelfLife
} from "./api";


function ShelfLife({
  user,
  onBack,
  onLogout
}) {

  /* ==========================================================
     IMAGE
  ========================================================== */

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [imagePreview, setImagePreview] =
    useState("");

  const [analysisResult, setAnalysisResult] =
    useState(null);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState("");


  /* ==========================================================
     PRODUCT DETAILS
  ========================================================== */

  const [category, setCategory] =
    useState("");

  const [storageTemperature, setStorageTemperature] =
    useState("");

  const [humidity, setHumidity] =
    useState("");

  const [packagingType, setPackagingType] =
    useState("");

  const [purchaseDate, setPurchaseDate] =
    useState("");

  const [expiryDate, setExpiryDate] =
    useState("");


  /* ==========================================================
     PREDICTION
  ========================================================== */

  const [shelfLifeResult, setShelfLifeResult] =
    useState(null);

  const [isPredicting, setIsPredicting] =
    useState(false);

  const [shelfLifeError, setShelfLifeError] =
    useState("");


  /* ==========================================================
     IMAGE PREVIEW CLEANUP
  ========================================================== */

  useEffect(() => {

    return () => {

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

    };

  }, [imagePreview]);


  /* ==========================================================
     FILE CHANGE
  ========================================================== */

  const handleFileChange = (event) => {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    if (!file.type.startsWith("image/")) {

      setAnalysisError(
        "Please select a valid food image."
      );

      return;
    }


    if (file.size > 10 * 1024 * 1024) {

      setAnalysisError(
        "Image size must be less than 10 MB."
      );

      return;
    }


    setSelectedFile(file);

    setAnalysisResult(null);

    setShelfLifeResult(null);

    setAnalysisError("");

    setShelfLifeError("");


    const preview =
      URL.createObjectURL(file);

    setImagePreview(preview);

  };


  /* ==========================================================
     ANALYZE IMAGE
  ========================================================== */

  const handleAnalyzeImage =
    async () => {

      if (!selectedFile) {

        setAnalysisError(
          "Please upload a food image first."
        );

        return;
      }


      try {

        setIsAnalyzing(true);

        setAnalysisError("");

        setShelfLifeResult(null);


        const result =
          await analyzeFoodImage(
            selectedFile
          );


        setAnalysisResult(result);

      }

      catch (error) {

        console.error(
          error
        );

        setAnalysisError(
          error?.message ||
          "Food image analysis failed."
        );

      }

      finally {

        setIsAnalyzing(false);

      }

    };


  /* ==========================================================
     GET FRESHNESS SCORE
  ========================================================== */

  const freshnessScore =
    Number(
      analysisResult
        ?.report
        ?.overall_assessment
        ?.freshness_score
    );


  /* ==========================================================
     PREDICT SHELF LIFE
  ========================================================== */

  const handleShelfLifePrediction =
    async () => {

      setShelfLifeError("");

      setShelfLifeResult(null);


      if (!analysisResult?.report) {

        setShelfLifeError(
          "Please analyze the food image first."
        );

        return;
      }


      if (!category) {

        setShelfLifeError(
          "Please select a food category."
        );

        return;
      }


      if (
        !Number.isFinite(
          freshnessScore
        )
      ) {

        setShelfLifeError(
          "Freshness score could not be obtained from the image analysis."
        );

        return;
      }


      try {

        setIsPredicting(true);


        const result =
          await predictShelfLife({

            category,

            freshnessScore,

            storageTemperature:
              storageTemperature
                ? Number(
                    storageTemperature
                  )
                : null,

            humidity:
              humidity
                ? Number(humidity)
                : null,

            packagingType,

            purchaseDate,

            expiryDate

          });


        /*
         * Supports both:
         *
         * { prediction: {...} }
         *
         * and direct prediction object.
         */

        const prediction =
          result?.prediction ||
          result;


        setShelfLifeResult(
          prediction
        );

      }

      catch (error) {

        console.error(
          "Shelf-life prediction error:",
          error
        );

        setShelfLifeError(
          error?.message ||
          "Shelf-life prediction failed."
        );

      }

      finally {

        setIsPredicting(false);

      }

    };


  /* ==========================================================
     RESET
  ========================================================== */

  const handleReset = () => {

    setSelectedFile(null);

    setImagePreview("");

    setAnalysisResult(null);

    setIsAnalyzing(false);

    setAnalysisError("");

    setCategory("");

    setStorageTemperature("");

    setHumidity("");

    setPackagingType("");

    setPurchaseDate("");

    setExpiryDate("");

    setShelfLifeResult(null);

    setIsPredicting(false);

    setShelfLifeError("");

  };


  /* ==========================================================
     PREDICTION DATA
  ========================================================== */

  const prediction =
    shelfLifeResult || {};


  const remainingDays =
    Number(
      prediction
        ?.remaining_shelf_life_days
    );


  const totalDays =
    Number(
      prediction
        ?.estimated_total_shelf_life_days
    );


  const productAge =
    Number(
      prediction
        ?.product_age_days
    );


  const riskLevel =
    prediction?.risk_level ||
    "Unknown";


  const predictedExpiry =
    prediction
      ?.predicted_expiry_date;


  const warnings =
    Array.isArray(
      prediction?.warnings
    )
      ? prediction.warnings
      : [];


  const recommendation =
    prediction?.recommendation ||
    "";


  return (

    <div
      className="shelf-life-page"
      style={{
        minHeight: "100vh"
      }}
    >

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <nav
        className="dashboard-navbar"
      >

        <div
          className="dashboard-brand"
        >

          <div className="brand-icon">
            🍎
          </div>

          <div>

            <h2>
              FoodFresh
            </h2>

            <span>
              Shelf-Life Prediction
            </span>

          </div>

        </div>


        <div
          className="dashboard-user"
        >

          <div
            style={{
              textAlign: "right"
            }}
          >

            <strong>
              {user?.name ||
                "User"}
            </strong>

            <span
              style={{
                display: "block"
              }}
            >
              {user?.role}
            </span>

          </div>


          <button
            className="back-button"
            onClick={onBack}
          >
            ← Back
          </button>


          {onLogout && (

            <button
              className="logout-btn"
              onClick={onLogout}
            >
              Logout
            </button>

          )}

        </div>

      </nav>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main
        className="shelf-life-content"
        style={{
          maxWidth: "1250px"
        }}
      >

        {/* HEADER */}

        <section
          className="shelf-life-header"
        >

          <span
            className="shelf-life-label"
          >
            MILESTONE 3 • SMART PREDICTION
          </span>

          <h1>
            Shelf-Life Prediction
          </h1>

          <p>
            Combine AI freshness analysis with
            storage conditions to estimate remaining
            shelf life and predicted expiry.
          </p>

        </section>


        {/* =================================================
            PROGRESS
        ================================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: "12px",
            marginBottom: "24px"
          }}
        >

          <Step
            number="1"
            title="Food Image"
            active
          />

          <Step
            number="2"
            title="Storage Details"
            active={
              Boolean(
                analysisResult
              )
            }
          />

          <Step
            number="3"
            title="Prediction"
            active={
              Boolean(
                shelfLifeResult
              )
            }
          />

        </div>


        {/* =================================================
            STEP 1
        ================================================= */}

        <section
          className="shelf-card"
          style={{
            padding: "28px",
            marginBottom: "20px"
          }}
        >

          <div
            className="step-number"
          >
            1
          </div>


          <div
            className="shelf-card-content"
          >

            <h2>
              Analyze Food Image
            </h2>

            <p
              className="section-description"
            >
              Upload a clear image. The AI freshness
              score will automatically be used for
              shelf-life prediction.
            </p>


            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  imagePreview
                    ? "1fr 1fr"
                    : "1fr",
                gap: "20px",
                marginTop: "20px"
              }}
            >

              <label
                className="upload-box"
                style={{
                  minHeight: "220px",
                  cursor: "pointer"
                }}
              >

                {imagePreview ? (

                  <img
                    src={imagePreview}
                    alt="Selected food"
                    style={{
                      width: "100%",
                      height: "220px",
                      objectFit: "cover",
                      borderRadius: "14px"
                    }}
                  />

                ) : (

                  <div
                    style={{
                      textAlign: "center"
                    }}
                  >

                    <div
                      style={{
                        fontSize: "50px"
                      }}
                    >
                      📷
                    </div>

                    <strong>
                      Upload Food Image
                    </strong>

                    <small>
                      JPG, JPEG, PNG or WEBP
                    </small>

                  </div>

                )}


                <input
                  type="file"
                  accept="image/*"
                  onChange={
                    handleFileChange
                  }
                  style={{
                    display: "none"
                  }}
                />

              </label>


              <div>

                {selectedFile && (

                  <div
                    style={{
                      padding: "16px",
                      background:
                        "#f5f8f5",
                      borderRadius: "14px",
                      marginBottom: "15px"
                    }}
                  >

                    <strong>
                      📄 {selectedFile.name}
                    </strong>

                    <small
                      style={{
                        display: "block",
                        marginTop: "5px"
                      }}
                    >
                      {(selectedFile.size / 1024).toFixed(1)}
                      {" "}KB
                    </small>

                  </div>

                )}


                <button
                  className="primary-btn"
                  onClick={
                    handleAnalyzeImage
                  }
                  disabled={
                    !selectedFile ||
                    isAnalyzing
                  }
                  style={{
                    width: "100%"
                  }}
                >

                  {isAnalyzing
                    ? "🔄 Analyzing..."
                    : "🔍 Analyze Freshness"}

                </button>


                {analysisError && (

                  <div
                    style={{
                      marginTop: "14px",
                      padding: "13px",
                      background:
                        "#fff0f0",
                      color: "#a32929",
                      borderRadius: "10px"
                    }}
                  >
                    ⚠️ {analysisError}
                  </div>

                )}

              </div>

            </div>


            {/* FRESHNESS SCORE */}

            {analysisResult && (

              <div
                style={{
                  marginTop: "22px",
                  padding: "18px",
                  background:
                    "#eef8f0",
                  borderRadius: "15px",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center"
                }}
              >

                <div>

                  <small>
                    AI FRESHNESS SCORE
                  </small>

                  <h2
                    style={{
                      margin:
                        "4px 0"
                    }}
                  >
                    {Number.isFinite(
                      freshnessScore
                    )
                      ? Math.round(
                          freshnessScore
                        )
                      : 0}
                    /100
                  </h2>

                  <span>
                    Automatically obtained
                    from image analysis
                  </span>

                </div>


                <div
                  style={{
                    fontSize: "42px"
                  }}
                >
                  🌱
                </div>

              </div>

            )}

          </div>

        </section>


        {/* =================================================
            STEP 2
        ================================================= */}

        <section
          className="shelf-card"
          style={{
            padding: "28px",
            marginBottom: "20px",
            opacity:
              analysisResult
                ? 1
                : 0.65
          }}
        >

          <div
            className="step-number"
          >
            2
          </div>


          <div
            className="shelf-card-content"
          >

            <h2>
              Storage & Product Details
            </h2>

            <p
              className="section-description"
            >
              These factors help improve the shelf-life
              estimate.
            </p>


            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0,1fr))",
                gap: "18px",
                marginTop: "20px"
              }}
            >

              {/* CATEGORY */}

              <Field
                label="Food Category"
                required
              >

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  disabled={
                    !analysisResult
                  }
                >

                  <option value="">
                    Select food category
                  </option>

                  <option value="Fruits">
                    Fruits
                  </option>

                  <option value="Vegetables">
                    Vegetables
                  </option>

                  <option value="Dairy Products">
                    Dairy Products
                  </option>

                  <option value="Meat & Poultry">
                    Meat & Poultry
                  </option>

                  <option value="Seafood">
                    Seafood
                  </option>

                  <option value="Bakery Products">
                    Bakery Products
                  </option>

                  <option value="Packaged Foods">
                    Packaged Foods
                  </option>

                  <option value="Beverages">
                    Beverages
                  </option>

                </select>

              </Field>


              {/* TEMPERATURE */}

              <Field
                label="Storage Temperature"
              >

                <div
                  style={{
                    position: "relative"
                  }}
                >

                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 4"
                    value={
                      storageTemperature
                    }
                    onChange={(e) =>
                      setStorageTemperature(
                        e.target.value
                      )
                    }
                    disabled={
                      !analysisResult
                    }
                  />

                  <span
                    style={{
                      position:
                        "absolute",
                      right: "13px",
                      top: "12px",
                      opacity: 0.6
                    }}
                  >
                    °C
                  </span>

                </div>

              </Field>


              {/* HUMIDITY */}

              <Field
                label="Humidity"
              >

                <div
                  style={{
                    position: "relative"
                  }}
                >

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g. 60"
                    value={humidity}
                    onChange={(e) =>
                      setHumidity(
                        e.target.value
                      )
                    }
                    disabled={
                      !analysisResult
                    }
                  />

                  <span
                    style={{
                      position:
                        "absolute",
                      right: "13px",
                      top: "12px",
                      opacity: 0.6
                    }}
                  >
                    %
                  </span>

                </div>

              </Field>


              {/* PACKAGING */}

              <Field
                label="Packaging Type"
              >

                <select
                  value={
                    packagingType
                  }
                  onChange={(e) =>
                    setPackagingType(
                      e.target.value
                    )
                  }
                  disabled={
                    !analysisResult
                  }
                >

                  <option value="">
                    Select packaging
                  </option>

                  <option value="Vacuum sealed">
                    Vacuum Sealed
                  </option>

                  <option value="Airtight">
                    Airtight
                  </option>

                  <option value="Sealed">
                    Sealed
                  </option>

                  <option value="Open">
                    Open
                  </option>

                  <option value="Loose">
                    Loose
                  </option>

                  <option value="Unpacked">
                    Unpacked
                  </option>

                </select>

              </Field>


              {/* PURCHASE DATE */}

              <Field
                label="Purchase / Storage Start Date"
              >

                <input
                  type="date"
                  value={
                    purchaseDate
                  }
                  onChange={(e) =>
                    setPurchaseDate(
                      e.target.value
                    )
                  }
                  disabled={
                    !analysisResult
                  }
                />

              </Field>


              {/* EXPIRY */}

              <Field
                label="Existing Expiry Date"
              >

                <input
                  type="date"
                  value={
                    expiryDate
                  }
                  onChange={(e) =>
                    setExpiryDate(
                      e.target.value
                    )
                  }
                  disabled={
                    !analysisResult
                  }
                />

              </Field>

            </div>


            {shelfLifeError && (

              <div
                style={{
                  marginTop: "18px",
                  padding: "14px",
                  background:
                    "#fff0f0",
                  color: "#a32929",
                  borderRadius: "10px"
                }}
              >
                ⚠️ {shelfLifeError}
              </div>

            )}


            <button
              className="primary-btn"
              onClick={
                handleShelfLifePrediction
              }
              disabled={
                !analysisResult ||
                !category ||
                isPredicting
              }
              style={{
                width: "100%",
                marginTop: "22px"
              }}
            >

              {isPredicting
                ? "🔄 Calculating Shelf Life..."
                : "⏳ Predict Remaining Shelf Life"}

            </button>

          </div>

        </section>


        {/* =================================================
            STEP 3 RESULT
        ================================================= */}

        {shelfLifeResult && (

          <section
            className="shelf-card"
            style={{
              padding: "28px",
              marginBottom: "20px"
            }}
          >

            <div
              className="step-number"
            >
              3
            </div>


            <div
              className="shelf-card-content"
            >

              <span
                className="shelf-life-label"
              >
                AI PREDICTION RESULT
              </span>

              <h2>
                Remaining Shelf Life
              </h2>


              {/* MAIN RESULT */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "18px",
                  marginTop: "22px"
                }}
              >

                <PredictionCard
                  icon="⏳"
                  label="Remaining Shelf Life"
                  value={
                    Number.isFinite(
                      remainingDays
                    )
                      ? `${remainingDays} days`
                      : "N/A"
                  }
                  highlight
                />


                <PredictionCard
                  icon="📅"
                  label="Predicted Expiry"
                  value={
                    formatDate(
                      predictedExpiry
                    )
                  }
                />


                <PredictionCard
                  icon="📦"
                  label="Estimated Total Life"
                  value={
                    Number.isFinite(
                      totalDays
                    )
                      ? `${totalDays} days`
                      : "N/A"
                  }
                />


                <PredictionCard
                  icon="🕒"
                  label="Product Age"
                  value={
                    Number.isFinite(
                      productAge
                    )
                      ? `${productAge} days`
                      : "N/A"
                  }
                />

              </div>


              {/* RISK */}

              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  borderRadius: "15px",
                  background:
                    riskLevel === "High"
                      ? "#fff0f0"
                      : riskLevel === "Moderate"
                        ? "#fff8e6"
                        : "#eef8f0"
                }}
              >

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center"
                  }}
                >

                  <div>

                    <small>
                      SPOILAGE RISK
                    </small>

                    <h3>
                      {riskLevel}
                    </h3>

                  </div>

                  <div
                    style={{
                      fontSize: "32px"
                    }}
                  >
                    {riskLevel === "High"
                      ? "🚨"
                      : riskLevel === "Moderate"
                        ? "⚠️"
                        : "✅"}
                  </div>

                </div>

              </div>


              {/* WARNINGS */}

              {warnings.length > 0 && (

                <div
                  style={{
                    marginTop: "20px"
                  }}
                >

                  <h3>
                    ⚠️ Important Warnings
                  </h3>

                  {warnings.map(
                    (
                      warning,
                      index
                    ) => (

                      <div
                        key={index}
                        style={{
                          padding: "12px 14px",
                          marginTop: "8px",
                          borderRadius: "10px",
                          background:
                            "#fff8e6"
                        }}
                      >
                        {warning}
                      </div>

                    )
                  )}

                </div>

              )}


              {/* RECOMMENDATION */}

              {recommendation && (

                <div
                  style={{
                    marginTop: "20px",
                    padding: "20px",
                    borderRadius: "15px",
                    background:
                      "#eef8f0"
                  }}
                >

                  <h3>
                    💡 Storage Recommendation
                  </h3>

                  <p>
                    {recommendation}
                  </p>

                </div>

              )}


              {/* ACTIONS */}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "24px"
                }}
              >

                <button
                  className="secondary-btn"
                  onClick={
                    handleReset
                  }
                >
                  🔄 New Prediction
                </button>


                <button
                  className="primary-btn"
                  onClick={
                    onBack
                  }
                >
                  ← Back to Dashboard
                </button>

              </div>

            </div>

          </section>

        )}

      </main>

    </div>
  );
}


/* ============================================================
   STEP
============================================================ */

function Step({
  number,
  title,
  active
}) {

  return (

    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background:
          active
            ? "#eef8f0"
            : "#f3f5f3",
        border:
          active
            ? "1px solid #cce1cf"
            : "1px solid #e4e8e4",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}
    >

      <strong>
        {active
          ? "✓"
          : number}
      </strong>

      <span>
        {title}
      </span>

    </div>
  );
}


/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  required,
  children
}) {

  return (

    <label
      style={{
        display: "block"
      }}
    >

      <span
        style={{
          display: "block",
          fontWeight: 600,
          marginBottom: "7px"
        }}
      >

        {label}

        {required && (
          <span
            style={{
              color: "#c0392b"
            }}
          >
            {" "}*
          </span>
        )}

      </span>

      {children}

    </label>
  );
}


/* ============================================================
   PREDICTION CARD
============================================================ */

function PredictionCard({
  icon,
  label,
  value,
  highlight
}) {

  return (

    <div
      style={{
        padding: "20px",
        borderRadius: "15px",
        background:
          highlight
            ? "#eef8f0"
            : "#f7f9f7",
        border:
          highlight
            ? "1px solid #cce1cf"
            : "1px solid #e5e9e5"
      }}
    >

      <div
        style={{
          fontSize: "27px"
        }}
      >
        {icon}
      </div>

      <small>
        {label}
      </small>

      <strong
        style={{
          display: "block",
          fontSize:
            highlight
              ? "29px"
              : "21px",
          marginTop: "6px"
        }}
      >
        {value}
      </strong>

    </div>
  );
}


/* ============================================================
   DATE FORMAT
============================================================ */

function formatDate(
  value
) {

  if (!value) {
    return "Not available";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


export default ShelfLife;