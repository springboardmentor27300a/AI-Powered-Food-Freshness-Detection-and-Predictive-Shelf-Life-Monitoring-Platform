
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import "./NotificationBell.css";

function getMessage(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notifications)) return data.notifications;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [listResponse, countResponse] = await Promise.all([
        apiFetch("/notifications"),
        apiFetch("/notifications/unread-count"),
      ]);

      if (!listResponse.ok || !countResponse.ok) {
        throw new Error("Unable to load notifications.");
      }

      const listData = await listResponse.json();
      const countData = await countResponse.json();

      setNotifications(getMessage(listData));

      const count = Number(
        countData?.unread_count ??
        countData?.count ??
        countData?.unread ??
        0
      );

      setUnreadCount(
        Number.isFinite(count)
          ? count
          : 0
      );
    } catch (err) {
      setError(err.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function checkForAlerts() {
    setChecking(true);
    setError("");

    try {
      const response = await apiFetch("/notifications/generate", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to generate alerts.");
      }

      await loadNotifications();
    } catch (err) {
      setError(err.message || "Could not check for alerts.");
    } finally {
      setChecking(false);
    }
  }

  async function markAsRead(notification) {
    if (notification.is_read) return;

    try {
      const response = await apiFetch(
        `/notifications/${notification.id}/read`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Unable to mark notification as read.");
      }

      await loadNotifications();
    } catch (err) {
      setError(err.message || "Could not update notification.");
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function severityClass(severity) {
    return String(severity || "medium").toLowerCase();
  }

  return (
    <div className="notification-bell-wrapper">
      <button
        type="button"
        className="notification-bell-button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);

          if (nextOpen) {
            loadNotifications();
          }
        }}
      >
        <span className="notification-bell-icon">🔔</span>

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="notification-backdrop"
            aria-label="Close notifications"
            onClick={() => setIsOpen(false)}
          />

          <section
            className="notification-dropdown"
            aria-label="Notifications"
          >
            <div className="notification-dropdown-header">
              <div>
                <h3>Notifications</h3>
                <p>
                  {unreadCount} unread
                </p>
              </div>

              <button
                type="button"
                className="notification-close-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="notification-actions">
              <button
                type="button"
                onClick={checkForAlerts}
                disabled={checking}
              >
                {checking ? "Checking..." : "↻ Check for Alerts"}
              </button>

              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {error && (
              <p className="notification-error">{error}</p>
            )}

            {loading && notifications.length === 0 ? (
              <p className="notification-empty">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <p className="notification-empty">
                No notifications yet. Click “Check for Alerts” to scan
                for food expiry, freshness, and storage issues.
              </p>
            ) : (
              <div className="notification-list">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`notification-item ${
                      notification.is_read ? "is-read" : "is-unread"
                    }`}
                  >
                    <div className="notification-item-top">
                      <span
                        className={`notification-severity ${severityClass(
                          notification.severity
                        )}`}
                      >
                        {notification.severity || "Notice"}
                      </span>

                      {!notification.is_read && (
                        <span className="notification-unread-dot" />
                      )}
                    </div>

                    <h4>
                      {notification.title || "Food freshness alert"}
                    </h4>

                    <p>
                      {notification.message || "There are no additional details."}
                    </p>

                    <div className="notification-item-footer">
                      <span>
                        {formatDate(
                          notification.created_at || notification.createdAt
                        )}
                      </span>

                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notification)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
