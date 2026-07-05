#!/usr/bin/env bash
# Measure catalog API latency (cache miss + hit) on server.
set -euo pipefail

HOST_HDR="Host: svoygarage.ru"
BASE="https://127.0.0.1"
BUST=$(date +%s)

echo "=== Catalog latency (nginx + API) ==="
curl -s -o /dev/null -w "miss TTFB:%{time_starttransfer}s total:%{time_total}s\n" \
  -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20&_bust=${BUST}" -k
curl -s -o /dev/null -w "hit  TTFB:%{time_starttransfer}s total:%{time_total}s\n" \
  -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k

echo "=== PgBouncer ==="
ss -lntp | grep -E ':6432|:5432' || true
pgrep -a pgbouncer || echo "pgbouncer:not_running"
