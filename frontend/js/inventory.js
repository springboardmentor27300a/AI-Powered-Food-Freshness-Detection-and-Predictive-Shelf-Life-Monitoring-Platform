/**
 * Food Freshness Monitoring Platform - Inventory Management Controller
 * Handles CRUD operations, filtering, search, sorting, image upload, and modals.
 */

let currentEditItemId = null;
let searchDebounceTimer = null;

function bootInventory() {
  if (!api.requireAuth()) return;

  // 1. Inventory Listing Page Initializer
  if (document.getElementById("inventory-table-body")) {
    initInventoryTable();
  }

  // 2. Add Food Page Initializer
  if (document.getElementById("add-food-form")) {
    initAddFoodForm();
  }

  // 3. Food Details Page Initializer
  if (document.getElementById("food-details-container") || document.getElementById("detail-food-name")) {
    initFoodDetails();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootInventory);
} else {
  bootInventory();
}

/* ==========================================================================
   1. Inventory Table & Search / Filter Controller
   ========================================================================== */
function initInventoryTable() {
  loadInventory();

  // Search input with debounce
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadInventory();
      }, 300);
    });
  }

  // Filter dropdowns
  const categoryFilter = document.getElementById("category-filter");
  const expiryFilter = document.getElementById("expiry-filter");
  const storageFilter = document.getElementById("storage-filter");
  const sortFilter = document.getElementById("sort-filter");

  [categoryFilter, expiryFilter, storageFilter, sortFilter].forEach((select) => {
    if (select) {
      select.addEventListener("change", () => loadInventory());
    }
  });

  // Setup Edit Modal submission
  const editForm = document.getElementById("edit-food-form");
  if (editForm) {
    editForm.addEventListener("submit", handleEditFormSubmit);
  }
}

let isInventoryLoading = false;

function normalizeInventoryResponse(response) {
  // Support the common response formats used by FastAPI and API wrappers:
  // [ ... ], { items: [...] }, { data: [...] }, { inventory: [...] }, etc.
  let value = response;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(value)) {
      return value
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          ...item,
          id: item.id ?? item._id ?? item.inventory_id ?? item.item_id,
          food_name: item.food_name ?? item.name ?? item.foodName ?? "Food Item",
          category: item.category ?? item.food_category ?? "Other",
          quantity: item.quantity ?? item.amount ?? 0,
          unit: item.unit ?? item.quantity_unit ?? "kg",
          purchase_date: item.purchase_date ?? item.purchaseDate ?? null,
          expiry_date: item.expiry_date ?? item.expiration_date ?? item.expiryDate ?? null,
          storage_type: item.storage_type ?? item.storageType ?? "Room Temperature",
          freshness_status: item.freshness_status ?? item.status ?? item.freshness_label ?? "",
          freshness_score: item.freshness_score ?? item.freshnessScore ?? item.visual_score ?? null,
          image_url: item.image_url ?? item.imageUrl ?? null,
        }));
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    const possibleArrays = [
      value.items,
      value.inventory,
      value.results,
      value.foods,
      value.records,
      value.data,
    ];

    const next = possibleArrays.find(
      (candidate) => Array.isArray(candidate) ||
        (candidate && typeof candidate === "object")
    );

    if (next === undefined) {
      return [];
    }

    value = next;
  }

  return [];
}

