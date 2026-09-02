import { useState } from "react";

import {
  addFood,
  uploadFoodImage,
  predictFoodFreshness,
} from "../api";


function AddFood({ onBack, onSuccess }) {

  // ==========================================================
  // FORM STATES
  // ==========================================================

  const [foodName, setFoodName] =
    useState("");

  const [category, setCategory] =
    useState("Fruits");

  const [imageFile, setImageFile] =
    useState(null);

  const [manufacturingDate, setManufacturingDate] =
    useState("");

  const [expiryDate, setExpiryDate] =
    useState("");

  const [storageCondition, setStorageCondition] =
    useState("Refrigerator");


  // ==========================================================
  // UI STATES
  // ==========================================================

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ==========================================================
  // PREDICTION RESULT
  // ==========================================================

  const [prediction, setPrediction] =
    useState(null);


  // ==========================================================
  // IMAGE CHANGE
  // ==========================================================

  const handleImageChange = (e) => {

    const file =
      e.target.files?.[0];


    if (!file) {

      setImageFile(null);

      setPrediction(null);

      return;
    }


    // --------------------------------------------------------
    // Validate image type
    // --------------------------------------------------------

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];


    if (
      !allowedTypes.includes(
        file.type
      )
    ) {

      setError(
        "Please select a JPG, JPEG, PNG or WEBP image."
      );

      setImageFile(null);

      setPrediction(null);

      return;
    }


    // --------------------------------------------------------
    // Validate image size
    // --------------------------------------------------------

    if (
      file.size >
      10 * 1024 * 1024
    ) {

      setError(
        "Image size must be less than 10 MB."
      );

      setImageFile(null);

      setPrediction(null);

      return;
    }


    setError("");

    setImageFile(file);

    setPrediction(null);
  };


  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setPrediction(null);


    // --------------------------------------------------------
    // FOOD NAME VALIDATION
    // --------------------------------------------------------

    if (
      !foodName.trim()
    ) {

      setError(
        "Please enter a food name."
      );

      return;
    }


    // --------------------------------------------------------
    // IMAGE VALIDATION
    // --------------------------------------------------------

    if (!imageFile) {

      setError(
        "Please select a food image for AI freshness prediction."
      );

      return;
    }


    // --------------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------------

    if (
      manufacturingDate &&
      expiryDate &&
      expiryDate < manufacturingDate
    ) {

      setError(
        "Expiry date cannot be before manufacturing date."
      );

      return;
    }


    setLoading(true);


    try {

      let imagePath = null;


      // ======================================================
      // STEP 1 — UPLOAD IMAGE
      // ======================================================

      const uploadResult =
        await uploadFoodImage(
          imageFile
        );


      // ------------------------------------------------------
      // Get image path from backend
      // ------------------------------------------------------

      imagePath =
        uploadResult?.image_path ||
        uploadResult?.path ||
        uploadResult?.file_path;


      if (!imagePath) {

        throw new Error(
          "Image uploaded, but backend did not return an image path."
        );
      }


      // ======================================================
      // STEP 2 — AI PREDICTION
      // ======================================================

      const predictionResult =
        await predictFoodFreshness(
          foodName.trim(),
          imagePath
        );


      // ------------------------------------------------------
      // Validate prediction response
      // ------------------------------------------------------

      if (
        !predictionResult ||
        !predictionResult.freshness_status
      ) {

        throw new Error(
          "AI prediction did not return a freshness status."
        );
      }


      // ------------------------------------------------------
      // Show prediction on screen
      // ------------------------------------------------------

      setPrediction(
        predictionResult
      );


      // ======================================================
      // STEP 3 — SAVE FOOD WITH AI RESULT
      // ======================================================

      await addFood(

        foodName.trim(),

        category,

        imagePath,

        manufacturingDate ||
          null,

        expiryDate ||
          null,

        storageCondition,

        // IMPORTANT:
        // Save AI prediction result
        // into database.

        predictionResult.freshness_status,

        predictionResult.freshness_score ??
          null

      );


      // ======================================================
      // STEP 4 — SUCCESS
      // ======================================================

      onSuccess();

    }

    catch (err) {

      console.error(
        "Add food error:",
        err
      );


      setError(
        err?.message ||
        "Failed to add food item."
      );

    }

    finally {

      setLoading(false);

    }

  };


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="form-page">


      {/* =====================================================
          FLOATING FOOD DECORATIONS
      ====================================================== */}

      <div className="floating-food food-one">
        🍎
      </div>


      <div className="floating-food food-two">
        🥕
      </div>


      <div className="floating-food food-three">
        🥦
      </div>


      {/* =====================================================
          HEADER
      ====================================================== */}

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
              Add Food
            </span>

          </div>

        </div>

      </header>


      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="form-page-main">


        {/* BACK BUTTON */}

        <button
          className="back-button"
          onClick={onBack}
          type="button"
          disabled={loading}
        >
          ← Back to Dashboard
        </button>


        {/* ===================================================
            CONTENT CARD
        ==================================================== */}

        <div className="content-card">


          <div className="form-card-decoration">
            🍎
          </div>


          {/* =================================================
              TITLE
          ================================================== */}

          <div className="section-title">

            <span className="mini-label">
              FOOD INVENTORY
            </span>


            <h1>
              Add Food Item
            </h1>


            <p>
              Add a food item to your personal
              freshness monitoring inventory.
            </p>

          </div>


          {/* =================================================
              ERROR
          ================================================== */}

          {error && (

            <div className="error-box">

              ⚠️ {error}

            </div>

          )}


          {/* =================================================
              PREDICTION RESULT
          ================================================== */}

          {prediction && (

            <div className="prediction-result">

              <strong>
                AI Freshness Result
              </strong>


              <div>
                Freshness:{" "}

                <b>
                  {prediction.freshness_status}
                </b>
              </div>


              <div>
                Freshness Score:{" "}

                <b>
                  {prediction.freshness_score}/100
                </b>
              </div>


              <div>
                Confidence:{" "}

                <b>
                  {prediction.confidence}%
                </b>
              </div>

            </div>

          )}


          {/* =================================================
              FORM
          ================================================== */}

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >


            {/* =================================================
                FOOD NAME
            ================================================== */}

            <div className="form-group">

              <label>
                Food Name
              </label>


              <input
                type="text"
                placeholder="e.g. Apple"
                value={foodName}
                onChange={(e) =>
                  setFoodName(
                    e.target.value
                  )
                }
                required
                disabled={loading}
              />

            </div>


            {/* =================================================
                CATEGORY
            ================================================== */}

            <div className="form-group">

              <label>
                Category
              </label>


              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
                disabled={loading}
              >

                <option>
                  Fruits
                </option>

                <option>
                  Vegetables
                </option>

                <option>
                  Dairy Products
                </option>

                <option>
                  Meat & Poultry
                </option>

                <option>
                  Seafood
                </option>

                <option>
                  Bakery Products
                </option>

                <option>
                  Packaged Foods
                </option>

                <option>
                  Beverages
                </option>

                <option>
                  Other
                </option>

              </select>

            </div>


            {/* =================================================
                FOOD IMAGE
            ================================================== */}

            <div className="form-group">

              <label>
                Food Image
              </label>


              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                disabled={loading}
              />


              {imageFile && (

                <small>
                  Selected:{" "}
                  {imageFile.name}
                </small>

              )}

            </div>


            {/* =================================================
                MANUFACTURING DATE
            ================================================== */}

            <div className="form-group">

              <label>
                Manufacturing Date
              </label>


              <input
                type="date"
                value={
                  manufacturingDate
                }
                onChange={(e) =>
                  setManufacturingDate(
                    e.target.value
                  )
                }
                disabled={loading}
              />

            </div>


            {/* =================================================
                EXPIRY DATE
            ================================================== */}

            <div className="form-group">

              <label>
                Expiry Date
              </label>


              <input
                type="date"
                value={
                  expiryDate
                }
                min={
                  manufacturingDate ||
                  undefined
                }
                onChange={(e) =>
                  setExpiryDate(
                    e.target.value
                  )
                }
                disabled={loading}
              />

            </div>


            {/* =================================================
                STORAGE CONDITION
            ================================================== */}

            <div className="form-group">

              <label>
                Storage Condition
              </label>


              <select
                value={
                  storageCondition
                }
                onChange={(e) =>
                  setStorageCondition(
                    e.target.value
                  )
                }
                disabled={loading}
              >

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


            {/* =================================================
                SUBMIT
            ================================================== */}

            <button
              className="primary-button"
              disabled={loading}
              type="submit"
            >

              {loading
                ? "Analyzing Food..."
                : "Add Food to Inventory →"}

            </button>


          </form>

        </div>

      </main>

    </div>

  );

}


export default AddFood;