/**
 * Food Freshness Monitoring Platform - Food Quality Inspector Workspace Controller
 * Powers live computer vision inspection, AI result validation, storage audits,
 * defect identification, alerts management, and quality analytics.
 */

let activeInspectionData = null;
let chartInstances = {};

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Guard Authentication and Role
  if (!api.enforceRoleAccess(["Food Quality Inspector", "Quality Inspector"])) return;

  // 2. Initialize UI Components
  setupTabNavigation();
  setupQuickActionPillButtons();
  setupImageDropzone();
  setupFormSubmissions();
  setupModals();
  setupStorageAuditor();

  // 3. Initial Data Load
  await loadDashboardOverview();
});

// =============================================================================
// TAB NAVIGATION & ROUTING
// =============================================================================
function setupTabNavigation() {
  const tabBtns = document.querySelectorAll(".tab-nav-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      activateTab(targetId);
    });
  });
}

function activateTab(tabId) {
  document.querySelectorAll(".tab-nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));

  const targetBtn = document.querySelector(`.tab-nav-btn[data-tab="${tabId}"]`);
  const targetPane = document.getElementById(tabId);

  if (targetBtn) targetBtn.classList.add("active");
  if (targetPane) targetPane.classList.add("active");

  // Lazy load data per tab
  if (tabId === "tab-overview") {
    loadDashboardOverview();
  } else if (tabId === "tab-reviews") {
    loadPendingReviewsQueue();
  } else if (tabId === "tab-history") {
    loadInspectionHistory();
  } else if (tabId === "tab-analytics") {
    loadQualityAnalytics();
  } else if (tabId === "tab-alerts") {
    loadQualityAlerts();
  }
}

function setupQuickActionPillButtons() {
  document.getElementById("btn-refresh-dashboard")?.addEventListener("click", loadDashboardOverview);
  document.getElementById("btn-view-all-history")?.addEventListener("click", () => activateTab("tab-history"));

  document.getElementById("quick-action-new-insp")?.addEventListener("click", () => activateTab("tab-new-inspection"));
  document.getElementById("quick-action-pending")?.addEventListener("click", () => activateTab("tab-reviews"));
  document.getElementById("quick-action-alerts")?.addEventListener("click", () => activateTab("tab-alerts"));
  document.getElementById("quick-action-analytics")?.addEventListener("click", () => activateTab("tab-analytics"));

  document.getElementById("quick-action-export")?.addEventListener("click", downloadInspectionCsv);
  document.getElementById("btn-history-export-csv")?.addEventListener("click", downloadInspectionCsv);

  document.getElementById("btn-apply-history-filters")?.addEventListener("click", loadInspectionHistory);

  document.getElementById("btn-filter-alerts-active")?.addEventListener("click", (e) => {
    e.target.classList.add("active");
    document.getElementById("btn-filter-alerts-all")?.classList.remove("active");
    loadQualityAlerts("active");
  });

  document.getElementById("btn-filter-alerts-all")?.addEventListener("click", (e) => {
    e.target.classList.add("active");
    document.getElementById("btn-filter-alerts-active")?.classList.remove("active");
    loadQualityAlerts("all");
  });
}

function downloadInspectionCsv() {
  const token = api.getToken();
  const url = `${api.baseUrl}/inspector/reports/export-csv`;

  fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to export CSV report");
      return res.blob();
    })
    .then((blob) => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `food_quality_inspections_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Quality inspection report downloaded.", "success");
    })
    .catch((err) => showToast(err.message, "error"));
}

// =============================================================================
// OVERVIEW DASHBOARD & KPI LOADER
// =============================================================================
async function loadDashboardOverview() {
  try {
    const data = await api.getInspectorDashboard();
    const kpis = data.kpis || {};

    // Populate KPI Cards
    setText("kpi-today-inspections", kpis.today_inspections ?? 0);
    setText("kpi-pending-reviews", kpis.pending_reviews ?? 0);
    setText("badge-pending-count", kpis.pending_reviews ?? 0);
    setText("kpi-fresh-items", kpis.fresh_items ?? 0);
    setText("kpi-spoilage-alerts", kpis.spoilage_alerts ?? 0);
    setText("badge-alerts-count", kpis.spoilage_alerts ?? 0);
    setText("kpi-flagged-results", kpis.flagged_results ?? 0);
    setText("kpi-avg-quality", `${kpis.average_quality_score ?? 0}%`);
    setText("kpi-avg-confidence", `${kpis.average_ai_confidence ?? 0}%`);

    // Render Recent Inspections Table
    renderRecentInspectionsTable(data.recent_inspections || []);

    // Render Active Quality Alerts
    renderOverviewAlertsList(data.active_alerts || []);
  } catch (err) {
    showToast(`Failed to load inspector dashboard: ${err.message}`, "error");
  }
}

function renderRecentInspectionsTable(items) {
  const tbody = document.getElementById("overview-recent-table-body");
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">No inspections recorded yet. Start one via the Image Inspection tab.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((insp) => {
    const ai = insp.ai_result || {};
    const statusCls = (insp.status || "pending").toLowerCase().replace(/\s+/g, "-");
    const scoreColor = (ai.quality_score >= 70) ? "#047857" : (ai.quality_score >= 40) ? "#b45309" : "#b91c1c";

    return `
      <tr>
        <td><strong>${escapeHtml(insp.inspection_id)}</strong></td>
        <td>${escapeHtml(insp.product_name)}</td>
        <td><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHtml(insp.category)}</span></td>
        <td><strong>${escapeHtml(ai.classification || "Not Analyzed")}</strong></td>
        <td><strong style="color: ${scoreColor};">${ai.quality_score ?? 0}%</strong></td>
        <td>${ai.estimated_shelf_life_days ?? 0} days</td>
        <td><span class="badge-status ${statusCls}">${escapeHtml(insp.status || "Pending")}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openInspectionDetailsModal('${insp.inspection_id}')">Details</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderOverviewAlertsList(alerts) {
  const container = document.getElementById("overview-alerts-list");
  const badge = document.getElementById("overview-alerts-badge");
  if (!container) return;

  if (badge) badge.textContent = `${alerts.length} Alert${alerts.length === 1 ? '' : 's'}`;

  if (alerts.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-muted);">No critical quality alerts active. All parameters safe.</div>`;
    return;
  }

  container.innerHTML = alerts.map((a) => {
    const sevCls = (a.severity || "medium").toLowerCase();
    return `
      <div style="border-left: 4px solid var(--primary); background: #f8fafc; border-radius: 4px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="font-size: 0.88rem; color: var(--text-main);">${escapeHtml(a.item_name)}</strong>
          <span class="severity-badge ${sevCls}">${escapeHtml(a.severity || 'Medium')}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">${escapeHtml(a.message)}</p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.72rem; color: var(--text-light);">${formatDateTime(a.created_at)}</span>
          <button class="btn btn-sm btn-outline" onclick="openResolveAlertModal('${a.id}', '${escapeHtml(a.item_name)}', '${escapeHtml(a.message)}')">Resolve</button>
        </div>
      </div>
    `;
  }).join("");
}

