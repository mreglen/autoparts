import { APP_HEADERS } from "../app/appIdentity";
import { clearTokens, readTokens, saveTokens } from "../auth/tokenStore";
import {
  API_BASE_URL,
  GET_RETRY_LIMIT,
  REQUEST_TIMEOUT_MS,
} from "../config/env";
import { ApiError, readErrorDetail } from "./errors";

let accessToken: string | null = null;
type RefreshResult = "ok" | "invalid" | "error";

let refreshInFlight: Promise<RefreshResult> | null = null;

export type SessionEndReason = "session" | "expired";

const sessionExpiredListeners = new Set<(reason: SessionEndReason) => void>();

export function onSessionExpired(
  listener: (reason: SessionEndReason) => void,
): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(reason: SessionEndReason): void {
  sessionExpiredListeners.forEach((listener) => listener(reason));
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function bootstrapAccessToken(): Promise<void> {
  const tokens = await readTokens();
  accessToken = tokens.access;
}

async function refreshTokens(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async (): Promise<RefreshResult> => {
    const tokens = await readTokens();
    if (!tokens.refresh) return "invalid";
    try {
      const response = await rawFetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh }),
      });
      if (response.status === 401 || response.status === 403) return "invalid";
      if (!response.ok) return "error";
      const data = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!data.access_token) return "error";
      await saveTokens({
        access: data.access_token,
        refresh: data.refresh_token ?? tokens.refresh,
      });
      accessToken = data.access_token;
      return "ok";
    } catch {
      return "error";
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(buildUrl(path), { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("timeout", 0, null);
    }
    throw new ApiError("network", 0, null);
  } finally {
    clearTimeout(timer);
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  form?: Record<string, string>;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

async function request<T>(
  path: string,
  options: ApiRequestOptions,
  attempt: number,
  didRefresh = false,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { ...APP_HEADERS };
  let body: BodyInit | undefined;
  if (options.form) {
    const form = new FormData();
    for (const [key, value] of Object.entries(options.form))
      form.append(key, value);
    body = form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await rawFetch(path, { method, headers, body });
  } catch (error) {
    if (method === "GET" && attempt < GET_RETRY_LIMIT) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      return request<T>(path, options, attempt + 1);
    }
    throw error;
  }

  if (
    response.status === 401 &&
    options.auth !== false &&
    options.retryOnUnauthorized !== false &&
    !didRefresh
  ) {
    // Деталь исходного 401 отличает «сессию деактивировали» (смена прав, выход на другом
    // устройстве) от обычного истёкшего JWT — для разных сообщений на экране входа.
    const originalDetail = await readErrorDetail(response.clone());
    const refreshed = await refreshTokens();
    if (refreshed === "ok") {
      return request<T>(path, options, attempt, true);
    }
    if (refreshed === "invalid") {
      await clearTokens();
      accessToken = null;
      const reason: SessionEndReason = originalDetail?.includes("Сессия")
        ? "session"
        : "expired";
      notifySessionExpired(reason);
    }
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiError("http", response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiGet<T>(
  path: string,
  options: Omit<ApiRequestOptions, "method"> = {},
): Promise<T> {
  return request<T>(path, { ...options, method: "GET" }, 0);
}

export function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: Omit<ApiRequestOptions, "method"> = {},
): Promise<T> {
  return request<T>(path, { ...options, method }, 0);
}

/** Бинарный GET (PDF и т.п.) с тем же Bearer/refresh, что у JSON-запросов. */
export async function apiBlob(path: string): Promise<Response> {
  const headers: Record<string, string> = { ...APP_HEADERS };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response = await rawFetch(path, { headers });
  if (response.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed === "ok") {
      headers.Authorization = `Bearer ${accessToken}`;
      response = await rawFetch(path, { headers });
    } else if (refreshed === "invalid") {
      await clearTokens();
      accessToken = null;
      notifySessionExpired("expired");
    }
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiError("http", response.status, detail);
  }
  return response;
}
