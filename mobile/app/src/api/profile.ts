import { apiGet, apiSend } from "./client";

/** Профиль аккаунта (`/api/auth/profile`, `/api/users/me`). */

export interface MyProfile {
  id: number;
  public_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  patronymic?: string | null;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  must_change_password?: boolean;
}

export interface ProfileUpdatePayload {
  last_name?: string | null;
  first_name?: string | null;
  patronymic?: string | null;
  email?: string;
  phone?: string | null;
}

export function fetchMyProfile() {
  return apiGet<MyProfile>("/auth/profile");
}

export async function updateMyProfile(
  body: ProfileUpdatePayload,
): Promise<MyProfile> {
  return apiSend<MyProfile>("PUT", "/users/me", { body });
}

export interface NotificationChannelPrefs {
  push: boolean;
  email: boolean;
}

export interface NotificationPrefs {
  orders: NotificationChannelPrefs;
  messages: NotificationChannelPrefs;
  search: NotificationChannelPrefs;
  other: NotificationChannelPrefs;
  autoservice: NotificationChannelPrefs;
}

export interface NotificationPreferencesResponse {
  notification_prefs: NotificationPrefs;
  has_push_subscription: boolean;
}

export function fetchNotificationPreferences() {
  return apiGet<NotificationPreferencesResponse>("/notifications/preferences");
}

export async function updateNotificationPreferences(
  prefs: NotificationPrefs,
): Promise<NotificationPreferencesResponse> {
  return apiSend<NotificationPreferencesResponse>(
    "PATCH",
    "/notifications/preferences",
    { body: { notification_prefs: prefs } },
  );
}
