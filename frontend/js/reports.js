/**
 * Food Freshness Monitoring Platform - Visual Reports Controller
 * Manages 7 Summary Cards, 6 Chart.js Interactive Visualizations,
 * Multi-attribute Filtering, Sorting, Pagination, and CSV/PDF/Excel Exports.
 */

// Application State
const state = {
  rawResponse: null,
  allItems: [],
  filteredItems: [],
  categories: [],
  activeFilters: {
    search: "",
    category: "all",
    status: "all",
    storage_type: "all",
    date_basis: "expiry_date",
    start_date: "",
    end_date: "",
    expiry_horizon: "all"
  },
  sorting: {
    column: "expiry_date",
    ascending: true
  },
  pagination: {
    currentPage: 1,
    pageSize: 10
  },
  charts: {
    freshnessDist: null,
    invStatus: null,
    catStatus: null,
    expiryTimeline: null,
    scoreDist: null,
    foodWaste: null
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!api.requireAuth()) return;

  setupEventListeners();
  await loadReportsData();
});

/**
 * Register all UI interaction event listeners
 */
function setupEventListeners() {
  // 1. Search Box with Debouncing
  const searchInput = document.getElementById("report-search-input");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.activeFilters.search = e.target.value.trim();
        state.pagination.currentPage = 1;
        applyClientFiltersAndRender();
      }, 250);
    });
  }

  // 2. Dropdown Filters
  const catFilter = document.getElementById("report-category-filter");
  if (catFilter) {
    catFilter.addEventListener("change", (e) => {
      state.activeFilters.category = e.target.value;
      state.pagination.currentPage = 1;
      loadReportsData();
    });
  }

  const statusFilter = document.getElementById("report-status-filter");
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      setStatusFilter(e.target.value, false);
    });
  }

  const storageFilter = document.getElementById("report-storage-filter");
  if (storageFilter) {
    storageFilter.addEventListener("change", (e) => {
      state.activeFilters.storage_type = e.target.value;
      state.pagination.currentPage = 1;
      loadReportsData();
    });
  }

  const dateBasisSelect = document.getElementById("report-date-basis");
  if (dateBasisSelect) {
    dateBasisSelect.addEventListener("change", (e) => {
      state.activeFilters.date_basis = e.target.value;
      if (state.activeFilters.start_date || state.activeFilters.end_date) {
        loadReportsData();
      }
    });
  }

  const startDateInput = document.getElementById("report-start-date");
  if (startDateInput) {
    startDateInput.addEventListener("change", (e) => {
      state.activeFilters.start_date = e.target.value;
      clearActiveHorizonPill();
      state.pagination.currentPage = 1;
      loadReportsData();
    });
  }

  const endDateInput = document.getElementById("report-end-date");
  if (endDateInput) {
    endDateInput.addEventListener("change", (e) => {
      state.activeFilters.end_date = e.target.value;
      clearActiveHorizonPill();
      state.pagination.currentPage = 1;
      loadReportsData();
    });
  }

  // 3. Quick Date Range Buttons
  const horizonPills = document.querySelectorAll(".pill-btn");
  horizonPills.forEach(btn => {
    btn.addEventListener("click", () => {
      horizonPills.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const range = btn.dataset.range;
      applyQuickDateRange(range);
    });
  });

  // 4. Reset Filters Button
  const resetBtn = document.getElementById("btn-reset-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetAllFilters);
  }

  // 5. Refresh Data Button
  const refreshBtn = document.getElementById("btn-refresh-data");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadReportsData(true));
  }

  // 6. Summary KPI Card Clicks (Filter Table & Smooth Scroll)
  setupSummaryCardClicks();

  // 7. Table Header Sorting
  setupTableSorting();

  // 8. Pagination Controls
  const pageSizeSelect = document.getElementById("table-page-size");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      state.pagination.pageSize = parseInt(e.target.value, 10) || 10;
      state.pagination.currentPage = 1;
      renderTable();
    });
  }

  const prevBtn = document.getElementById("btn-prev-page");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderTable();
      }
    });
  }

  const nextBtn = document.getElementById("btn-next-page");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const maxPages = Math.ceil(state.filteredItems.length / state.pagination.pageSize) || 1;
      if (state.pagination.currentPage < maxPages) {
        state.pagination.currentPage++;
        renderTable();
      }
    });
  }

  // 9. Export Buttons
  const exportCsvBtn = document.getElementById("btn-export-csv");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => downloadFilteredFile("/reports/export-csv", "food_freshness_report.csv"));
  }

  const exportPdfBtn = document.getElementById("btn-export-pdf");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => downloadFilteredFile("/reports/export-pdf", "food_freshness_report.pdf"));
  }

  const exportExcelBtn = document.getElementById("btn-export-excel");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", () => downloadFilteredFile("/reports/export-excel", "food_freshness_inventory.xlsx"));
  }

  const printBtn = document.getElementById("btn-print-report");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }
}

/**
 * Configure click actions on the 7 summary KPI cards
 */
function setupSummaryCardClicks() {
  const cardMap = [
    { id: "card-total", status: "all" },
    { id: "card-fresh", status: "Fresh" },
    { id: "card-expired", status: "Expired" },
    { id: "card-spoiled", status: "Spoiled" },
    { id: "card-at-risk", status: "At Risk" },
    { id: "card-not-analyzed", status: "Not Analyzed" },
    { id: "card-nearing-expiry", status: "Nearing Expiry" },
  ];

  cardMap.forEach(({ id, status }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", () => {
        setStatusFilter(status, true);
        scrollToTable();
      });
    }
  });
}

