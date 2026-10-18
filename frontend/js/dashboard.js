/**
 * Food Freshness Monitoring Platform - Dynamic Dashboard Controller
 * Implements real-time Chart.js visualizations, IoT cold-chain simulation,
 * interactive Arrhenius decay kinetics, quick AI scan, and instant search.
 */

let allRecentItems = [];
let freshnessChartInstance = null;
let expiryChartInstance = null;
let currentQuickFile = null;
let currentQuickImageUrl = null;

// Dedicated Feature State Variables
let currentScannerFile = null;
let currentScannerImageUrl = null;
let lastScanResult = null;
let cachedGuidelines = null;
let currentGuidelineFilter = "all";
let currentAlertsFilter = "all";
let searchHistoryTimeout = null;
let allAlertItems = [];

// Dashboard Arrhenius Presets
const dashPresets = {
  Apples: { baseDays: 24, refTemp: 4.0, refRH: 90, q10: 2.2, score: 95 },
  Salmon: { baseDays: 4, refTemp: 1.0, refRH: 90, q10: 2.8, score: 91 },
  Milk: { baseDays: 10, refTemp: 3.0, refRH: 70, q10: 2.6, score: 88 },
  Avocado: { baseDays: 6, refTemp: 14.0, refRH: 65, q10: 2.4, score: 75 },
  Bread: { baseDays: 6, refTemp: 21.0, refRH: 55, q10: 1.8, score: 92 },
};
let activeDashPreset = dashPresets.Apples;

document.addEventListener("DOMContentLoaded", async () => {
  if (!api.enforceRoleAccess(["Consumer"])) return;

  const user = api.getUser();
  if (user) {
    const nameEl = document.querySelector(".user-display-name");
    const roleBadge = document.querySelector(".user-role-badge");
    const avatarEl = document.querySelector(".user-avatar");
    if (nameEl) nameEl.textContent = user.name || "Consumer";
    if (roleBadge) roleBadge.textContent = user.role || "Consumer";
    if (avatarEl) avatarEl.textContent = (user.name || "C").charAt(0).toUpperCase();
  }

  await loadDashboardData();
  initDashboardSimulator();
  initDedicatedFeatures();
  startTelemetrySimulation();

  // Check URL query ?view=... or hash #... to switch view on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get("view");
  const hashParam = window.location.hash.replace("#", "");
  const targetView = viewParam || hashParam;
  if (targetView && ["overview", "scanner", "shelf-life", "recommendations", "alerts", "history"].includes(targetView)) {
    switchConsumerView(targetView);
  }
});

// =============================================================================
// 1. Data Ingestion & State Loading
// =============================================================================
async function loadDashboardData() {
  try {
    const [stats, items, scanHistory] = await Promise.all([
      api.getDashboardStats(),
      api.getInventory({ sort_by: "expiry_date", sort_order: "asc" }),
      api.getFreshnessHistory({ limit: 6 }).catch(() => [])
    ]);

    renderStats(stats);
    allRecentItems = items || [];
    renderRecentTable(allRecentItems.slice(0, 8));
    renderRecentScans(scanHistory || []);
    renderConsumerExpiryAlerts(allRecentItems);
    populateQuickAiItemSelect(allRecentItems);
    populateScannerItemSelect(allRecentItems);
    populateShelfLifePantrySelect(allRecentItems);
    renderDashboardCharts(stats, allRecentItems);
    loadConsumerAlerts();
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    showToast("Error loading dashboard metrics: " + error.message, "error");
  }
}

function renderStats(stats) {
  const totalItemsEl = document.getElementById("stat-total-items");
  const totalQtyEl = document.getElementById("stat-total-qty");
  const expiringSoonEl = document.getElementById("stat-expiring-soon");
  const pendingAiEl = document.getElementById("stat-pending-ai");
  const spoiledItemsEl = document.getElementById("stat-spoiled-items");
  const storageAlertsEl = document.getElementById("stat-storage-alerts");

  if (totalItemsEl) animateCounter(totalItemsEl, stats.total_food_items || 0);
  if (totalQtyEl) animateCounter(totalQtyEl, stats.total_quantity ? stats.total_quantity.toFixed(1) : "0.0");
  if (expiringSoonEl) animateCounter(expiringSoonEl, stats.items_expiring_soon || 0);
  if (pendingAiEl) animateCounter(pendingAiEl, stats.freshness_analysis_pending || 0);
  if (spoiledItemsEl) animateCounter(spoiledItemsEl, stats.spoiled_items || 0);
  if (storageAlertsEl) animateCounter(storageAlertsEl, stats.storage_alerts || 0);

  // Category distribution bars
  const catContainer = document.getElementById("category-distribution-container");
  if (catContainer && stats.category_distribution) {
    const total = stats.total_food_items || 1;
    let html = "";
    Object.entries(stats.category_distribution).forEach(([category, count]) => {
      const percentage = Math.round((count / total) * 100);
      html += `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <span style="font-weight: 600;">${escapeHtml(category)}</span>
            <span style="color: var(--text-muted);">${count} items (${percentage}%)</span>
          </div>
          <div style="width: 100%; height: 8px; background: var(--bg-surface); border-radius: 4px; overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
          </div>
        </div>
      `;
    });
    catContainer.innerHTML = html || "<p style='color:var(--text-muted);'>No category data available yet.</p>";
  }
}

