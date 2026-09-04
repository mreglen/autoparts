#!/bin/bash
# Apply / enable / disable Marzban VPN Telegram bot on the host.
# Usage (as root via sudo -n):
#   marzban-vpn-bot-apply enable /path/to/token.file
#   marzban-vpn-bot-apply disable
#   marzban-vpn-bot-apply status
set -euo pipefail

BOT_DIR="${VPN_BOT_DIR:-/opt/marzban-vpn-bot}"
ENV_FILE="${BOT_DIR}/.env"
SERVICE_NAME="${VPN_BOT_SERVICE:-marzban-vpn-bot}"
ACTION="${1:-}"
TOKEN_FILE="${2:-}"

umask 077

upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # Avoid sed delimiter issues: rewrite via python
    python3 - "$file" "$key" "$value" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
key, value = sys.argv[2], sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
out = []
found = False
for line in lines:
    if line.startswith(key + "="):
        out.append(f"{key}={value}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

case "$ACTION" in
  enable)
    if [[ -z "$TOKEN_FILE" || ! -f "$TOKEN_FILE" ]]; then
      echo "token file required" >&2
      exit 2
    fi
    TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"
    if [[ -z "$TOKEN" ]]; then
      echo "empty token" >&2
      exit 2
    fi
    mkdir -p "$BOT_DIR"
    upsert_env "BOT_TOKEN" "$TOKEN" "$ENV_FILE"
    # По умолчанию Tor — иначе polling к api.telegram.org таймаутится
    if ! grep -q '^TELEGRAM_PROXY_URL=' "$ENV_FILE" 2>/dev/null; then
      upsert_env "TELEGRAM_PROXY_URL" "socks5://127.0.0.1:9050" "$ENV_FILE"
    fi
    chown marzbanbot:marzbanbot "$ENV_FILE" 2>/dev/null || true
    chmod 600 "$ENV_FILE"
    rm -f "$TOKEN_FILE"
    systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
    systemctl restart "$SERVICE_NAME"
    sleep 1
    if systemctl is-active --quiet "$SERVICE_NAME"; then
      echo "service_active=1"
      echo "Бот запущен (${SERVICE_NAME})"
    else
      echo "service_active=0"
      echo "systemctl restart выполнен, но сервис не active" >&2
      systemctl --no-pager -l status "$SERVICE_NAME" | head -n 20 >&2 || true
      exit 1
    fi
    ;;
  disable)
    systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true
    systemctl disable "$SERVICE_NAME" >/dev/null 2>&1 || true
    echo "service_active=0"
    echo "Бот остановлен"
    ;;
  status)
    if systemctl is-active --quiet "$SERVICE_NAME"; then
      echo "service_active=1"
    else
      echo "service_active=0"
    fi
    ;;
  *)
    echo "usage: $0 enable <token-file> | disable | status" >&2
    exit 2
    ;;
esac