// =============================================================================
// IMAGE DROPZONE, URL PREVIEW & NEW INSPECTION SUBMISSION
// =============================================================================
let activeImageSourceMode = "device"; // "device" or "url"

function setupImageDropzone() {
  const btnDevice = document.getElementById("btn-source-device");
  const btnUrl = document.getElementById("btn-source-url");
  const wrapperDevice = document.getElementById("wrapper-upload-device");
  const wrapperUrl = document.getElementById("wrapper-upload-url");
  const dropzone = document.getElementById("dropzone-inspection");
  const fileInput = document.getElementById("insp-file-input");
  const urlInput = document.getElementById("insp-image-url-input");
  const btnFetchUrl = document.getElementById("btn-fetch-url-preview");
  const previewBox = document.getElementById("preview-container-box");
  const preview = document.getElementById("insp-image-preview");
  const btnClear = document.getElementById("btn-clear-image-preview");

  // Mode Switching
  btnDevice?.addEventListener("click", () => {
    activeImageSourceMode = "device";
    btnDevice.style.background = "var(--primary)";
    btnDevice.style.color = "white";
    btnDevice.classList.remove("btn-outline");
    btnUrl.style.background = "transparent";
    btnUrl.style.color = "var(--text-main)";
    btnUrl.classList.add("btn-outline");
    if (wrapperDevice) wrapperDevice.style.display = "block";
    if (wrapperUrl) wrapperUrl.style.display = "none";
  });

  btnUrl?.addEventListener("click", () => {
    activeImageSourceMode = "url";
    btnUrl.style.background = "var(--primary)";
    btnUrl.style.color = "white";
    btnUrl.classList.remove("btn-outline");
    btnDevice.style.background = "transparent";
    btnDevice.style.color = "var(--text-main)";
    btnDevice.classList.add("btn-outline");
    if (wrapperDevice) wrapperDevice.style.display = "none";
    if (wrapperUrl) wrapperUrl.style.display = "block";
  });

  // Device File Dropzone
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        displayImagePreview(fileInput.files[0], preview, previewBox);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        displayImagePreview(fileInput.files[0], preview, previewBox);
      }
    });
  }

  // URL Preview Handler
  btnFetchUrl?.addEventListener("click", () => {
    const url = urlInput?.value.trim();
    if (!url) {
      showToast("Please enter an image web address / URL first.", "error");
      return;
    }
    loadUrlPreview(url, preview, previewBox);
  });

  // Quick Sample URL Buttons
  document.querySelectorAll(".btn-sample-url").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sampleUrl = btn.dataset.url;
      if (urlInput) urlInput.value = sampleUrl;
      loadUrlPreview(sampleUrl, preview, previewBox);
    });
  });

  // Clear Preview
  btnClear?.addEventListener("click", () => {
    if (fileInput) fileInput.value = "";
    if (urlInput) urlInput.value = "";
    if (preview) preview.src = "";
    if (previewBox) previewBox.style.display = "none";
  });
}