// =============================================================================
// 2. Chart.js Dynamic Visualizations
// =============================================================================
function renderDashboardCharts(stats, items) {
  // 1. Freshness Status Donut
  const donutCtx = document.getElementById("freshnessStatusChart");
  if (donutCtx) {
    if (freshnessChartInstance) freshnessChartInstance.destroy();

    const freshCount = Math.max(0, (stats.total_food_items || 0) - (stats.items_expiring_soon || 0) - (stats.spoiled_items || 0) - (stats.freshness_analysis_pending || 0));
    const expiringCount = stats.items_expiring_soon || 0;
    const spoiledCount = stats.spoiled_items || 0;
    const pendingCount = stats.freshness_analysis_pending || 0;

    freshnessChartInstance = new Chart(donutCtx, {
      type: "doughnut",
      data: {
        labels: ["Optimal / Fresh", "Expiring Soon (<72h)", "Spoiled / Expired", "Analysis Pending"],
        datasets: [{
          data: [freshCount, expiringCount, spoiledCount, pendingCount],
          backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"],
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 11, family: "inherit" } }
          }
        },
        cutout: "68%"
      }
    });
  }

  // 2. 7-Day Expiry Horizon Chart
  const horizonCtx = document.getElementById("expiryHorizonChart");
  if (horizonCtx) {
    if (expiryChartInstance) expiryChartInstance.destroy();

    // Calculate item counts expiring on Day 0 (today) through Day +6
    const daysLabels = [];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `+${i} Days`;
      daysLabels.push(label);

      // Count items matching this exact expiry date
      counts[i] = items.filter(item => item.expiry_date === iso).length;
    }

    expiryChartInstance = new Chart(horizonCtx, {
      type: "bar",
      data: {
        labels: daysLabels,
        datasets: [{
          label: "Expiring Items",
          data: counts,
          backgroundColor: counts.map((c, idx) => idx === 0 ? "#ef4444" : idx <= 2 ? "#f59e0b" : "#0d9488"),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { size: 11 } },
            grid: { color: "#f1f5f9" }
          },
          x: {
            ticks: { font: { size: 11 } },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.y} item(s) due for rotation/consumption`
            }
          }
        }
      }
    });
  }
}

// =============================================================================
// 3. Recent Items Table & Live Instant Search
// =============================================================================
function renderRecentTable(items) {
  const tableBody = document.getElementById("recent-items-body");
  if (!tableBody) return;

  if (!items || items.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state" style="padding: 30px 15px; text-align: center;">
          <div class="empty-icon" style="font-size: 32px; margin-bottom: 6px;">📦</div>
          <div class="empty-title" style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Pantry Inventory is Empty</div>
          <div class="empty-subtitle" style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">No items in your pantry yet. Load items from datasets or add new food.</div>
          <div style="display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="seedDatasetItems()">🌱 Load Dataset Items</button>
            <a href="add-food.html" class="btn btn-secondary btn-sm">+ Add Food Item</a>
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
      let expiryBadge = `<span class="badge badge-fresh">Fresh</span>`;
      if (item.expiry_date < todayStr) {
        expiryBadge = `<span class="badge badge-danger">Expired</span>`;
      } else if (item.expiry_date <= in3DaysStr) {
        expiryBadge = `<span class="badge badge-warning">Expiring Soon</span>`;
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
              <div class="food-batch">${escapeHtml(item.batch_number || "No Batch ID")}</div>
            </div>
          </div>
        </td>
        <td><span class="badge" style="background:#f1f5f9;color:#334155;">${escapeHtml(item.category)}</span></td>
        <td><strong>${item.quantity}</strong> ${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.expiry_date)}</td>
        <td>${expiryBadge}</td>
        <td>
          <div class="actions-cell">
            <a href="food-details.html?id=${item.id}" class="btn btn-secondary btn-sm">Inspect</a>
            <button type="button" class="btn btn-primary btn-sm" onclick="quickAiForItem('${item.id}', '${escapeHtml(item.food_name)}')">⚡ Scan</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function filterRecentTable(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    renderRecentTable(allRecentItems.slice(0, 8));
    return;
  }

  const filtered = allRecentItems.filter((i) =>
    (i.food_name || "").toLowerCase().includes(q) ||
    (i.category || "").toLowerCase().includes(q) ||
    (i.batch_number || "").toLowerCase().includes(q) ||
    (i.location || "").toLowerCase().includes(q)
  );
  renderRecentTable(filtered);
}

function populateQuickAiItemSelect(items) {
  const sel = document.getElementById("quick-ai-item-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">-- Choose Existing Item to Update --</option>` +
    items.map(i => `<option value="${i.id}">${escapeHtml(i.food_name)} (${escapeHtml(i.category)} - ${i.quantity} ${i.unit})</option>`).join("");
}

function renderRecentScans(scans) {
  const container = document.getElementById("recent-scans-container");
  if (!container) return;

  if (!scans || scans.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 28px 20px; color: var(--text-muted);">
        <span style="font-size: 32px; display: block; margin-bottom: 6px;">📸</span>
        <strong style="color: var(--text-main);">No AI Scans Recorded Yet</strong>
        <p style="font-size: 13px; margin: 4px 0 12px 0;">Upload or capture a food photo to diagnose freshness with Computer Vision.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="openQuickAiModal()">Run First AI Scan</button>
      </div>
    `;
    return;
  }

  const cardsHtml = scans.slice(0, 6).map(s => {
    const score = Math.round(s.freshness_score || 85);
    const label = s.freshness_label || "Fresh";
    const badgeClass = (label === "Fresh" || label === "Optimal") ? "badge-fresh" : (label === "Spoiled" || label === "Critical") ? "badge-danger" : "badge-warning";
    const dateFormatted = s.analysis_date ? new Date(s.analysis_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recently";
    const imgSrc = s.image_url ? (s.image_url.startsWith("http") ? s.image_url : s.image_url) : "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=150&q=80";

    const defects = (s.detected_defects && s.detected_defects.length > 0) ? s.detected_defects.join(", ") : "None Detected";

    return `
      <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; display: flex; gap: 14px; align-items: center; box-shadow: var(--shadow-sm); transition: transform 0.2s ease;">
        <img src="${imgSrc}" alt="${escapeHtml(s.food_name)}" style="width: 64px; height: 64px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src='https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=150&q=80'">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <strong style="color: var(--text-main); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.food_name)}</strong>
            <span class="badge ${badgeClass}" style="font-size: 11px;">${label}</span>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 4px; font-size: 12px; color: var(--text-muted);">
            <span>Score: <strong style="color: var(--primary);">${score}%</strong></span>
            <span>Shelf Life: <strong>${Number(s.estimated_shelf_life_days || 7).toFixed(1)}d</strong></span>
            <span>Defects: <em>${escapeHtml(defects)}</em></span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            🕒 ${dateFormatted} &bull; AI Conf: ${Math.round((s.confidence || 0.92) * 100)}%
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
      ${cardsHtml}
    </div>
  `;
}

function renderConsumerExpiryAlerts(items) {
  const container = document.getElementById("consumer-expiry-alerts-list");
  const badge = document.getElementById("consumer-expiring-badge");
  if (!container) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  const urgentItems = (items || []).filter(item => {
    if (!item.expiry_date) return false;
    const exp = new Date(item.expiry_date);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  if (badge) {
    badge.textContent = `${urgentItems.length} Items <= 72h`;
    badge.className = urgentItems.length > 0 ? "badge badge-danger" : "badge badge-fresh";
  }

  if (urgentItems.length === 0) {
    container.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 16px; text-align: center;">
        <span style="font-size: 26px;">✨</span>
        <h4 style="color: #166534; margin: 4px 0;">All Items Fresh & Safe</h4>
        <p style="color: #15803d; font-size: 12px; margin: 0;">No foods approaching expiration within the next 72 hours.</p>
      </div>
    `;
    return;
  }

  const itemsHtml = urgentItems.slice(0, 4).map(item => {
    const exp = new Date(item.expiry_date);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    const urgencyText = diffDays <= 0 ? "Expired Today" : diffDays === 1 ? "Expires Tomorrow" : `Expires in ${diffDays} Days`;
    const urgencyClass = diffDays <= 0 ? "#dc2626" : "#d97706";

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border-color);">
        <div>
          <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(item.food_name)}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.category || 'General')} &bull; ${item.quantity} ${escapeHtml(item.unit || 'units')}</div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 12px; font-weight: 700; color: ${urgencyClass};">${urgencyText}</span>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.expiry_date)}</div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
      ${itemsHtml}
    </div>
  `;
}

function getStorageRecommendationForCategory(category, status) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("fruit") || cat.includes("veg")) {
    return status === "Expiring Soon" || status === "Moderately Fresh" 
      ? "Consume within 24–48h or freeze sliced portions. Keep away from ethylene-emitting apples."
      : "Store in refrigerator crisper at 2°C–4°C and 85–95% RH in ventilated bags.";
  }
  if (cat.includes("dairy")) {
    return status === "Expiring Soon"
      ? "Heat-treat or consume immediately. Do not leave at room temperature."
      : "Maintain continuous refrigeration at 2°C–4°C on internal shelf, tightly capped.";
  }
  if (cat.includes("meat") || cat.includes("fish")) {
    return status === "Expiring Soon"
      ? "Cook thoroughly immediately or vacuum-seal and freeze at -18°C."
      : "Store on lowest shelf at 0°C–2°C in sealed leak-proof container; consume in 48h.";
  }
  if (cat.includes("bakery")) {
    return "Store at ambient room temperature in breathable box. Freeze slices if unused within 48h.";
  }
  return "Store in a cool, dry, dark pantry or refrigerate if perishable.";
}

// =============================================================================
// 4. Quick Action Toggles & Telemetry Stream
// =============================================================================
function toggleTelemetry() {
  const el = document.getElementById("telemetry-strip");
  const btn = document.getElementById("btn-toggle-iot");
  if (!el) return;

  if (el.style.display === "none") {
    el.style.display = "grid";
    if (btn) btn.classList.add("active");
  } else {
    el.style.display = "none";
    if (btn) btn.classList.remove("active");
  }
}

function toggleSimulator() {
  const el = document.getElementById("dashboard-simulator-card");
  const btn = document.getElementById("btn-toggle-sim");
  if (!el) return;

  if (el.style.display === "none") {
    el.style.display = "block";
    if (btn) btn.classList.add("active");
  } else {
    el.style.display = "none";
    if (btn) btn.classList.remove("active");
  }
}

function startTelemetrySimulation() {
  setInterval(() => {
    const t1 = (3.2 + (Math.random() * 0.4 - 0.2)).toFixed(1);
    const t2 = (3.9 + (Math.random() * 0.4 - 0.2)).toFixed(1);
    const t3 = (-18.6 + (Math.random() * 0.4 - 0.2)).toFixed(1);
    const t4 = (21.8 + (Math.random() * 0.6 - 0.3)).toFixed(1);

    const el1 = document.getElementById("iot-t1");
    const el2 = document.getElementById("iot-t2");
    const el3 = document.getElementById("iot-t3");
    const el4 = document.getElementById("iot-t4");

    if (el1) el1.textContent = t1 + "°C";
    if (el2) el2.textContent = t2 + "°C";
    if (el3) el3.textContent = t3 + "°C";
    if (el4) el4.textContent = t4 + "°C";
  }, 3500);
}

// =============================================================================
// 5. Dashboard Arrhenius Simulator Logic
// =============================================================================
function initDashboardSimulator() {
  const tempSlider = document.getElementById("dash-sim-temp");
  const rhSlider = document.getElementById("dash-sim-rh");

  if (!tempSlider || !rhSlider) return;

  const updateSim = () => {
    const temp = parseFloat(tempSlider.value);
    const rh = parseFloat(rhSlider.value);

    document.getElementById("dash-sim-temp-val").textContent = temp.toFixed(1) + "°C";
    document.getElementById("dash-sim-rh-val").textContent = rh.toFixed(0) + "%";

    const deltaT = temp - activeDashPreset.refTemp;
    const kineticMultiplier = Math.pow(activeDashPreset.q10, deltaT / 10);
    const rhDiff = Math.abs(rh - activeDashPreset.refRH);
    const rhFactor = 1 + (rhDiff > 15 ? (rhDiff - 15) * 0.015 : 0);

    const effective = Math.max(0.1, kineticMultiplier * rhFactor);
    const days = Math.max(0.1, activeDashPreset.baseDays / effective);

    const q10El = document.getElementById("dash-sim-q10");
    q10El.textContent = effective.toFixed(2) + "x Base Decay Rate";
    if (effective > 1.8) q10El.style.color = "#dc2626";
    else if (effective > 1.2) q10El.style.color = "#d97706";
    else q10El.style.color = "#0f766e";

    document.getElementById("dash-sim-days").textContent = days.toFixed(1) + " Days";

    const bar = document.getElementById("dash-sim-bar");
    const pct = Math.min(100, Math.round((days / activeDashPreset.baseDays) * 100));
    bar.style.width = pct + "%";
    if (pct > 50) bar.style.backgroundColor = "#10b981";
    else if (pct > 20) bar.style.backgroundColor = "#f59e0b";
    else bar.style.backgroundColor = "#ef4444";

    const recEl = document.getElementById("dash-sim-rec");
    if (days >= activeDashPreset.baseDays * 0.6) {
      recEl.textContent = "Storage within recommended thermal bounds.";
      recEl.style.color = "#047857";
    } else if (days >= activeDashPreset.baseDays * 0.3) {
      recEl.textContent = "Elevated temperature acceleration. Schedule FEFO usage.";
      recEl.style.color = "#b45309";
    } else {
      recEl.textContent = "Thermal stress critical! Rapid quality decline predicted.";
      recEl.style.color = "#b91c1c";
    }
  };

  tempSlider.addEventListener("input", updateSim);
  rhSlider.addEventListener("input", updateSim);

  // Preset pill clicks
  document.querySelectorAll("#dashboard-simulator-card .preset-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#dashboard-simulator-card .preset-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const name = btn.dataset.name;
      activeDashPreset = dashPresets[name] || dashPresets.Apples;
      tempSlider.value = activeDashPreset.refTemp;
      rhSlider.value = activeDashPreset.refRH;
      updateSim();
    });
  });
}

// =============================================================================
// 6. Quick AI Vision Scan Modal
// =============================================================================
function openQuickAiModal() {
  currentQuickFile = null;
  currentQuickImageUrl = null;
  const modal = document.getElementById("quick-ai-modal");
  const output = document.getElementById("quick-scan-output");
  const preview = document.getElementById("quick-preview-box");
  const runBtn = document.getElementById("btn-run-quick-scan");
  const urlInput = document.getElementById("quick-url-input");
  const fileInput = document.getElementById("quick-file-input");

  if (urlInput) urlInput.value = "";
  if (fileInput) fileInput.value = "";
  if (output) output.style.display = "none";
  if (preview) preview.style.display = "none";
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = "🔍 Run OpenCV & Arrhenius AI";
  }
  switchQuickMode("upload");
  if (modal) modal.classList.add("active");
}

function switchQuickMode(mode) {
  const uploadBtn = document.getElementById("btn-quick-mode-upload");
  const urlBtn = document.getElementById("btn-quick-mode-url");
  const uploadPanel = document.getElementById("quick-upload-panel");
  const urlPanel = document.getElementById("quick-url-panel");

  if (mode === "upload") {
    if (uploadBtn) {
      uploadBtn.style.background = "white";
      uploadBtn.style.color = "var(--primary)";
      uploadBtn.style.border = "1px solid #cbd5e1";
      uploadBtn.style.fontWeight = "700";
    }
    if (urlBtn) {
      urlBtn.style.background = "transparent";
      urlBtn.style.color = "var(--text-muted)";
      urlBtn.style.border = "none";
      urlBtn.style.fontWeight = "600";
    }
    if (uploadPanel) uploadPanel.style.display = "block";
    if (urlPanel) urlPanel.style.display = "none";
  } else {
    if (urlBtn) {
      urlBtn.style.background = "white";
      urlBtn.style.color = "var(--primary)";
      urlBtn.style.border = "1px solid #cbd5e1";
      urlBtn.style.fontWeight = "700";
    }
    if (uploadBtn) {
      uploadBtn.style.background = "transparent";
      uploadBtn.style.color = "var(--text-muted)";
      uploadBtn.style.border = "none";
      uploadBtn.style.fontWeight = "600";
    }
    if (uploadPanel) uploadPanel.style.display = "none";
    if (urlPanel) urlPanel.style.display = "block";
  }
}

function loadQuickImageUrl() {
  const input = document.getElementById("quick-url-input");
  const url = input ? input.value.trim() : "";
  if (!url) {
    showToast("Please enter a food image address (URL).", "warning");
    return;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:image/")) {
    showToast("Please enter a valid HTTP, HTTPS, or data:image URL.", "error");
    return;
  }

  currentQuickImageUrl = url;
  currentQuickFile = null;
  const fileInput = document.getElementById("quick-file-input");
  if (fileInput) fileInput.value = "";

  const previewBox = document.getElementById("quick-preview-box");
  const previewImg = document.getElementById("quick-preview-img");
  if (previewImg) previewImg.src = url;
  if (previewBox) previewBox.style.display = "block";

  const runBtn = document.getElementById("btn-run-quick-scan");
  if (runBtn) runBtn.disabled = false;

  showToast("Image address loaded! Ready for scan.", "success");
}

function useSampleQuickUrl(url) {
  const input = document.getElementById("quick-url-input");
  if (input) input.value = url;
  loadQuickImageUrl();
}

function closeQuickAiModal() {
  const modal = document.getElementById("quick-ai-modal");
  if (modal) modal.classList.remove("active");
}

function quickAiForItem(itemId, itemName) {
  openQuickAiModal();
  const sel = document.getElementById("quick-ai-item-select");
  if (sel) sel.value = itemId;
}

function handleQuickFile(file) {
  if (!file) return;
  currentQuickFile = file;
  currentQuickImageUrl = null;
  const urlInput = document.getElementById("quick-url-input");
  if (urlInput) urlInput.value = "";

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewBox = document.getElementById("quick-preview-box");
    const previewImg = document.getElementById("quick-preview-img");
    previewImg.src = e.target.result;
    previewBox.style.display = "block";

    const runBtn = document.getElementById("btn-run-quick-scan");
    if (runBtn) runBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

async function executeQuickScan() {
  const runBtn = document.getElementById("btn-run-quick-scan");
  const itemSelect = document.getElementById("quick-ai-item-select");
  const itemId = itemSelect ? itemSelect.value : "";

  try {
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner" style="display:inline-block; margin-right:6px;"></span> Analyzing Computer Vision...';

    let foodName = "Food Item";
    let category = "Fruits";
    let qualityVal, shelfLifeVal, statusVal, confidenceVal, spoilageRisk, defectsDetected;

    if (itemId) {
      // Analyze existing inventory item in MongoDB
      const foundItem = allRecentItems.find(i => String(i.id) === String(itemId));
      if (foundItem) {
        foodName = foundItem.food_name || "Food Item";
        category = foundItem.category || "Fruits";
      }

      let imageUrl = null;
      if (currentQuickFile) {
        const uploadRes = await api.uploadFoodImage(currentQuickFile);
        imageUrl = uploadRes.image_url;
      } else if (currentQuickImageUrl) {
        imageUrl = currentQuickImageUrl;
      }
      const analysisRes = await api.analyzeFreshness({
        inventory_id: itemId,
        image_url: imageUrl || undefined,
      });

      qualityVal = Math.round(analysisRes.freshness_score || 90);
      shelfLifeVal = (analysisRes.shelf_life_days || 7.0).toFixed(1);
      statusVal = analysisRes.freshness_status || "Fresh";
      confidenceVal = Math.round((analysisRes.confidence || 0.94) * 100);
      spoilageRisk = analysisRes.spoilage_risk || (qualityVal < 40 ? "Critical" : qualityVal < 65 ? "Moderate" : "Low");
      defectsDetected = analysisRes.visual_defect_detected ? "Colonies / Browning Detected" : "None Detected";
    } else if (currentQuickFile || currentQuickImageUrl) {
      // Standalone Quick Scan on uploaded file or image address
      foodName = currentQuickFile ? currentQuickFile.name.replace(/\.[^/.]+$/, "") : "Scanned Food Sample";
      const formData = new FormData();
      if (currentQuickFile) formData.append("file", currentQuickFile);
      if (currentQuickImageUrl) formData.append("image_url", currentQuickImageUrl);
      formData.append("category", category);
      formData.append("food_name", foodName);

      const scanRes = await api.quickScanFood(formData);
      qualityVal = Math.round(scanRes.visual_score || 92);
      shelfLifeVal = (scanRes.estimated_shelf_life_days || 7.0).toFixed(1);
      statusVal = scanRes.freshness_label || "Fresh";
      confidenceVal = Math.round((scanRes.confidence || 0.95) * 100);
      spoilageRisk = scanRes.spoilage_risk_level || (qualityVal < 40 ? "Critical" : qualityVal < 65 ? "Moderate" : "Low");
      defectsDetected = (scanRes.detected_defects && scanRes.detected_defects.length > 0) ? scanRes.detected_defects.join(", ") : "None Detected";
    } else {
      showToast("Please select an item, upload a file, or enter an image address.", "warning");
      runBtn.disabled = false;
      runBtn.textContent = "Run OpenCV & Arrhenius AI";
      return;
    }

    // Render results in output modal
    const output = document.getElementById("quick-scan-output");
    output.style.display = "block";

    const nameEl = document.getElementById("quick-scanned-name");
    if (nameEl) nameEl.textContent = `${foodName} (${category})`;

    const scoreEl = document.getElementById("quick-quality-score");
    if (scoreEl) scoreEl.textContent = qualityVal + "%";

    const shelfEl = document.getElementById("quick-shelf-life");
    if (shelfEl) shelfEl.textContent = shelfLifeVal + "d";

    const confEl = document.getElementById("quick-confidence-score");
    if (confEl) confEl.textContent = confidenceVal + "%";

    const riskEl = document.getElementById("quick-spoilage-risk");
    if (riskEl) {
      riskEl.textContent = spoilageRisk;
      riskEl.style.color = (spoilageRisk === "Critical" || spoilageRisk === "High") ? "#dc2626" : (spoilageRisk === "Moderate") ? "#d97706" : "#16a34a";
    }

    const badge = document.getElementById("quick-result-badge");
    if (badge) {
      badge.textContent = statusVal;
      if (statusVal === "Fresh" || statusVal === "Optimal") {
        badge.className = "badge badge-fresh";
      } else if (statusVal === "Marginal" || statusVal === "Moderately Fresh" || statusVal === "Expiring Soon") {
        badge.className = "badge badge-warning";
      } else {
        badge.className = "badge badge-danger";
      }
    }

    const recText = document.getElementById("quick-rec-text");
    if (recText) {
      recText.textContent = `Computer Vision diagnostic: Spoilage risk evaluated as ${spoilageRisk}. Defects noted: ${defectsDetected}.`;
    }

    const storageAdviceEl = document.getElementById("quick-storage-advice");
    if (storageAdviceEl) {
      const advice = getStorageRecommendationForCategory(category, statusVal);
      storageAdviceEl.innerHTML = `<strong>Storage Recommendation:</strong> ${advice}`;
    }

    showToast("AI Vision & Arrhenius scan completed successfully!", "success");
    runBtn.textContent = "Analysis Done";
    runBtn.disabled = false;

    // Refresh dashboard data & scan history
    await loadDashboardData();
  } catch (err) {
    console.error("Scan error:", err);
    showToast("Error running AI scan: " + err.message, "error");
    runBtn.disabled = false;
    runBtn.textContent = "Retry Scan";
  }
}

// Drag & Drop for dropzone
const dropzone = document.getElementById("quick-dropzone");
if (dropzone) {
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#0d9488";
    dropzone.style.background = "#f0fdfa";
  });
  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "";
    dropzone.style.background = "";
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "";
    dropzone.style.background = "";
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleQuickFile(e.dataTransfer.files[0]);
    }
  });
}

function getCategoryEmoji(category) {
  const emojiMap = {
    Fruits: "🍎",
    Vegetables: "🥦",
    Dairy: "🧀",
    Meat: "🥩",
    Fish: "🐟",
    Grains: "🌾",
    Bakery: "🍞",
    "Packaged Food": "🥫",
    Other: "🥗",
  };
  return emojiMap[category] || "🍽️";
}

// =============================================================================
// 7. Dedicated Consumer Feature Controllers (5 Core Features)
// =============================================================================

/**
 * View Navigation Switcher
 */
function switchConsumerView(viewName) {
  // Update Tabs
  document.querySelectorAll(".consumer-nav-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  // Update Sidebar Nav Items
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
    if (item.id === `nav-item-${viewName}`) {
      item.classList.add("active");
    } else if (item.id && item.id.startsWith("nav-item-")) {
      item.classList.remove("active");
    }
  });

  // Update Sections
  const views = ["overview", "scanner", "shelf-life", "recommendations", "alerts", "history"];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.style.display = (v === viewName) ? "block" : "none";
    }
  });

  // Update Action Cards active highlight
  document.querySelectorAll(".consumer-action-card").forEach(c => c.classList.remove("active"));
  const activeCard = document.getElementById(`action-card-${viewName}`);
  if (activeCard) activeCard.classList.add("active");

  // Keep URL query in sync
  try {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("view", viewName);
    window.history.replaceState({ view: viewName }, "", newUrl);
  } catch (e) {}

  // Load view-specific data
  if (viewName === "scanner") {
    populateScannerItemSelect(allRecentItems);
  } else if (viewName === "shelf-life") {
    runShelfLifeSimulation();
  } else if (viewName === "recommendations") {
    loadStorageGuidelines();
  } else if (viewName === "alerts") {
    loadConsumerAlerts();
  } else if (viewName === "history") {
    loadConsumerScanHistory();
  }

  // Smooth scroll to top of view
  window.scrollTo({ top: 120, behavior: "smooth" });
}

/**
 * Dedicated Features Initializer
 */
function initDedicatedFeatures() {
  initScannerStationListeners();
  initShelfLifeViewSimulator();
}

// -----------------------------------------------------------------------------
// FEATURE 1: AI Food Freshness Scanner Station
// -----------------------------------------------------------------------------
function initScannerStationListeners() {
  const dropzone = document.getElementById("scanner-dropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#0d9488";
      dropzone.style.background = "#f0fdfa";
    });
    dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
      dropzone.style.background = "";
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
      dropzone.style.background = "";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleScannerFile(e.dataTransfer.files[0]);
      }
    });
  }
}

function populateScannerItemSelect(items) {
  const sel = document.getElementById("scanner-item-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">-- Standalone Scan (No Pantry Item Linked) --</option>` +
    (items || []).map(i => `<option value="${i.id}">${escapeHtml(i.food_name)} (${escapeHtml(i.category)} - ${i.quantity} ${i.unit})</option>`).join("");
}

