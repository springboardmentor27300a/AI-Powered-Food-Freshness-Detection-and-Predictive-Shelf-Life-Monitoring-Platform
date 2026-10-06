import client from "./client";

export async function generateReport(payload) {
  const res = await client.post("/reports/generate", payload);
  return res.data;
}

export async function listReports(params = {}) {
  const res = await client.get("/reports", { params });
  return res.data;
}

export async function getReport(id) {
  const res = await client.get(`/reports/${id}`);
  return res.data;
}

export async function downloadReportPdf(id, reportNumber) {
  const res = await client.get(`/reports/${id}/pdf`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(
    new Blob([res.data], {
      type: "application/pdf",
    })
  );

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `FoodCare_Freshness_Report_${reportNumber}.pdf`
  );

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export async function downloadReportCsv(id, reportNumber) {
  const res = await client.get(`/reports/${id}/csv`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(
    new Blob([res.data], {
      type: "text/csv",
    })
  );

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `FoodCare_Freshness_Report_${reportNumber}.csv`
  );

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export async function downloadReportExcel(id, reportNumber) {
  const res = await client.get(`/reports/${id}/excel`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(
    new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `FoodCare_Freshness_Report_${reportNumber}.xlsx`
  );

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}