async function loadInventory() {
  const tableBody = document.getElementById("inventory-table-body");
  const totalCountEl = document.getElementById("inventory-total-count");
  if (!tableBody) return;

  isInventoryLoading = true;
  if (totalCountEl) totalCountEl.textContent = "Loading items...";

  tableBody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center; padding: 48px 20px;">
        <span class="spinner" style="display:inline-block; border-color:#0d9488; border-top-color:transparent; width:28px; height:28px; border-width:3px;"></span>
        <div style="margin-top:12px; color:var(--text-muted); font-size:14px; font-weight:500;">Fetching food inventory from database...</div>
      </td>
    </tr>
  `;

  const searchValue = document.getElementById("search-input")?.value?.trim() || "";
  const categoryValue = document.getElementById("category-filter")?.value || "";
  const expiryValue = document.getElementById("expiry-filter")?.value || "";
  const storageValue = document.getElementById("storage-filter")?.value || "";
  const sortByVal = document.getElementById("sort-filter")?.value || "expiry_date_asc";

  let sort_by = "expiry_date";
  let sort_order = "asc";
  if (sortByVal.endsWith("_desc")) {
    sort_by = sortByVal.replace(/_desc$/, "");
    sort_order = "desc";
  } else if (sortByVal.endsWith("_asc")) {
    sort_by = sortByVal.replace(/_asc$/, "");
    sort_order = "asc";
  } else if (sortByVal) {
    sort_by = sortByVal;
  }

  // Do not send placeholder filter values such as "all" to the API.
  const isRealFilter = (value) =>
    value && !["all", "any", "none", "all_categories", "all_statuses", "all_storage"].includes(
      String(value).trim().toLowerCase()
    );

  const params = {
    sort_by,
    sort_order,
  };
  if (searchValue) params.search = searchValue;
  if (isRealFilter(categoryValue)) params.category = categoryValue;
  if (isRealFilter(expiryValue)) params.expiry_status = expiryValue;
  if (isRealFilter(storageValue)) params.storage_type = storageValue;

  try {
    const rawData = await api.getInventory(params);
    let items = normalizeInventoryResponse(rawData);

    // If no filters are active and the API wrapper returned an unfamiliar
    // empty shape, make one unfiltered request before showing an empty state.
    if (
      items.length === 0 &&
      !searchValue &&
      !isRealFilter(categoryValue) &&
      !isRealFilter(expiryValue) &&
      !isRealFilter(storageValue)
    ) {
      console.warn("[Inventory] No items extracted from the first response. Retrying with default parameters.", rawData);
      const fallbackData = await api.getInventory({});
      items = normalizeInventoryResponse(fallbackData);
    }

    console.log(`[Inventory] Loaded ${items.length} item(s).`, items);
    renderInventoryTable(items);
  } catch (error) {
    console.error("[Inventory] Error retrieving food inventory:", error);
    if (totalCountEl) totalCountEl.textContent = "Failed to load inventory";

    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 40px 20px; color:var(--text-main);">
          <div style="font-size:36px; margin-bottom:12px;">⚠️</div>
          <div style="font-weight:700; color:#ef4444; font-size:17px; margin-bottom:8px;">Unable to Connect to Food Inventory</div>
          <div style="color:var(--text-muted); font-size:14px; max-width:500px; margin:0 auto 18px auto; line-height:1.5;">
            ${escapeHtml(error.message || "Failed to reach backend server or MongoDB service. Please verify your connection.")}
          </div>
          <div style="display:flex; gap:10px; justify-content:center; align-items:center;">
            <button type="button" class="btn btn-primary btn-sm" onclick="loadInventory()">
              🔄 Retry Loading
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="seedDatasetItems()">
              🌱 Load Dataset Items
            </button>
          </div>
        </td>
      </tr>
    `;
    showToast("Error loading inventory: " + (error.message || "Failed to fetch items"), "error");
  } finally {
    isInventoryLoading = false;
  }
}
function renderInventoryTable(items) {
  const tableBody = document.getElementById("inventory-table-body");
  const totalCountEl = document.getElementById("inventory-total-count");
  if (!tableBody) return;

  const count = (items || []).length;
  if (totalCountEl) {
    totalCountEl.textContent = count === 0
      ? "0 active food items"
      : `${count} active food ${count === 1 ? "item" : "items"}`;
  }

  // Update badge for Action Card & Sidebar if present
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertCount = (items || []).filter((item) => {
      if (!item.expiry_date) return false;
      const exp = new Date(item.expiry_date);
      const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      const statusLower = (item.freshness_status || "").toLowerCase();
      return diff <= 3 || statusLower === "spoiled";
    }).length;

    const actionBadge = document.getElementById("action-alerts-badge");
    if (actionBadge) {
      actionBadge.textContent = `${alertCount} ALERTS`;
      if (alertCount > 0) {
        actionBadge.style.background = "#fee2e2";
        actionBadge.style.color = "#dc2626";
      } else {
        actionBadge.style.background = "#dcfce7";
        actionBadge.style.color = "#166534";
      }
    }

    const sidebarBadge = document.getElementById("sidebar-alerts-badge");
    if (sidebarBadge) {
      sidebarBadge.textContent = alertCount;
      sidebarBadge.style.display = alertCount > 0 ? "inline-block" : "none";
    }
  } catch (e) {
    console.error("Error updating inventory alert badges:", e);
  }

  if (!items || items.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state" style="padding: 48px 20px; text-align: center;">
          <div class="empty-icon" style="font-size: 42px; margin-bottom: 10px;">📦</div>
          <div class="empty-title" style="font-size: 19px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Food Inventory is Empty</div>
          <div class="empty-subtitle" style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.5;">
            No food items found matching your criteria. Populate sample produce directly from our AI freshness datasets or add custom food items.
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-seed-empty" onclick="seedDatasetItems()">
              🌱 Load Dataset Items
            </button>
            <a href="add-food.html" class="btn btn-secondary btn-sm">+ Add Food Item</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tableBody.innerHTML = items
    .map((item) => {
      const foodName = item.food_name || item.name || "Food Item";
      const category = item.category || "Other";
      const quantity = item.quantity ?? 0;
      const unit = item.unit || "kg";
      const purchaseDate = item.purchase_date || "—";
      const expiryDate = item.expiry_date || "—";
      const storageType = item.storage_type || "Room Temperature";

      // Expiry calculation
      let expiryBadge = `<span class="badge badge-fresh">${escapeHtml(expiryDate)}</span>`;
      if (item.expiry_date) {
        const exp = new Date(item.expiry_date);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          expiryBadge = `<span class="badge badge-danger">${escapeHtml(expiryDate)} (Expired)</span>`;
        } else if (diffDays === 0) {
          expiryBadge = `<span class="badge badge-danger">${escapeHtml(expiryDate)} (Expires Today)</span>`;
        } else if (diffDays <= 3) {
          expiryBadge = `<span class="badge badge-warning">${escapeHtml(expiryDate)} (${diffDays}d left)</span>`;
        } else {
          expiryBadge = `<span class="badge badge-fresh">${escapeHtml(expiryDate)} (${diffDays}d left)</span>`;
        }
      }

      // Freshness Status badge
      const statusLower = (item.freshness_status || "").toLowerCase().trim();
      let statusBadge = `<span class="badge badge-pending">Not Analyzed</span>`;
      if (statusLower === "fresh" || statusLower === "good" || statusLower === "acceptable") {
        statusBadge = `<span class="badge badge-fresh">${escapeHtml(item.freshness_status)}</span>`;
      } else if (statusLower === "spoiled") {
        statusBadge = `<span class="badge badge-danger">Spoiled</span>`;
      } else if (statusLower.includes("soon") || statusLower.includes("near")) {
        statusBadge = `<span class="badge badge-warning">Expiring Soon</span>`;
      }

      const scoreHtml = item.freshness_score != null
        ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Score: ${Math.round(item.freshness_score)}%</div>`
        : "";

      return `
      <tr>
        <td>
          <div class="food-cell">
            <div class="food-avatar">
              ${item.image_url ? `<img src="${item.image_url}" alt="${escapeHtml(foodName)}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">` : getCategoryEmoji(category)}
            </div>
            <div>
              <div class="food-title">${escapeHtml(foodName)}</div>
              <div class="food-batch">${escapeHtml(item.batch_number ? `Batch: ${item.batch_number}` : (item.location || 'Main Storage'))}</div>
            </div>
          </div>
        </td>
        <td><span class="badge" style="background:#f1f5f9;color:#334155;">${escapeHtml(category)}</span></td>
        <td><strong>${quantity}</strong> ${escapeHtml(unit)}</td>
        <td><small class="text-muted">${escapeHtml(purchaseDate)}</small></td>
        <td>${expiryBadge}</td>
        <td><small>${escapeHtml(storageType)}</small></td>
        <td>
          ${statusBadge}
          ${scoreHtml}
        </td>
        <td>
          <div class="actions-cell">
            <a href="food-details.html?id=${item.id}" class="btn btn-secondary btn-sm" title="Inspect Details">
              View
            </a>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${item.id}')" title="Edit Item">
                      Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteItem('${item.id}', '${escapeHtml(foodName)}')" title="Delete Item">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

/* ==========================================================================
   2. Add Food Form Controller
   ========================================================================== */
function initAddFoodForm() {
  const form = document.getElementById("add-food-form");
  if (!form) return;

  // Set default purchase date to today and expiry to today + 7 days
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const pDateInput = document.getElementById("purchase_date");
  const eDateInput = document.getElementById("expiry_date");

  if (pDateInput && !pDateInput.value) pDateInput.value = todayStr;
  if (eDateInput && !eDateInput.value) eDateInput.value = nextWeekStr;

  // Image upload preview & Mode Toggles
  setupImagePreview("food_image", "image-preview-container", "image-preview-img");

  let addImageMode = "device";
  const btnModeDevice = document.getElementById("btn-add-mode-device");
  const btnModeUrl = document.getElementById("btn-add-mode-url");
  const wrapModeDevice = document.getElementById("add-mode-device-wrap");
  const wrapModeUrl = document.getElementById("add-mode-url-wrap");
  const previewImg = document.getElementById("image-preview-img");
  const previewBox = document.getElementById("image-preview-container");
  const urlInput = document.getElementById("food_image_url");
  const btnPreviewUrl = document.getElementById("btn-preview-url");

  btnModeDevice?.addEventListener("click", () => {
    addImageMode = "device";
    btnModeDevice.style.background = "var(--primary)";
    btnModeDevice.style.color = "white";
    btnModeDevice.classList.remove("btn-outline");
    btnModeUrl.style.background = "transparent";
    btnModeUrl.style.color = "var(--text-main)";
    btnModeUrl.classList.add("btn-outline");
    if (wrapModeDevice) wrapModeDevice.style.display = "block";
    if (wrapModeUrl) wrapModeUrl.style.display = "none";
  });

  btnModeUrl?.addEventListener("click", () => {
    addImageMode = "url";
    btnModeUrl.style.background = "var(--primary)";
    btnModeUrl.style.color = "white";
    btnModeUrl.classList.remove("btn-outline");
    btnModeDevice.style.background = "transparent";
    btnModeDevice.style.color = "var(--text-main)";
    btnModeDevice.classList.add("btn-outline");
    if (wrapModeDevice) wrapModeDevice.style.display = "none";
    if (wrapModeUrl) wrapModeUrl.style.display = "block";
  });

  btnPreviewUrl?.addEventListener("click", () => {
    const url = urlInput?.value.trim();
    if (!url) {
      showToast("Please enter an image URL first.", "error");
      return;
    }
    if (previewImg && previewBox) {
      previewImg.onload = () => {
        previewBox.style.display = "block";
        showToast("Image loaded from address successfully.", "info");
      };
      previewImg.onerror = () => {
        previewBox.style.display = "none";
        showToast("Could not load image from that address. Check URL validity.", "error");
      };
      previewImg.src = url;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("submit-food-btn");
    const foodName = document.getElementById("food_name").value.trim();
    const category = document.getElementById("category").value;
    const quantity = parseFloat(document.getElementById("quantity").value);
    const unit = document.getElementById("unit").value.trim();
    const purchaseDate = document.getElementById("purchase_date").value;
    const expiryDate = document.getElementById("expiry_date").value;
    const storageType = document.getElementById("storage_type").value;
    const storageTemp = document.getElementById("storage_temperature").value;
    const storageHum = document.getElementById("storage_humidity").value;
    const location = document.getElementById("location").value.trim();
    const batchNumber = document.getElementById("batch_number").value.trim();
    const imageFileInput = document.getElementById("food_image");

    // Client-side validations
    if (!foodName) {
      showToast("Please enter a valid food name.", "error");
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      showToast("Quantity must be a positive number.", "error");
      return;
    }

    if (new Date(expiryDate) < new Date(purchaseDate)) {
      showToast("Expiry date cannot be earlier than purchase date.", "error");
      return;
    }

    setButtonLoading(submitBtn, true, "Adding Food Item...");

    try {
      let imageUrl = null;

      if (addImageMode === "url" && urlInput && urlInput.value.trim()) {
        imageUrl = urlInput.value.trim();
      } else if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
        try {
          const uploadRes = await api.uploadImage(imageFileInput.files[0]);
          imageUrl = uploadRes.image_url;
        } catch (uploadErr) {
          console.warn("Image upload failed, continuing with record creation:", uploadErr);
          showToast("Image upload failed: " + uploadErr.message, "warning");
        }
      } else if (urlInput && urlInput.value.trim()) {
        imageUrl = urlInput.value.trim();
      }

      const payload = {
        food_name: foodName,
        category,
        quantity,
        unit: unit || "kg",
        purchase_date: purchaseDate,
        expiry_date: expiryDate,
        storage_type: storageType,
        storage_temperature: storageTemp ? parseFloat(storageTemp) : null,
        storage_humidity: storageHum ? parseFloat(storageHum) : null,
        location: location || "Main Storage",
        batch_number: batchNumber || null,
        image_url: imageUrl,
      };

      await api.createInventoryItem(payload);
      showToast(`Food item "${foodName}" added successfully!`, "success");

      setTimeout(() => {
        window.location.href = "inventory.html";
      }, 700);
    } catch (err) {
      setButtonLoading(submitBtn, false, "Save Food Item");
      showToast("Failed to save food: " + err.message, "error");
    }
  });
}

/* ==========================================================================
   3. Food Details Inspector Controller
   ========================================================================== */
async function initFoodDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get("id");

  if (!itemId) {
    showToast("No food item ID specified in URL.", "error");
    window.location.href = "inventory.html";
    return;
    }

  try {
    const item = await api.getInventoryItem(itemId);
    renderFoodDetails(item);
  } catch (error) {
    console.error("Failed to load food details:", error);
    showToast("Error loading food details: " + error.message, "error");
  }
}

function renderFoodDetails(item) {
  document.getElementById("detail-food-name").textContent = item.food_name;
  document.getElementById("detail-category").textContent = item.category;
  document.getElementById("detail-quantity").textContent = `${item.quantity} ${item.unit}`;
  document.getElementById("detail-purchase-date").textContent = item.purchase_date;
  document.getElementById("detail-expiry-date").textContent = item.expiry_date;
  document.getElementById("detail-storage-type").textContent = item.storage_type;
  document.getElementById("detail-temperature").textContent = item.storage_temperature !== null ? `${item.storage_temperature} °C` : "Not specified";
  document.getElementById("detail-humidity").textContent = item.storage_humidity !== null ? `${item.storage_humidity} %` : "Not specified";
  document.getElementById("detail-location").textContent = item.location || "Main Storage";
  document.getElementById("detail-batch").textContent = item.batch_number || "None";
  document.getElementById("detail-freshness-status").textContent = item.freshness_status || "Not Analyzed";

  // Load and display live AI Shelf-Life & Spoilage predictions
  loadItemPredictions(item);

  // Setup Delete button
  const delBtn = document.getElementById("btn-delete-detail");
  if (delBtn) {
    delBtn.onclick = () => confirmDeleteItem(item.id, item.food_name, true);
  }

  // Setup Edit button
  const editBtn = document.getElementById("btn-edit-detail");
  if (editBtn) {
    editBtn.onclick = () => openEditModal(item.id);
  }

  // Setup Live AI Diagnostic Trigger Button
  const diagBtn = document.getElementById("btn-trigger-ai");
  if (diagBtn) {
    diagBtn.onclick = () => runLiveAIDiagnostic(item.id, diagBtn);
  }
}

async function loadItemPredictions(item) {
  try {
    // 1. Fetch live shelf life prediction
    const shelfRes = await api.request("/shelf-life/predict", {
      method: "POST",
      body: JSON.stringify({ inventory_id: item.id }),
    });

    let baselineDays = 5.0;
    let baseTemp = item.storage_temperature !== null && item.storage_temperature !== undefined ? item.storage_temperature : 4.0;

    if (shelfRes && shelfRes.prediction) {
      const p = shelfRes.prediction;
      baselineDays = p.predicted_remaining_days || 5.0;
      const shelfEl = document.getElementById("detail-shelf-life");
      if (shelfEl) shelfEl.textContent = `${baselineDays} days (${p.storage_stress_level} Stress)`;
    }

    // Initialize Interactive Storage Slider
    const simSlider = document.getElementById("detail-sim-slider");
    const simValTag = document.getElementById("detail-sim-temp-val");
    const simImpact = document.getElementById("detail-sim-impact-text");

    if (simSlider && simValTag && simImpact) {
      simSlider.value = baseTemp;
      simValTag.textContent = `${baseTemp.toFixed(1)}°C`;
      simImpact.textContent = `${baselineDays.toFixed(1)} days (Current)`;

      simSlider.oninput = () => {
        const newTemp = parseFloat(simSlider.value);
        simValTag.textContent = `${newTemp.toFixed(1)}°C`;

        // Arrhenius calculation: Q10 ~ 2.3
        const delta = newTemp - baseTemp;
        const kineticFactor = Math.pow(2.3, delta / 10);
        const adjustedDays = Math.max(0.1, baselineDays / kineticFactor);

        const shelfEl = document.getElementById("detail-shelf-life");
        if (shelfEl) {
          shelfEl.textContent = `${adjustedDays.toFixed(1)} days (${newTemp > baseTemp + 5 ? "High Thermal Stress" : newTemp < baseTemp ? "Cold Preserved" : "Normal"})`;
        }

        if (adjustedDays < baselineDays * 0.5) {
          simImpact.textContent = `${adjustedDays.toFixed(1)} days (${(baselineDays - adjustedDays).toFixed(1)}d loss! ⚠️)`;
          simImpact.style.color = "#ef4444";
        } else if (adjustedDays > baselineDays * 1.2) {
          simImpact.textContent = `${adjustedDays.toFixed(1)} days (+${(adjustedDays - baselineDays).toFixed(1)}d extended! ❄️)`;
          simImpact.style.color = "#10b981";
        } else {
          simImpact.textContent = `${adjustedDays.toFixed(1)} days`;
          simImpact.style.color = "var(--primary)";
        }
      };
    }

    // 2. Fetch spoilage detection
    const spoilRes = await api.request("/spoilage/detect", {
      method: "POST",
      body: JSON.stringify({ inventory_id: item.id }),
    });

    if (spoilRes) {
      const spoilEl = document.getElementById("detail-spoilage-risk");
      if (spoilEl) {
        spoilEl.textContent = `${Math.round(spoilRes.spoilage_probability * 100)}% (${spoilRes.spoilage_risk_level} Risk)`;
      }
    }

    // 3. Fetch prescriptive recommendations
    const recRes = await api.request(`/recommendations/${item.id}`);
    if (recRes && recRes.recommendations) {
      renderRecommendationsBox(recRes.recommendations);
    }
  } catch (err) {
    console.warn("Could not load dynamic predictions:", err);
  }
}

function renderRecommendationsBox(recs) {
  const container = document.getElementById("detail-recommendations-box");
  if (!container) return;

  const storageTxt = recs.storage_recommendations?.[0] || "Maintain current temperature.";
  const consumptionTxt = recs.consumption_recommendations?.[0] || "Safe for standard meal prep.";
  const fefoTxt = recs.rotation_recommendations?.[0] || "Standard FIFO/FEFO rotation.";

  container.innerHTML = `
    <div style="font-size:13px; margin-top:14px; padding:12px; background:#f0fdfa; border-radius:var(--radius-md); border-left:4px solid var(--primary);">
      <div style="font-weight:700; color:var(--primary); margin-bottom:4px;">Prescriptive Recommendations:</div>
      <div style="margin-bottom:4px;"><strong>Storage:</strong> ${escapeHtml(storageTxt)}</div>
      <div style="margin-bottom:4px;"><strong>Consumption:</strong> ${escapeHtml(consumptionTxt)}</div>
      <div><strong>FEFO Action:</strong> ${escapeHtml(fefoTxt)} (Rank: ${escapeHtml(recs.fefo_priority)})</div>
    </div>
  `;
}

async function runLiveAIDiagnostic(itemId, btn) {
  setButtonLoading(btn, true, "Running Vision AI...");

  try {
    const res = await api.request("/freshness/analyze", {
      method: "POST",
      body: JSON.stringify({ inventory_id: itemId }),
    });

    showToast(`AI Inspection Complete: ${res.analysis.freshness_label} (${res.analysis.visual_score}%)`, "success");
    await initFoodDetails();
  } catch (err) {
    showToast("AI Diagnostic Failed: " + err.message, "error");
  } finally {
    setButtonLoading(btn, false, "Run Live AI Diagnostic");
  }
}

/* ==========================================================================
   4. Edit Modal & Delete Helpers
   ========================================================================== */
async function openEditModal(itemId) {
  currentEditItemId = itemId;
  const modal = document.getElementById("edit-modal");
  if (!modal) return;

  try {
    const item = await api.getInventoryItem(itemId);

    document.getElementById("edit-food_name").value = item.food_name;
    document.getElementById("edit-category").value = item.category;
    document.getElementById("edit-quantity").value = item.quantity;
    document.getElementById("edit-unit").value = item.unit;
    document.getElementById("edit-purchase_date").value = item.purchase_date;
    document.getElementById("edit-expiry_date").value = item.expiry_date;
    document.getElementById("edit-storage_type").value = item.storage_type;
    document.getElementById("edit-storage_temperature").value = item.storage_temperature ?? "";
    document.getElementById("edit-storage_humidity").value = item.storage_humidity ?? "";
    document.getElementById("edit-location").value = item.location || "";
    document.getElementById("edit-batch_number").value = item.batch_number || "";

    modal.classList.add("active");
  } catch (err) {
    showToast("Could not load item details for editing: " + err.message, "error");
  }
}

function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  if (modal) modal.classList.remove("active");
  currentEditItemId = null;
}