function onScannerItemSelect(itemId) {
  if (!itemId) return;
  const item = allRecentItems.find(i => String(i.id) === String(itemId));
  if (item) {
    const nameInput = document.getElementById("scanner-food-name");
    const catSelect = document.getElementById("scanner-category-select");
    const tempInput = document.getElementById("scanner-temp");
    const humInput = document.getElementById("scanner-humidity");

    if (nameInput) nameInput.value = item.food_name || "Food Item";
    if (catSelect && item.category) catSelect.value = item.category;
    if (tempInput && item.storage_temperature !== undefined && item.storage_temperature !== null) {
      tempInput.value = item.storage_temperature;
    }
    if (humInput && item.storage_humidity !== undefined && item.storage_humidity !== null) {
      humInput.value = item.storage_humidity;
    }

    // Enable scan button if linked item selected
    const runBtn = document.getElementById("btn-execute-scanner");
    if (runBtn) runBtn.disabled = false;
  }
}

function switchScannerMode(mode) {
  const uploadBtn = document.getElementById("btn-scanner-mode-upload");
  const urlBtn = document.getElementById("btn-scanner-mode-url");
  const uploadPanel = document.getElementById("scanner-upload-panel");
  const urlPanel = document.getElementById("scanner-url-panel");

  if (mode === "upload") {
    if (uploadBtn) {
      uploadBtn.style.background = "white";
      uploadBtn.style.color = "var(--primary)";
      uploadBtn.style.border = "1px solid #cbd5e1";
      uploadBtn.style.fontWeight = "700";
    }
    if (urlBtn) {
      urlBtn.style.background = "transparent";
      urlBtn.style.color = "var(--text-muted)";
      urlBtn.style.border = "none";
      urlBtn.style.fontWeight = "600";
    }
    if (uploadPanel) uploadPanel.style.display = "block";
    if (urlPanel) urlPanel.style.display = "none";
  } else {
    if (urlBtn) {
      urlBtn.style.background = "white";
      urlBtn.style.color = "var(--primary)";
      urlBtn.style.border = "1px solid #cbd5e1";
      urlBtn.style.fontWeight = "700";
    }
    if (uploadBtn) {
      uploadBtn.style.background = "transparent";
      uploadBtn.style.color = "var(--text-muted)";
      uploadBtn.style.border = "none";
      uploadBtn.style.fontWeight = "600";
    }
    if (uploadPanel) uploadPanel.style.display = "none";
    if (urlPanel) urlPanel.style.display = "block";
  }
}