function loadUrlPreview(url, imgElement, boxElement) {
  if (!imgElement || !boxElement) return;
  imgElement.onload = () => {
    boxElement.style.display = "block";
    showToast("Image loaded from address successfully.", "info");
  };
  imgElement.onerror = () => {
    boxElement.style.display = "none";
    showToast("Could not load image from that address. Check URL validity.", "error");
  };
  imgElement.src = url;
}

function displayImagePreview(file, imgElement, boxElement) {
  if (!file || !imgElement) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    imgElement.src = e.target.result;
    if (boxElement) boxElement.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function setupFormSubmissions() {
  const form = document.getElementById("form-new-inspection");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-submit-inspection");

    const productName = document.getElementById("insp-product-name").value.trim();
    const category = document.getElementById("insp-category").value;
    const batch = document.getElementById("insp-batch").value.trim();
    const location = document.getElementById("insp-location").value.trim();
    const temp = document.getElementById("insp-temp").value;
    const rh = document.getElementById("insp-rh").value;
    const notes = document.getElementById("insp-notes").value.trim();
    const fileInput = document.getElementById("insp-file-input");
    const urlInput = document.getElementById("insp-image-url-input");

    // Validation: Image must be provided either via file or URL
    const hasFile = fileInput?.files && fileInput.files[0];
    const hasUrl = urlInput?.value.trim();

    if (!hasFile && !hasUrl) {
      showToast("Please provide an image from your device or paste an image address URL.", "error");
      return;
    }

    setButtonLoading(btn, true, "⚡ Run AI Freshness Diagnostic & Save");

    const formData = new FormData();
    formData.append("product_name", productName);
    formData.append("category", category);
    if (batch) formData.append("batch_number", batch);
    if (location) formData.append("storage_location", location);
    if (temp) formData.append("storage_temperature", temp);
    if (rh) formData.append("storage_humidity", rh);
    if (notes) formData.append("notes", notes);

    if (activeImageSourceMode === "url" && hasUrl) {
      formData.append("image_url", hasUrl);
    } else if (hasFile) {
      formData.append("file", fileInput.files[0]);
    } else if (hasUrl) {
      formData.append("image_url", hasUrl);
    }

    try {
      const result = await api.createInspectorInspection(formData);
      showToast(`Inspection ${result.inspection_id} completed successfully!`, "success");
      activeInspectionData = result;

      // Populate Live Diagnostic Card on the Right
      renderDiagnosticScorecard(result);

      // Refresh Overview KPIs in Background
      loadDashboardOverview();
    } catch (err) {
      showToast(`Inspection submission failed: ${err.message}`, "error");
    } finally {
      setButtonLoading(btn, false, "⚡ Run AI Freshness Diagnostic & Save");
    }
  });

  // Wire In-Place Diagnostic Card Buttons
  document.getElementById("btn-diag-confirm")?.addEventListener("click", () => {
    if (!activeInspectionData) return;
    const comments = document.getElementById("diag-inspector-comments").value.trim();
    submitInspectorReview(activeInspectionData.inspection_id, "Confirmed", "Meets visual quality standards", comments);
  });

  document.getElementById("btn-diag-further-insp")?.addEventListener("click", () => {
    if (!activeInspectionData) return;
    const comments = document.getElementById("diag-inspector-comments").value.trim();
    submitInspectorReview(activeInspectionData.inspection_id, "Requires Further Inspection", "Secondary verification required", comments);
  });

  document.getElementById("btn-diag-flag")?.addEventListener("click", () => {
    if (!activeInspectionData) return;
    openFlagModal(activeInspectionData.inspection_id);
  });
}

