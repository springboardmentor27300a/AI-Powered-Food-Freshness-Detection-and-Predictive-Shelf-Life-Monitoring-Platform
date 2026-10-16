import { useEffect, useMemo, useState } from "react";

import "./Inventory.css";

import { apiFetch } from "./api";


function Inventory({ onBack, user }) {

  /* ============================================================
     DATA
  ============================================================ */

  const [foodItems, setFoodItems] =
    useState([]);

  const [foodBatches, setFoodBatches] =
    useState([]);


  /* ============================================================
     FORM
  ============================================================ */

  const [name, setName] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [description, setDescription] =
    useState("");


  /* ============================================================
     UI
  ============================================================ */

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("All");

  const [statusFilter, setStatusFilter] =
    useState("All");


  const [message, setMessage] =
    useState("");

  const [batchMessage, setBatchMessage] =
    useState("");


  const [loading, setLoading] =
    useState(false);

  const [batchLoading, setBatchLoading] =
    useState(false);


  const [refreshing, setRefreshing] =
    useState(false);


  /* ============================================================
     LOAD FOOD ITEMS
  ============================================================ */

  const loadFoodItems = async () => {

    try {

      const response =
        await apiFetch(
          "/inventory/food-items"
        );


      const data =
        await response.json();


      if (!response.ok) {

        setMessage(
          data?.detail ||
          "Could not load food items."
        );

        return;
      }


      setFoodItems(
        Array.isArray(data)
          ? data
          : data?.food_items || []
      );

    }

    catch (error) {

      console.error(
        "Food items error:",
        error
      );


      setMessage(
        "Unable to connect to the backend."
      );
    }
  };


  /* ============================================================
     LOAD BATCHES
  ============================================================ */

  const loadFoodBatches = async () => {

    setBatchLoading(true);

    try {

      const response =
        await apiFetch(
          "/inventory/batches"
        );


      const data =
        await response.json();


      if (!response.ok) {

        setBatchMessage(
          data?.detail ||
          "Could not load food batches."
        );

        return;
      }


      setFoodBatches(
        Array.isArray(data)
          ? data
          : data?.batches || []
      );

    }

    catch (error) {

      console.error(
        "Food batches error:",
        error
      );


      setBatchMessage(
        "Unable to load food batches."
      );

    }

    finally {

      setBatchLoading(false);

    }
  };


  /* ============================================================
     LOAD EVERYTHING
  ============================================================ */

  const loadInventory = async () => {

    setRefreshing(true);

    setMessage("");

    setBatchMessage("");


    try {

      await Promise.all([
        loadFoodItems(),
        loadFoodBatches(),
      ]);

    }

    finally {

      setRefreshing(false);

    }
  };


  useEffect(() => {

    loadInventory();

  }, []);


  /* ============================================================
     ADD FOOD ITEM
  ============================================================ */

  const handleAddFoodItem = async (event) => {

    event.preventDefault();

    setMessage("");

    setLoading(true);


    try {

      const response =
        await apiFetch(
          "/inventory/food-items",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({

              name:
                name.trim(),

              category:
                category.trim(),

              description:
                description.trim() ||
                null,

            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        setMessage(
          data?.detail ||
          "Could not add food item."
        );

        return;
      }


      setMessage(
        "Food item added successfully."
      );


      setName("");

      setCategory("");

      setDescription("");


      await loadFoodItems();

    }

    catch (error) {

      console.error(
        "Add food item error:",
        error
      );


      setMessage(
        "Unable to connect to the backend."
      );

    }

    finally {

      setLoading(false);

    }
  };


  /* ============================================================
     FOOD ITEM NAME
  ============================================================ */

  const getFoodItemName = (
    foodItemId
  ) => {

    const item =
      foodItems.find(
        (food) =>
          Number(food.id) ===
          Number(foodItemId)
      );


    return item?.name ||
      `Food Item #${foodItemId}`;
  };


  /* ============================================================
     CATEGORY ICON
  ============================================================ */

  const getFoodIcon = (
    category
  ) => {

    const value =
      String(category || "")
        .toLowerCase();


    if (
      value.includes("fruit")
    ) {
      return "🍎";
    }


    if (
      value.includes("vegetable")
    ) {
      return "🥬";
    }


    if (
      value.includes("dairy")
    ) {
      return "🥛";
    }


    if (
      value.includes("meat")
    ) {
      return "🥩";
    }


    if (
      value.includes("grain")
    ) {
      return "🌾";
    }


    if (
      value.includes("bakery")
    ) {
      return "🍞";
    }


    return "📦";
  };


  /* ============================================================
     EXPIRY STATUS
  ============================================================ */

  const getExpiryStatus = (
    expiryDate
  ) => {

    if (!expiryDate) {

      return {
        label: "No expiry date",
        className:
          "inventory-status-neutral",
      };

    }


    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );


    const expiry =
      new Date(expiryDate);

    expiry.setHours(
      0,
      0,
      0,
      0
    );


    const difference =
      expiry.getTime() -
      today.getTime();


    const days =
      Math.ceil(
        difference /
        (1000 * 60 * 60 * 24)
      );


    if (days < 0) {

      return {
        label: "Expired",
        className:
          "inventory-status-danger",
      };

    }


    if (days <= 2) {

      return {
        label:
          `${days} day${
            days === 1
              ? ""
              : "s"
          } left`,
        className:
          "inventory-status-danger",
      };

    }


    if (days <= 7) {

      return {
        label:
          `${days} days left`,
        className:
          "inventory-status-warning",
      };

    }


    return {
      label:
        `${days} days left`,
      className:
        "inventory-status-good",
    };
  };


  /* ============================================================
     FILTER OPTIONS
  ============================================================ */

  const categories =
    useMemo(() => {

      const values =
        foodItems
          .map(
            (item) =>
              item.category
          )
          .filter(Boolean);


      return [
        "All",
        ...new Set(values),
      ];

    }, [foodItems]);


  /* ============================================================
     FILTERED ITEMS
  ============================================================ */

  const filteredItems =
    useMemo(() => {

      return foodItems.filter(
        (item) => {

          const matchesSearch =
            String(
              item?.name || ""
            )
              .toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            String(
              item?.category || ""
            )
              .toLowerCase()
              .includes(
                search.toLowerCase()
              );


          const matchesCategory =
            categoryFilter ===
              "All" ||
            item?.category ===
              categoryFilter;


          return (
            matchesSearch &&
            matchesCategory
          );

        }
      );

    }, [
      foodItems,
      search,
      categoryFilter,
    ]);


  /* ============================================================
     FILTERED BATCHES
  ============================================================ */

  const filteredBatches =
    useMemo(() => {

      return foodBatches.filter(
        (batch) => {

          const foodName =
            getFoodItemName(
              batch.food_item_id
            );


          const matchesSearch =
            foodName
              .toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            String(
              batch?.batch_number ||
              ""
            )
              .toLowerCase()
              .includes(
                search.toLowerCase()
              );


          const expiry =
            getExpiryStatus(
              batch.expiry_date
            );


          let matchesStatus =
            true;


          if (
            statusFilter ===
            "Healthy"
          ) {

            matchesStatus =
              expiry.className ===
              "inventory-status-good";

          }


          if (
            statusFilter ===
            "Attention"
          ) {

            matchesStatus =
              expiry.className ===
              "inventory-status-warning";

          }


          if (
            statusFilter ===
            "Critical"
          ) {

            matchesStatus =
              expiry.className ===
              "inventory-status-danger";

          }


          return (
            matchesSearch &&
            matchesStatus
          );

        }
      );

    }, [
      foodBatches,
      foodItems,
      search,
      statusFilter,
    ]);


  /* ============================================================
     INVENTORY STATISTICS
  ============================================================ */

  const totalItems =
    foodItems.length;


  const totalBatches =
    foodBatches.length;


  const expiringSoon =
    foodBatches.filter(
      (batch) => {

        const status =
          getExpiryStatus(
            batch.expiry_date
          );

        return (
          status.className ===
          "inventory-status-warning"
        );

      }
    ).length;


  const criticalBatches =
    foodBatches.filter(
      (batch) => {

        const status =
          getExpiryStatus(
            batch.expiry_date
          );

        return (
          status.className ===
          "inventory-status-danger"
        );

      }
    ).length;


  /* ============================================================
     PERMISSION
  ============================================================ */

  const canAddFood =
    [
      "Retail Manager",
      "Warehouse Operator",
      "Administrator",
    ].includes(
      user?.role
    );


  return (
    <div className="inventory-page">


      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="inventory-topbar">

        <div>

          <button
            className="inventory-back-button"
            onClick={onBack}
          >
            ← Dashboard
          </button>

          <span className="inventory-eyebrow">
            INVENTORY MANAGEMENT
          </span>

          <h1>
            Food Inventory
          </h1>

          <p>
            Monitor food items, batches,
            stock information and expiry risk
            from one place.
          </p>

        </div>


        <div className="inventory-topbar-actions">

          <span className="inventory-role-badge">
            {user?.role || "User"}
          </span>


          <button
            className="inventory-refresh-button"
            onClick={loadInventory}
            disabled={refreshing}
          >
            {refreshing
              ? "⏳ Refreshing..."
              : "↻ Refresh"}
          </button>

        </div>

      </header>


      <main className="inventory-container">


        {/* ====================================================
            KPI CARDS
        ==================================================== */}

        <section className="inventory-kpi-grid">


          <div className="inventory-kpi-card">

            <div className="inventory-kpi-icon">
              📦
            </div>

            <div>

              <span>
                FOOD ITEMS
              </span>

              <strong>
                {totalItems}
              </strong>

              <small>
                Items in catalogue
              </small>

            </div>

          </div>


          <div className="inventory-kpi-card">

            <div className="inventory-kpi-icon">
              🏷️
            </div>

            <div>

              <span>
                ACTIVE BATCHES
              </span>

              <strong>
                {totalBatches}
              </strong>

              <small>
                Stored food batches
              </small>

            </div>

          </div>


          <div className="inventory-kpi-card inventory-kpi-warning">

            <div className="inventory-kpi-icon">
              ⏳
            </div>

            <div>

              <span>
                EXPIRING SOON
              </span>

              <strong>
                {expiringSoon}
              </strong>

              <small>
                Within 7 days
              </small>

            </div>

          </div>


          <div className="inventory-kpi-card inventory-kpi-danger">

            <div className="inventory-kpi-icon">
              ⚠️
            </div>

            <div>

              <span>
                CRITICAL
              </span>

              <strong>
                {criticalBatches}
              </strong>

              <small>
                Expired / urgent
              </small>

            </div>

          </div>

        </section>


        {/* ====================================================
            ADD FOOD ITEM
        ==================================================== */}

        {canAddFood && (

          <section className="inventory-add-card">

            <div className="inventory-section-heading">

              <div className="inventory-heading-icon">
                +
              </div>

              <div>

                <span>
                  INVENTORY CATALOGUE
                </span>

                <h2>
                  Add New Food Item
                </h2>

                <p>
                  Add a food type before creating
                  or monitoring its batches.
                </p>

              </div>

            </div>


            <form
              className="inventory-add-form"
              onSubmit={
                handleAddFoodItem
              }
            >

              <div className="inventory-field">

                <label>
                  Food Name
                </label>

                <input
                  type="text"
                  placeholder="e.g. Apple"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              <div className="inventory-field">

                <label>
                  Category
                </label>

                <input
                  type="text"
                  placeholder="e.g. Fruits"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              <div className="inventory-field inventory-field-wide">

                <label>
                  Description
                </label>

                <input
                  type="text"
                  placeholder="Optional description"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                />

              </div>


              <button
                type="submit"
                className="inventory-add-button"
                disabled={loading}
              >
                {loading
                  ? "Adding..."
                  : "+ Add Food"}
              </button>

            </form>


            {message && (

              <div className="inventory-message">
                {message}
              </div>

            )}

          </section>

        )}


        {/* ====================================================
            FILTERS
        ==================================================== */}

        <section className="inventory-filter-card">

          <div className="inventory-search">

            <span>
              🔎
            </span>

            <input
              type="text"
              placeholder="Search food or batch..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>


          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(
                event.target.value
              )
            }
          >

            {categories.map(
              (categoryOption) => (

                <option
                  key={
                    categoryOption
                  }
                  value={
                    categoryOption
                  }
                >
                  {categoryOption}
                </option>

              )
            )}

          </select>


          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >

            <option value="All">
              All Status
            </option>

            <option value="Healthy">
              Healthy
            </option>

            <option value="Attention">
              Needs Attention
            </option>

            <option value="Critical">
              Critical
            </option>

          </select>

        </section>


        {/* ====================================================
            FOOD ITEMS
        ==================================================== */}

        <section className="inventory-section">

          <div className="inventory-section-title">

            <div>

              <span>
                FOOD CATALOGUE
              </span>

              <h2>
                Food Items
              </h2>

            </div>

            <span className="inventory-count">
              {filteredItems.length}
              {" "}
              items
            </span>

          </div>


          {filteredItems.length === 0 ? (

            <div className="inventory-empty">

              <div>
                📦
              </div>

              <h3>
                No food items found
              </h3>

              <p>
                Add a food item or change
                your search filters.
              </p>

            </div>

          ) : (

            <div className="inventory-food-grid">

              {filteredItems.map(
                (item) => (

                  <article
                    className="inventory-food-card"
                    key={item.id}
                  >

                    <div className="inventory-food-icon">
                      {getFoodIcon(
                        item.category
                      )}
                    </div>


                    <div className="inventory-food-content">

                      <span className="inventory-category">
                        {item.category ||
                          "Uncategorized"}
                      </span>


                      <h3>
                        {item.name}
                      </h3>


                      <p>
                        {item.description ||
                          "No description available."}
                      </p>


                      <div className="inventory-food-footer">

                        <span>
                          ID #{item.id}
                        </span>

                        <span>
                          Active
                        </span>

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>


        {/* ====================================================
            BATCHES
        ==================================================== */}

        <section className="inventory-section">

          <div className="inventory-section-title">

            <div>

              <span>
                STORAGE & EXPIRY MONITORING
              </span>

              <h2>
                Food Batches
              </h2>

            </div>

            <span className="inventory-count">
              {filteredBatches.length}
              {" "}
              batches
            </span>

          </div>


          {batchMessage && (

            <div className="inventory-message">
              {batchMessage}
            </div>

          )}


          {batchLoading ? (

            <div className="inventory-loading">
              ⏳ Loading food batches...
            </div>

          ) : filteredBatches.length === 0 ? (

            <div className="inventory-empty">

              <div>
                🏷️
              </div>

              <h3>
                No batches found
              </h3>

              <p>
                Batch information will appear
                here when available.
              </p>

            </div>

          ) : (

            <div className="inventory-batch-list">

              {filteredBatches.map(
                (batch) => {

                  const expiry =
                    getExpiryStatus(
                      batch.expiry_date
                    );


                  return (

                    <article
                      className="inventory-batch-card"
                      key={batch.id}
                    >

                      <div className="inventory-batch-main">

                        <div className="inventory-batch-icon">
                          {getFoodIcon(
                            foodItems.find(
                              (item) =>
                                Number(item.id) ===
                                Number(
                                  batch.food_item_id
                                )
                            )?.category
                          )}
                        </div>


                        <div>

                          <span className="inventory-category">
                            {getFoodItemName(
                              batch.food_item_id
                            )}
                          </span>

                          <h3>
                            Batch #
                            {batch.batch_number ||
                              batch.id}
                          </h3>

                          <p>
                            Quantity:{" "}
                            <strong>
                              {batch.quantity ??
                                "N/A"}
                              {" "}
                              {batch.unit || ""}
                            </strong>
                          </p>

                        </div>

                      </div>


                      <div className="inventory-batch-details">

                        <div>

                          <span>
                            Storage
                          </span>

                          <strong>
                            {batch.storage_temperature !==
                            null &&
                            batch.storage_temperature !==
                            undefined
                              ? `${batch.storage_temperature}°C`
                              : "N/A"}
                          </strong>

                        </div>


                        <div>

                          <span>
                            Humidity
                          </span>

                          <strong>
                            {batch.humidity !==
                              null &&
                            batch.humidity !==
                              undefined
                              ? `${batch.humidity}%`
                              : "N/A"}
                          </strong>

                        </div>


                        <div>

                          <span>
                            Packaging
                          </span>

                          <strong>
                            {batch.packaging_type ||
                              "N/A"}
                          </strong>

                        </div>


                        <div>

                          <span>
                            Expiry
                          </span>

                          <strong>
                            {batch.expiry_date ||
                              "N/A"}
                          </strong>

                        </div>

                      </div>


                      <span
                        className={`inventory-batch-status ${expiry.className}`}
                      >
                        {expiry.label}
                      </span>

                    </article>

                  );

                }
              )}

            </div>

          )}

        </section>


        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="inventory-bottom-actions">

          <button
            onClick={onBack}
          >
            ← Back to Dashboard
          </button>

        </div>

      </main>

    </div>
  );
}


export default Inventory;