function loadScannerImageUrl() {
  const input = document.getElementById("scanner-url-input");
  const url = input ? input.value.trim() : "";
  if (!url) {
    showToast("Please enter a food image address (URL).", "warning");
    return;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:image/")) {
    showToast("Please enter a valid HTTP, HTTPS, or data:image URL.", "error");
    return;
  }

  currentScannerImageUrl = url;
  currentScannerFile = null;

  const fileInput = document.getElementById("scanner-file-input");
  if (fileInput) fileInput.value = "";

  const previewContainer = document.getElementById("scanner-preview-container");
  const previewImg = document.getElementById("scanner-preview-img");
  const sourceBadge = document.getElementById("scanner-source-badge");

  if (previewImg) {
    previewImg.src = url;
    previewImg.onerror = () => {
      showToast("Notice: Remote server may restrict direct preview. The AI backend will fetch and analyze directly.", "info");
    };
  }
  if (sourceBadge) {
    sourceBadge.textContent = "🌐 Loaded via Image Address";
    sourceBadge.style.background = "#e0f2fe";
    sourceBadge.style.color = "#0369a1";
  }
  if (previewContainer) previewContainer.style.display = "block";

  // Auto-detect a cleaner food name from URL if default
  const nameInput = document.getElementById("scanner-food-name");
  if (nameInput && (!nameInput.value || nameInput.value === "Fresh Apple")) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1] || "";
      const clean = last.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      if (clean && clean.length < 25 && !clean.includes("photo-") && !clean.includes("image")) {
        nameInput.value = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
    } catch (e) {}
  }

  const runBtn = document.getElementById("btn-execute-scanner");
  if (runBtn) runBtn.disabled = false;

  showToast("Image address loaded! Ready for AI scan.", "success");
}

function useSampleScannerUrl(url, name, category) {
  const input = document.getElementById("scanner-url-input");
  if (input) input.value = url;
  const nameInput = document.getElementById("scanner-food-name");
  if (nameInput && name) nameInput.value = name;
  const catSelect = document.getElementById("scanner-category-select");
  if (catSelect && category) catSelect.value = category;

  loadScannerImageUrl();
}

function handleScannerFile(file) {
  if (!file) return;

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
  if (!validTypes.includes(file.type)) {
    showToast("Invalid format. Please select JPEG, PNG, or WebP.", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast("File size exceeds 10MB limit.", "error");
    return;
  }

  currentScannerFile = file;
  currentScannerImageUrl = null;
  const urlInput = document.getElementById("scanner-url-input");
  if (urlInput) urlInput.value = "";

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewContainer = document.getElementById("scanner-preview-container");
    const previewImg = document.getElementById("scanner-preview-img");
    const sourceBadge = document.getElementById("scanner-source-badge");

    if (previewImg) previewImg.src = e.target.result;
    if (sourceBadge) {
      sourceBadge.textContent = "📁 File Upload: " + file.name;
      sourceBadge.style.background = "#dcfce7";
      sourceBadge.style.color = "#166534";
    }
    if (previewContainer) previewContainer.style.display = "block";

    const nameInput = document.getElementById("scanner-food-name");
    if (nameInput && (!nameInput.value || nameInput.value === "Fresh Apple")) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      nameInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }

    const runBtn = document.getElementById("btn-execute-scanner");
    if (runBtn) runBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearScannerImage() {
  currentScannerFile = null;
  currentScannerImageUrl = null;
  const fileInput = document.getElementById("scanner-file-input");
  if (fileInput) fileInput.value = "";
  const urlInput = document.getElementById("scanner-url-input");
  if (urlInput) urlInput.value = "";
  const previewContainer = document.getElementById("scanner-preview-container");
  if (previewContainer) previewContainer.style.display = "none";

  const itemSelect = document.getElementById("scanner-item-select");
  const runBtn = document.getElementById("btn-execute-scanner");
  if (runBtn) {
    runBtn.disabled = !itemSelect || !itemSelect.value;
  }
}

async function runScannerStation() {
  const runBtn = document.getElementById("btn-execute-scanner");
  const laserBar = document.getElementById("scanner-laser-bar");
  const itemSelect = document.getElementById("scanner-item-select");
  const itemId = itemSelect ? itemSelect.value : "";
  const foodName = (document.getElementById("scanner-food-name")?.value || "Food Item").trim();
  const category = document.getElementById("scanner-category-select")?.value || "Fruits";
  const tempVal = parseFloat(document.getElementById("scanner-temp")?.value) || 4.0;
  const humVal = parseFloat(document.getElementById("scanner-humidity")?.value) || 85.0;

  if (!currentScannerFile && !currentScannerImageUrl && !itemId) {
    showToast("Please upload an image, enter an image address, or select a pantry item.", "warning");
    return;
  }

  try {
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner" style="display:inline-block; margin-right:8px;"></span> Analyzing Computer Vision & Microbial Kinetics...';
    }
    if (laserBar) laserBar.style.display = "block";

    let scanResult = null;

    if (itemId) {
      let imageUrl = null;
      if (currentScannerFile) {
        const upRes = await api.uploadFoodImage(currentScannerFile);
        imageUrl = upRes.image_url;
      } else if (currentScannerImageUrl) {
        imageUrl = currentScannerImageUrl;
      }
      const analysisRes = await api.analyzeFreshness({
        inventory_id: itemId,
        image_url: imageUrl || undefined,
      });

      scanResult = {
        food_name: foodName,
        category: category,
        freshness_score: analysisRes.freshness_score,
        freshness_label: analysisRes.freshness_status || analysisRes.freshness_category || "Fresh",
        estimated_shelf_life_days: analysisRes.estimated_shelf_life_days || 7.0,
        confidence: analysisRes.confidence || 0.94,
        spoilage_risk_level: analysisRes.spoilage_risk_level || (analysisRes.freshness_score < 40 ? "Critical" : analysisRes.freshness_score < 65 ? "Moderate" : "Low"),
        detected_defects: analysisRes.detected_defects || [],
        color_score: analysisRes.analysis?.color_score || 90.0,
        texture_score: analysisRes.analysis?.texture_score || 92.0,
        browning_index: analysisRes.analysis?.browning_index || 0.12,
        roughness_index: analysisRes.analysis?.roughness_index || 0.08,
        mold_detected: analysisRes.analysis?.mold_detected || false,
        bruising_detected: analysisRes.analysis?.bruising_detected || false,
      };
    } else {
      const formData = new FormData();
      if (currentScannerFile) {
        formData.append("file", currentScannerFile);
      }
      if (currentScannerImageUrl) {
        formData.append("image_url", currentScannerImageUrl);
      }
      formData.append("category", category);
      formData.append("food_name", foodName);
      formData.append("storage_temperature", tempVal);
      formData.append("storage_humidity", humVal);

      scanResult = await api.quickScanFood(formData);
    }

    lastScanResult = scanResult;

    // Render Results in Panel
    const emptyState = document.getElementById("scanner-empty-state");
    const activeResults = document.getElementById("scanner-active-results");
    if (emptyState) emptyState.style.display = "none";
    if (activeResults) activeResults.style.display = "block";

    const nameEl = document.getElementById("res-food-name");
    const catEl = document.getElementById("res-food-category");
    if (nameEl) nameEl.textContent = scanResult.food_name || foodName;
    if (catEl) catEl.textContent = `${scanResult.category || category} Category`;

    const statusVal = scanResult.freshness_label || scanResult.freshness_category || "Fresh";
    const statusBadge = document.getElementById("res-overall-status-badge");
    if (statusBadge) {
      statusBadge.textContent = statusVal;
      statusBadge.className = (statusVal === "Fresh" || statusVal === "Optimal") 
        ? "badge badge-fresh" 
        : (statusVal === "Spoiled" || statusVal === "Critical") 
        ? "badge badge-danger" 
        : "badge badge-warning";
    }

    const scoreVal = Math.round(scanResult.freshness_score || scanResult.visual_score || 85);
    const scoreEl = document.getElementById("res-score-val");
    if (scoreEl) scoreEl.textContent = `${scoreVal}%`;

    const shelfDays = Number(scanResult.estimated_shelf_life_days || 7.0).toFixed(1);
    const shelfEl = document.getElementById("res-shelflife-val");
    if (shelfEl) shelfEl.textContent = `${shelfDays}d`;

    const confVal = Math.round((scanResult.confidence || scanResult.confidence_score || 0.94) * 100);
    const confEl = document.getElementById("res-confidence-val");
    if (confEl) confEl.textContent = `${confVal}%`;

    const riskVal = scanResult.spoilage_risk_level || (scoreVal < 40 ? "Critical" : scoreVal < 65 ? "Moderate" : "Low");
    const riskEl = document.getElementById("res-risk-val");
    if (riskEl) {
      riskEl.textContent = riskVal;
      riskEl.style.color = (riskVal === "Critical" || riskVal === "High") ? "#dc2626" : (riskVal === "Moderate") ? "#d97706" : "#16a34a";
    }

    // Sub-scores
    const colorScore = Math.round(scanResult.color_score || 92);
    const textureScore = Math.round(scanResult.texture_score || 94);
    const colScoreEl = document.getElementById("res-sub-color");
    const colBarEl = document.getElementById("res-bar-color");
    const texScoreEl = document.getElementById("res-sub-texture");
    const texBarEl = document.getElementById("res-bar-texture");
    const browningEl = document.getElementById("res-sub-browning");
    const moldEl = document.getElementById("res-sub-mold");

    if (colScoreEl) colScoreEl.textContent = `${colorScore} / 100`;
    if (colBarEl) colBarEl.style.width = `${colorScore}%`;
    if (texScoreEl) texScoreEl.textContent = `${textureScore} / 100`;
    if (texBarEl) texBarEl.style.width = `${textureScore}%`;
    if (browningEl) {
      const brown = scanResult.browning_index !== undefined ? scanResult.browning_index : 0.05;
      browningEl.textContent = brown > 0.35 ? "High Browning" : brown > 0.15 ? "Moderate Browning" : "Optimal (Low)";
    }
    if (moldEl) {
      moldEl.textContent = scanResult.mold_detected ? "Detected! Spores Present" : "None Detected";
      moldEl.style.color = scanResult.mold_detected ? "#dc2626" : "#16a34a";
    }

    // Defects text
    const defects = (scanResult.detected_defects && scanResult.detected_defects.length > 0)
      ? scanResult.detected_defects.join(", ")
      : (scanResult.mold_detected ? "Fungal mold colonies detected on surface" : "Intact cuticle, uniform pigmentation, no fungal mycelium.");
    const defTextEl = document.getElementById("res-defects-text");
    if (defTextEl) defTextEl.textContent = defects;

    // Prescriptive advice
    const advice = getStorageRecommendationForCategory(category, statusVal);
    const adviceEl = document.getElementById("res-storage-text");
    if (adviceEl) adviceEl.textContent = advice;

    showToast("AI Vision scan & Arrhenius kinetics calculated successfully!", "success");

    // Refresh scan history & alerts
    loadConsumerScanHistory();
    loadDashboardData();
  } catch (err) {
    console.error("Scanner Error:", err);
    showToast("Error executing AI scan: " + err.message, "error");
  } finally {
    if (laserBar) laserBar.style.display = "none";
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = "🔍 Run AI Computer Vision & Kinetic Analysis";
    }
  }
}

