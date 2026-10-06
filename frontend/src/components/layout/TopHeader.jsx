import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Bell,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../constants/roles";
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../api/notifications";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/inventory": "Food Items",
  "/batches": "Batches",
  "/inventory-overview": "Inventory Overview",
  "/upload": "Food Image Analysis",
  "/reports": "Freshness Reports",
  "/analytics": "Analytics",
  "/shelf-life": "Shelf Life Prediction",
  "/recommendations": "Recommendations",
  "/waste-reduction": "Waste Reduction",
  "/storage": "Storage Monitoring",
  "/profile": "Profile & Settings",
  "/admin/users": "User Management",
};

function pageTitleFor(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

  const base = "/" + pathname.split("/")[1];

  return PAGE_TITLES[base] || "FoodCare";
}

export default function TopHeader({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function loadNotifications() {
    try {
      const [notificationData, countData] = await Promise.all([
        listNotifications(),
        getUnreadNotificationCount(),
      ]);

      setNotifications(notificationData);
      setUnreadCount(countData.unread_count || 0);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials = (user?.full_name || user?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
          {pageTitleFor(location.pathname)}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notification section */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setMenuOpen(false);
            }}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            title="Notifications"
          >
            <Bell size={20} />

            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNotificationsOpen(false)}
              />

              <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Notifications
                  </h3>

                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await markAllNotificationsRead();
                          await loadNotifications();
                        } catch (error) {
                          console.error(
                            "Failed to mark all notifications as read:",
                            error
                          );
                        }
                      }}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={async () => {
                          try {
                            if (!notification.is_read) {
                              await markNotificationRead(notification.id);
                              await loadNotifications();
                            }
                          } catch (error) {
                            console.error(
                              "Failed to mark notification as read:",
                              error
                            );
                          }
                        }}
                        className={`w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                          !notification.is_read ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {notification.title}
                          </p>

                          {!notification.is_read && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {notification.message}
                        </p>

                        <p className="mt-1 text-[10px] uppercase text-slate-400">
                          {notification.severity}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile section */}
        <div className="relative">
          <button
            onClick={() => {
              setMenuOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials}
            </span>

            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-slate-900">
                {user?.full_name || user?.username}
              </span>

              <span className="block text-xs leading-tight text-slate-400">
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </span>

            <ChevronDown size={15} className="text-slate-400" />
          </button>

          {/* Profile dropdown */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />

              <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profile");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <UserIcon size={15} />
                  Profile
                </button>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}