/**
 * Food Freshness Monitoring Platform - Reports & Quality Compliance Controller
 * Handles report filtering, CSV export, printable layout, and batch certificates.
 */

document.addEventListener("DOMContentLoaded", async () => {
  if (!api.requireAuth()) return;

  const categoryFilter = document.getElementById("report-category-filter");
  const storageFilter = document.getElementById("report-storage-filter");

  [categoryFilter, storageFilter].forEach(el => {
    if (el) el.addEventListener("change", () => loadReportsData());
  });

  async function downloadReportFile(endpoint, defaultFilename) {
    const cat = categoryFilter?.value || "all";
    const stor = storageFilter?.value || "all";
    const q = new URLSearchParams();
    if (cat !== "all") q.append("category", cat);
    if (stor !== "all") q.append("storage_type", stor);

    try {
      showToast("Generating report document, please wait...", "info");
      const token = api.getToken();
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${api.baseUrl}${endpoint}?${q.toString()}`, { headers });
      if (!res.ok) {
        throw new Error("Failed to download report file");
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

  const exportCsvBtn = document.getElementById("btn-export-csv");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => downloadReportFile("/reports/export-csv", "food_freshness_report.csv"));
  }

  const exportPdfBtn = document.getElementById("btn-export-pdf");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => downloadReportFile("/reports/export-pdf", "food_freshness_report.pdf"));
  }

  const exportExcelBtn = document.getElementById("btn-export-excel");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", () => downloadReportFile("/reports/export-excel", "food_freshness_inventory.xlsx"));
  }

  const printBtn = document.getElementById("btn-print-report");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  await loadReportsData();
});

async function loadReportsData() {
  const tableBody = document.getElementById("reports-table-body");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:30px;">
          <span class="spinner" style="display:inline-block; border-color:#0d9488; border-top-color:transparent;"></span>
          <p style="margin-top:8px; color:var(--text-muted);">Generating report data...</p>
        </td>
      </tr>
    `;
  }

  const category = document.getElementById("report-category-filter")?.value || "all";
  const storageType = document.getElementById("report-storage-filter")?.value || "all";

  try {
    const q = new URLSearchParams();
    if (category !== "all") q.append("category", category);
    if (storageType !== "all") q.append("storage_type", storageType);

    const res = await api.request(`/reports/summary?${q.toString()}`);

    renderReportSummary(res.summary);
    renderReportTable(res.items);
  } catch (err) {
    console.error("Error loading reports:", err);
    showToast("Error generating report: " + err.message, "error");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="8" style="color:#ef4444;text-align:center;">Failed to load report data: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function renderReportSummary(summary) {
  if (!summary || !summary.metrics) return;
  const m = summary.metrics;

  document.getElementById("rep-total-items").textContent = m.total_inventory_items || 0;
  document.getElementById("rep-avg-score").textContent = `${m.average_quality_score || 0}%`;
  document.getElementById("rep-analyses-count").textContent = m.total_analyses_performed || 0;

  const compBadge = document.getElementById("rep-compliance-status");
  if (compBadge) {
    if (summary.compliance_status === "COMPLIANT") {
      compBadge.className = "badge badge-fresh";
      compBadge.textContent = "COMPLIANT";
    } else {
      compBadge.className = "badge badge-danger";
      compBadge.textContent = "ATTENTION REQUIRED";
    }
  }

  const reportIdEl = document.getElementById("rep-report-id");
  if (reportIdEl) reportIdEl.textContent = `Report ID: ${summary.report_id}`;

  const genDateEl = document.getElementById("rep-gen-date");
  if (genDateEl) {
    const d = new Date(summary.generated_at);
    genDateEl.textContent = `Generated: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

function renderReportTable(items) {
  const tableBody = document.getElementById("reports-table-body");
  if (!tableBody) return;

  if (!items || items.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 30px; color:var(--text-muted);">
          No inventory items matched your reporting criteria.
        </td>
      </tr>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  tableBody.innerHTML = items.map(item => {
    let statusBadge = `<span class="badge badge-pending">Not Analyzed</span>`;
    if (item.freshness_status === "Fresh") {
      statusBadge = `<span class="badge badge-fresh">Fresh</span>`;
    } else if (item.freshness_status === "Expiring Soon") {
      statusBadge = `<span class="badge badge-warning">Expiring Soon</span>`;
    } else if (item.freshness_status === "Spoiled" || item.expiry_date < todayStr) {
      statusBadge = `<span class="badge badge-danger">Spoiled / Expired</span>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(item.food_name)}</strong></td>
        <td><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHtml(item.category)}</span></td>
        <td>${item.quantity} ${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.expiry_date)}</td>
        <td>${escapeHtml(item.storage_type)} (${item.storage_temperature !== null && item.storage_temperature !== undefined ? item.storage_temperature + '°C' : 'N/A'})</td>
        <td><strong>${item.freshness_score !== null && item.freshness_score !== undefined ? item.freshness_score + '%' : 'Pending'}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openCertificateModal('${item.id}')">
            📜 Certificate
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function openCertificateModal(itemId) {
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
}

function closeCertificateModal() {
  const modal = document.getElementById("certificate-modal");
  if (modal) modal.classList.remove("active");
}