function sendScanToSimulator() {
  if (!lastScanResult) return;
  switchConsumerView("shelf-life");

  const foodName = lastScanResult.food_name || "Food Item";
  const cat = lastScanResult.category || "Fruits";
  const tempInput = document.getElementById("vsim-temp");
  const rhInput = document.getElementById("vsim-rh");
  const scoreInput = document.getElementById("vsim-score");
  const foodInput = document.getElementById("vsim-food-name-input");
  const catSelect = document.getElementById("vsim-category-select");

  if (foodInput) foodInput.value = foodName;
  if (catSelect) catSelect.value = cat;
  if (tempInput) tempInput.value = 4.0;
  if (rhInput) rhInput.value = 85.0;
  if (scoreInput) scoreInput.value = Math.round(lastScanResult.freshness_score || 90);

  predictCustomFoodShelfLife();
}

// -----------------------------------------------------------------------------
// FEATURE 2: Shelf-Life Prediction (Arrhenius Simulator & Custom Food Predictor)
// -----------------------------------------------------------------------------
const vsimPresets = {
  Apples: { baseDays: 24, refTemp: 4.0, refRH: 90, q10: 2.2, cat: "Fruits", emoji: "🍏" },
  Berries: { baseDays: 6, refTemp: 2.0, refRH: 92, q10: 2.5, cat: "Fruits", emoji: "🫐" },
  Milk: { baseDays: 10, refTemp: 3.0, refRH: 70, q10: 2.6, cat: "Dairy", emoji: "🥛" },
  Salmon: { baseDays: 4, refTemp: 1.0, refRH: 90, q10: 3.0, cat: "Fish", emoji: "🐟" },
  Meat: { baseDays: 7, refTemp: 1.0, refRH: 75, q10: 2.8, cat: "Meat", emoji: "🥩" },
  Bread: { baseDays: 6, refTemp: 21.0, refRH: 55, q10: 1.8, cat: "Bakery", emoji: "🍞" },
  Avocado: { baseDays: 7, refTemp: 12.0, refRH: 65, q10: 2.4, cat: "Fruits", emoji: "🥑" },
  Grains: { baseDays: 180, refTemp: 20.0, refRH: 45, q10: 1.4, cat: "Grains", emoji: "🌾" },
};
let activeVSimPreset = vsimPresets.Apples;

// Catalogue of 40+ recognizable food commodities for client-side instant prediction and autocomplete
const knownCommodityList = [
  { key: "apple", name: "Apples", cat: "Fruits", emoji: "🍏", baseDays: 24, refTemp: 4.0, refRH: 90, q10: 2.2, advice: "Refrigerate in crisper drawer (2–4°C). Store separately from ethylene-sensitive produce." },
  { key: "banana", name: "Bananas", cat: "Fruits", emoji: "🍌", baseDays: 7, refTemp: 14.0, refRH: 85, q10: 2.5, advice: "Keep at room temperature (13–15°C). Never refrigerate before ripening." },
  { key: "strawberry", name: "Strawberries", cat: "Fruits", emoji: "🍓", baseDays: 6, refTemp: 2.0, refRH: 92, q10: 2.6, advice: "Store chilled at 1–2°C unwashed in breathable clamshell." },
  { key: "berries", name: "Fresh Berries", cat: "Fruits", emoji: "🫐", baseDays: 5, refTemp: 2.0, refRH: 92, q10: 2.6, advice: "Store chilled near 2°C with high humidity in original packaging." },
  { key: "orange", name: "Oranges & Citrus", cat: "Fruits", emoji: "🍊", baseDays: 21, refTemp: 6.0, refRH: 85, q10: 2.0, advice: "Store in produce bin (4–7°C) or cool dry pantry." },
  { key: "mango", name: "Fresh Mangoes", cat: "Fruits", emoji: "🥭", baseDays: 8, refTemp: 12.0, refRH: 85, q10: 2.3, advice: "Ripen at ambient; once soft, refrigerate at 10–12°C." },
  { key: "avocado", name: "Avocado", cat: "Fruits", emoji: "🥑", baseDays: 7, refTemp: 12.0, refRH: 65, q10: 2.4, advice: "Ripen at room temperature; chill once ripe to delay softening." },
  { key: "grape", name: "Table Grapes", cat: "Fruits", emoji: "🍇", baseDays: 14, refTemp: 1.0, refRH: 92, q10: 2.3, advice: "Store unwashed in perforated bag near 0–2°C." },
  { key: "watermelon", name: "Watermelon", cat: "Fruits", emoji: "🍉", baseDays: 14, refTemp: 12.0, refRH: 85, q10: 2.1, advice: "Whole melons keep best at 12–15°C; wrap cut slices and chill." },
  { key: "lemon", name: "Lemons & Limes", cat: "Fruits", emoji: "🍋", baseDays: 28, refTemp: 8.0, refRH: 85, q10: 1.9, advice: "Seal in crisper drawer bag to retain juice and prevent skin dehydration." },
  { key: "peach", name: "Peaches & Plums", cat: "Fruits", emoji: "🍑", baseDays: 8, refTemp: 2.0, refRH: 90, q10: 2.4, advice: "Ripen stem-side down at room temp, then chill at 1–3°C." },
  { key: "pineapple", name: "Fresh Pineapple", cat: "Fruits", emoji: "🍍", baseDays: 10, refTemp: 10.0, refRH: 85, q10: 2.2, advice: "Store whole at 8–10°C. Cut fruit must be chilled in airtight container." },
  { key: "kiwi", name: "Kiwi Fruit", cat: "Fruits", emoji: "🥝", baseDays: 18, refTemp: 2.0, refRH: 90, q10: 2.2, advice: "Keep at 0–2°C away from apples and bananas to prevent premature softening." },
  { key: "tomato", name: "Fresh Tomatoes", cat: "Vegetables", emoji: "🍅", baseDays: 10, refTemp: 13.0, refRH: 85, q10: 2.2, advice: "Keep stem-side up at room temp (12–15°C). Avoid refrigeration." },
  { key: "potato", name: "Potatoes", cat: "Vegetables", emoji: "🥔", baseDays: 60, refTemp: 12.0, refRH: 85, q10: 1.6, advice: "Cool, dark, ventilated dry pantry (10–12°C). Never refrigerate." },
  { key: "onion", name: "Onions", cat: "Vegetables", emoji: "🧅", baseDays: 45, refTemp: 15.0, refRH: 65, q10: 1.5, advice: "Store in dry ventilated mesh bags away from potatoes." },
  { key: "garlic", name: "Garlic Bulbs", cat: "Vegetables", emoji: "🧄", baseDays: 90, refTemp: 15.0, refRH: 65, q10: 1.4, advice: "Keep in wire mesh keeper in dry ambient pantry. Avoid plastic bags." },
  { key: "carrot", name: "Carrots", cat: "Vegetables", emoji: "🥕", baseDays: 30, refTemp: 3.0, refRH: 95, q10: 2.0, advice: "Remove green tops, store in perforated bag in high-humidity crisper." },
  { key: "broccoli", name: "Broccoli Crowns", cat: "Vegetables", emoji: "🥦", baseDays: 9, refTemp: 2.0, refRH: 95, q10: 2.6, advice: "Store loose in perforated bag in refrigerator crisper." },
  { key: "spinach", name: "Fresh Spinach", cat: "Vegetables", emoji: "🥬", baseDays: 6, refTemp: 2.0, refRH: 95, q10: 2.8, advice: "Line container with paper towels; store at 1–3°C at 90–95% RH." },
  { key: "lettuce", name: "Lettuce Greens", cat: "Vegetables", emoji: "🥬", baseDays: 8, refTemp: 2.0, refRH: 95, q10: 2.7, advice: "Crisper drawer in breathable bag away from ethylene fruits." },
  { key: "cucumber", name: "Cucumbers", cat: "Vegetables", emoji: "🥒", baseDays: 10, refTemp: 10.0, refRH: 90, q10: 2.2, advice: "Chilling sensitive; store in warmest refrigerator spot or pantry (10–12°C)." },
  { key: "pepper", name: "Bell Peppers", cat: "Vegetables", emoji: "🫑", baseDays: 12, refTemp: 8.0, refRH: 90, q10: 2.2, advice: "Store dry in crisper drawer (7–9°C)." },
  { key: "cabbage", name: "Cabbage", cat: "Vegetables", emoji: "🥗", baseDays: 35, refTemp: 2.0, refRH: 95, q10: 1.9, advice: "Keep whole head unwrapped in crisper drawer." },
  { key: "mushroom", name: "Mushrooms", cat: "Vegetables", emoji: "🍄", baseDays: 6, refTemp: 2.0, refRH: 90, q10: 2.8, advice: "Store in brown paper bag in refrigerator to prevent slimy condensation." },
  { key: "milk", name: "Whole Milk", cat: "Dairy", emoji: "🥛", baseDays: 10, refTemp: 3.0, refRH: 70, q10: 2.6, advice: "Keep strictly at 2–4°C on middle shelf, not door compartments." },
  { key: "yogurt", name: "Yogurt", cat: "Dairy", emoji: "🥣", baseDays: 18, refTemp: 4.0, refRH: 70, q10: 2.4, advice: "Keep sealed at 2–4°C; consume within 7–10 days of opening." },
  { key: "cheese", name: "Cheddar Cheese", cat: "Dairy", emoji: "🧀", baseDays: 45, refTemp: 4.0, refRH: 75, q10: 2.0, advice: "Wrap in parchment, then loosely in plastic wrap in dairy bin." },
  { key: "paneer", name: "Fresh Paneer", cat: "Dairy", emoji: "🧀", baseDays: 7, refTemp: 3.0, refRH: 75, q10: 2.8, advice: "Submerge in fresh water in airtight container; change water every 2 days." },
  { key: "butter", name: "Butter", cat: "Dairy", emoji: "🧈", baseDays: 60, refTemp: 4.0, refRH: 65, q10: 1.8, advice: "Store wrapped in cold refrigerator compartment or freeze." },
  { key: "egg", name: "Grade A Eggs", cat: "Dairy", emoji: "🥚", baseDays: 35, refTemp: 4.0, refRH: 70, q10: 2.0, advice: "Keep in carton on middle shelf to prevent moisture loss." },
  { key: "chicken", name: "Fresh Chicken Breast", cat: "Meat", emoji: "🍗", baseDays: 5, refTemp: 1.5, refRH: 75, q10: 2.8, advice: "Bottom refrigerator shelf at 0–2°C on rimmed tray. Cook within 48h." },
  { key: "beef", name: "Fresh Beef Steak", cat: "Meat", emoji: "🥩", baseDays: 7, refTemp: 1.5, refRH: 75, q10: 2.6, advice: "Store at 0–2°C in bottom chiller drawer; cook or freeze within 48h." },
  { key: "pork", name: "Pork Chops", cat: "Meat", emoji: "🥩", baseDays: 5, refTemp: 1.5, refRH: 75, q10: 2.7, advice: "Store tightly wrapped on lower cold shelf at 0–2°C." },
  { key: "salmon", name: "Fresh Salmon Fillet", cat: "Fish", emoji: "🐟", baseDays: 4, refTemp: 1.0, refRH: 90, q10: 3.0, advice: "Best over crushed ice at 0–1°C. Cook within 24–48 hours." },
  { key: "fish", name: "Fish Fillet", cat: "Fish", emoji: "🐟", baseDays: 4, refTemp: 1.0, refRH: 90, q10: 3.0, advice: "Ultra-perishable; seal tightly over ice pack at 0–2°C." },
  { key: "shrimp", name: "Raw Shrimp / Prawns", cat: "Fish", emoji: "🦐", baseDays: 3, refTemp: 0.5, refRH: 90, q10: 3.2, advice: "Keep on ice in refrigerator; prepare within 24–36h." },
  { key: "bread", name: "Sourdough / Bread", cat: "Bakery", emoji: "🍞", baseDays: 6, refTemp: 20.0, refRH: 55, q10: 1.8, advice: "Room temp in bread box. Never refrigerate (stales faster at 4°C)." },
  { key: "croissant", name: "Pastries & Croissants", cat: "Bakery", emoji: "🥐", baseDays: 4, refTemp: 20.0, refRH: 50, q10: 1.9, advice: "Keep at room temp in paper bag. Re-crisp in warm oven." },
  { key: "oats", name: "Rolled Oats", cat: "Grains", emoji: "🌾", baseDays: 180, refTemp: 20.0, refRH: 45, q10: 1.4, advice: "Airtight container in cool, dark pantry away from heat." },
  { key: "rice", name: "White & Brown Rice", cat: "Grains", emoji: "🍚", baseDays: 365, refTemp: 20.0, refRH: 45, q10: 1.3, advice: "Store sealed in dry cupboard away from moisture." },
  { key: "pasta", name: "Dry Pasta", cat: "Grains", emoji: "🍝", baseDays: 365, refTemp: 20.0, refRH: 45, q10: 1.3, advice: "Store in sealed jar in cool, dark pantry." },
];

