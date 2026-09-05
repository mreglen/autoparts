#!/usr/bin/env bash
# Deploy MarzVPN bot modules + Celery to /opt/marzban-vpn-bot on master.
set -euo pipefail

REPO="${REPO:-/home/fast/autoparts}"
BOT_DST="/opt/marzban-vpn-bot"
BACKEND_ENV="${REPO}/backend/.env"

echo "==> git pull in ${REPO}"
cd "${REPO}"
sudo -u fast git fetch origin
sudo -u fast git checkout celery_update
sudo -u fast git pull --ff-only origin celery_update

SRC="${REPO}/vpn-marzban-bot/bot"
test -f "${SRC}/main.py"
test -f "${SRC}/db.py"

echo "==> sync bot files to ${BOT_DST}"
install -d -o marzbanbot -g marzbanbot "${BOT_DST}"
# Keep existing .env / .venv
rsync -a --delete \
  --exclude '.env' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "${SRC}/" "${BOT_DST}/"
chown -R marzbanbot:marzbanbot "${BOT_DST}"

echo "==> patch .env (DATABASE_URL, Celery, trial)"
ENV_FILE="${BOT_DST}/.env"
touch "${ENV_FILE}"
chown marzbanbot:marzbanbot "${ENV_FILE}"

# Prefer direct Postgres for asyncpg (bypass pgbouncer)
DB_URL=""
if [[ -f "${BACKEND_ENV}" ]]; then
  DB_URL="$(grep -E '^DATABASE_URL_DIRECT=' "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)"
  if [[ -z "${DB_URL}" ]]; then
    DB_URL="$(grep -E '^DATABASE_URL=' "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)"
    # pgbouncer :6432 → try direct :5432
    DB_URL="${DB_URL//:6432\//:5432/}"
  fi
fi
if [[ -z "${DB_URL}" ]]; then
  echo "ERROR: cannot read DATABASE_URL from ${BACKEND_ENV}" >&2
  exit 1
fi

python3 - "${ENV_FILE}" "${DB_URL}" <<'PY'
import sys
from pathlib import Path
env_path = Path(sys.argv[1])
db_url = sys.argv[2].strip().strip('"').strip("'")
lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
kv = {}
order = []
for line in lines:
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    if k not in kv:
        order.append(k)
    kv[k] = v

updates = {
    "DATABASE_URL": db_url,
    "BOT_USERNAME": kv.get("BOT_USERNAME", "marzvpn_bot"),
    "TRIAL_MINUTES": kv.get("TRIAL_MINUTES", "4320"),
    "REFERRAL_REWARD_DAYS": kv.get("REFERRAL_REWARD_DAYS", "5"),
    "CELERY_BROKER_URL": kv.get("CELERY_BROKER_URL", "redis://127.0.0.1:6379/2"),
    "CELERY_RESULT_BACKEND": kv.get("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/2"),
    "KEY_VERIFY_INTERVAL_MINUTES": kv.get("KEY_VERIFY_INTERVAL_MINUTES", "5"),
    "SUB_URL_REWRITE_FROM": kv.get("SUB_URL_REWRITE_FROM", "://195.24.65.251:62050"),
    "SUB_URL_REWRITE_TO": kv.get("SUB_URL_REWRITE_TO", "://195.24.65.251:2086"),
}
for k, v in updates.items():
    if k not in kv:
        order.append(k)
    kv[k] = v

out = []
for k in order:
    out.append(f"{k}={kv[k]}")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("env updated keys:", ", ".join(sorted(updates)))
PY

echo "==> pip install"
sudo -u marzbanbot "${BOT_DST}/.venv/bin/pip" install -r "${BOT_DST}/requirements.txt"

echo "==> install systemd units"
cp "${BOT_DST}/marzban-vpn-bot.service" /etc/systemd/system/marzban-vpn-bot.service
cp "${BOT_DST}/marzban-vpn-bot-celery.service" /etc/systemd/system/marzban-vpn-bot-celery.service
cp "${BOT_DST}/marzban-vpn-bot-celerybeat.service" /etc/systemd/system/marzban-vpn-bot-celerybeat.service
systemctl daemon-reload
systemctl enable marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat
systemctl restart marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat

sleep 3
systemctl is-active marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat
journalctl -u marzban-vpn-bot -n 15 --no-pager
journalctl -u marzban-vpn-bot-celery -n 10 --no-pager

# Reload site backend code (celery include) without forcing double beat
if systemctl list-unit-files | grep -q celery; then
  echo "==> reload site celery workers (code pull already done)"
  systemctl try-restart celery celerybeat 2>/dev/null || \
  systemctl try-restart celery-worker celery-beat 2>/dev/null || true
fi

echo "DEPLOY_MASTER_OK"
