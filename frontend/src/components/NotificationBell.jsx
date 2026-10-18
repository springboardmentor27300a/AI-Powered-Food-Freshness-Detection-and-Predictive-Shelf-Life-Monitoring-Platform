import { useEffect, useState, useRef } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  generateNotifications,
} from "../api";

const SEVERITY_CONFIG = {
  info: { icon: Info, color: "#3b82f6", bg: "#eff6ff", label: "INFO" },
  warning: { icon: AlertTriangle, color: "#f59e0b", bg: "#fffbeb", label: "WARNING" },
  critical: { icon: AlertCircle, color: "#ef4444", bg: "#fef2f2", label: "CRITICAL" },
};

const TYPE_LABELS = {
  freshness_alert: "Freshness Alert",
  shelf_life_warning: "Shelf-Life Warning",
  shelf_life_expiring_soon: "Shelf-Life Warning",
  shelf_life_expired: "Shelf-Life Warning",
  spoilage_notification: "Spoilage Notification",
  storage_condition_alert: "Storage Condition Alert",
  inventory_expired: "Inventory Alert",
  inventory_expiring_soon: "Inventory Alert",
  platform_notification: "Platform Notification",
};

export default function NotificationBell({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications(session.token);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // Silently fail — notifications are non-critical
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const data = await getUnreadCount(session.token);
      setUnreadCount(data.unread_count);
    } catch {
      // Silently fail
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateNotifications(session.token);
      await fetchNotifications();
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(session.token, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(session.token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button className="notification-bell-btn" onClick={toggleDropdown} title="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-header-actions">
              <button
                className="btn-text"
                onClick={handleGenerate}
                disabled={loading}
                title="Check for new alerts"
              >
                {loading ? "Checking..." : "Refresh"}
              </button>
              <button className="btn-text" onClick={handleMarkAllRead}>
                Mark all read
              </button>
              <button className="notification-close" onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <CheckCircle2 size={24} />
                <span>No new notifications.</span>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => {
                const sevCfg = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
                const SevIcon = sevCfg.icon;
                const typeLabel = TYPE_LABELS[n.notification_type] || n.notification_type;
                return (
                  <div
                    key={n.id}
                    className={`notification-item ${!n.is_read ? "notification-unread" : ""}`}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    <div
                      className="notification-icon"
                      style={{ background: sevCfg.bg, color: sevCfg.color }}
                    >
                      <SevIcon size={16} />
                    </div>
                    <div className="notification-content">
                      <div className="notification-title-row">
                        <span
                          className="notification-type"
                          style={{ color: sevCfg.color }}
                        >
                          {sevCfg.label}
                        </span>
                        <span className="notification-type-label">{typeLabel}</span>
                      </div>
                      <strong className="notification-title">{n.title}</strong>
                      <p className="notification-message">{n.message}</p>
                      <span className="notification-time">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    {!n.is_read && <span className="notification-dot" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
