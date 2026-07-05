#!/usr/bin/env bash
# Stage 9 load test runner (run on prod as root).
set -euo pipefail

ROOT="${AUTOPARTS_ROOT:-/home/fast/autoparts}"
K6_SCRIPT="${ROOT}/scripts/ops/load-test-k6.js"
HOST_HDR="Host: svoygarage.ru"
BASE="https://127.0.0.1"
NGINX_LOG="/var/log/nginx/svoygarage_ssl_access.log"
RESULT_LOG="/var/log/autoparts-load-test.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

require_root() {
  [[ $EUID -eq 0 ]] || { echo "Run as root"; exit 1; }
}

ensure_k6() {
  if command -v k6 >/dev/null 2>&1; then
    log "k6: $(k6 version 2>/dev/null | head -1)"
    return 0
  fi
  log "Installing k6..."
  if apt-get install -y k6 2>/dev/null; then
    return 0
  fi
  local ver="v0.57.0"
  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64) arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *) echo "Unsupported arch: $arch"; exit 1 ;;
  esac
  curl -fsSL -o /tmp/k6.tar.gz \
    "https://github.com/grafana/k6/releases/download/${ver}/k6-${ver}-linux-${arch}.tar.gz"
  tar -xzf /tmp/k6.tar.gz -C /tmp
  install -m 755 "/tmp/k6-${ver}-linux-${arch}/k6" /usr/local/bin/k6
  log "k6 installed: $(k6 version | head -1)"
}

snapshot_metrics() {
  local label="$1"
  local load1 ram disk c502 c504 restarts
  load1=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)
  ram=$(awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END {if (t>0) printf "%.0f", (t-a)/t*100; else print 0}' /proc/meminfo)
  disk=$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
  c502=$(count_nginx_errors 5 502)
  c504=$(count_nginx_errors 5 504)
  restarts=$(journalctl -u kroan --since '15 minutes ago' --no-pager 2>/dev/null | grep -c 'Started kroan' || echo 0)
  log "SNAPSHOT ${label}: load1m=${load1} ram=${ram}% disk=${disk}% 502_5m=${c502} 504_5m=${c504} kroan_restarts_15m=${restarts}"
}

count_nginx_errors() {
  local minutes="$1"
  local code="$2"
  [[ -f "$NGINX_LOG" ]] || { echo 0; return; }
  python3 - "$NGINX_LOG" "$minutes" "$code" <<'PY'
import datetime as dt
import re
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
minutes = int(sys.argv[2])
code = sys.argv[3]
needle = f" {code} "
cutoff = dt.datetime.now() - dt.timedelta(minutes=minutes)
pat = re.compile(r"\[(\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2})")
count = 0
try:
    with log_path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if needle not in line:
                continue
            match = pat.search(line)
            if not match:
                continue
            try:
                ts = dt.datetime.strptime(match.group(1), "%d/%b/%Y:%H:%M:%S")
            except ValueError:
                continue
            if ts >= cutoff:
                count += 1
except OSError:
    pass
print(count)
PY
}

preflight() {
  log "=== Pre-flight ==="
  for svc in kroan nginx postgresql redis-server celery pgbouncer; do
    systemctl is-active --quiet "$svc" || { log "FAIL: $svc not active"; exit 1; }
    log "  $svc: active"
  done
  local cart catalog cache
  cart=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:8080/api/cart/ || echo 000)
  catalog=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 15 \
    -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k || echo 000)
  cache=$(curl -sI -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k \
    | grep -i x-cache-status | awk '{print $2}' | tr -d '\r' || echo unknown)
  log "  smoke: cart=${cart} catalog=${catalog} cache=${cache}"
  [[ "$catalog" == "200" ]] || { log "FAIL: catalog not 200"; exit 1; }
}

warmup() {
  log "=== Warmup microcache ==="
  local i
  for i in $(seq 1 20); do
    curl -sf -o /dev/null -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k || true
    curl -sf -o /dev/null -H "$HOST_HDR" "${BASE}/server/api/part-types/public" -k || true
  done
  local cache
  cache=$(curl -sI -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20" -k \
    | grep -i x-cache-status | awk '{print $2}' | tr -d '\r' || echo unknown)
  log "  catalog cache after warmup: ${cache}"
}

run_track() {
  local mode="$1"
  log "=== Track ${mode} ==="
  LOAD_TEST_MODE="$mode" \
  LOAD_TEST_BASE="$BASE" \
  LOAD_TEST_HOST="svoygarage.ru" \
  LOAD_TEST_INSECURE=true \
    k6 run "$K6_SCRIPT" 2>&1 | tee -a "$RESULT_LOG" || true
  sleep 60
}

print_markdown_table() {
  log "=== Results (paste into docs/ops/load-test.md) ==="
  echo ""
  echo "| Track | Mode | RPS | p50 | p95 | p99 | Fail % |"
  echo "|-------|------|-----|-----|-----|-----|--------|"
  for mode in hit miss mixed direct; do
    local f="/tmp/k6-summary-${mode}.json"
    [[ -f "$f" ]] || continue
    python3 - "$f" "$mode" <<'PY'
import json, sys
path, mode = sys.argv[1], sys.argv[2]
with open(path) as f:
    d = json.load(f)
m = d.get("metrics", {})
rps = m.get("http_reqs", {}).get("values", {}).get("rate", 0)
dur = m.get("http_req_duration", {}).get("values", {})
fail = m.get("http_req_failed", {}).get("values", {}).get("rate", 0) * 100
labels = {"hit": "A Catalog HIT", "miss": "B Catalog MISS", "mixed": "C Mixed", "direct": "D Backend direct"}
print(f"| {labels.get(mode, mode)} | {mode} | {rps:.1f} | {dur.get('p(50)', 0):.0f}ms | {dur.get('p(95)', 0):.0f}ms | {dur.get('p(99)', 0):.0f}ms | {fail:.2f}% |")
PY
  done
  echo ""
}

main() {
  require_root
  [[ -f "$K6_SCRIPT" ]] || { log "Missing $K6_SCRIPT"; exit 1; }
  touch "$RESULT_LOG"
  chmod 644 "$RESULT_LOG"

  log "========== Load test start =========="
  ensure_k6
  preflight
  snapshot_metrics "before"
  warmup

  run_track hit
  run_track miss
  run_track mixed
  run_track direct

  snapshot_metrics "after"
  print_markdown_table
  log "========== Load test done =========="
  log "Full log: $RESULT_LOG"
}

main "$@"