let currentPredictedFood = {
  name: "Apples",
  category: "Fruits",
  emoji: "🍏",
  baseDays: 24,
  refTemp: 4.0,
  refRH: 90,
  q10: 2.2,
  advice: "Refrigerate in crisper drawer (2–4°C). Store separately from ethylene-sensitive produce."
};

function populateCommodityDatalist() {
  const datalist = document.getElementById("vsim-food-datalist");
  if (!datalist) return;
  datalist.innerHTML = knownCommodityList.map(c => `<option value="${escapeHtml(c.name)}">${c.emoji} ${escapeHtml(c.name)} (${c.cat})</option>`).join("");
}

function populateShelfLifePantrySelect(items) {
  const select = document.getElementById("vsim-pantry-select");
  if (!select) return;

  const validItems = (items || []).filter(i => i.food_name);
  if (validItems.length === 0) {
    select.innerHTML = `<option value="">-- No active pantry items --</option>`;
    return;
  }

  let html = `<option value="">-- Select from your pantry (${validItems.length} items) --</option>`;
  validItems.forEach(item => {
    const score = Math.round(item.freshness_score || 85);
    html += `<option value="${item._id}" data-name="${escapeHtml(item.food_name)}" data-cat="${escapeHtml(item.category || 'Fruits')}" data-temp="${item.storage_temperature || ''}" data-rh="${item.storage_humidity || ''}" data-score="${score}">
      ${escapeHtml(item.food_name)} - ${escapeHtml(item.category || 'Pantry')} (${score}%)
    </option>`;
  });
  select.innerHTML = html;
}

function resolveCommodityProfile(foodName, preferredCategory) {
  const clean = (foodName || "").trim().toLowerCase();
  if (!clean) return currentPredictedFood;

  // Search exact or partial in commodity list
  const match = knownCommodityList.find(c => clean.includes(c.key) || c.key.includes(clean) || clean.includes(c.name.toLowerCase()));
  if (match) {
    const cat = (preferredCategory && preferredCategory !== "auto") ? preferredCategory : match.cat;
    return {
      name: match.name,
      category: cat,
      emoji: match.emoji,
      baseDays: match.baseDays,
      refTemp: match.refTemp,
      refRH: match.refRH,
      q10: match.q10,
      advice: match.advice
    };
  }

  // Infer category from name keywords
  let inferredCat = "Fruits";
  if (/(milk|dairy|cheese|yogurt|butter|cream|paneer|egg)/i.test(clean)) inferredCat = "Dairy";
  else if (/(chicken|meat|beef|pork|poultry|steak|lamb|sausage)/i.test(clean)) inferredCat = "Meat";
  else if (/(fish|salmon|tuna|cod|seafood|shrimp|prawn|crab)/i.test(clean)) inferredCat = "Fish";
  else if (/(veg|spinach|lettuce|tomato|potato|onion|carrot|broccoli|cucumber|pepper|cabbage)/i.test(clean)) inferredCat = "Vegetables";
  else if (/(bread|bakery|croissant|cake|muffin|bagel|pastry)/i.test(clean)) inferredCat = "Bakery";
  else if (/(grain|rice|wheat|oat|flour|pasta|cereal|bean)/i.test(clean)) inferredCat = "Grains";

  const cat = (preferredCategory && preferredCategory !== "auto") ? preferredCategory : inferredCat;
  const emojis = { Fruits: "🍎", Vegetables: "🥦", Dairy: "🧀", Meat: "🥩", Fish: "🐟", Bakery: "🍞", Grains: "🌾", "Packaged Food": "📦", Other: "🍽️" };

  return {
    name: foodName.trim(),
    category: cat,
    emoji: emojis[cat] || "🥗",
    baseDays: cat === "Grains" ? 180 : cat === "Dairy" ? 12 : cat === "Meat" ? 6 : cat === "Fish" ? 4 : cat === "Bakery" ? 5 : 12,
    refTemp: cat === "Fish" ? 1.0 : cat === "Meat" ? 1.5 : cat === "Dairy" ? 3.0 : cat === "Bakery" || cat === "Grains" ? 20.0 : 4.0,
    refRH: 85,
    q10: cat === "Fish" ? 3.0 : cat === "Meat" ? 2.8 : cat === "Dairy" ? 2.6 : 2.2,
    advice: `Store ${cat} under proper refrigeration (${cat === 'Bakery' || cat === 'Grains' ? 'cool dry room temp' : '1–4°C'}) to delay Arrhenius kinetic spoilage.`
  };
}

function initShelfLifeViewSimulator() {
  const tempSlider = document.getElementById("vsim-temp");
  const rhSlider = document.getElementById("vsim-rh");
  const scoreSlider = document.getElementById("vsim-score");
  const pkgSelect = document.getElementById("vsim-packaging");
  const foodInput = document.getElementById("vsim-food-name-input");
  const categorySelect = document.getElementById("vsim-category-select");
  const pantrySelect = document.getElementById("vsim-pantry-select");

  populateCommodityDatalist();
  populateShelfLifePantrySelect(allRecentItems);

  if (tempSlider) tempSlider.addEventListener("input", runShelfLifeSimulation);
  if (rhSlider) rhSlider.addEventListener("input", runShelfLifeSimulation);
  if (scoreSlider) scoreSlider.addEventListener("input", runShelfLifeSimulation);
  if (pkgSelect) pkgSelect.addEventListener("change", runShelfLifeSimulation);

  // Custom Food Input event listeners
  if (foodInput) {
    foodInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        predictCustomFoodShelfLife();
      }
    });

    foodInput.addEventListener("input", () => {
      const val = foodInput.value.trim();
      if (val.length >= 2) {
        const resolved = resolveCommodityProfile(val, categorySelect?.value);
        const iconEl = document.getElementById("vsim-food-icon");
        if (iconEl) iconEl.textContent = resolved.emoji;
      }
    });
  }

  // Category select listener
  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      const name = foodInput ? foodInput.value.trim() : "";
      if (name) {
        predictCustomFoodShelfLife();
      }
    });
  }

  // Pantry item select listener
  if (pantrySelect) {
    pantrySelect.addEventListener("change", () => {
      const selected = pantrySelect.options[pantrySelect.selectedIndex];
      if (!selected || !selected.value) return;

      const name = selected.dataset.name;
      const cat = selected.dataset.cat;
      const score = selected.dataset.score;
      const temp = selected.dataset.temp;
      const rh = selected.dataset.rh;

      if (foodInput) foodInput.value = name;
      if (categorySelect && cat) categorySelect.value = cat;
      if (scoreSlider && score) scoreSlider.value = score;
      if (tempSlider && temp && !isNaN(temp)) tempSlider.value = temp;
      if (rhSlider && rh && !isNaN(rh)) rhSlider.value = rh;

      predictCustomFoodShelfLife();
    });
  }

  // Preset pills
  document.querySelectorAll("#view-shelf-life .preset-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#view-shelf-life .preset-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const name = btn.dataset.name;
      const cat = btn.dataset.cat || "Fruits";
      selectQuickFoodItem(name, cat);
    });
  });
}

/**
 * Quick button selection for popular foods
 */
function selectQuickFoodItem(name, category) {
  const foodInput = document.getElementById("vsim-food-name-input");
  const categorySelect = document.getElementById("vsim-category-select");

  if (foodInput) foodInput.value = name;
  if (categorySelect && category) categorySelect.value = category;

  predictCustomFoodShelfLife();
}

/**
 * Executes shelf-life prediction specifically for the user-entered food item
 */
async function predictCustomFoodShelfLife() {
  const foodInput = document.getElementById("vsim-food-name-input");
  const categorySelect = document.getElementById("vsim-category-select");
  const tempSlider = document.getElementById("vsim-temp");
  const rhSlider = document.getElementById("vsim-rh");

  const enteredName = foodInput ? foodInput.value.trim() : "Apples";
  if (!enteredName) {
    showToast("Please enter a food item name.", "warning");
    return;
  }

  const selectedCat = categorySelect ? categorySelect.value : "auto";
  const resolved = resolveCommodityProfile(enteredName, selectedCat);
  currentPredictedFood = resolved;

  // Update UI Icon & Category
  const iconEl = document.getElementById("vsim-food-icon");
  if (iconEl) iconEl.textContent = resolved.emoji;
  if (categorySelect && selectedCat === "auto") {
    categorySelect.value = resolved.category;
  }

  // Update optimal reference sliders if user hasn't explicitly set them
  if (tempSlider && resolved.refTemp !== undefined) {
    tempSlider.value = resolved.refTemp;
  }
  if (rhSlider && resolved.refRH !== undefined) {
    rhSlider.value = resolved.refRH;
  }

  // Run the Arrhenius Kinetic simulation
  await runShelfLifeSimulation();

  showToast(`Predicted shelf life for ${resolved.emoji} ${resolved.name} (${resolved.category})`, "success");
}