/**
 * Smoothly scrolls the viewport to the inventory table
 */
function scrollToTable() {
  const tableSec = document.getElementById("inventory-table-section");
  if (tableSec) {
    tableSec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Quick date pill range calculation
 */
function applyQuickDateRange(range) {
  const today = new Date();
  const format = (d) => d.toISOString().split("T")[0];

  const startInput = document.getElementById("report-start-date");
  const endInput = document.getElementById("report-end-date");

  state.activeFilters.expiry_horizon = range;

  if (range === "all") {
    state.activeFilters.start_date = "";
    state.activeFilters.end_date = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
  } else if (range === "today") {
    const todayStr = format(today);
    state.activeFilters.start_date = todayStr;
    state.activeFilters.end_date = todayStr;
    if (startInput) startInput.value = todayStr;
    if (endInput) endInput.value = todayStr;
  } else if (range === "3days") {
    const future = new Date(today);
    future.setDate(today.getDate() + 3);
    state.activeFilters.start_date = format(today);
    state.activeFilters.end_date = format(future);
    if (startInput) startInput.value = state.activeFilters.start_date;
    if (endInput) endInput.value = state.activeFilters.end_date;
  } else if (range === "7days") {
    const future = new Date(today);
    future.setDate(today.getDate() + 7);
    state.activeFilters.start_date = format(today);
    state.activeFilters.end_date = format(future);
    if (startInput) startInput.value = state.activeFilters.start_date;
    if (endInput) endInput.value = state.activeFilters.end_date;
  } else if (range === "30days") {
    const future = new Date(today);
    future.setDate(today.getDate() + 30);
    state.activeFilters.start_date = format(today);
    state.activeFilters.end_date = format(future);
    if (startInput) startInput.value = state.activeFilters.start_date;
    if (endInput) endInput.value = state.activeFilters.end_date;
  }

  state.pagination.currentPage = 1;
  loadReportsData();
}

function clearActiveHorizonPill() {
  document.querySelectorAll(".pill-btn").forEach(p => p.classList.remove("active"));
}

/**
 * Sets the active status filter, updates dropdown and KPI card active highlights
 */
function setStatusFilter(statusVal, shouldScroll = false) {
  state.activeFilters.status = statusVal;

  // Sync status dropdown
  const statusSelect = document.getElementById("report-status-filter");
  if (statusSelect) {
    statusSelect.value = statusVal;
  }

  // Highlight corresponding card
  const cardMap = {
    "all": "card-total",
    "Fresh": "card-fresh",
    "Expired": "card-expired",
    "Spoiled": "card-spoiled",
    "At Risk": "card-at-risk",
    "Not Analyzed": "card-not-analyzed",
    "Nearing Expiry": "card-nearing-expiry"
  };

  document.querySelectorAll(".kpi-stat-card").forEach(c => c.classList.remove("active-filter"));
  const activeCardId = cardMap[statusVal];
  if (activeCardId) {
    const el = document.getElementById(activeCardId);
    if (el) el.classList.add("active-filter");
  }

  state.pagination.currentPage = 1;
  applyClientFiltersAndRender();

  if (shouldScroll) {
    scrollToTable();
  }
}

/**
 * Filter by both category and status (e.g. when clicking stacked bar segment)
 */
function setCategoryAndStatusFilter(catName, statusName) {
  if (catName && catName !== "all") {
    state.activeFilters.category = catName;
    const catSelect = document.getElementById("report-category-filter");
    if (catSelect) catSelect.value = catName;
  }
  if (statusName) {
    setStatusFilter(statusName, true);
  } else {
    applyClientFiltersAndRender();
    scrollToTable();
  }
}

/**
 * Reset all filters to default
 */
function resetAllFilters() {
  state.activeFilters = {
    search: "",
    category: "all",
    status: "all",
    storage_type: "all",
    date_basis: "expiry_date",
    start_date: "",
    end_date: "",
    expiry_horizon: "all"
  };
  state.pagination.currentPage = 1;

  // Reset inputs in DOM
  const searchInput = document.getElementById("report-search-input");
  if (searchInput) searchInput.value = "";

  const catSelect = document.getElementById("report-category-filter");
  if (catSelect) catSelect.value = "all";

  const statusSelect = document.getElementById("report-status-filter");
  if (statusSelect) statusSelect.value = "all";

  const storageSelect = document.getElementById("report-storage-filter");
  if (storageSelect) storageSelect.value = "all";

  const basisSelect = document.getElementById("report-date-basis");
  if (basisSelect) basisSelect.value = "expiry_date";

  const startInput = document.getElementById("report-start-date");
  if (startInput) startInput.value = "";

  const endInput = document.getElementById("report-end-date");
  if (endInput) endInput.value = "";

  document.querySelectorAll(".pill-btn").forEach(p => p.classList.remove("active"));
  const allTimePill = document.getElementById("btn-range-all");
  if (allTimePill) allTimePill.classList.add("active");

  document.querySelectorAll(".kpi-stat-card").forEach(c => c.classList.remove("active-filter"));
  const totalCard = document.getElementById("card-total");
  if (totalCard) totalCard.classList.add("active-filter");

  loadReportsData(true);
}

/**
 * Fetch live reporting and inventory data from FastAPI backend
 */
async function loadReportsData(showFeedback = false) {
  const tableBody = document.getElementById("reports-table-body");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 40px;">
          <span class="spinner" style="display:inline-block; border-color:#0d9488; border-top-color:transparent;"></span>
          <p style="margin-top:10px; color:var(--text-muted); font-weight:600;">Loading visual reports & inventory audit records...</p>
        </td>
      </tr>
    `;
  }

  if (showFeedback) {
    showToast("Refreshing reports data from server...", "info");
  }

  try {
    const q = new URLSearchParams();
    if (state.activeFilters.category !== "all") q.append("category", state.activeFilters.category);
    if (state.activeFilters.storage_type !== "all") q.append("storage_type", state.activeFilters.storage_type);
    if (state.activeFilters.start_date) q.append("start_date", state.activeFilters.start_date);
    if (state.activeFilters.end_date) q.append("end_date", state.activeFilters.end_date);
    if (state.activeFilters.date_basis) q.append("date_basis", state.activeFilters.date_basis);

    const res = await api.request(`/reports/summary?${q.toString()}`);
    state.rawResponse = res;
    state.allItems = res.items || [];
    state.categories = res.categories || [];

    // Populate Category filter options dynamically
    populateCategoryDropdown(state.categories);

    // Render 7 KPI Summary Cards
    renderSummaryCards(res.summary_cards || {});

    // Render 6 Interactive Chart.js Visualizations
    renderCharts(res.charts || {});

    // Filter and Render Detailed Table
    applyClientFiltersAndRender();

    if (showFeedback) {
      showToast("Reports data refreshed successfully!", "success");
    }
  } catch (err) {
    console.error("Error loading reports data:", err);
    showToast("Failed to load reports: " + err.message, "error");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align:center; padding:30px; color:#ef4444; font-weight:600;">
            Failed to load reports: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Populate Category Dropdown dynamically from backend dataset
 */
function populateCategoryDropdown(categories) {
  const catSelect = document.getElementById("report-category-filter");
  if (!catSelect || !categories || categories.length === 0) return;

  const currentVal = state.activeFilters.category;
  const existingOptions = new Set(["all"]);

  let optionsHtml = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    if (!existingOptions.has(cat)) {
      existingOptions.add(cat);
      const isSelected = cat === currentVal ? "selected" : "";
      optionsHtml += `<option value="${escapeHtml(cat)}" ${isSelected}>${getCategoryEmoji(cat)} ${escapeHtml(cat)}</option>`;
    }
  });

  catSelect.innerHTML = optionsHtml;
}

/**
 * Category Emoji Map
 */
function getCategoryEmoji(cat) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("fruit")) return "🍎";
  if (c.includes("veg")) return "🥦";
  if (c.includes("dairy") || c.includes("milk") || c.includes("cheese")) return "🧀";
  if (c.includes("meat") || c.includes("poultry") || c.includes("beef") || c.includes("chicken")) return "🥩";
  if (c.includes("fish") || c.includes("seafood") || c.includes("salmon")) return "🐟";
  if (c.includes("baker") || c.includes("bread")) return "🍞";
  if (c.includes("grain") || c.includes("rice") || c.includes("cereal") || c.includes("flour")) return "🌾";
  if (c.includes("pack") || c.includes("canned")) return "🥫";
  if (c.includes("bever") || c.includes("drink") || c.includes("juice")) return "🥤";
  return "🍽️";
}

/**
 * Render 7 Summary KPI Cards
 */
function renderSummaryCards(cards) {
  if (!cards) return;

  const p = cards.percentages || {};

  // Total
  const totalEl = document.getElementById("rep-total-items");
  if (totalEl) totalEl.textContent = cards.total_products ?? 0;

  // Fresh
  const freshEl = document.getElementById("rep-fresh-items");
  if (freshEl) freshEl.textContent = cards.fresh_products ?? 0;
  const freshPctEl = document.getElementById("rep-fresh-pct");
  if (freshPctEl) freshPctEl.textContent = `${p.fresh_pct ?? 0}%`;

  // Expired
  const expiredEl = document.getElementById("rep-expired-items");
  if (expiredEl) expiredEl.textContent = cards.expired_products ?? 0;
  const expiredPctEl = document.getElementById("rep-expired-pct");
  if (expiredPctEl) expiredPctEl.textContent = `${p.expired_pct ?? 0}%`;

  // Spoiled
  const spoiledEl = document.getElementById("rep-spoiled-items");
  if (spoiledEl) spoiledEl.textContent = cards.spoiled_products ?? 0;
  const spoiledPctEl = document.getElementById("rep-spoiled-pct");
  if (spoiledPctEl) spoiledPctEl.textContent = `${p.spoiled_pct ?? 0}%`;

  // At Risk
  const atRiskEl = document.getElementById("rep-at-risk-items");
  if (atRiskEl) atRiskEl.textContent = cards.at_risk_products ?? 0;
  const atRiskPctEl = document.getElementById("rep-at-risk-pct");
  if (atRiskPctEl) atRiskPctEl.textContent = `${p.at_risk_pct ?? 0}%`;

  // Not Analyzed
  const notAnalyzedEl = document.getElementById("rep-not-analyzed-items");
  if (notAnalyzedEl) notAnalyzedEl.textContent = cards.not_analyzed_products ?? 0;
  const notAnalyzedPctEl = document.getElementById("rep-not-analyzed-pct");
  if (notAnalyzedPctEl) notAnalyzedPctEl.textContent = `${p.not_analyzed_pct ?? 0}%`;

  // Nearing Expiry
  const nearingEl = document.getElementById("rep-nearing-expiry-items");
  if (nearingEl) nearingEl.textContent = cards.nearing_expiry_products ?? 0;
  const nearingPctEl = document.getElementById("rep-nearing-expiry-pct");
  if (nearingPctEl) nearingPctEl.textContent = `${p.nearing_expiry_pct ?? 0}% (≤3d left)`;
}

/**
 * Render all 6 Chart.js Visualizations
 */
function renderCharts(chartsData) {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js library not loaded yet.");
    return;
  }

  renderChartA(chartsData.freshness_distribution);
  renderChartB(chartsData.inventory_status);
  renderChartC(chartsData.category_status);
  renderCategoryBreakdownTable(chartsData.category_status, state.allItems);
  renderChartD(chartsData.expiry_timeline);
  renderChartE(chartsData.freshness_score_distribution);
  renderChartF(chartsData.food_waste);
  renderFoodWasteTable(chartsData.food_waste);
}

/**
 * Chart A: Inventory Freshness Distribution (Doughnut)
 */
function renderChartA(data) {
  const canvas = document.getElementById("chart-freshness-distribution");
  if (!canvas || !data) return;

  if (state.charts.freshnessDist) {
    state.charts.freshnessDist.destroy();
  }

  const ctx = canvas.getContext("2d");
  state.charts.freshnessDist = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.counts,
        backgroundColor: data.colors,
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 11, weight: "bold" }, padding: 12 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || "";
              const count = context.parsed || 0;
              const pct = data.percentages ? data.percentages[context.dataIndex] : 0;
              return ` ${label}: ${count} items (${pct}%)`;
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const statusClicked = data.labels[index];
          setStatusFilter(statusClicked, true);
        }
      }
    }
  });
}

/**
 * Chart B: Food Inventory Status Overview (Bar)
 */
function renderChartB(data) {
  const canvas = document.getElementById("chart-inventory-status");
  if (!canvas || !data) return;

  if (state.charts.invStatus) {
    state.charts.invStatus.destroy();
  }

  const ctx = canvas.getContext("2d");
  state.charts.invStatus = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Item Count",
        data: data.counts,
        backgroundColor: data.colors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterBody: function(context) {
              if (context[0] && context[0].label.includes("Nearing Expiry")) {
                return "\n*Overlaps with Fresh, At Risk, or Unanalyzed items.";
              }
              return "";
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: "#f1f5f9" }
        },
        x: {
          ticks: { font: { size: 10, weight: "600" } },
          grid: { display: false }
        }
      },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const label = data.labels[index];
          if (label.includes("Nearing Expiry")) {
            setStatusFilter("Nearing Expiry", true);
          } else {
            setStatusFilter(label, true);
          }
        }
      }
    }
  });
}

/**
 * Chart C: Category-Wise Food Status Breakdown (Stacked Bar)
 */
function renderChartC(data) {
  const canvas = document.getElementById("chart-category-status");
  if (!canvas || !data) return;

  if (state.charts.catStatus) {
    state.charts.catStatus.destroy();
  }

  const ctx = canvas.getContext("2d");
  state.charts.catStatus = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.categories,
      datasets: [
        { label: "Fresh", data: data.fresh, backgroundColor: "#10b981", stack: "Stack 0" },
        { label: "At Risk", data: data.at_risk, backgroundColor: "#f59e0b", stack: "Stack 0" },
        { label: "Spoiled", data: data.spoiled, backgroundColor: "#ef4444", stack: "Stack 0" },
        { label: "Expired", data: data.expired, backgroundColor: "#be123c", stack: "Stack 0" },
        { label: "Not Analyzed", data: data.not_analyzed, backgroundColor: "#94a3b8", stack: "Stack 0" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11, weight: "bold" }, padding: 12 }
        },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 11, weight: "600" } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: "#f1f5f9" }
        }
      },
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const el = elements[0];
          const cat = data.categories[el.index];
          const dataset = state.charts.catStatus.data.datasets[el.datasetIndex];
          const status = dataset.label;
          setCategoryAndStatusFilter(cat, status);
        }
      }
    }
  });
}

/**
 * Render Category Quality Breakdown Table
 */
function renderCategoryBreakdownTable(catData, allItems) {
  const tbody = document.getElementById("category-breakdown-tbody");
  if (!tbody || !catData) return;

  const categories = catData.categories || [];
  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:15px; color:var(--text-muted);">No categories available</td></tr>`;
    return;
  }

  let totalItemsAll = 0;
  let freshAll = 0;
  let atRiskAll = 0;
  let spoiledAll = 0;
  let expiredAll = 0;
  let notAnalyzedAll = 0;

  let rowsHtml = "";
  categories.forEach((cat, idx) => {
    const fr = catData.fresh ? catData.fresh[idx] || 0 : 0;
    const ar = catData.at_risk ? catData.at_risk[idx] || 0 : 0;
    const sp = catData.spoiled ? catData.spoiled[idx] || 0 : 0;
    const ex = catData.expired ? catData.expired[idx] || 0 : 0;
    const na = catData.not_analyzed ? catData.not_analyzed[idx] || 0 : 0;
    const catTotal = fr + ar + sp + ex + na;

    totalItemsAll += catTotal;
    freshAll += fr;
    atRiskAll += ar;
    spoiledAll += sp;
    expiredAll += ex;
    notAnalyzedAll += na;

    // Calculate average score for category items
    const catItems = (allItems || []).filter(i => (i.category || "Other") === cat);
    const scoredItems = catItems.filter(i => i.freshness_score_num !== null && i.freshness_score_num !== undefined);
    let avgScoreHtml = `<span style="color:var(--text-muted); font-size:11px;">--</span>`;
    if (scoredItems.length > 0) {
      const avg = Math.round(scoredItems.reduce((acc, i) => acc + i.freshness_score_num, 0) / scoredItems.length);
      let col = "#10b981";
      if (avg < 40) col = "#ef4444";
      else if (avg < 70) col = "#f59e0b";
      avgScoreHtml = `<span style="font-weight:700; color:${col};">${avg}%</span>`;
    }

    const emoji = getCategoryEmoji(cat);
    rowsHtml += `
      <tr style="cursor:pointer;" onclick="filterByCategory('${escapeHtml(cat)}')" title="Click to filter by ${escapeHtml(cat)}">
        <td style="font-weight:600; color:var(--text-main, #0f172a);">
          <span style="margin-right:4px;">${emoji}</span> ${escapeHtml(cat)}
        </td>
        <td style="text-align:center; font-weight:700;">${catTotal}</td>
        <td style="text-align:center; color:#10b981; font-weight:600;">${fr}</td>
        <td style="text-align:center; color:#d97706; font-weight:600;">${ar}</td>
        <td style="text-align:center; color:#dc2626; font-weight:600;">${sp}</td>
        <td style="text-align:center; color:#be123c; font-weight:600;">${ex}</td>
        <td style="text-align:center; color:#64748b;">${na}</td>
        <td style="text-align:center;">${avgScoreHtml}</td>
      </tr>
    `;
  });

  // Calculate overall average score
  const allScored = (allItems || []).filter(i => i.freshness_score_num !== null && i.freshness_score_num !== undefined);
  let overallAvgDisp = "--";
  if (allScored.length > 0) {
    const oAvg = Math.round(allScored.reduce((acc, i) => acc + i.freshness_score_num, 0) / allScored.length);
    overallAvgDisp = `${oAvg}%`;
  }

  // Footer total row
  rowsHtml += `
    <tr style="background:#f8fafc; font-weight:800; border-top: 2px solid var(--border-color, #cbd5e1);">
      <td style="color:#0f766e;">Total Summary</td>
      <td style="text-align:center;">${totalItemsAll}</td>
      <td style="text-align:center; color:#10b981;">${freshAll}</td>
      <td style="text-align:center; color:#d97706;">${atRiskAll}</td>
      <td style="text-align:center; color:#dc2626;">${spoiledAll}</td>
      <td style="text-align:center; color:#be123c;">${expiredAll}</td>
      <td style="text-align:center; color:#64748b;">${notAnalyzedAll}</td>
      <td style="text-align:center; color:#0f766e;">${overallAvgDisp}</td>
    </tr>
  `;

  tbody.innerHTML = rowsHtml;
}

/**
 * Filter by Category from table click
 */
window.filterByCategory = function(cat) {
  const catSelect = document.getElementById("report-category-filter");
  if (catSelect) {
    catSelect.value = cat;
    state.activeFilters.category = cat;
    applyClientFiltersAndRender();
    scrollToTable();
  }
};

/**
 * Chart D: Expiry Timeline & Horizons (Bar)
 */
function renderChartD(data) {
  const canvas = document.getElementById("chart-expiry-timeline");
  if (!canvas || !data) return;

  if (state.charts.expiryTimeline) {
    state.charts.expiryTimeline.destroy();
  }

  const bucketColors = [
    "#be123c", // Expired
    "#e11d48", // Today
    "#ca8a04", // 1-3d
    "#f59e0b", // 4-7d
    "#3b82f6", // 8-30d
    "#10b981"  // Safe
  ];

  const ctx = canvas.getContext("2d");
  state.charts.expiryTimeline = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.buckets,
      datasets: [{
        label: "Items Expiring",
        data: data.counts,
        backgroundColor: bucketColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterBody: function(context) {
              if (!context[0]) return "";
              const idx = context[0].dataIndex;
              const details = data.category_breakdown ? data.category_breakdown[idx] : null;
              if (details && Object.keys(details).length > 0) {
                const lines = ["Categories:"];
                for (const [k, v] of Object.entries(details)) {
                  lines.push(` • ${k}: ${v}`);
                }
                return lines.join("\n");
              }
              return "";
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: "#f1f5f9" }
        },
        x: {
          ticks: { font: { size: 10, weight: "600" } },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Chart E: Freshness Score Distribution Histogram (Bar)
 */
function renderChartE(data) {
  const canvas = document.getElementById("chart-score-distribution");
  if (!canvas || !data) return;

  // Update subtitle & badge
  const subtitle = document.getElementById("analyzed-counter-subtitle");
  if (subtitle) {
    subtitle.textContent = `Quality score distribution across ${data.total_analyzed ?? 0} analyzed items (${data.analyzed_percentage ?? 0}%)`;
  }
  const badge = document.getElementById("analyzed-counter-badge");
  if (badge) {
    badge.textContent = `Analyzed: ${data.total_analyzed ?? 0} items`;
  }

  if (state.charts.scoreDist) {
    state.charts.scoreDist.destroy();
  }

  const rangeColors = [
    "#be123c", // 0-20% Critical
    "#ef4444", // 21-40% Poor
    "#f59e0b", // 41-60% Moderate
    "#3b82f6", // 61-80% Good
    "#10b981"  // 81-100% Prime
  ];

  const ctx = canvas.getContext("2d");
  state.charts.scoreDist = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.ranges,
      datasets: [{
        label: "Analyzed Items",
        data: data.counts,
        backgroundColor: rangeColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y || 0;
              const tot = data.total_analyzed || 1;
              const pct = ((val / tot) * 100).toFixed(1);
              return ` Items: ${val} (${pct}% of analyzed items)`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: "#f1f5f9" }
        },
        x: {
          ticks: { font: { size: 11, weight: "600" } },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Chart F: Food Waste Analysis (Bar)
 */
function renderChartF(data) {
  const canvas = document.getElementById("chart-food-waste");
  if (!canvas || !data) return;

  // Update Waste KPI cards
  const totalCountEl = document.getElementById("waste-total-count");
  if (totalCountEl) totalCountEl.textContent = data.total_waste_items ?? 0;

  const expCountEl = document.getElementById("waste-expired-count");
  if (expCountEl) expCountEl.textContent = data.expired_items_count ?? 0;

  const spoilCountEl = document.getElementById("waste-spoiled-count");
  if (spoilCountEl) spoilCountEl.textContent = data.spoiled_items_count ?? 0;

  const totalQtyEl = document.getElementById("waste-total-qty");
  if (totalQtyEl) totalQtyEl.textContent = `${data.total_waste_quantity ?? 0}`;

  if (state.charts.foodWaste) {
    state.charts.foodWaste.destroy();
  }

  const categories = data.categories || [];
  const quantities = data.waste_quantities || [];

  const ctx = canvas.getContext("2d");
  state.charts.foodWaste = new Chart(ctx, {
    type: "bar",
    data: {
      labels: categories.length > 0 ? categories : ["No Waste Recorded"],
      datasets: [{
        label: "Waste Quantity",
        data: quantities.length > 0 ? quantities : [0],
        backgroundColor: "#e11d48",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              const item = data.waste_by_category ? data.waste_by_category[idx] : null;
              if (item) {
                return ` Quantity: ${item.quantity} ${item.primary_unit} (${item.count} items: ${item.expired_count} expired, ${item.spoiled_count} spoiled)`;
              }
              return ` Waste: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 11 } },
          grid: { color: "#f1f5f9" }
        },
        x: {
          ticks: { font: { size: 11, weight: "600" } },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Render Food Waste & Spoilage Table
 */
function renderFoodWasteTable(wasteData) {
  const tbody = document.getElementById("waste-breakdown-tbody");
  if (!tbody || !wasteData) return;

  const wasteList = wasteData.waste_by_category || [];
  if (wasteList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:18px; color:#10b981; font-weight:600; background:#f0fdf4;">
          ✅ Zero Food Waste Recorded: No expired batches or spoiled items found.
        </td>
      </tr>
    `;
    return;
  }

  const totalWasteQty = parseFloat(wasteData.total_waste_quantity) || 1;
  let rowsHtml = "";

  wasteList.forEach(w => {
    const emoji = getCategoryEmoji(w.category);
    const qty = parseFloat(w.quantity) || 0;
    const sharePct = Math.round((qty / totalWasteQty) * 100);

    rowsHtml += `
      <tr>
        <td style="font-weight:600; color:var(--text-main, #0f172a);">
          <span style="margin-right:4px;">${emoji}</span> ${escapeHtml(w.category)}
        </td>
        <td style="text-align:center; color:#be123c; font-weight:600;">${w.expired_count || 0}</td>
        <td style="text-align:center; color:#dc2626; font-weight:600;">${w.spoiled_count || 0}</td>
        <td style="text-align:center; font-weight:700; color:#b91c1c;">${qty}</td>
        <td style="text-align:center; color:var(--text-muted);">${escapeHtml(w.primary_unit || "units")}</td>
        <td style="text-align:center;">
          <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
            <div style="width:60px; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
              <div style="width:${sharePct}%; height:100%; background:#e11d48; border-radius:3px;"></div>
            </div>
            <span style="font-size:11px; font-weight:700; color:#e11d48;">${sharePct}%</span>
          </div>
        </td>
      </tr>
    `;
  });

  // Footer total
  rowsHtml += `
    <tr style="background:#fff1f2; font-weight:800; border-top: 2px solid #fecdd3;">
      <td style="color:#be123c;">Total Waste</td>
      <td style="text-align:center; color:#be123c;">${wasteData.expired_items_count || 0}</td>
      <td style="text-align:center; color:#dc2626;">${wasteData.spoiled_items_count || 0}</td>
      <td style="text-align:center; color:#b91c1c;">${wasteData.total_waste_quantity || 0}</td>
      <td style="text-align:center; color:var(--text-muted);">mixed units</td>
      <td style="text-align:center; color:#be123c;">100%</td>
    </tr>
  `;

  tbody.innerHTML = rowsHtml;
}

/**
 * Client-side Filter, Sort, and Render Table
 */
function applyClientFiltersAndRender() {
  const { search, status } = state.activeFilters;

  let filtered = [...state.allItems];

  // 1. Text Search Filter
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(item => {
      const name = String(item.food_name || "").toLowerCase();
      const id = String(item.id || "").toLowerCase();
      const cat = String(item.category || "").toLowerCase();
      const batch = String(item.batch_number || "").toLowerCase();
      return name.includes(s) || id.includes(s) || cat.includes(s) || batch.includes(s);
    });
  }

  // 2. Status Filter
  if (status && status !== "all") {
    if (status === "Nearing Expiry") {
      filtered = filtered.filter(item => item.is_nearing_expiry);
    } else {
      filtered = filtered.filter(item => (item.computed_status || "").toLowerCase() === status.toLowerCase());
    }
  }

  // 3. Sorting
  const { column, ascending } = state.sorting;
  filtered.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];

    if (valA === null || valA === undefined) valA = "";
    if (valB === null || valB === undefined) valB = "";

    // Numeric sorting
    if (column === "quantity" || column === "freshness_score" || column === "days_to_expiry") {
      const numA = parseFloat(valA) || 0;
      const numB = parseFloat(valB) || 0;
      return ascending ? numA - numB : numB - numA;
    }

    // String sorting
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return ascending ? -1 : 1;
    if (strA > strB) return ascending ? 1 : -1;
    return 0;
  });

  state.filteredItems = filtered;
  renderTable();
}

/**
 * Configure sorting by clicking table header
 */
function setupTableSorting() {
  const headers = document.querySelectorAll(".custom-reports-table th[data-sort]");
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (state.sorting.column === col) {
        state.sorting.ascending = !state.sorting.ascending;
      } else {
        state.sorting.column = col;
        state.sorting.ascending = true;
      }

      // Update header indicator
      headers.forEach(h => {
        const text = h.textContent.replace(/ [▲▼⬍]/g, "");
        if (h.dataset.sort === state.sorting.column) {
          h.textContent = `${text} ${state.sorting.ascending ? "▲" : "▼"}`;
        } else {
          h.textContent = `${text} ⬍`;
        }
      });

      applyClientFiltersAndRender();
    });
  });
}

/**
 * Render the table rows and pagination controls
 */
function renderTable() {
  const tbody = document.getElementById("reports-table-body");
  const countBadge = document.getElementById("table-record-count");
  const showingText = document.getElementById("pagination-showing-text");
  const pageNumbers = document.getElementById("pagination-numbers");
  const prevBtn = document.getElementById("btn-prev-page");
  const nextBtn = document.getElementById("btn-next-page");

  const totalRecords = state.filteredItems.length;
  if (countBadge) {
    countBadge.textContent = `${totalRecords} items`;
  }

  if (totalRecords === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 40px; color:var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-weight: 600; font-size: 15px;">No inventory items match your reporting criteria</div>
            <p style="font-size: 12px; margin-top: 4px;">Try clearing filters or selecting another date range.</p>
          </td>
        </tr>
      `;
    }
    if (showingText) showingText.textContent = "Showing 0 of 0 entries";
    if (pageNumbers) pageNumbers.innerHTML = "";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const { currentPage, pageSize } = state.pagination;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRecords);
  const pageItems = state.filteredItems.slice(startIdx, endIdx);

  if (showingText) {
    showingText.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalRecords} entries`;
  }

  if (tbody) {
    tbody.innerHTML = pageItems.map(item => {
      // 1. Image Thumbnail
      const emoji = getCategoryEmoji(item.category);
      let thumbHtml = `<div class="product-thumb">${emoji}</div>`;
      if (item.image_url) {
        thumbHtml = `
          <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.food_name)}" class="product-thumb"
               onerror="this.outerHTML='<div class=\\'product-thumb\\'>${emoji}</div>'">
        `;
      }

      // 2. Days to Expiry Badge
      const days = item.days_to_expiry;
      let daysHtml;
      if (days === null || days === undefined) {
        daysHtml = `<span class="days-badge">N/A</span>`;
      } else if (days < 0) {
        daysHtml = `<span class="days-badge expired">${days}d (Expired)</span>`;
      } else if (days === 0) {
        daysHtml = `<span class="days-badge warning">Today</span>`;
      } else if (days <= 3) {
        daysHtml = `<span class="days-badge warning">+${days}d (Nearing)</span>`;
      } else {
        daysHtml = `<span class="days-badge safe">+${days}d</span>`;
      }

      // 3. Freshness Score Progress Bar
      const score = item.freshness_score;
      let scoreHtml;
      if (score === null || score === undefined || score === "") {
        scoreHtml = `<span style="font-size:12px; color:var(--text-muted); font-weight:600;">Not Analyzed</span>`;
      } else {
        const sNum = Math.min(100, Math.max(0, parseFloat(score) || 0));
        let fillColor = "#10b981";
        if (sNum < 40) fillColor = "#ef4444";
        else if (sNum < 70) fillColor = "#f59e0b";

        scoreHtml = `
          <div class="score-meter-wrap">
            <span style="font-weight:700; font-size:12px; color:${fillColor};">${sNum}%</span>
            <div class="score-meter-bar">
              <div class="score-meter-fill" style="width:${sNum}%; background:${fillColor};"></div>
            </div>
          </div>
        `;
      }

      // 4. Inventory Status Badge
      const st = item.computed_status || "Not Analyzed";
      let statusBadgeClass = "badge-status-not-analyzed";
      if (st === "Fresh") statusBadgeClass = "badge-status-fresh";
      else if (st === "Expired") statusBadgeClass = "badge-status-expired";
      else if (st === "Spoiled") statusBadgeClass = "badge-status-spoiled";
      else if (st === "At Risk") statusBadgeClass = "badge-status-at-risk";

      let nearingTag = "";
      if (item.is_nearing_expiry && st !== "Expired") {
        nearingTag = `<span title="Expires in ≤3 days" style="margin-left:4px; font-size:11px;">🔔</span>`;
      }

      // 5. Last Analyzed Format
      let lastAnalyzedStr = "Never";
      if (item.last_analyzed) {
        try {
          const d = new Date(item.last_analyzed);
          lastAnalyzedStr = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch (_) {
          lastAnalyzedStr = String(item.last_analyzed);
        }
      }

      const shortId = item.id ? `#${String(item.id).slice(-6)}` : "-";

      return `
        <tr>
          <td>${thumbHtml}</td>
          <td>
            <strong>${escapeHtml(item.food_name || "Food Item")}</strong>
            ${item.batch_number ? `<div style="font-size:11px; color:var(--text-muted);">Batch: ${escapeHtml(item.batch_number)}</div>` : ""}
          </td>
          <td>
            <code style="font-size:11px; background:#f1f5f9; padding:2px 6px; border-radius:4px;" title="${escapeHtml(item.id || '')}">
              ${escapeHtml(shortId)}
            </code>
          </td>
          <td>
            <span class="badge" style="background:#f1f5f9; color:#334155; font-size:11px; font-weight:600;">
              ${escapeHtml(item.category || "General")}
            </span>
          </td>
          <td><strong>${item.quantity ?? 1}</strong> <span style="color:var(--text-muted); font-size:12px;">${escapeHtml(item.unit || "")}</span></td>
          <td><span style="font-family:monospace; font-size:12px;">${escapeHtml(item.expiry_date || "N/A")}</span></td>
          <td>${daysHtml}</td>
          <td>${scoreHtml}</td>
          <td>
            <span class="badge-status ${statusBadgeClass}">
              ${escapeHtml(st)}${nearingTag}
            </span>
          </td>
          <td><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(lastAnalyzedStr)}</span></td>
          <td style="text-align:center;">
            <button class="btn btn-secondary btn-sm" onclick="openCertificateModal('${escapeHtml(item.id)}')">
              📜 Certificate
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Update Pagination Controls
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  if (pageNumbers) {
    let btnsHtml = "";
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      btnsHtml += `
        <button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">
          ${p}
        </button>
      `;
    }
    pageNumbers.innerHTML = btnsHtml;
  }
}

/**
 * Navigate to a specific page
 */
window.goToPage = function(pageNum) {
  state.pagination.currentPage = pageNum;
  renderTable();
  scrollToTable();
};

/**
 * Quality Compliance Certificate Modal
 */
window.openCertificateModal = async function(itemId) {
  const modal = document.getElementById("certificate-modal");
  if (!modal) return;

  try {
    const cert = await api.request(`/reports/batch/${itemId}`);

    document.getElementById("cert-id").textContent = cert.certificate_id;
    document.getElementById("cert-item-name").textContent = cert.food_item.food_name;
    document.getElementById("cert-category").textContent = cert.food_item.category;
    document.getElementById("cert-batch").textContent = cert.food_item.batch_number || "BATCH-STD-01";
    document.getElementById("cert-score").textContent = `${cert.visual_quality_score}%`;
    document.getElementById("cert-shelf-life").textContent = `${cert.predicted_remaining_shelf_life_days} days`;
    document.getElementById("cert-fefo").textContent = cert.recommended_fefo_priority;
    document.getElementById("cert-markdown").textContent = cert.clearance_markdown_discount;
    document.getElementById("cert-compliance").textContent = cert.compliance_summary;

    const defectsList = document.getElementById("cert-defects-list");
    if (defectsList && cert.latest_inspection) {
      defectsList.innerHTML = (cert.latest_inspection.detected_defects || [])
        .map(d => `<li>${escapeHtml(d)}</li>`)
        .join("");
    }

    modal.classList.add("active");
  } catch (err) {
    showToast("Failed to load certificate: " + err.message, "error");
  }
};

window.closeCertificateModal = function() {
  const modal = document.getElementById("certificate-modal");
  if (modal) modal.classList.remove("active");
};

/**
 * Download filtered report file (CSV, PDF, Excel)
 */
async function downloadFilteredFile(endpoint, defaultFilename) {
  const q = new URLSearchParams();
  if (state.activeFilters.category !== "all") q.append("category", state.activeFilters.category);
  if (state.activeFilters.storage_type !== "all") q.append("storage_type", state.activeFilters.storage_type);
  if (state.activeFilters.status !== "all") q.append("status", state.activeFilters.status);
  if (state.activeFilters.search) q.append("search", state.activeFilters.search);
  if (state.activeFilters.start_date) q.append("start_date", state.activeFilters.start_date);
  if (state.activeFilters.end_date) q.append("end_date", state.activeFilters.end_date);
  if (state.activeFilters.date_basis) q.append("date_basis", state.activeFilters.date_basis);
  if (state.activeFilters.expiry_horizon !== "all") q.append("expiry_horizon", state.activeFilters.expiry_horizon);

  try {
    showToast("Preparing document download...", "info");
    const token = api.getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${api.baseUrl}${endpoint}?${q.toString()}`, { headers });
    if (!res.ok) {
      throw new Error("Download request failed with status " + res.status);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast("Document downloaded successfully!", "success");
  } catch (err) {
    showToast("Export error: " + err.message, "error");
  }
}
