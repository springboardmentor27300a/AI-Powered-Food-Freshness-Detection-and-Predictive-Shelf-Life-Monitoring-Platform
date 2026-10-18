/**
 * Food Freshness Monitoring Platform - Executive Analytics Dashboard Controller
 * Multi-dimensional Chart.js visualizations, real MongoDB KPIs, and dynamic filters.
 */

let chartFreshnessDist = null;
let chartCategoryAnalysis = null;
let chartShelfLife = null;
let chartStorageMonitoring = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!api.enforceRoleAccess(["Admin"])) return;

  // Initialize event listeners
  const refreshBtn = document.getElementById("btn-refresh-dashboard");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadExecutiveAnalytics());
  }

  const exportBtn = document.getElementById("btn-export-exec-report");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      window.location.href = "/api/reports/export-csv";
    });
  }

  const filterSelects = ["filter-category", "filter-location", "filter-start-date", "filter-end-date"];
  filterSelects.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => loadExecutiveAnalytics());
    }
  });

  await loadExecutiveAnalytics();
});

async function loadExecutiveAnalytics() {
  const loadingIndicator = document.getElementById("exec-loading-indicator");
  if (loadingIndicator) loadingIndicator.style.display = "block";

  const category = document.getElementById("filter-category")?.value || "all";
  const location = document.getElementById("filter-location")?.value || "all";
  const startDate = document.getElementById("filter-start-date")?.value || "";
  const endDate = document.getElementById("filter-end-date")?.value || "";

  try {
    const query = new URLSearchParams();
    if (category !== "all") query.append("category", category);
    if (location !== "all") query.append("location", location);
    if (startDate) query.append("start_date", startDate);
    if (endDate) query.append("end_date", endDate);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const data = await api.request(`/analytics/executive${queryString}`);

    renderExecutiveKPIs(data.kpis);
    renderCharts(data.charts);
    renderFactualInsights(data.insights);

    const timestampEl = document.getElementById("exec-last-updated");
    if (timestampEl && data.kpis.last_updated) {
      const d = new Date(data.kpis.last_updated);
      timestampEl.textContent = `Last Synced: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (error) {
    console.error("Failed to load executive analytics:", error);
    showToast("Error retrieving executive metrics: " + error.message, "error");
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

function renderExecutiveKPIs(kpis) {
  if (!kpis) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== null && val !== undefined ? val : "0";
  };

  setVal("kpi-total-items", kpis.total_inventory_items);
  setVal("kpi-total-qty", `${kpis.total_inventory_quantity}`);
  setVal("kpi-total-analyses", kpis.total_freshness_analyses);
  setVal("kpi-fresh-count", kpis.fresh_items_count);
  setVal("kpi-moderate-count", kpis.moderately_fresh_count);
  setVal("kpi-spoiled-count", kpis.spoiled_or_high_risk_count);
  setVal("kpi-avg-score", `${kpis.average_quality_score}%`);
  setVal("kpi-avg-shelf-life", `${kpis.average_predicted_remaining_days} d`);
  setVal("kpi-approaching-expiry", kpis.items_approaching_expiry);
  setVal("kpi-storage-alerts", kpis.active_storage_alerts);
  setVal("kpi-waste-risk", `$${kpis.estimated_inventory_waste_usd}`);
}

function renderCharts(charts) {
  if (!charts) return;

  // Chart A: Freshness Distribution (Doughnut)
  renderFreshnessDistributionChart(charts.freshness_distribution);

  // Chart B: Food Category Analysis (Grouped Bar)
  renderCategoryAnalysisChart(charts.category_analysis);

  // Chart C: Shelf Life Distribution (Bar)
  renderShelfLifeChart(charts.shelf_life_distribution);

  // Chart D: Storage Telemetry (Dual-axis Line)
  renderStorageMonitoringChart(charts.storage_monitoring);
}

function renderFreshnessDistributionChart(data) {
  const canvas = document.getElementById("chart-freshness-dist");
  if (!canvas || !window.Chart) return;

  if (chartFreshnessDist) chartFreshnessDist.destroy();

  chartFreshnessDist = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.data,
        backgroundColor: data.colors,
        borderWidth: 2,
        borderColor: "#ffffff",
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } },
      },
      cutout: "65%",
    }
  });
}

function renderCategoryAnalysisChart(catData) {
  const canvas = document.getElementById("chart-category-analysis");
  if (!canvas || !window.Chart) return;

  if (chartCategoryAnalysis) chartCategoryAnalysis.destroy();

  const labels = catData.map(c => c.category);
  const scores = catData.map(c => c.average_score);
  const counts = catData.map(c => c.item_count);

  chartCategoryAnalysis = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Avg Quality Score (%)",
          data: scores,
          backgroundColor: "#0d9488",
          borderRadius: 6,
          yAxisID: "yScore",
        },
        {
          label: "Total Items",
          data: counts,
          backgroundColor: "#94a3b8",
          borderRadius: 6,
          yAxisID: "yCount",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yScore: {
          type: "linear",
          position: "left",
          min: 0,
          max: 100,
          title: { display: true, text: "Quality Score (%)" },
        },
        yCount: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Items Count" },
        }
      },
      plugins: {
        legend: { position: "top" }
      }
    }
  });
}

function renderShelfLifeChart(shelfData) {
  const canvas = document.getElementById("chart-shelf-life");
  if (!canvas || !window.Chart) return;

  if (chartShelfLife) chartShelfLife.destroy();

  chartShelfLife = new Chart(canvas, {
    type: "bar",
    data: {
      labels: shelfData.labels,
      datasets: [{
        label: "Item Count",
        data: shelfData.data,
        backgroundColor: ["#ef4444", "#f59e0b", "#0284c7", "#10b981"],
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderStorageMonitoringChart(storageRecords) {
  const canvas = document.getElementById("chart-storage-monitoring");
  if (!canvas || !window.Chart) return;

  if (chartStorageMonitoring) chartStorageMonitoring.destroy();

  // If no readings, show simulated baseline demo markers
  let labels = [];
  let temps = [];
  let hums = [];

  if (storageRecords && storageRecords.length > 0) {
    labels = storageRecords.map(r => r.recorded_at);
    temps = storageRecords.map(r => r.temperature);
    hums = storageRecords.map(r => r.humidity);
  } else {
    labels = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    temps = [3.8, 4.0, 4.2, 5.1, 4.0, 3.9, 3.7];
    hums = [65, 68, 70, 64, 66, 67, 65];
  }

  chartStorageMonitoring = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: temps,
          borderColor: "#0d9488",
          backgroundColor: "rgba(13, 148, 136, 0.1)",
          fill: true,
          tension: 0.3,
          yAxisID: "yTemp",
        },
        {
          label: "Relative Humidity (%)",
          data: hums,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.05)",
          fill: true,
          tension: 0.3,
          yAxisID: "yHum",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yTemp: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Temperature (°C)" },
        },
        yHum: {
          type: "linear",
          position: "right",
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Relative Humidity (%)" },
        }
      },
      plugins: {
        legend: { position: "top" }
      }
    }
  });
}

function renderFactualInsights(insights) {
  const container = document.getElementById("exec-insights-list");
  if (!container) return;

  if (!insights || insights.length === 0) {
    container.innerHTML = `<li style="color:var(--text-muted);">All parameters operating within normal baseline limits.</li>`;
    return;
  }

  container.innerHTML = insights
    .map(txt => `<li style="margin-bottom: 8px; line-height: 1.5;">${escapeHtml(txt)}</li>`)
    .join("");
}