async function runShelfLifeSimulation() {
  const tempSlider = document.getElementById("vsim-temp");
  const rhSlider = document.getElementById("vsim-rh");
  const scoreSlider = document.getElementById("vsim-score");
  const pkgSelect = document.getElementById("vsim-packaging");
  const foodInput = document.getElementById("vsim-food-name-input");
  const categorySelect = document.getElementById("vsim-category-select");

  if (!tempSlider || !rhSlider || !scoreSlider) return;

  const temp = parseFloat(tempSlider.value);
  const rh = parseFloat(rhSlider.value);
  const score = parseFloat(scoreSlider.value);
  const pkg = pkgSelect ? pkgSelect.value : "Standard Pack";

  const tEl = document.getElementById("vsim-temp-val");
  const rEl = document.getElementById("vsim-rh-val");
  const sEl = document.getElementById("vsim-score-val");
  if (tEl) tEl.textContent = `${temp.toFixed(1)}°C`;
  if (rEl) rEl.textContent = `${rh.toFixed(0)}%`;
  if (sEl) sEl.textContent = `${score.toFixed(0)}%`;

  const foodName = foodInput ? foodInput.value.trim() || currentPredictedFood.name : currentPredictedFood.name;
  const categoryVal = (categorySelect && categorySelect.value !== "auto") ? categorySelect.value : currentPredictedFood.category;

  try {
    // Call backend Arrhenius kinetic simulation endpoint
    const simRes = await api.simulateShelfLife({
      category: categoryVal,
      food_name: foodName,
      storage_temperature: temp,
      storage_humidity: rh,
      current_freshness_score: score,
      packaging_type: pkg
    });

    renderSimulationResults(simRes);
  } catch (err) {
    // Dynamic client-side Arrhenius fallback
    const resolved = resolveCommodityProfile(foodName, categoryVal);
    const deltaT = temp - resolved.refTemp;
    const kineticMultiplier = Math.pow(resolved.q10, deltaT / 10);
    const rhDiff = Math.abs(rh - resolved.refRH);
    const rhFactor = 1 + (rhDiff > 15 ? (rhDiff - 15) * 0.015 : 0);
    const pkgFactors = { "Vacuum Pack": 1.85, "Modified Atmosphere Bag": 1.55, "Clamshell Punnet": 1.15, "Standard Pack": 1.0, "Open Air": 0.7 };
    const pkgMultiplier = pkgFactors[pkg] || 1.0;

    const effective = Math.max(0.1, (kineticMultiplier * rhFactor) / pkgMultiplier);
    const baseDays = resolved.baseDays * (score / 100);
    const days = Math.max(0.2, baseDays / effective);

    const projectedExpiryDate = new Date();
    projectedExpiryDate.setDate(projectedExpiryDate.getDate() + Math.ceil(days));

    const fallbackRes = {
      food_name: resolved.name,
      category: resolved.category,
      emoji: resolved.emoji,
      storage_advice: resolved.advice,
      predicted_remaining_days: parseFloat(days.toFixed(1)),
      adjusted_expiry_date: projectedExpiryDate.toISOString().split("T")[0],
      daily_degradation_rate_pct: parseFloat((100 / Math.max(1, baseDays) * effective).toFixed(2)),
      temp_acceleration_factor: parseFloat(kineticMultiplier.toFixed(2)),
      storage_stress_level: effective > 1.8 ? "Critical" : effective > 1.2 ? "Moderate" : "Optimal",
      forecast_7_days: Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        const tracker = Math.max(0, score - (i + 1) * (100 / Math.max(1, baseDays) * effective));
        return {
          day_offset: i + 1,
          date: d.toISOString().split("T")[0],
          projected_freshness_score: Math.round(tracker),
          status: tracker >= 70 ? "Fresh" : tracker >= 40 ? "Near Spoilage" : "Spoiled",
          risk_level: tracker >= 70 ? "Low" : tracker >= 40 ? "High" : "Critical"
        };
      })
    };
    renderSimulationResults(fallbackRes);
  }
}

function renderSimulationResults(data) {
  const daysEl = document.getElementById("vsim-days");
  const stressBadge = document.getElementById("vsim-stress-badge");
  const barEl = document.getElementById("vsim-bar");
  const rateEl = document.getElementById("vsim-rate");
  const q10El = document.getElementById("vsim-q10-val");
  const recEl = document.getElementById("vsim-recommendation-text");
  const activeNameEl = document.getElementById("vsim-active-food-name");
  const activeEmojiEl = document.getElementById("vsim-active-emoji");
  const activeCatEl = document.getElementById("vsim-active-category");
  const activeExpiryEl = document.getElementById("vsim-adjusted-expiry");

  const displayName = data.food_name || currentPredictedFood.name || "Food Item";
  const displayEmoji = data.emoji || currentPredictedFood.emoji || "🥗";
  const displayCat = data.category || currentPredictedFood.category || "Pantry";

  if (activeNameEl) activeNameEl.textContent = displayName;
  if (activeEmojiEl) activeEmojiEl.textContent = displayEmoji;
  if (activeCatEl) activeCatEl.textContent = `${displayCat} Category`;
  if (activeExpiryEl) {
    activeExpiryEl.textContent = data.adjusted_expiry_date ? `Projected Expiry: ${new Date(data.adjusted_expiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : `Projected: In ~${Math.ceil(data.predicted_remaining_days)} days`;
  }

  if (daysEl) daysEl.textContent = `${Number(data.predicted_remaining_days).toFixed(1)} Days`;

  if (rateEl) rateEl.textContent = `${data.daily_degradation_rate_pct || 4.2}% / day`;
  if (q10El) q10El.textContent = `${data.temp_acceleration_factor || 1.0}x Base`;

  const stress = data.storage_stress_level || "Optimal";
  if (stressBadge) {
    stressBadge.textContent = `Thermal Stress: ${stress}`;
    stressBadge.className = stress === "Optimal" ? "badge badge-fresh" : stress === "Moderate" ? "badge badge-warning" : "badge badge-danger";
  }

  if (barEl) {
    const base = currentPredictedFood.baseDays || 14;
    const pct = Math.min(100, Math.round((data.predicted_remaining_days / base) * 100));
    barEl.style.width = `${Math.max(5, pct)}%`;
    barEl.style.backgroundColor = pct > 50 ? "#10b981" : pct > 20 ? "#f59e0b" : "#ef4444";
  }

  if (recEl) {
    const specificAdvice = data.storage_advice || currentPredictedFood.advice;
    if (stress === "Optimal") {
      recEl.innerHTML = `<strong>Optimal Storage:</strong> ${escapeHtml(specificAdvice || 'Storage conditions within recommended bounds. Arrhenius kinetic decay rate is minimized.')}`;
      recEl.style.color = "#047857";
      recEl.style.background = "#f0fdf4";
      recEl.style.borderColor = "#bbf7d0";
    } else if (stress === "Moderate") {
      recEl.innerHTML = `<strong>Attention Required:</strong> Temperature or humidity accelerated decay. ${escapeHtml(specificAdvice || 'Consume or preserve within 3–4 days to prevent spoilage.')}`;
      recEl.style.color = "#b45309";
      recEl.style.background = "#fffbeb";
      recEl.style.borderColor = "#fef3c7";
    } else {
      recEl.innerHTML = `<strong>Critical Thermal Stress!</strong> Rapid microbial and enzymatic breakdown occurring. Move to recommended temperature immediately or consume now.`;
      recEl.style.color = "#b91c1c";
      recEl.style.background = "#fef2f2";
      recEl.style.borderColor = "#fecaca";
    }
  }

  // Render 7-day trajectory cards
  const trajectoryContainer = document.getElementById("vsim-trajectory-container");
  if (trajectoryContainer && data.forecast_7_days) {
    trajectoryContainer.innerHTML = data.forecast_7_days.map(f => {
      const score = Math.round(f.projected_freshness_score);
      const badgeClass = score >= 70 ? "badge-fresh" : score >= 40 ? "badge-warning" : "badge-danger";
      const dateStr = f.date ? new Date(f.date).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }) : `Day +${f.day_offset}`;

      return `
        <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 8px; text-align: center; box-shadow: var(--shadow-sm); transition: transform 0.2s ease;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${dateStr}</div>
          <div style="font-size: 18px; font-weight: 800; color: ${score >= 70 ? 'var(--primary)' : score >= 40 ? '#d97706' : '#dc2626'}; margin: 4px 0;">${score}%</div>
          <span class="badge ${badgeClass}" style="font-size: 10px; padding: 2px 6px;">${escapeHtml(f.status || 'Good')}</span>
        </div>
      `;
    }).join("");
  }
}

// -----------------------------------------------------------------------------
// FEATURE 3: Storage Recommendations Directory
// -----------------------------------------------------------------------------
async function loadStorageGuidelines() {
  const container = document.getElementById("guidelines-directory-container");
  if (!container) return;

  try {
    if (!cachedGuidelines) {
      const res = await api.getStorageGuidelines();
      cachedGuidelines = res.guidelines || {};
    }
    renderGuidelineCards(cachedGuidelines, currentGuidelineFilter);
  } catch (err) {
    console.error("Error loading guidelines:", err);
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">Failed to load storage guidelines: ${escapeHtml(err.message)}</p>`;
  }
}

function renderGuidelineCards(guidelines, filterCategory = "all") {
  const container = document.getElementById("guidelines-directory-container");
  if (!container) return;

  let entries = Object.entries(guidelines);
  if (filterCategory !== "all") {
    entries = entries.filter(([k, _]) => k.toLowerCase() === filterCategory.toLowerCase());
  }

  if (entries.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">No storage guidelines match your filter.</div>`;
    return;
  }

  container.innerHTML = entries.map(([categoryKey, data]) => {
    const icon = getCategoryEmoji(categoryKey);

    return `
      <div class="guideline-card">
        <div class="guideline-header">
          <div class="guideline-title">
            <span style="font-size: 22px;">${icon}</span>
            <span>${escapeHtml(data.name || categoryKey)}</span>
          </div>
          <span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:11px;">${escapeHtml(data.storage_type || 'Refrigerate')}</span>
        </div>

        <div class="guideline-metrics">
          <div class="guideline-metric-item">
            <span class="guideline-metric-label">Optimal Temp</span>
            <span class="guideline-metric-val">${data.temp_min}°C to ${data.temp_max}°C</span>
          </div>
          <div class="guideline-metric-item">
            <span class="guideline-metric-label">Humidity</span>
            <span class="guideline-metric-val">${data.humidity_min}% to ${data.humidity_max}% RH</span>
          </div>
        </div>

        <div class="guideline-tip-box">
          <strong>Preservation Advice:</strong> ${escapeHtml(data.tips || "Maintain clean, dry container.")}
        </div>

        <div class="guideline-ethylene-box">
          <strong>Ethylene:</strong> ${escapeHtml(data.ethylene || "Neutral")}
        </div>

        <div style="font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 8px;">
          ⏱️ <strong>Typical Lifespan:</strong> ${escapeHtml(data.shelf_life_guidance || "1-2 weeks")}
        </div>
      </div>
    `;
  }).join("");
}

