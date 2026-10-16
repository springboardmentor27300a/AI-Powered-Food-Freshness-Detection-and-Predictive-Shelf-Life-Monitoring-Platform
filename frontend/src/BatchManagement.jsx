import { useEffect, useState } from "react";
import "./BatchManagement.css";
import { apiFetch, normalizeRole } from "./api";

function BatchManagement({ onBack, user }) {

  const [foodItems, setFoodItems] = useState([]);
  const [batches, setBatches] = useState([]);

  const [foodItemId, setFoodItemId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [storageTemperature, setStorageTemperature] =
    useState("");
  const [humidity, setHumidity] = useState("");
  const [packagingType, setPackagingType] =
    useState("");
  const [purchaseDate, setPurchaseDate] =
    useState("");
  const [expiryDate, setExpiryDate] =
    useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] =
    useState(false);
  const [deletingBatchId, setDeletingBatchId] =
    useState(null);


  // ============================================================
  // USER PERMISSION
  // ============================================================

  const canManageBatches = [
    "Retail Manager",
    "Warehouse Operator",
    "Administrator"
  ].includes(normalizeRole(user?.role));


  // ============================================================
  // LOAD FOOD ITEMS
  // ============================================================

  const loadFoodItems = async () => {

    try {

      const response = await apiFetch(
        "/inventory/food-items"
      );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.detail ||
          "Could not load food items"
        );

        setMessageType("error");

        return;
      }

      setFoodItems(data);

    } catch (error) {

      console.error(
        "Food items error:",
        error
      );

      setMessage(
        "Unable to connect to backend"
      );

      setMessageType("error");
    }
  };


  // ============================================================
  // LOAD BATCHES
  // ============================================================

  const loadBatches = async () => {

    setBatchLoading(true);

    try {

      const response = await apiFetch(
        "/inventory/batches"
      );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.detail ||
          "Could not load food batches"
        );

        setMessageType("error");

        return;
      }

      setBatches(data);

    } catch (error) {

      console.error(
        "Batch loading error:",
        error
      );

      setMessage(
        "Unable to load food batches"
      );

      setMessageType("error");

    } finally {

      setBatchLoading(false);
    }
  };


  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {

    loadFoodItems();
    loadBatches();

  }, []);


  // ============================================================
  // CLEAR FORM
  // ============================================================

  const clearForm = () => {

    setFoodItemId("");
    setBatchNumber("");
    setQuantity("");
    setUnit("");
    setStorageTemperature("");
    setHumidity("");
    setPackagingType("");
    setPurchaseDate("");
    setExpiryDate("");
  };


  // ============================================================
  // ADD BATCH
  // ============================================================

  const handleAddBatch = async (e) => {

    e.preventDefault();

    setMessage("");
    setMessageType("");

    setLoading(true);

    try {

      const response = await apiFetch(
        "/inventory/batches",
        {
          method: "POST",

          body: JSON.stringify({

            food_item_id:
              Number(foodItemId),

            batch_number:
              batchNumber.trim(),

            quantity:
              Number(quantity),

            unit:
              unit.trim(),

            storage_temperature:
              storageTemperature === ""
                ? null
                : Number(
                    storageTemperature
                  ),

            humidity:
              humidity === ""
                ? null
                : Number(humidity),

            packaging_type:
              packagingType.trim() === ""
                ? null
                : packagingType.trim(),

            purchase_date:
              purchaseDate === ""
                ? null
                : purchaseDate,

            expiry_date:
              expiryDate === ""
                ? null
                : expiryDate
          })
        }
      );

      const data =
        await response.json();


      if (!response.ok) {

        setMessage(
          data.detail ||
          "Could not create batch"
        );

        setMessageType("error");

        return;
      }


      setMessage(
        "Food batch added successfully!"
      );

      setMessageType("success");


      clearForm();


      await loadBatches();

    } catch (error) {

      console.error(
        "Add batch error:",
        error
      );

      setMessage(
        "Unable to connect to backend"
      );

      setMessageType("error");

    } finally {

      setLoading(false);
    }
  };


  // ============================================================
  // DELETE BATCH
  // ============================================================

  const handleDeleteBatch = async (
    batchId,
    batchNumber
  ) => {

    const confirmed =
      window.confirm(
        `Are you sure you want to delete batch "${batchNumber}"?`
      );

    if (!confirmed) {
      return;
    }


    setDeletingBatchId(batchId);

    setMessage("");
    setMessageType("");


    try {

      const response =
        await apiFetch(
          `/inventory/batches/${batchId}`,
          {
            method: "DELETE"
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        setMessage(
          data.detail ||
          "Could not delete batch"
        );

        setMessageType("error");

        return;
      }


      setMessage(
        "Food batch deleted successfully!"
      );

      setMessageType("success");


      // Remove deleted batch immediately
      setBatches((currentBatches) =>
        currentBatches.filter(
          (batch) =>
            batch.id !== batchId
        )
      );


    } catch (error) {

      console.error(
        "Delete batch error:",
        error
      );

      setMessage(
        "Unable to connect to backend"
      );

      setMessageType("error");

    } finally {

      setDeletingBatchId(null);
    }
  };


  // ============================================================
  // GET FOOD NAME
  // ============================================================

  const getFoodName = (foodItemId) => {

    const foodItem =
      foodItems.find(
        (item) =>
          item.id === foodItemId
      );

    return foodItem
      ? foodItem.name
      : `Food Item #${foodItemId}`;
  };


  // ============================================================
  // UI
  // ============================================================

  return (

    <div className="batch-page">


      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <div className="batch-topbar">

        <button
          className="back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <h1>
          Food Batch Management
        </h1>

      </div>


      <div className="batch-container">


        {/* ====================================================
            ADD BATCH
        ==================================================== */}

        {canManageBatches && (

          <div className="batch-form-card">

            <h2>
              Add Food Batch
            </h2>


            <form
              onSubmit={handleAddBatch}
            >


              {/* FOOD ITEM */}

              <label>
                Food Item
              </label>

              <select
                value={foodItemId}
                onChange={(e) =>
                  setFoodItemId(
                    e.target.value
                  )
                }
                required
              >

                <option value="">
                  Select food item
                </option>

                {foodItems.map(
                  (item) => (

                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>

                  )
                )}

              </select>


              {/* BATCH NUMBER */}

              <label>
                Batch Number
              </label>

              <input
                type="text"
                placeholder="e.g. APP-001"
                value={batchNumber}
                onChange={(e) =>
                  setBatchNumber(
                    e.target.value
                  )
                }
                required
              />


              {/* QUANTITY */}

              <label>
                Quantity
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 100"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value
                  )
                }
                required
              />


              {/* UNIT */}

              <label>
                Unit
              </label>

              <input
                type="text"
                placeholder="e.g. kg"
                value={unit}
                onChange={(e) =>
                  setUnit(
                    e.target.value
                  )
                }
                required
              />


              {/* TEMPERATURE */}

              <label>
                Storage Temperature (°C)
              </label>

              <input
                type="number"
                step="0.01"
                placeholder="e.g. 4"
                value={
                  storageTemperature
                }
                onChange={(e) =>
                  setStorageTemperature(
                    e.target.value
                  )
                }
              />


              {/* HUMIDITY */}

              <label>
                Humidity (%)
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 60"
                value={humidity}
                onChange={(e) =>
                  setHumidity(
                    e.target.value
                  )
                }
              />


              {/* PACKAGING */}

              <label>
                Packaging Type
              </label>

              <input
                type="text"
                placeholder="e.g. Plastic Tray"
                value={packagingType}
                onChange={(e) =>
                  setPackagingType(
                    e.target.value
                  )
                }
              />


              {/* PURCHASE DATE */}

              <label>
                Purchase Date
              </label>

              <input
                type="date"
                value={purchaseDate}
                onChange={(e) =>
                  setPurchaseDate(
                    e.target.value
                  )
                }
              />


              {/* EXPIRY DATE */}

              <label>
                Expiry Date
              </label>

              <input
                type="date"
                value={expiryDate}
                onChange={(e) =>
                  setExpiryDate(
                    e.target.value
                  )
                }
              />


              {/* SUBMIT */}

              <button
                type="submit"
                disabled={loading}
              >

                {loading
                  ? "Adding..."
                  : "Add Batch"}

              </button>

            </form>


            {/* MESSAGE */}

            {message && (

              <p
                className={
                  messageType === "error"
                    ? "batch-message batch-error"
                    : "batch-message batch-success"
                }
              >
                {message}
              </p>

            )}

          </div>

        )}


        {/* ====================================================
            BATCH LIST
        ==================================================== */}

        <div className="batch-list-card">


          <div className="batch-list-header">

            <h2>
              Food Batches
            </h2>

            <button
              onClick={loadBatches}
              disabled={batchLoading}
            >
              {batchLoading
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>


          {/* MESSAGE */}

          {message && (

            <p
              className={
                messageType === "error"
                  ? "batch-message batch-error"
                  : "batch-message batch-success"
              }
            >
              {message}
            </p>

          )}


          {/* NO BATCHES */}

          {batches.length === 0 ? (

            <div className="empty-batches">

              <div>
                📦
              </div>

              <p>
                No batches available yet.
              </p>

              <span>
                Add a batch using the form.
              </span>

            </div>

          ) : (


            <div className="batch-list">


              {batches.map(
                (batch) => (

                  <div
                    className="batch-card"
                    key={batch.id}
                  >


                    {/* BATCH HEADER */}

                    <div className="batch-card-header">

                      <div>

                        <h3>
                          {getFoodName(
                            batch.food_item_id
                          )}
                        </h3>

                        <span className="batch-number">
                          {batch.batch_number}
                        </span>

                      </div>


                      {/* DELETE BUTTON */}

                      {canManageBatches && (

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteBatch(
                              batch.id,
                              batch.batch_number
                            )
                          }
                          disabled={
                            deletingBatchId ===
                            batch.id
                          }
                          style={{
                            background:
                              "#dc3545",
                            color:
                              "white",
                            border: "none",
                            borderRadius:
                              "6px",
                            padding:
                              "8px 14px",
                            cursor:
                              deletingBatchId ===
                              batch.id
                                ? "not-allowed"
                                : "pointer",
                            fontWeight:
                              "600"
                          }}
                        >

                          {deletingBatchId ===
                          batch.id
                            ? "Deleting..."
                            : "🗑 Delete"}

                        </button>

                      )}

                    </div>


                    {/* BATCH DETAILS */}

                    <div className="batch-details">


                      <div>

                        <strong>
                          Quantity
                        </strong>

                        <span>
                          {batch.quantity}{" "}
                          {batch.unit}
                        </span>

                      </div>


                      <div>

                        <strong>
                          Temperature
                        </strong>

                        <span>

                          {batch.storage_temperature !==
                            null &&
                          batch.storage_temperature !==
                            undefined
                            ? `${batch.storage_temperature} °C`
                            : "Not specified"}

                        </span>

                      </div>


                      <div>

                        <strong>
                          Humidity
                        </strong>

                        <span>

                          {batch.humidity !==
                            null &&
                          batch.humidity !==
                            undefined
                            ? `${batch.humidity}%`
                            : "Not specified"}

                        </span>

                      </div>


                      <div>

                        <strong>
                          Packaging
                        </strong>

                        <span>
                          {batch.packaging_type ||
                            "Not specified"}
                        </span>

                      </div>


                      <div>

                        <strong>
                          Purchase Date
                        </strong>

                        <span>
                          {batch.purchase_date ||
                            "Not specified"}
                        </span>

                      </div>


                      <div>

                        <strong>
                          Expiry Date
                        </strong>

                        <span>
                          {batch.expiry_date ||
                            "Not specified"}
                        </span>

                      </div>


                    </div>


                  </div>

                )
              )}

            </div>

          )}

        </div>


      </div>

    </div>
  );
}

export default BatchManagement;