/** Интерфейс хранилища кэша + in-memory реализация (fallback до инициализации SQLite,
 *  а также основа для jest-тестов). */

export interface CacheEntryRecord {
  key: string;
  entity: string;
  payload: string;
  fetchedAt: number;
  expiresAt: number | null;
}

export interface CacheStore {
  get(key: string): Promise<CacheEntryRecord | null>;
  put(entry: CacheEntryRecord): Promise<void>;
  deleteKeys(keys: string[]): Promise<void>;
  deleteEntity(entity: string): Promise<void>;
  clear(): Promise<void>;
  /** Для тестов/отладки. */
  listAll(): Promise<CacheEntryRecord[]>;
}

export interface EvictionLimits {
  maxEntries: number;
  /** Примерный объём в «символах» payload — точный байтовый подсчёт не нужен. */
  maxPayloadChars: number;
}

export const DEFAULT_EVICTION_LIMITS: EvictionLimits = {
  maxEntries: 500,
  maxPayloadChars: 8_000_000,
};

interface EntryMeta {
  key: string;
  entity: string;
  payload: string;
  fetchedAt: number;
}

/** Чистая функция выбора ключей на вытеснение: сначала не-gorячие по fetched_at,
 *  при необходимости — самые старые вообще. Возвращает ключи к удалению. */
export function selectEvictionKeys(
  entries: EntryMeta[],
  limits: EvictionLimits,
  hotEntities: ReadonlySet<string>,
): string[] {
  const totalChars = entries.reduce((sum, e) => sum + e.payload.length, 0);
  if (
    entries.length <= limits.maxEntries &&
    totalChars <= limits.maxPayloadChars
  )
    return [];

  const evict: string[] = [];
  let count = entries.length;
  let chars = totalChars;
  const over = () =>
    count > limits.maxEntries || chars > limits.maxPayloadChars;

  const tryEvict = (pool: EntryMeta[]) => {
    const sorted = [...pool].sort((a, b) => a.fetchedAt - b.fetchedAt);
    for (const e of sorted) {
      if (!over()) return;
      evict.push(e.key);
      count -= 1;
      chars -= e.payload.length;
    }
  };

  tryEvict(entries.filter((e) => !hotEntities.has(e.entity)));
  if (over()) tryEvict(entries);
  return evict;
}

export type HotEntitiesProvider = () => ReadonlySet<string>;

const NO_HOT: HotEntitiesProvider = () => new Set();

export function createMemoryStore(
  limits: EvictionLimits = DEFAULT_EVICTION_LIMITS,
  hotEntities: HotEntitiesProvider = NO_HOT,
): CacheStore {
  const map = new Map<string, CacheEntryRecord>();

  const evictIfNeeded = () => {
    const keys = selectEvictionKeys(
      [...map.values()].map(({ key, entity, payload, fetchedAt }) => ({
        key,
        entity,
        payload,
        fetchedAt,
      })),
      limits,
      hotEntities(),
    );
    for (const key of keys) map.delete(key);
  };

  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async put(entry) {
      map.set(entry.key, entry);
      evictIfNeeded();
    },
    async deleteKeys(keys) {
      for (const key of keys) map.delete(key);
    },
    async deleteEntity(entity) {
      for (const [key, e] of map) if (e.entity === entity) map.delete(key);
    },
    async clear() {
      map.clear();
    },
    async listAll() {
      return [...map.values()];
    },
  };
}