function renderDiagnosticScorecard(insp) {
  document.getElementById("diagnostic-empty-state").style.display = "none";
  document.getElementById("diagnostic-results-content").style.display = "block";

  const ai = insp.ai_result || {};
  const storage = insp.storage_review || {};

  setText("diagnostic-insp-id", `${insp.inspection_id} — ${insp.product_name}`);
  const statusBadge = document.getElementById("diagnostic-status-badge");
  if (statusBadge) {
    statusBadge.textContent = insp.status;
    statusBadge.className = `badge-status ${(insp.status || "pending").toLowerCase().replace(/\s+/g, "-")}`;
  }

  // Scores
  setText("diag-score", `${ai.quality_score}%`);
  setText("diag-classification", ai.classification || "Not Analyzed");
  setText("diag-confidence", `${Math.round(ai.confidence * 100)}%`);
  setText("diag-shelf-life", `${ai.estimated_shelf_life_days} days`);
  setText("diag-spoilage-risk", ai.spoilage_risk || "Low");

  // Defects Tags
  const defectsContainer = document.getElementById("diag-defects-list");
  if (defectsContainer) {
    const defects = ai.detected_defects || [];
    if (defects.length === 0 || (defects.length === 1 && defects[0].includes("No Significant Defects"))) {
      defectsContainer.innerHTML = `<span class="feature-tag success">🌿 Optimal Visual Quality — No Defects</span>`;
    } else {
      defectsContainer.innerHTML = defects.map((d) => `<span class="feature-tag danger">⚠️ ${escapeHtml(d)}</span>`).join("");
    }
  }

  // Storage Compliance
  const stBadge = document.getElementById("diag-storage-badge");
  if (stBadge) {
    stBadge.textContent = storage.status || "Normal";
    stBadge.className = `badge ${storage.status === 'Normal' ? 'success' : 'danger'}`;
  }
  setText("diag-storage-text", storage.notes || "Storage parameters within compliant tolerances.");
}

async function submitInspectorReview(inspectionId, decision, reason, comments, adjustedShelfLife = null) {
  try {
    const payload = { decision, reason, comments };
    if (adjustedShelfLife !== null) payload.adjusted_shelf_life = adjustedShelfLife;

    const res = await api.reviewInspectorInspection(inspectionId, payload);
    showToast(`Inspection ${inspectionId} marked as ${decision}.`, "success");
    activeInspectionData = res;
    renderDiagnosticScorecard(res);
    loadDashboardOverview();
  } catch (err) {
    showToast(`Validation update failed: ${err.message}`, "error");
  }
}