async function handleEditFormSubmit(e) {
  e.preventDefault();
  if (!currentEditItemId) return;

  const submitBtn = document.getElementById("edit-submit-btn");
  setButtonLoading(submitBtn, true, "Saving...");

  try {
    const payload = {
      food_name: document.getElementById("edit-food_name").value.trim(),
      category: document.getElementById("edit-category").value,
      quantity: parseFloat(document.getElementById("edit-quantity").value),
      unit: document.getElementById("edit-unit").value.trim(),
      purchase_date: document.getElementById("edit-purchase_date").value,
      expiry_date: document.getElementById("edit-expiry_date").value,
      storage_type: document.getElementById("edit-storage_type").value,
      storage_temperature: document.getElementById("edit-storage_temperature").value ? parseFloat(document.getElementById("edit-storage_temperature").value) : null,
      storage_humidity: document.getElementById("edit-storage_humidity").value ? parseFloat(document.getElementById("edit-storage_humidity").value) : null,
      location: document.getElementById("edit-location").value.trim(),
      batch_number: document.getElementById("edit-batch_number").value.trim(),
    };

    await api.updateInventoryItem(currentEditItemId, payload);
    showToast("Food item updated successfully!", "success");
    closeEditModal();

    // If on inventory list, refresh table. If on details page, refresh details.
    if (document.getElementById("inventory-table-body")) {
      loadInventory();
    } else if (document.getElementById("detail-food-name")) {
      initFoodDetails();
    }
  } catch (err) {
    showToast("Failed to update item: " + err.message, "error");
  } finally {
    setButtonLoading(submitBtn, false, "Save Changes");
  }
}

