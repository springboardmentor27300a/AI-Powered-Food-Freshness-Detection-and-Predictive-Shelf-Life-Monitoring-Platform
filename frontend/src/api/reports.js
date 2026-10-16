import api from "./axios";

// Downloads one report through the authenticated axios instance (so the
// JWT is attached) and saves it in the browser. `kind` is one of:
// freshness | shelf-life | inventory-quality | waste-reduction |
// storage-compliance | platform-summary.   `format` is "pdf" or "xlsx".
export async function downloadReport(kind, format) {
  let response;
  try {
    response = await api.get(`/api/reports/${kind}`, {
      params: { format },
      responseType: "blob",
    });
  } catch (err) {
    // With responseType "blob", error bodies arrive as a Blob too.
    let detail = "";
    try {
      const text = await err.response?.data?.text?.();
      detail = text ? JSON.parse(text).detail : "";
    } catch {
      detail = "";
    }
    const status = err.response?.status;
    if (status === 403) throw new Error("You do not have permission to download this report.");
    if (detail && typeof detail === "string") throw new Error(detail);
    throw new Error("Could not generate the report. Please try again.");
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const filename = `${kind}-report-${stamp}.${format}`;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}