// =============================================================================
// PENDING REVIEWS QUEUE
// =============================================================================
async function loadPendingReviewsQueue() {
  const tbody = document.getElementById("reviews-table-body");
  const countBadge = document.getElementById("reviews-queue-count");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">Fetching validation queue...</td></tr>`;

  try {
    const all = await api.getInspectorInspections();
    const pending = all.filter((i) => ["Pending", "Under Review", "Requires Further Inspection"].includes(i.status));

    if (countBadge) countBadge.textContent = `${pending.length} Items`;

    if (pending.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">🎉 All inspections have been validated! Zero pending reviews.</td></tr>`;
      return;
    }

    tbody.innerHTML = pending.map((insp) => {
      const ai = insp.ai_result || {};
      const storage = insp.storage_review || {};
      const statusCls = (insp.status || "pending").toLowerCase().replace(/\s+/g, "-");

      return `
        <tr>
          <td><strong>${escapeHtml(insp.inspection_id)}</strong></td>
          <td>${escapeHtml(insp.product_name)}</td>
          <td><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHtml(insp.category)}</span></td>
          <td><strong>${escapeHtml(ai.classification || "Not Analyzed")}</strong></td>
          <td><strong>${ai.quality_score ?? 0}%</strong></td>
          <td><span class="severity-badge ${(ai.spoilage_risk || 'low').toLowerCase()}">${escapeHtml(ai.spoilage_risk || 'Low')}</span></td>
          <td><span class="badge ${storage.status === 'Normal' ? 'success' : 'danger'}">${escapeHtml(storage.status || 'Normal')}</span></td>
          <td><span class="badge-status ${statusCls}">${escapeHtml(insp.status)}</span></td>
          <td>
            <div style="display:flex; gap: 6px;">
              <button class="btn btn-sm btn-primary" onclick="openReviewDecisionModal('${insp.inspection_id}', '${escapeHtml(insp.product_name)}', '${escapeHtml(ai.classification)}')">Validate</button>
              <button class="btn btn-sm btn-danger" onclick="openFlagModal('${insp.inspection_id}')">Flag</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #b91c1c;">Error: ${err.message}</td></tr>`;
  }
}

// =============================================================================
// INSPECTION HISTORY
// =============================================================================
async function loadInspectionHistory() {
  const tbody = document.getElementById("history-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">Querying historical audit records...</td></tr>`;

  const search = document.getElementById("hist-search")?.value.trim() || "";
  const category = document.getElementById("hist-category")?.value || "all";
  const freshness = document.getElementById("hist-freshness")?.value || "all";
  const status = document.getElementById("hist-status")?.value || "all";

  const params = {};
  if (search) params.search = search;
  if (category !== "all") params.category = category;
  if (freshness !== "all") params.freshness_status = freshness;
  if (status !== "all") params.status = status;

  try {
    const items = await api.getInspectorHistory(params);

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">No inspections matched the selected filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((insp) => {
      const ai = insp.ai_result || {};
      const rev = insp.inspector_review || {};
      const statusCls = (insp.status || "pending").toLowerCase().replace(/\s+/g, "-");

      return `
        <tr>
          <td><strong>${escapeHtml(insp.inspection_id)}</strong></td>
          <td>${escapeHtml(insp.product_name)}</td>
          <td><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHtml(insp.category)}</span></td>
          <td><strong>${escapeHtml(ai.classification || "Not Analyzed")}</strong></td>
          <td><strong>${ai.quality_score ?? 0}%</strong></td>
          <td>${escapeHtml(rev.decision || "Pending")}</td>
          <td><span class="badge-status ${statusCls}">${escapeHtml(insp.status)}</span></td>
          <td>${formatDate(insp.created_at)}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="openInspectionDetailsModal('${insp.inspection_id}')">View</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #b91c1c;">Error: ${err.message}</td></tr>`;
  }
}

// =============================================================================
// STORAGE CONDITION REVIEW AUDITOR
// =============================================================================
function setupStorageAuditor() {
  const btn = document.getElementById("btn-run-storage-audit");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const cat = document.getElementById("storage-audit-category").value;
    const temp = parseFloat(document.getElementById("storage-audit-temp").value);
    const rh = parseFloat(document.getElementById("storage-audit-rh").value);

    try {
      const res = await api.getInspectorStorageReview(cat, temp, rh);
      
      setText("storage-result-title", `${cat} Storage Tolerances Audit`);
      const b = document.getElementById("storage-result-badge");
      if (b) {
        b.textContent = res.status;
        b.className = `badge ${res.status === 'Normal' ? 'success' : 'danger'}`;
      }

      setText("storage-temp-range", `${res.permitted_temp_min}°C to ${res.permitted_temp_max}°C`);
      setText("storage-temp-opt", `${res.recommended_temperature}°C`);
      setText("storage-rh-range", `${res.permitted_humidity_min}% to ${res.permitted_humidity_max}%`);
      setText("storage-rh-opt", `${res.recommended_humidity}%`);

      const list = document.getElementById("storage-findings-list");
      if (list) {
        if (res.violations && res.violations.length > 0) {
          list.innerHTML = res.violations.map((v) => `<li style="color:#b91c1c;">${escapeHtml(v)}</li>`).join("");
        } else {
          list.innerHTML = `<li>Observed conditions (+${temp}°C, ${rh}% RH) comply with safe cold-chain preservation.</li>`;
        }
      }

      setText("storage-advice-text", res.action_advice || "Optimal storage conditions maintained.");
    } catch (err) {
      showToast(`Storage audit failed: ${err.message}`, "error");
    }
  });
}