function filterGuidelines(category, btn) {
  currentGuidelineFilter = category;
  if (btn) {
    document.querySelectorAll("#view-recommendations .preset-pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }
  if (cachedGuidelines) {
    renderGuidelineCards(cachedGuidelines, category);
  } else {
    loadStorageGuidelines();
  }
}

// -----------------------------------------------------------------------------
// FEATURE 4: Expiry and Spoilage Alerts
// -----------------------------------------------------------------------------
async function loadConsumerAlerts() {
  const container = document.getElementById("full-alerts-list-container");
  const actionBadge = document.getElementById("action-alerts-badge");
  const tabCount = document.getElementById("tab-alerts-count");

  try {
    const today = new Date();
    today.setHours(0,0,0,0);

    // Identify attention items from inventory
    const attentionItems = (allRecentItems || []).map(item => {
      let diffDays = 999;
      if (item.expiry_date) {
        const exp = new Date(item.expiry_date);
        diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      }

      let severity = "safe";
      if (diffDays <= 0 || item.freshness_status === "Spoiled") severity = "critical";
      else if (diffDays <= 2) severity = "warning";
      else if (diffDays <= 3) severity = "notice";

      return {
        ...item,
        diffDays,
        severity
      };
    }).filter(i => i.severity !== "safe");

    allAlertItems = attentionItems;

    // Update Action Card Badge & Tab Count & Sidebar Badge
    const totalCount = attentionItems.length;
    if (actionBadge) {
      actionBadge.textContent = `${totalCount} ALERTS`;
      if (totalCount > 0) {
        actionBadge.className = "action-card-badge badge-danger";
        actionBadge.style.background = "#fee2e2";
        actionBadge.style.color = "#dc2626";
      } else {
        actionBadge.className = "action-card-badge badge-fresh";
        actionBadge.style.background = "#dcfce7";
        actionBadge.style.color = "#166534";
      }
    }
    if (tabCount) {
      tabCount.textContent = totalCount;
      tabCount.style.display = totalCount > 0 ? "inline-block" : "none";
    }
    const sidebarBadge = document.getElementById("sidebar-alerts-badge");
    if (sidebarBadge) {
      sidebarBadge.textContent = totalCount;
      sidebarBadge.style.display = totalCount > 0 ? "inline-block" : "none";
    }

    renderConsumerAlertsList(currentAlertsFilter);
  } catch (err) {
    console.error("Alerts error:", err);
    if (container) container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">Failed to process alerts: ${escapeHtml(err.message)}</p>`;
  }
}

function renderConsumerAlertsList(filter = "all") {
  const container = document.getElementById("full-alerts-list-container");
  if (!container) return;

  let items = allAlertItems;
  if (filter !== "all") {
    items = items.filter(i => i.severity === filter);
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-lg); padding: 36px 20px; text-align: center;">
        <span style="font-size: 36px; display: block; margin-bottom: 8px;">✨</span>
        <h4 style="color: #166534; font-size: 16px; margin: 0 0 6px 0;">All Food Items Fresh & Safe</h4>
        <p style="color: #15803d; font-size: 13px; max-width: 400px; margin: 0 auto;">
          No items match the "${escapeHtml(filter)}" criteria. All pantry foods are within their designated shelf life.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${items.map(item => {
        const icon = getCategoryEmoji(item.category);
        const badgeClass = item.severity === "critical" ? "badge-danger" : item.severity === "warning" ? "badge-warning" : "badge";
        const badgeStyle = item.severity === "notice" ? "background:#fef3c7; color:#d97706;" : "";
        const countdownText = item.diffDays <= 0 ? "EXPIRED / TODAY" : item.diffDays === 1 ? "EXPIRES TOMORROW" : `EXPIRES IN ${item.diffDays} DAYS`;

        return `
          <div style="background: white; border: 1px solid var(--border-color); border-left: 4px solid ${item.severity === 'critical' ? '#ef4444' : item.severity === 'warning' ? '#f59e0b' : '#38bdf8'}; border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span style="font-size: 28px;">${icon}</span>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: var(--text-main); font-size: 15px;">${escapeHtml(item.food_name)}</strong>
                  <span class="badge ${badgeClass}" style="${badgeStyle} font-size: 11px;">${countdownText}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  ${escapeHtml(item.category)} &bull; ${item.quantity} ${escapeHtml(item.unit)} &bull; Expiry: <strong>${escapeHtml(item.expiry_date)}</strong> &bull; Storage: ${escapeHtml(item.location || 'Pantry')}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-primary btn-sm" onclick="quickAiForItem('${item.id}', '${escapeHtml(item.food_name)}')">
                ⚡ Scan with AI
              </button>
              <a href="food-details.html?id=${item.id}" class="btn btn-secondary btn-sm">
                Inspect Item
              </a>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function filterAlertsView(filter, btn) {
  currentAlertsFilter = filter;
  if (btn) {
    document.querySelectorAll("#view-alerts .consumer-nav-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }
  renderConsumerAlertsList(filter);
}

async function markAllNotificationsAcknowledge() {
  try {
    await api.markAllNotificationsRead();
    showToast("All alert notifications marked as acknowledged.", "success");
    loadConsumerAlerts();
  } catch (err) {
    showToast("Error acknowledging alerts: " + err.message, "error");
  }
}

// -----------------------------------------------------------------------------
// FEATURE 5: Scan History & Detail Modal
// -----------------------------------------------------------------------------
async function loadConsumerScanHistory() {
  const container = document.getElementById("full-history-grid-container");
  const countBadge = document.getElementById("history-count-badge");
  const categoryFilter = document.getElementById("history-category-filter")?.value || "all";
  const searchInput = (document.getElementById("history-search-input")?.value || "").trim();

  if (!container) return;

  try {
    const params = { limit: 40 };
    if (categoryFilter && categoryFilter !== "all") params.category = categoryFilter;
    if (searchInput) params.search = searchInput;

    const history = await api.getFreshnessHistory(params);

    if (countBadge) {
      countBadge.textContent = `${history.length} Scan Records Found`;
    }

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <span style="font-size: 40px; display: block; margin-bottom: 10px;">📸</span>
          <h4 style="color: var(--text-main); margin: 0 0 6px 0;">No Scan Records Found</h4>
          <p style="font-size: 13px; max-width: 320px; margin: 0 auto 16px auto;">
            No food scans match your current search or category filter. Run an AI scan to diagnose items!
          </p>
          <button type="button" class="btn btn-primary btn-sm" onclick="switchConsumerView('scanner')">+ New AI Scan</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="scan-history-grid">
        ${history.map(record => {
          const score = Math.round(record.freshness_score || 85);
          const label = record.freshness_label || "Fresh";
          const badgeClass = (label === "Fresh" || label === "Optimal") ? "badge-fresh" : (label === "Spoiled" || label === "Critical") ? "badge-danger" : "badge-warning";
          const dateStr = record.analysis_date ? new Date(record.analysis_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recently";
          const imgSrc = record.image_url ? record.image_url : "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80";
          const defects = (record.detected_defects && record.detected_defects.length > 0) ? record.detected_defects.join(", ") : "No Defects";

          return `
            <div class="scan-history-card">
              <div class="scan-history-thumb-wrap">
                <img src="${imgSrc}" alt="${escapeHtml(record.food_name)}" class="scan-history-thumb" onerror="this.src='https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80'">
                <span class="badge ${badgeClass}" style="position: absolute; top: 10px; right: 10px; font-size: 11px;">${escapeHtml(label)}</span>
              </div>
              <div class="scan-history-body">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <strong style="color: var(--text-main); font-size: 15px;">${escapeHtml(record.food_name)}</strong>
                  <span class="badge" style="background:#f1f5f9; color:#475569; font-size:10px;">${escapeHtml(record.category)}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; margin-top: 4px;">
                  <div>Score: <strong style="color:var(--primary);">${score}%</strong></div>
                  <div>Shelf Life: <strong>${Number(record.estimated_shelf_life_days || 7).toFixed(1)}d</strong></div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  🕒 ${dateStr} &bull; Defects: <em>${escapeHtml(defects)}</em>
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="openScanDetailModal('${record.id}')">
                    Inspect Diagnostics &rarr;
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } catch (err) {
    console.error("Error loading history:", err);
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">Failed to load scan history: ${escapeHtml(err.message)}</p>`;
  }
}

function debounceSearchHistory(val) {
  clearTimeout(searchHistoryTimeout);
  searchHistoryTimeout = setTimeout(() => {
    loadConsumerScanHistory();
  }, 350);
}

async function openScanDetailModal(recordId) {
  const modal = document.getElementById("modal-scan-detail");
  if (!modal) return;

  try {
    const record = await api.getFreshnessRecord(recordId);

    const nameEl = document.getElementById("mdetail-food-name");
    const subEl = document.getElementById("mdetail-subtitle");
    const catBadge = document.getElementById("mdetail-category-badge");
    const dateEl = document.getElementById("mdetail-date");
    const statusBadge = document.getElementById("mdetail-status-badge");
    const scoreEl = document.getElementById("mdetail-score");
    const shelfEl = document.getElementById("mdetail-shelflife");
    const confEl = document.getElementById("mdetail-confidence");
    const imgEl = document.getElementById("mdetail-img");

    const colScoreEl = document.getElementById("mdetail-color-score");
    const texScoreEl = document.getElementById("mdetail-texture-score");
    const riskScoreEl = document.getElementById("mdetail-risk-score");
    const defTextEl = document.getElementById("mdetail-defects-text");
    const moldFlag = document.getElementById("mdetail-mold-flag");
    const bruiseFlag = document.getElementById("mdetail-bruise-flag");
    const modelEl = document.getElementById("mdetail-model-version");
    const recsList = document.getElementById("mdetail-recs-list");

    if (nameEl) nameEl.textContent = record.food_name || "Food Sample";
    if (subEl) subEl.textContent = `Diagnostic Record ID: ${record.id}`;
    if (catBadge) catBadge.textContent = record.category || "General";
    if (dateEl) dateEl.textContent = record.analysis_date ? new Date(record.analysis_date).toLocaleString() : "Recently analyzed";

    const label = record.freshness_label || "Fresh";
    if (statusBadge) {
      statusBadge.textContent = label;
      statusBadge.className = (label === "Fresh" || label === "Optimal") ? "badge badge-fresh" : (label === "Spoiled" || label === "Critical") ? "badge badge-danger" : "badge badge-warning";
    }

    const score = Math.round(record.freshness_score || 85);
    if (scoreEl) scoreEl.textContent = `${score}%`;
    if (shelfEl) shelfEl.textContent = `${Number(record.estimated_shelf_life_days || 7).toFixed(1)}d`;
    if (confEl) confEl.textContent = `${Math.round((record.confidence || 0.94) * 100)}%`;

    if (imgEl) {
      imgEl.src = record.image_url || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80";
      imgEl.onerror = () => { imgEl.src = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80"; };
    }

    if (colScoreEl) colScoreEl.textContent = `${Math.round(record.color_score || 92)}%`;
    if (texScoreEl) texScoreEl.textContent = `${Math.round(record.texture_score || 94)}%`;

    const risk = record.spoilage_risk_level || "Low";
    if (riskScoreEl) {
      riskScoreEl.textContent = risk;
      riskScoreEl.style.color = (risk === "Critical" || risk === "High") ? "#dc2626" : risk === "Moderate" ? "#d97706" : "#16a34a";
    }

    const defects = (record.detected_defects && record.detected_defects.length > 0) ? record.detected_defects.join(", ") : "No visual defects or anomalies detected.";
    if (defTextEl) defTextEl.textContent = defects;

    if (moldFlag) {
      moldFlag.textContent = record.mold_detected ? "YES" : "No";
      moldFlag.style.color = record.mold_detected ? "#dc2626" : "#16a34a";
    }
    if (bruiseFlag) {
      bruiseFlag.textContent = record.bruising_detected ? "YES" : "No";
      bruiseFlag.style.color = record.bruising_detected ? "#d97706" : "#16a34a";
    }

    if (modelEl) modelEl.textContent = record.model_version || "cv-arrhenius-v2.4";

    if (recsList) {
      if (record.recommendations && record.recommendations.storage_recommendations) {
        const storageRecs = record.recommendations.storage_recommendations.join(" ");
        const consumeRecs = (record.recommendations.consumption_recommendations || []).join(" ");
        recsList.innerHTML = `<p style="margin:0 0 6px 0;"><strong>Storage:</strong> ${escapeHtml(storageRecs)}</p><p style="margin:0;"><strong>Consumption:</strong> ${escapeHtml(consumeRecs)}</p>`;
      } else {
        recsList.textContent = getStorageRecommendationForCategory(record.category, label);
      }
    }

    modal.classList.add("active");
  } catch (err) {
    showToast("Error retrieving scan details: " + err.message, "error");
  }
}

function closeScanDetailModal() {
  const modal = document.getElementById("modal-scan-detail");
  if (modal) modal.classList.remove("active");
}

async function seedDatasetItems() {
  try {
    showToast("Importing food items from AI freshness datasets...", "info");
    const res = await api.seedDatasetInventory();
    showToast(res.message || "Loaded food items from datasets successfully!", "success");
    await loadOverviewData();
  } catch (err) {
    showToast("Failed to load dataset items: " + (err.message || err), "error");
  }
}

window.seedDatasetItems = seedDatasetItems;

