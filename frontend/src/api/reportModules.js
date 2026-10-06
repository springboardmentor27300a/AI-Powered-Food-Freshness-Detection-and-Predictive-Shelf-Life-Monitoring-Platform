import client from "./client";

// -----------------------------
// Inventory Quality Report
// -----------------------------

export async function getInventoryQualityReport(params = {}) {
  const res = await client.get("/inventory/quality-report", { params });
  return res.data;
}

export async function downloadInventoryQualityPdf() {
  const res = await client.get("/inventory/quality-report/pdf", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Inventory_Quality_Report.pdf",
    "application/pdf"
  );
}

export async function downloadInventoryQualityCsv() {
  const res = await client.get("/inventory/quality-report/csv", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Inventory_Quality_Report.csv",
    "text/csv"
  );
}

export async function downloadInventoryQualityExcel() {
  const res = await client.get("/inventory/quality-report/excel", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Inventory_Quality_Report.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}


// -----------------------------
// Waste Reduction Report
// -----------------------------

export async function getWasteReductionReport(params = {}) {
  const res = await client.get("/waste-reduction/report", { params });
  return res.data;
}

export async function downloadWasteReductionPdf() {
  const res = await client.get("/waste-reduction/report/pdf", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Waste_Reduction_Report.pdf",
    "application/pdf"
  );
}

export async function downloadWasteReductionCsv() {
  const res = await client.get("/waste-reduction/report/csv", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Waste_Reduction_Report.csv",
    "text/csv"
  );
}

export async function downloadWasteReductionExcel() {
  const res = await client.get("/waste-reduction/report/excel", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Waste_Reduction_Report.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}


// -----------------------------
// Storage Compliance Report
// -----------------------------

export async function getStorageComplianceReport(params = {}) {
  const res = await client.get("/storage/compliance-report", { params });
  return res.data;
}

export async function downloadStorageCompliancePdf() {
  const res = await client.get("/storage/compliance-report/pdf", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Storage_Compliance_Report.pdf",
    "application/pdf"
  );
}

export async function downloadStorageComplianceCsv() {
  const res = await client.get("/storage/compliance-report/csv", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Storage_Compliance_Report.csv",
    "text/csv"
  );
}

export async function downloadStorageComplianceExcel() {
  const res = await client.get("/storage/compliance-report/excel", {
    responseType: "blob",
  });

  downloadBlob(
    res.data,
    "FoodCare_Storage_Compliance_Report.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}


// -----------------------------
// Common download helper
// -----------------------------

function downloadBlob(data, filename, mimeType) {
  const blob = new Blob([data], {
    type: mimeType,
  });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}
// -----------------------------
// Shelf-Life Report
// -----------------------------

export async function downloadShelfLifePdf(batchId) {
  const res = await client.get(
    `/shelf-life/batch/${batchId}/report/pdf`,
    {
      responseType: "blob",
    }
  );

  downloadBlob(
    res.data,
    `FoodCare_Shelf_Life_Report_${batchId}.pdf`,
    "application/pdf"
  );
}

export async function downloadShelfLifeCsv(batchId) {
  const res = await client.get(
    `/shelf-life/batch/${batchId}/report/csv`,
    {
      responseType: "blob",
    }
  );

  downloadBlob(
    res.data,
    `FoodCare_Shelf_Life_Report_${batchId}.csv`,
    "text/csv"
  );
}

export async function downloadShelfLifeExcel(batchId) {
  const res = await client.get(
    `/shelf-life/batch/${batchId}/report/excel`,
    {
      responseType: "blob",
    }
  );

  downloadBlob(
    res.data,
    `FoodCare_Shelf_Life_Report_${batchId}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}