// =============================================================================
// QUALITY ANALYTICS CHARTS (CHART.JS)
// =============================================================================
async function loadQualityAnalytics() {
  try {
    const data = await api.getInspectorQualityAnalytics();

    renderFreshnessDonutChart(data.freshness_distribution || {});
    renderQualityTrendsLineChart(data.quality_trends || []);
    renderSpoilageBarChart(data.spoilage_trends || []);
    renderInspectionActivityChart(data.inspection_activity || []);
  } catch (err) {
    showToast(`Failed to load quality analytics: ${err.message}`, "error");
  }
}

function renderFreshnessDonutChart(dist) {
  const ctx = document.getElementById("chart-freshness-dist");
  if (!ctx) return;

  if (chartInstances.freshness) chartInstances.freshness.destroy();

  chartInstances.freshness = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Fresh", "Moderately Fresh", "Spoiled"],
      datasets: [{
        data: [dist["Fresh"] || 0, dist["Moderately Fresh"] || 0, dist["Spoiled"] || 0],
        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
        borderWidth: 2,
        borderColor: "#ffffff",
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      }
    }
  });
}

function renderQualityTrendsLineChart(trends) {
  const ctx = document.getElementById("chart-quality-trends");
  if (!ctx) return;

  if (chartInstances.quality) chartInstances.quality.destroy();

  chartInstances.quality = new Chart(ctx, {
    type: "line",
    data: {
      labels: trends.map((t) => t.date),
      datasets: [{
        label: "Average Quality Score (%)",
        data: trends.map((t) => t.average_quality),
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.1)",
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100 }
      }
    }
  });
}

