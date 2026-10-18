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

async function loadInventory() {
  const tableBody = document.getElementById("inventory-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center; padding: 40px;">
        <span class="spinner" style="display:inline-block; border-color:#0d9488; border-top-color:transparent;"></span>
        <div style="margin-top:10px; color:var(--text-muted);">Fetching food inventory...</div>
      </td>
    </tr>
  `;

  const search = document.getElementById("search-input")?.value.trim();
  const category = document.getElementById("category-filter")?.value;
  const expiry_status = document.getElementById("expiry-filter")?.value;
  const storage_type = document.getElementById("storage-filter")?.value;
  const sortByVal = document.getElementById("sort-filter")?.value || "expiry_date_asc";

  const [sort_by, sort_order] = sortByVal.split("_");

  try {
    const items = await api.getInventory({
      search,
      category,
      expiry_status,
      storage_type,
      sort_by,
      sort_order: sort_order || "asc",
    });

    renderInventoryTable(items);
  } catch (error) {
    console.error("Error loading inventory:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 30px; color:#ef4444;">
          Failed to load inventory: ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
    showToast("Error loading inventory: " + error.message, "error");
  }
}

function renderInventoryTable(items) {
  const tableBody = document.getElementById("inventory-table-body");
  const totalCountEl = document.getElementById("inventory-total-count");
  if (!tableBody) return;

  if (totalCountEl) totalCountEl.textContent = `${items.length} items`;

  // Update badge for Action Card & Sidebar if present
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertCount = (items || []).filter(item => {
      if (!item.expiry_date) return false;
      const exp = new Date(item.expiry_date);
      const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      return diff <= 3 || item.freshness_status === "Spoiled";
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
        <td colspan="8" class="empty-state" style="padding: 40px 20px; text-align: center;">
          <div class="empty-icon" style="font-size: 36px; margin-bottom: 8px;">📦</div>
          <div class="empty-title" style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Food Inventory is Empty</div>
          <div class="empty-subtitle" style="font-size: 14px; color: var(--text-muted); margin-bottom: 16px;">
            Load sample produce & food items directly from our AI freshness datasets, or add custom items manually.
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="seedDatasetItems()">
              🌱 Load Dataset Items
            </button>
            <a href="add-food.html" class="btn btn-secondary btn-sm">+ Add New Food</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().split("T")[0];

  tableBody.innerHTML = items
    .map((item) => {
      // Expiry calculation
      let expiryBadge = `<span class="badge badge-fresh">${item.expiry_date}</span>`;
      if (item.expiry_date < todayStr) {
        expiryBadge = `<span class="badge badge-danger">${item.expiry_date} (Expired)</span>`;
      } else if (item.expiry_date <= in3DaysStr) {
        expiryBadge = `<span class="badge badge-warning">${item.expiry_date} (Soon)</span>`;
      }

      // Freshness Status badge
      let statusBadge = `<span class="badge badge-pending">Not Analyzed</span>`;
      if (item.freshness_status === "Fresh") {
        statusBadge = `<span class="badge badge-fresh">Fresh</span>`;
      } else if (item.freshness_status === "Spoiled") {
        statusBadge = `<span class="badge badge-danger">Spoiled</span>`;
      } else if (item.freshness_status === "Expiring Soon") {
        statusBadge = `<span class="badge badge-warning">Expiring Soon</span>`;
      }

      return `
      <tr>
        <td>
          <div class="food-cell">
            <div class="food-avatar">
              ${item.image_url ? `<img src="${item.image_url}" alt="${escapeHtml(item.food_name)}">` : getCategoryEmoji(item.category)}
            </div>
            <div>
              <div class="food-title">${escapeHtml(item.food_name)}</div>
              <div class="food-batch">${escapeHtml(item.batch_number ? `Batch: ${item.batch_number}` : (item.location || 'Storage'))}</div>
            </div>
          </div>
        </td>
        <td><span class="badge" style="background:#f1f5f9;color:#334155;">${escapeHtml(item.category)}</span></td>
        <td><strong>${item.quantity}</strong> ${escapeHtml(item.unit)}</td>
        <td><small class="text-muted">${escapeHtml(item.purchase_date)}</small></td>
        <td>${expiryBadge}</td>
        <td><small>${escapeHtml(item.storage_type)}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div class="actions-cell">
            <a href="food-details.html?id=${item.id}" class="btn btn-secondary btn-sm" title="Inspect Details">
              View
            </a>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${item.id}')" title="Edit Item">
              Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteItem('${item.id}', '${escapeHtml(item.food_name)}')" title="Delete Item">
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
  try {
    if (btn) setButtonLoading(btn, true, "Loading...");
    const res = await api.seedDatasetInventory();
    showToast(res.message || "Loaded food items from datasets successfully!", "success");
    await loadInventory();
  } catch (err) {
    showToast("Failed to load dataset items: " + (err.message || err), "error");
  } finally {
    if (btn) setButtonLoading(btn, false, "🌱 Load Dataset Items");
  }
}

window.getCategoryEmoji = getCategoryEmoji;
window.seedDatasetItems = seedDatasetItems;