async function confirmDeleteItem(itemId, foodName, redirectAfter = false) {
  const confirmed = confirm(`Are you sure you want to delete "${foodName}" from inventory? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    await api.deleteInventoryItem(itemId);
    showToast(`"${foodName}" was deleted successfully.`, "success");

    if (redirectAfter) {
      setTimeout(() => {
        window.location.href = "inventory.html";
      }, 500);
    } else {
      loadInventory();
    }
  } catch (err) {
    showToast("Delete failed: " + err.message, "error");
  }
}

function setupImagePreview(fileInputId, previewContainerId, previewImgId) {
  const fileInput = document.getElementById(fileInputId);
  const container = document.getElementById(previewContainerId);
  const img = document.getElementById(previewImgId);

  if (!fileInput || !container || !img) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        container.style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      container.style.display = "none";
    }
  });
}

function getCategoryEmoji(category) {
  const emojiMap = {
    Fruits: "🍎",
    Vegetables: "🥦",
    Dairy: "🧀",
    "Dairy Products": "🧀",
    Meat: "🥩",
    "Meat & Poultry": "🥩",
    Fish: "🐟",
    Seafood: "🐟",
    Grains: "🌾",
    Bakery: "🍞",
    "Bakery Products": "🍞",
    "Packaged Food": "🥫",
    "Packaged Foods": "🥫",
    Beverages: "🧃",
    Other: "🥗",
  };
  return emojiMap[category] || "🍽️";
}

async function seedDatasetItems() {
  const btn = document.getElementById("btn-seed-dataset");
  const emptyBtn = document.getElementById("btn-seed-empty");
  try {
    if (btn) setButtonLoading(btn, true, "Loading...");
    if (emptyBtn) setButtonLoading(emptyBtn, true, "Loading...");
    const res = await api.seedDatasetInventory();
    const msg = res.message || "Loaded food items from datasets successfully!";
    showToast(msg, "success");
    await loadInventory();
  } catch (err) {
    console.error("[Inventory] Failed to seed dataset items:", err);
    showToast("Failed to load dataset items: " + (err.message || err), "error");
  } finally {
    if (btn) setButtonLoading(btn, false, "🌱 Load Dataset Items");
    if (emptyBtn) setButtonLoading(emptyBtn, false, "🌱 Load Dataset Items");
  }
}

window.loadInventory = loadInventory;
window.seedDatasetItems = seedDatasetItems;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.confirmDeleteItem = confirmDeleteItem;
window.getCategoryEmoji = getCategoryEmoji;