function renderSpoilageBarChart(trends) {
  const ctx = document.getElementById("chart-spoilage-trends");
  if (!ctx) return;

  if (chartInstances.spoilage) chartInstances.spoilage.destroy();

  chartInstances.spoilage = new Chart(ctx, {
    type: "bar",
    data: {
      labels: trends.map((t) => t.date),
      datasets: [
        {
          label: "Spoiled Food Items",
          data: trends.map((t) => t.spoiled_count),
          backgroundColor: "#ef4444",
        },
        {
          label: "Flagged Results",
          data: trends.map((t) => t.flagged_count),
          backgroundColor: "#f59e0b",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function renderInspectionActivityChart(activity) {
  const ctx = document.getElementById("chart-inspection-activity");
  if (!ctx) return;

  if (chartInstances.activity) chartInstances.activity.destroy();

  chartInstances.activity = new Chart(ctx, {
    type: "bar",
    data: {
      labels: activity.map((a) => a.date),
      datasets: [{
        label: "Inspections Conducted",
        data: activity.map((a) => a.count),
        backgroundColor: "#0284c7",
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

// =============================================================================
// QUALITY ALERTS TAB
// =============================================================================
async function loadQualityAlerts(filter = "all") {
  const tbody = document.getElementById("alerts-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">Loading active alerts...</td></tr>`;

  try {
    const alerts = await api.getInspectorAlerts(filter);

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">🎉 Zero alerts found for filter '${filter}'. All storage and quality conditions nominal.</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map((a) => {
      const sevCls = (a.severity || "medium").toLowerCase();
      const isResolved = a.status === "resolved";

      return `
        <tr>
          <td><span class="severity-badge ${sevCls}">${escapeHtml(a.severity || 'Medium')}</span></td>
          <td><strong>${escapeHtml(a.alert_type || 'Alert')}</strong></td>
          <td>${escapeHtml(a.item_name)}</td>
          <td>${a.inspection_id ? `<code>${escapeHtml(a.inspection_id)}</code>` : 'N/A'}</td>
          <td>${escapeHtml(a.message)}</td>
          <td>${formatDateTime(a.created_at)}</td>
          <td><span class="badge ${isResolved ? 'success' : 'danger'}">${escapeHtml(a.status)}</span></td>
          <td>
            ${isResolved
              ? `<span style="font-size:0.75rem; color:var(--text-muted);">Resolved</span>`
              : `<button class="btn btn-sm btn-outline" onclick="openResolveAlertModal('${a.id}', '${escapeHtml(a.item_name)}', '${escapeHtml(a.message)}')">Resolve</button>`
            }
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: #b91c1c;">Error: ${err.message}</td></tr>`;
  }
}

// =============================================================================
// MODALS
// =============================================================================
function setupModals() {
  // Close buttons
  document.getElementById("btn-close-modal-details")?.addEventListener("click", () => closeModal("modal-details"));
  document.getElementById("btn-close-modal-review")?.addEventListener("click", () => closeModal("modal-review"));
  document.getElementById("btn-cancel-modal-review")?.addEventListener("click", () => closeModal("modal-review"));
  document.getElementById("btn-close-modal-flag")?.addEventListener("click", () => closeModal("modal-flag"));
  document.getElementById("btn-cancel-modal-flag")?.addEventListener("click", () => closeModal("modal-flag"));
  document.getElementById("btn-close-modal-resolve")?.addEventListener("click", () => closeModal("modal-resolve-alert"));
  document.getElementById("btn-cancel-modal-resolve")?.addEventListener("click", () => closeModal("modal-resolve-alert"));

  // Form Submissions
  document.getElementById("form-modal-review")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("modal-review-insp-id").value;
    const decision = document.getElementById("modal-review-decision").value;
    const reason = document.getElementById("modal-review-reason").value.trim();
    const adj = document.getElementById("modal-review-adjusted-days").value;
    const comments = document.getElementById("modal-review-comments").value.trim();

    const adjVal = adj ? parseFloat(adj) : null;
    await submitInspectorReview(id, decision, reason, comments, adjVal);
    closeModal("modal-review");
    loadPendingReviewsQueue();
  });

  document.getElementById("form-modal-flag")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("modal-flag-insp-id").value;
    const issueType = document.getElementById("modal-flag-issue-type").value;
    const severity = document.getElementById("modal-flag-severity").value;
    const reason = document.getElementById("modal-flag-reason").value.trim();
    const comments = document.getElementById("modal-flag-comments").value.trim();

    try {
      await api.flagInspectorInspection(id, {
        issue_type: issueType,
        severity,
        reason,
        comments
      });
      showToast(`Inspection ${id} flagged as [${severity}] ${issueType}`, "warning");
      closeModal("modal-flag");
      loadPendingReviewsQueue();
      loadDashboardOverview();
    } catch (err) {
      showToast(`Flag action failed: ${err.message}`, "error");
    }
  });

  document.getElementById("form-modal-resolve")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertId = document.getElementById("modal-resolve-alert-id").value;
    const action = document.getElementById("modal-resolve-action").value.trim();
    const notes = document.getElementById("modal-resolve-notes").value.trim();

    try {
      await api.resolveInspectorAlert(alertId, {
        action_taken: action,
        resolution_notes: notes,
      });
      showToast("Quality alert resolved successfully.", "success");
      closeModal("modal-resolve-alert");
      loadQualityAlerts();
      loadDashboardOverview();
    } catch (err) {
      showToast(`Resolve alert failed: ${err.message}`, "error");
    }
  });
}

function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.display = "flex";
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.display = "none";
}

window.openInspectionDetailsModal = async function(inspectionId) {
  openModal("modal-details");
  const content = document.getElementById("modal-details-content");
  if (!content) return;

  content.innerHTML = `<div style="text-align:center; padding: 20px;">Fetching inspection ${inspectionId}...</div>`;

  try {
    const insp = await api.getInspectorInspection(inspectionId);
    const ai = insp.ai_result || {};
    const storage = insp.storage_review || {};
    const rev = insp.inspector_review || {};

    const imageHtml = insp.image_reference
      ? `<img src="${insp.image_reference}" style="max-width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;" alt="Food Image">`
      : `<div style="background:#f1f5f9; padding: 30px; text-align:center; border-radius:8px; margin-bottom:16px; color:#64748b;">No Image Attached</div>`;

    content.innerHTML = `
      ${imageHtml}
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin:0; font-size: 1.3rem;">${escapeHtml(insp.product_name)}</h3>
        <span class="badge-status ${(insp.status || 'pending').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(insp.status)}</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 0.85rem;">
        <div><strong>Inspection ID:</strong> ${escapeHtml(insp.inspection_id)}</div>
        <div><strong>Category:</strong> ${escapeHtml(insp.category)}</div>
        <div><strong>Batch Number:</strong> ${escapeHtml(insp.batch_number || 'N/A')}</div>
        <div><strong>Inspector:</strong> ${escapeHtml(insp.inspector_name)}</div>
        <div><strong>Date:</strong> ${formatDateTime(insp.created_at)}</div>
        <div><strong>Location:</strong> ${escapeHtml(storage.storage_location || 'General Storage')}</div>
      </div>

      <h4 style="font-size: 0.95rem; margin-bottom: 6px;">Original AI Freshness Diagnostics</h4>
      <div class="scorecard-banner" style="margin-bottom: 14px;">
        <div class="scorecard-item">
          <div class="val">${ai.quality_score}%</div>
          <div class="lbl">Quality Score</div>
        </div>
        <div class="scorecard-item">
          <div class="val">${ai.classification}</div>
          <div class="lbl">Classification</div>
        </div>
        <div class="scorecard-item">
          <div class="val">${Math.round(ai.confidence * 100)}%</div>
          <div class="lbl">AI Confidence</div>
        </div>
        <div class="scorecard-item">
          <div class="val">${ai.estimated_shelf_life_days}d</div>
          <div class="lbl">Shelf Life</div>
        </div>
        <div class="scorecard-item">
          <div class="val">${ai.spoilage_risk}</div>
          <div class="lbl">Spoilage Risk</div>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; margin-bottom: 6px;">Environmental Storage Review</h4>
      <div style="background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 16px;">
        <div>Observed Temp: <strong>${storage.current_temperature ?? 'N/A'}°C</strong> (Allowed: ${storage.permitted_temp_min}°C to ${storage.permitted_temp_max}°C)</div>
        <div>Observed Humidity: <strong>${storage.current_humidity ?? 'N/A'}%</strong> (Optimal: ${storage.recommended_humidity}%)</div>
        <div>Compliance Status: <span class="badge ${storage.status === 'Normal' ? 'success' : 'danger'}">${storage.status}</span></div>
        <div style="color: #64748b; margin-top: 4px;">${escapeHtml(storage.notes || 'No issues observed')}</div>
      </div>

      <h4 style="font-size: 0.95rem; margin-bottom: 6px;">Inspector Review & Human Decision</h4>
      <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 16px;">
        <div>Decision: <strong>${escapeHtml(rev.decision || 'Pending')}</strong></div>
        ${rev.reason ? `<div>Reason: ${escapeHtml(rev.reason)}</div>` : ''}
        ${rev.comments ? `<div>Comments: ${escapeHtml(rev.comments)}</div>` : ''}
        ${rev.inspector_adjusted_shelf_life ? `<div>Human Adjusted Shelf Life: <strong>${rev.inspector_adjusted_shelf_life} days</strong></div>` : ''}
        ${rev.reviewed_at ? `<div>Reviewed At: ${formatDateTime(rev.reviewed_at)} by ${escapeHtml(rev.inspector_name || 'Inspector')}</div>` : ''}
      </div>

      <div style="display:flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-primary" onclick="openReviewDecisionModal('${insp.inspection_id}', '${escapeHtml(insp.product_name)}', '${escapeHtml(ai.classification)}')">Update Decision</button>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div style="color:#b91c1c; padding:20px;">Failed to load inspection: ${err.message}</div>`;
  }
};

window.openReviewDecisionModal = function(id, name, aiClassification) {
  document.getElementById("modal-review-insp-id").value = id;
  setText("modal-review-product-name", `${name} (${id})`);
  setText("modal-review-ai-res", aiClassification);
  openModal("modal-review");
};

window.openFlagModal = function(id) {
  document.getElementById("modal-flag-insp-id").value = id;
  openModal("modal-flag");
};

window.openResolveAlertModal = function(id, name, msg) {
  document.getElementById("modal-resolve-alert-id").value = id;
  setText("modal-resolve-item-name", name);
  setText("modal-resolve-message", msg);
  openModal("modal-resolve-alert");
};

// =============================================================================
// UTILITY HELPERS
// =============================================================================
function setText(elemId, val) {
  const el = document.getElementById(elemId);
  if (!el) return;
  if (typeof animateCounter === "function" && typeof val === "number") {
    animateCounter(el, val);
  } else {
    el.textContent = val;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(dateStr);
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(dateStr);
  }
}
