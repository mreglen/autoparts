import { apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";

/** In-app лента уведомлений (`/api/notifications/feed`). */

export interface UserNotification {
  id: number;
  event_type: string;
  title: string;
  body?: string | null;
  url?: string | null;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationFeed {
  items: UserNotification[];
  unread_count: number;
}

export function fetchNotificationFeed(limit = 50) {
  return cachedGet<NotificationFeed>(`/api/notifications/feed?limit=${limit}`);
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiSend("POST", `/api/notifications/feed/${id}/read`);
  await invalidateEntities(["notifications"]);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiSend("POST", "/api/notifications/feed/read-all");
  await invalidateEntities(["notifications"]);
}
