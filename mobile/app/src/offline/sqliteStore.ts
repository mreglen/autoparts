/** SQLite-реализация кэша (expo-sqlite — входит в Expo Go).
 *  Схема и миграции — src/offline/migrations.ts, версионируются независимо от бэкенда. */

import * as SQLite from "expo-sqlite";

import { CACHE_MIGRATIONS, pendingMigrations } from "./migrations";
import {
  DEFAULT_EVICTION_LIMITS,
  selectEvictionKeys,
  type CacheEntryRecord,
  type CacheStore,
  type EvictionLimits,
  type HotEntitiesProvider,
} from "./store";

const DB_NAME = "sg-offline-cache.db";
const SCHEMA_VERSION_KEY = "schema_version";

interface Row {
  key: string;
  entity: string;
  payload: string;
  fetched_at: number;
  expires_at: number | null;
}

function rowToRecord(row: Row): CacheEntryRecord {
  return {
    key: row.key,
    entity: row.entity,
    payload: row.payload,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
  };
}

export async function createSqliteStore(
  limits: EvictionLimits = DEFAULT_EVICTION_LIMITS,
  hotEntities: HotEntitiesProvider = () => new Set(),
): Promise<CacheStore> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  );
  const versionRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM cache_meta WHERE key = ?",
    [SCHEMA_VERSION_KEY],
  );
  const applied = versionRow ? [Number(versionRow.value)] : [];
  const pending = pendingMigrations(applied);
  if (pending.length > 0) {
    await db.withTransactionAsync(async () => {
      for (const migration of pending) {
        for (const statement of migration.statements) {
          await db.execAsync(statement);
        }
      }
      await db.runAsync(
        "INSERT INTO cache_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [
          SCHEMA_VERSION_KEY,
          String(CACHE_MIGRATIONS[CACHE_MIGRATIONS.length - 1].version),
        ],
      );
    });
  }

  const evictIfNeeded = async () => {
    const rows = await db.getAllAsync<Row>(
      "SELECT key, entity, payload, fetched_at, expires_at FROM cache_entries",
    );
    const keys = selectEvictionKeys(
      rows.map((r) => ({
        key: r.key,
        entity: r.entity,
        payload: r.payload,
        fetchedAt: r.fetched_at,
      })),
      limits,
      hotEntities(),
    );
    for (const key of keys) {
      await db.runAsync("DELETE FROM cache_entries WHERE key = ?", [key]);
    }
  };

  return {
    async get(key) {
      const row = await db.getFirstAsync<Row>(
        "SELECT * FROM cache_entries WHERE key = ?",
        [key],
      );
      return row ? rowToRecord(row) : null;
    },
    async put(entry) {
      await db.runAsync(
        `INSERT INTO cache_entries (key, entity, payload, fetched_at, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           entity = excluded.entity,
           payload = excluded.payload,
           fetched_at = excluded.fetched_at,
           expires_at = excluded.expires_at`,
        [
          entry.key,
          entry.entity,
          entry.payload,
          entry.fetchedAt,
          entry.expiresAt,
        ],
      );
      await evictIfNeeded();
    },
    async deleteKeys(keys) {
      for (const key of keys) {
        await db.runAsync("DELETE FROM cache_entries WHERE key = ?", [key]);
      }
    },
    async deleteEntity(entity) {
      await db.runAsync("DELETE FROM cache_entries WHERE entity = ?", [entity]);
    },
    async clear() {
      await db.runAsync("DELETE FROM cache_entries");
    },
    async listAll() {
      const rows = await db.getAllAsync<Row>("SELECT * FROM cache_entries");
      return rows.map(rowToRecord);
    },
  };
}
