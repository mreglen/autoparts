#!/usr/bin/env bash
# EXPLAIN ANALYZE for typical public catalog query (run on server as root or postgres).
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/fast/autoparts/backend/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source <(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed 's/^/export /')
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set in $ENV_FILE" >&2
  exit 1
fi

echo "=== Catalog list EXPLAIN (quantity > 0, page 1) ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id
FROM products p
WHERE COALESCE(p.quantity, 0) > 0
  AND p.is_new = false
ORDER BY p.id DESC
LIMIT 20;
SQL

echo ""
echo "=== Index usage on products ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE relname = 'products'
ORDER BY idx_scan DESC;
SQL
