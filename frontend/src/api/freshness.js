import api from "./axios";

// Uploads a food photo for one inventory item and runs heuristic
// computer-vision freshness analysis on it (NOT a trained AI model —
// see backend/app/core/image_processing.py for details).
export async function analyzeFreshness(inventoryId, imageFile) {
  const formData = new FormData();
  formData.append("file", imageFile);

  const response = await api.post(
    `/api/inventory/${inventoryId}/freshness`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}

// Returns the freshness assessment history + trend direction for one
// inventory item (real stored records only, never fabricated).
export async function getFreshnessHistory(inventoryId) {
  const response = await api.get(`/api/inventory/${inventoryId}/freshness`);
  return response.data;
}

export async function getFreshnessAssessment(assessmentId) {
  const response = await api.get(`/api/freshness/${assessmentId}`);
  return response.data;
}

export async function deleteFreshnessAssessment(assessmentId) {
  await api.delete(`/api/freshness/${assessmentId}`);
}

// Fetches the actual uploaded food photo for an assessment and
// returns it as a data: URL, so it can be embedded directly in the
// on-screen report and the printable/PDF report (Milestone 3).
// The image is fetched with the same authenticated axios instance
// (so the Authorization header is attached) rather than linking to a
// raw backend URL, and no filesystem path is ever exposed to the UI.
export async function getFreshnessAssessmentImageDataUrl(assessmentId) {
  const response = await api.get(`/api/freshness/${assessmentId}/image`, {
    responseType: "blob",
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(response.data);
  });
}

