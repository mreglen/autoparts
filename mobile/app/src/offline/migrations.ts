/** Миграции локального кэша — отдельно от миграций бэкенда.
 *  Каждая запись применяется один раз; версия хранится в cache_meta. */

export interface CacheMigration {
  version: number;
  statements: string[];
}

export const SCHEMA_VERSION = 1;

export const CACHE_MIGRATIONS: CacheMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cache_entries_entity ON cache_entries(entity, fetched_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_entries_fetched ON cache_entries(fetched_at)`,
      `CREATE TABLE IF NOT EXISTS cache_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
];

export function pendingMigrations(
  appliedVersions: Iterable<number>,
): CacheMigration[] {
  const applied = new Set(appliedVersions);
  return CACHE_MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version,
  );
}
