/** Декодирование JWT без зависимостей: нужны permission_codes для этапа 5
 *  (видимость разделов режет сервер, но клиент прячет лишние табы). */

import { getAccessToken } from "../api/client";

export interface TokenPayload {
  sub?: string;
  exp?: number;
  permission_codes?: string[];
  user_permissions?: number[];
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  // atob есть в Hermes; fallback — через global Buffer отсутствует, поэтому чистый atob.
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function decodeAccessToken(
  token: string | null | undefined,
): TokenPayload | null {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(base64UrlDecode(part)) as TokenPayload;
  } catch {
    return null;
  }
}

/** Коды прав текущей сессии — читаются из access-токена в памяти клиента. */
export function currentPermissionCodes(): string[] {
  return decodeAccessToken(getAccessToken())?.permission_codes ?? [];
}
