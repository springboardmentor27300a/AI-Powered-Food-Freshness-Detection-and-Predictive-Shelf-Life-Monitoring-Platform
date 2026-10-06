// Keeps developer-facing details (file paths, stack traces, "train the
// model first" instructions) out of the normal user interface, while
// still surfacing real, meaningful information (e.g. "no report yet",
// "wrong role") that helps the user understand what happened.

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

// Backend validation/auth/not-found messages are safe to show as-is —
// they don't leak paths or stack traces. Only messages that look like
// they reference the filesystem, a model file, or Python internals get
// replaced with a clean equivalent.
const LOOKS_TECHNICAL = /(\.keras|\.py|\/home\/|\/mnt\/|[A-Za-z]:\\|Traceback|models\/|ml\/|train_cnn|Errno|File not found at)/i;

export function friendlyError(err, fallback = GENERIC_FALLBACK) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim() && !LOOKS_TECHNICAL.test(detail)) {
    return detail;
  }
  const status = err?.response?.status;
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 415) return "That file type isn't supported.";
  return fallback;
}

// CNN model status ("available" | "unavailable" | ...) — never surfaces
// the raw `reason` field, which may contain a filesystem path or a
// training command intended for the developer, not the end user.
export function friendlyModelStatus(modelStatus) {
  if (!modelStatus) {
    return { available: false, message: "Freshness prediction is currently unavailable." };
  }
  if (modelStatus.status === "available") {
    return { available: true, message: "AI freshness prediction is active." };
  }
  return {
    available: false,
    message: "AI freshness prediction isn't set up yet for this environment. Visual analysis and all other features still work normally.",
  };
}

// A CNN prediction record on a report/analysis — same idea, applied to
// the per-image prediction status rather than the global model status.
export function friendlyPredictionMessage(cnnPrediction) {
  if (!cnnPrediction || cnnPrediction.status !== "success") {
    return "AI prediction isn't available for this image. The visual analysis below is still based on the real photo.";
  }
  return null; // success — caller renders the real prediction
}
