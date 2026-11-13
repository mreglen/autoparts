import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { TOKEN_KEYS } from "../storage/keys";

export interface StoredTokens {
  access: string | null;
  refresh: string | null;
}

const SECURE_TIMEOUT_MS = 3000;
const FALLBACK_PREFIX = "sg:fallback:";

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), SECURE_TIMEOUT_MS),
    ),
  ]);
}

export async function readTokens(): Promise<StoredTokens> {
  const [access, refresh] = await Promise.all([
    withTimeout(
      SecureStore.getItemAsync(TOKEN_KEYS.access),
      undefined as string | null | undefined,
    ),
    withTimeout(
      SecureStore.getItemAsync(TOKEN_KEYS.refresh),
      undefined as string | null | undefined,
    ),
  ]);
  if (access !== undefined || refresh !== undefined) {
    return { access: access ?? null, refresh: refresh ?? null };
  }
  const [fbAccess, fbRefresh] = await Promise.all([
    AsyncStorage.getItem(`${FALLBACK_PREFIX}${TOKEN_KEYS.access}`),
    AsyncStorage.getItem(`${FALLBACK_PREFIX}${TOKEN_KEYS.refresh}`),
  ]);
  return { access: fbAccess, refresh: fbRefresh };
}

export async function saveTokens(tokens: Partial<StoredTokens>): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  const mirror: [string, string | null | undefined][] = [];
  if ("access" in tokens) mirror.push([TOKEN_KEYS.access, tokens.access]);
  if ("refresh" in tokens) mirror.push([TOKEN_KEYS.refresh, tokens.refresh]);
  for (const [key, value] of mirror) {
    const fbKey = `${FALLBACK_PREFIX}${key}`;
    jobs.push(
      value
        ? AsyncStorage.setItem(fbKey, value)
        : AsyncStorage.removeItem(fbKey),
    );
    jobs.push(
      withTimeout(
        value
          ? SecureStore.setItemAsync(key, value)
          : SecureStore.deleteItemAsync(key),
        undefined,
      ),
    );
  }
  await Promise.all(jobs);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(`${FALLBACK_PREFIX}${TOKEN_KEYS.access}`),
    AsyncStorage.removeItem(`${FALLBACK_PREFIX}${TOKEN_KEYS.refresh}`),
    withTimeout(SecureStore.deleteItemAsync(TOKEN_KEYS.access), undefined),
    withTimeout(SecureStore.deleteItemAsync(TOKEN_KEYS.refresh), undefined),
  ]);
}
