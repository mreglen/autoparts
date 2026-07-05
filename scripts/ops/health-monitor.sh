#!/usr/bin/env bash
# Production health monitor (stage 8). Run every 5 min via cron.
set -euo pipefail

ROOT="${AUTOPARTS_ROOT:-/home/fast/autoparts}"
ENV_FILE="/etc/autoparts/monitor.env"
STATE_DIR="/var/lib/autoparts"
STATE_FILE="${STATE_DIR}/monitor-state"
HEALTH_LOG="/var/log/autoparts-health.log"
ALERT_LOG="/var/log/autoparts-alerts.log"
NGINX_LOG="/var/log/nginx/svoygarage_ssl_access.log"

WINDOW_MIN="${WINDOW_MIN:-5}"
MAX_502_504="${MAX_502_504:-5}"
MAX_KROAN_RESTARTS="${MAX_KROAN_RESTARTS:-2}"
KROAN_RESTART_WINDOW_MIN="${KROAN_RESTART_WINDOW_MIN:-15}"
LOAD_WARN="${LOAD_WARN:-4}"
RAM_WARN_PCT="${RAM_WARN_PCT:-90}"
DISK_WARN_PCT="${DISK_WARN_PCT:-90}"
ALERT_COOLDOWN_MIN="${ALERT_COOLDOWN_MIN:-30}"

SERVICES=(kroan nginx postgresql redis-server celery pgbouncer)

mkdir -p "$STATE_DIR"
touch "$HEALTH_LOG" "$ALERT_LOG"
chmod 644 "$HEALTH_LOG" "$ALERT_LOG" 2>/dev/null || true

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

log_line() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

should_alert() {
  local key="$1"
  local now
  now=$(date +%s)
  local last=0
  if [[ -f "$STATE_FILE" ]]; then
    last=$(grep "^${key}=" "$STATE_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || echo 0)
  fi
  if (( now - last >= ALERT_COOLDOWN_MIN * 60 )); then
    return 0
  fi
  return 1
}

mark_alert() {
  local key="$1"
  local now
  now=$(date +%s)
  local tmp="${STATE_FILE}.tmp"
  if [[ -f "$STATE_FILE" ]]; then
    grep -v "^${key}=" "$STATE_FILE" >"$tmp" 2>/dev/null || true
  else
    : >"$tmp"
  fi
  echo "${key}=${now}" >>"$tmp"
  mv "$tmp" "$STATE_FILE"
}

send_alert() {
  local key="$1"
  local message="$2"
  log_line "ALERT: $message" | tee -a "$ALERT_LOG"
  if should_alert "$key"; then
    mark_alert "$key"
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
      curl -sf --max-time 10 -X POST \
        "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        --data-urlencode "text=${message}" >/dev/null 2>&1 || true
    fi
  fi
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

count_kroan_restarts() {
  local minutes="$1"
  journalctl -u kroan --since "${minutes} minutes ago" --no-pager 2>/dev/null \
    | grep -c 'Started kroan' || echo 0
}

load_avg_1m() {
  awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0
}

ram_percent() {
  awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END {if (t>0) printf "%.0f", (t-a)/t*100; else print 0}' /proc/meminfo 2>/dev/null || echo 0
}

root_disk_percent() {
  df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0
}

issues=()
ok_bits=()

for svc in "${SERVICES[@]}"; do
  if systemctl is-active --quiet "$svc"; then
    ok_bits+=("${svc}:ok")
  else
    issues+=("service_down:${svc}")
    send_alert "svc_${svc}" "svoygarage: сервис ${svc} не active"
  fi
done

c502=$(count_nginx_errors "$WINDOW_MIN" 502)
c504=$(count_nginx_errors "$WINDOW_MIN" 504)
restarts=$(count_kroan_restarts "$KROAN_RESTART_WINDOW_MIN")
load1=$(load_avg_1m)
ram=$(ram_percent)
disk=$(root_disk_percent)

ok_bits+=("502_${WINDOW_MIN}m=${c502}" "504_${WINDOW_MIN}m=${c504}" "kroan_restarts_${KROAN_RESTART_WINDOW_MIN}m=${restarts}" "load1m=${load1}" "ram=${ram}%" "disk=${disk}%")

if (( c502 > MAX_502_504 )); then
  issues+=("502_high")
  send_alert "nginx_502" "svoygarage: nginx 502 = ${c502} за ${WINDOW_MIN} мин (порог ${MAX_502_504})"
fi
if (( c504 > MAX_502_504 )); then
  issues+=("504_high")
  send_alert "nginx_504" "svoygarage: nginx 504 = ${c504} за ${WINDOW_MIN} мин (порог ${MAX_502_504})"
fi
if (( restarts > MAX_KROAN_RESTARTS )); then
  issues+=("kroan_restarts")
  send_alert "kroan_restart" "svoygarage: kroan перезапускался ${restarts} раз за ${KROAN_RESTART_WINDOW_MIN} мин"
fi

load_cmp=$(python3 -c "print(1 if float('${load1}') > float('${LOAD_WARN}') else 0)" 2>/dev/null || echo 0)
if [[ "$load_cmp" == "1" ]]; then
  issues+=("load_high")
  send_alert "load_avg" "svoygarage: load average 1m = ${load1} (порог ${LOAD_WARN})"
fi
if (( ram > RAM_WARN_PCT )); then
  issues+=("ram_high")
  send_alert "ram" "svoygarage: RAM ${ram}% (порог ${RAM_WARN_PCT}%)"
fi
if (( disk > DISK_WARN_PCT )); then
  issues+=("disk_high")
  send_alert "disk" "svoygarage: диск / заполнен на ${disk}%"
fi

if [[ ${#issues[@]} -eq 0 ]]; then
  log_line "OK ${ok_bits[*]}"
else
  log_line "ISSUES ${issues[*]} | ${ok_bits[*]}"
fi
