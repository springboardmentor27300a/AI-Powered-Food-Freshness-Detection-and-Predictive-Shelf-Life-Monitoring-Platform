import client from "./client";

export async function listNotifications(params = {}) {
  const res = await client.get("/notifications", { params });
  return res.data;
}

export async function getUnreadNotificationCount() {
  const res = await client.get("/notifications/unread-count");

  return {
    unread_count:
      res.data.unread_count ??
      res.data.count ??
      res.data.total ??
      0,
  };
}

export async function markNotificationRead(notificationId, isRead = true) {
  const res = await client.patch(
    `/notifications/${notificationId}/read`,
    { is_read: isRead }
  );
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await client.patch("/notifications/mark-all-read");
  return res.data;
}