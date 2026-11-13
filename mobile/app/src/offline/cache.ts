/** Чтение через кэш: сеть → SQLite, при сетевой ошибке — последняя запись с пометкой stale.
 *  Запись (POST/PATCH/…) идёт мимо кэша; после успешной мутации вызывают invalidateEntities. */

import { ApiError } from "../api/errors";
import { CACHE_POLICIES, policyForPath, type CachePolicy } from "./policies";
import {
  createMemoryStore,
  DEFAULT_EVICTION_LIMITS,
  type CacheStore,
} from "./store";

const DEFAULT_LIMITS = DEFAULT_EVICTION_LIMITS;

export interface CachedResult<T> {
  data: T;
  fetchedAt: number;
  /** true — данные из кэша (сети не было или ответ не прошёл). */
  fromCache: boolean;
  /** true — кэш протух либо показан в офлайне: UI обязан показать возраст (StaleDataBadge). */
  stale: boolean;
}

let activeStore: CacheStore | null = null;

function fallbackStore(): CacheStore {
  if (!activeStore)
    activeStore = createMemoryStore(DEFAULT_LIMITS, hotEntitiesProvider);
  return activeStore;
}

export function getCacheStore(): CacheStore {
  return activeStore ?? fallbackStore();
}

export function setCacheStore(store: CacheStore): void {
  activeStore = store;
}

function hotEntitiesProvider(): ReadonlySet<string> {
  return new Set(CACHE_POLICIES.filter((p) => p.hot).map((p) => p.entity));
}

/** Ленивая инициализация SQLite-кэша. Вызывается один раз при старте приложения. */
export async function bootstrapOfflineCache(): Promise<void> {
  if (activeStore) return;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- require ленивый: jest-тесты не должны подтягивать expo-sqlite */
    const { createSqliteStore } =
      require("./sqliteStore") as typeof import("./sqliteStore");
    /* eslint-enable @typescript-eslint/no-require-imports */
    activeStore = await createSqliteStore(DEFAULT_LIMITS, hotEntitiesProvider);
  } catch {
    // Нет SQLite ( exotica ) — работаем на in-memory кэше до перезапуска.
    activeStore = createMemoryStore(DEFAULT_LIMITS, hotEntitiesProvider);
  }
}

function isOfflineError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === "network" || error.kind === "timeout")
  );
}

async function putCached(
  path: string,
  policy: CachePolicy,
  data: unknown,
): Promise<number> {
  const fetchedAt = Date.now();
  await getCacheStore().put({
    key: path,
    entity: policy.entity,
    payload: JSON.stringify(data),
    fetchedAt,
    expiresAt: fetchedAt + policy.ttlMs,
  });
  return fetchedAt;
}

export type CacheFetcher = <T>(path: string) => Promise<T>;
type PathFetcher<T> = (path: string) => Promise<T>;

async function defaultFetcher<T>(path: string): Promise<T> {
  /* eslint-disable @typescript-eslint/no-require-imports -- require ленивый: не грузим auth/tokenStore в тестах и до входа */
  const { apiGet } = require("../api/client") as typeof import("../api/client");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return apiGet<T>(path);
}

export async function cachedGet<T>(
  path: string,
  fetcher: PathFetcher<T> = defaultFetcher,
): Promise<CachedResult<T>> {
  const policy = policyForPath(path);
  try {
    const data = await fetcher(path);
    const fetchedAt = policy ? await putCached(path, policy, data) : Date.now();
    return { data, fetchedAt, fromCache: false, stale: false };
  } catch (error) {
    if (!isOfflineError(error) || !policy?.offlineReadable) throw error;
    const entry = await getCacheStore().get(path);
    if (!entry) throw error;
    const parsed = JSON.parse(entry.payload) as T;
    return {
      data: parsed,
      fetchedAt: entry.fetchedAt,
      fromCache: true,
      stale: true,
    };
  }
}

/** После успешной мутации вычищает затронутые сущности — не ждём протухания. */
export async function invalidateEntities(entities: string[]): Promise<void> {
  const store = getCacheStore();
  await Promise.all(entities.map((entity) => store.deleteEntity(entity)));
}

/** Удалить конкретные ключи (например, деталь сущности по id). */
export async function invalidateKeys(keys: string[]): Promise<void> {
  await getCacheStore().deleteKeys(keys);
}
