import { useEffect, useState } from "react";
import { API } from "./api";

export default function AssessmentHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadHistory = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API}/assessments/history`);

      if (!response.ok) {
        throw new Error("Could not load assessment history");
      }

      const data = await response.json();

      setItems(
        Array.isArray(data.assessments)
          ? data.assessments
          : []
      );
    } catch (error) {
      console.error(error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async () => {
    setOpen(true);
    await loadHistory();
  };

  useEffect(() => {
    const closeOnEscape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="assessment-history-trigger"
        onClick={openHistory}
      >
        Assessment History
      </button>

      {open && (
        <div
          className="history-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="history-modal">

            <div className="history-modal-header">
              <div>
                <p className="eyebrow">
                  PREVIOUS ASSESSMENTS
                </p>

                <h2>Assessment History</h2>

                <p>
                  Review previous freshness assessments and
                  reopen their saved reports.
                </p>
              </div>

              <button
                type="button"
                className="history-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close assessment history"
              >
                ×
              </button>
            </div>

            <div className="history-modal-toolbar">
              <span>
                {items.length} saved assessment
                {items.length === 1 ? "" : "s"}
              </span>

              <button
                type="button"
                className="history-refresh-button"
                onClick={loadHistory}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loading && items.length === 0 ? (
              <div className="history-empty">
                Loading assessment history...
              </div>
            ) : items.length === 0 ? (
              <div className="history-empty">
                No previous assessments found.
              </div>
            ) : (
              <div className="history-table-wrap">
                <table className="history-table">

                  <thead>
                    <tr>
                      <th>Assessment</th>
                      <th>Food</th>
                      <th>Batch</th>
                      <th>Freshness</th>
                      <th>Status</th>
                      <th>Spoilage Risk</th>
                      <th>Shelf Life</th>
                      <th>Predicted Expiry</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr key={item.assessment_id}>

                        <td>
                          #{item.assessment_id}
                        </td>

                        <td>
                          <strong>{item.food_type}</strong>
                        </td>

                        <td>
                          {item.batch_id
                            ? `#${item.batch_id}`
                            : "Not linked"}
                        </td>

                        <td>
                          {Number(
                            item.freshness_score || 0
                          ).toFixed(2)}%
                        </td>

                        <td>
                          <span
                            className={`history-status history-status-${String(
                              item.freshness_status || ""
                            ).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {item.freshness_status}
                          </span>
                        </td>

                        <td>
                          {item.spoilage_risk}
                        </td>

                        <td>
                          {item.shelf_life_at_assessment} days
                        </td>

                        <td>
                          {item.predicted_expiry_date}
                        </td>

                        <td>
                          <div className="history-actions">

                            <button
                              type="button"
                              className="history-view-button"
                              onClick={() =>
                                window.open(
                                  `${API}/reports/assessment/${item.assessment_id}/pdf`,
                                  "_blank"
                                )
                              }
                            >
                              View Report
                            </button>

                            <button
                              type="button"
                              className="history-excel-button"
                              onClick={() =>
                                window.open(
                                  `${API}/reports/assessment/${item.assessment_id}/excel`,
                                  "_blank"
                                )
                              }
                            >
                              Excel
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
