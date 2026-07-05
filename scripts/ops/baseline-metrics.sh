#!/usr/bin/env bash
# One-shot baseline metrics for stage 2 (run on server as root).
set -euo pipefail

HOST_HDR="Host: svoygarage.ru"
BASE="https://127.0.0.1"

echo "=== API TTFB ==="
curl -s -o /dev/null -w 'catalog_miss TTFB:%{time_starttransfer}s total:%{time_total}s\n' \
  -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20&_bust=$(date +%s)" -k
curl -sI -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20&_bust=$(date +%s)" -k | grep -i x-cache || true
curl -s -o /dev/null -w 'catalog_hit TTFB:%{time_starttransfer}s total:%{time_total}s\n' \
  -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k
curl -sI -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k | grep -i x-cache || true
curl -s -o /dev/null -w 'part_types TTFB:%{time_starttransfer}s total:%{time_total}s\n' \
  -H "$HOST_HDR" "${BASE}/server/api/part-types/public" -k
curl -s -o /dev/null -w 'facets TTFB:%{time_starttransfer}s total:%{time_total}s\n' \
  -H "$HOST_HDR" "${BASE}/server/api/catalog/facets" -k

echo "=== HTML TTFB ==="
for path in / /autoparts/used /autoparts/new; do
  curl -s -o /dev/null -w "${path} TTFB:%{time_starttransfer}s total:%{time_total}s\n" \
    -H "$HOST_HDR" "${BASE}${path}" -k
done

echo "=== main.js ==="
MAIN=$(ls /var/www/my-autoparts/static/js/main.*.js | head -1)
echo "main_file:${MAIN}"
echo -n "raw_bytes:"
wc -c < "$MAIN"
curl -sI -H "$HOST_HDR" -H 'Accept-Encoding: gzip' "${BASE}/static/js/$(basename "$MAIN")" -k | grep -iE 'content-length|content-encoding' || true
curl -sI -H "$HOST_HDR" -H 'Accept-Encoding: br' "${BASE}/static/js/$(basename "$MAIN")" -k | grep -iE 'content-length|content-encoding' || true
nginx -V 2>&1 | grep -i brotli || echo "brotli:no"

echo "=== sample part slug ==="
curl -s -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=1" -k | \
  python3 -c "import sys,json; d=json.load(sys.stdin); i=(d.get('items') or [{}])[0]; print(i.get('slug') or i.get('public_slug') or i.get('id',''))"

echo "=== errors 24h ==="
grep -cE ' 502 ' /var/log/nginx/svoygarage_ssl_access.log || echo 0
grep -cE ' 504 ' /var/log/nginx/svoygarage_ssl_access.log || echo 0
journalctl -u kroan --since '24 hours ago' --no-pager | grep -c 'Stopped kroan' || echo 0
