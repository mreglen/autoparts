#!/usr/bin/env bash
# Production update: git pull + backend deps + frontend build + graceful restart.
# Usage (on server as root):  update
#                              update --nginx   # also reload nginx if configs changed in repo
set -euo pipefail

ROOT="/home/fast/autoparts"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend/my-autoparts"
WEB_ROOT="/var/www/my-autoparts"
VENV="$BACKEND/venv"
LOG="/var/log/autoparts-update.log"
LOCK="/var/run/autoparts-update.lock"
DEPLOY_STATE_DIR="/var/lib/autoparts"
PREVIOUS_RELEASE_FILE="$DEPLOY_STATE_DIR/previous-release.sha"
HEALTH_URL="http://127.0.0.1:8080/api/auth/public-site-config"
HEALTH_MAX_WAIT=120

SKIP_FRONTEND=0
SKIP_BACKEND=0
RELOAD_NGINX=0
ROLLBACK=0

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

die() {
  log "ERROR: $*"
  exit 1
}

usage() {
  cat <<'EOF'
Usage: update [options]

  Полное обновление production: git pull, frontend build, один перезапуск backend.

Options:
  --nginx          Применить nginx-конфиги из репозитория и reload nginx
  --frontend-only  Только git pull + сборка и выкладка frontend
  --backend-only   Только git pull + pip + перезапуск kroan/celery
  --skip-frontend  Не собирать frontend
  --skip-backend   Не перезапускать kroan/celery (только код и frontend)
  --rollback       Вернуть предыдущий успешно развёрнутый Git SHA
  -h, --help       Справка
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --nginx) RELOAD_NGINX=1 ;;
      --frontend-only) SKIP_BACKEND=1 ;;
      --backend-only) SKIP_FRONTEND=1 ;;
      --skip-frontend) SKIP_FRONTEND=1 ;;
      --skip-backend) SKIP_BACKEND=1 ;;
      --rollback) ROLLBACK=1 ;;
      -h|--help) usage; exit 0 ;;
      *) die "Неизвестный аргумент: $1 (update --help)" ;;
    esac
    shift
  done
}

require_root() {
  [[ $EUID -eq 0 ]] || die "Запускайте от root: sudo update"
}

acquire_lock() {
  exec 200>"$LOCK"
  flock -n 200 || die "Обновление уже выполняется (lock: $LOCK)"
}

wait_for_api() {
  local waited=0
  log "Ожидание готовности API (до ${HEALTH_MAX_WAIT}s)..."
  while (( waited < HEALTH_MAX_WAIT )); do
    if curl -sf -o /dev/null --max-time 3 "$HEALTH_URL"; then
      log "API готов за ${waited}s"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  journalctl -u kroan -n 30 --no-pager >> "$LOG" 2>&1 || true
  die "API не ответил за ${HEALTH_MAX_WAIT}s — см. journalctl -u kroan"
}

ensure_scheduler_env() {
  local env="$BACKEND/.env"
  [[ -f "$env" ]] || return 0
  if grep -qE '^NEW_PARTS_SEO_SYNC_USE_CELERY=false' "$env" 2>/dev/null; then
    log "Включение NEW_PARTS_SEO_SYNC_USE_CELERY=true в backend/.env"
    sed -i 's/^NEW_PARTS_SEO_SYNC_USE_CELERY=false/NEW_PARTS_SEO_SYNC_USE_CELERY=true/' "$env"
    chown fast:fast "$env"
    chmod 600 "$env"
  elif ! grep -qE '^NEW_PARTS_SEO_SYNC_USE_CELERY=' "$env" 2>/dev/null; then
    log "Добавление NEW_PARTS_SEO_SYNC_USE_CELERY=true в backend/.env"
    printf '\nNEW_PARTS_SEO_SYNC_USE_CELERY=true\n' >> "$env"
    chown fast:fast "$env"
    chmod 600 "$env"
  fi
}

fix_backend_env() {
  local env="$BACKEND/.env"
  [[ -f "$env" ]] || return 0
  if grep -qE '^[A-Z_][A-Z0-9_]* = ' "$env" 2>/dev/null; then
    log "Исправление пробелов в backend/.env"
    sed -i -E 's/^([A-Z_][A-Z0-9_]*) = (.*)$/\1=\2/' "$env"
    sed -i -E "s/^([A-Z_][A-Z0-9_]*)='(.*)'$/\1=\2/" "$env"
    sed -i -E 's/^([A-Z_][A-Z0-9_]*)="(.*)"$/\1=\2/' "$env"
    chown fast:fast "$env"
    chmod 600 "$env"
  fi
}

ensure_upload_dirs() {
  mkdir -p "$BACKEND/uploads/vehicle_pictures"
  chown -R fast:fast "$BACKEND/uploads"
}

ensure_nginx_cache_dirs() {
  mkdir -p /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check /var/cache/nginx/sg_prerender
  chown www-data:www-data /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check /var/cache/nginx/sg_prerender
}

nginx_has_brotli() {
  nginx -V 2>&1 | grep -qi brotli
}

ensure_brotli_modules() {
  if nginx_has_brotli; then
    log "Nginx Brotli: модуль уже доступен"
    return 0
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    log "WARN: apt-get недоступен — Brotli не установлен"
    return 1
  fi
  log "Установка libnginx-mod-http-brotli-* ..."
  if DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static; then
    log "Brotli модули установлены"
    return 0
  fi
  log "WARN: не удалось установить Brotli модули"
  return 1
}

ensure_nginx_http_includes() {
  local nginx_conf="/etc/nginx/nginx.conf"
  [[ -f "$nginx_conf" ]] || return 0

  if ! grep -q 'svoygarage-microcache.conf' "$nginx_conf"; then
    sed -i '/http {/a \	include /etc/nginx/snippets/svoygarage-microcache.conf;' "$nginx_conf"
    log "Добавлен include microcache в nginx.conf"
  fi
}

ensure_brotli_snippet() {
  local brotli_src="$ROOT/docs/nginx/svoygarage-brotli.conf"
  local brotli_dst="/etc/nginx/snippets/svoygarage-brotli.conf"
  local site="/etc/nginx/sites-available/svoygarage"

  if nginx_has_brotli; then
    [[ -f "$brotli_src" ]] && cp "$brotli_src" "$brotli_dst"
    log "Brotli snippet активен"
    return 0
  fi

  if [[ -f "$site" ]] && grep -q 'svoygarage-brotli.conf' "$site"; then
    sed -i '/svoygarage-brotli.conf/d' "$site"
    log "Brotli: include удалён из site config (модуль недоступен)"
  fi
}

git_pull() {
  log "git fetch + sync с origin (локальные правки сбрасываются, backend/.env и frontend/.env сохраняются)..."
  local branch env_backup="" fe_env_backup="" previous_sha
  branch=$(sudo -u fast git -C "$ROOT" rev-parse --abbrev-ref HEAD)
  previous_sha=$(sudo -u fast git -C "$ROOT" rev-parse HEAD)
  if [[ -f "$BACKEND/.env" ]]; then
    env_backup=$(mktemp)
    cp "$BACKEND/.env" "$env_backup"
  fi
  if [[ -f "$FRONTEND/.env" ]]; then
    fe_env_backup=$(mktemp)
    cp "$FRONTEND/.env" "$fe_env_backup"
  fi
  chown -R fast:fast "$ROOT"
  sudo -u fast git -C "$ROOT" fetch origin "$branch"
  sudo -u fast git -C "$ROOT" reset --hard "origin/$branch"
  sudo -u fast git -C "$ROOT" clean -fd
  if [[ -n "$env_backup" && -f "$env_backup" ]]; then
    cp "$env_backup" "$BACKEND/.env"
    chown fast:fast "$BACKEND/.env"
    chmod 600 "$BACKEND/.env"
    rm -f "$env_backup"
  fi
  if [[ -n "$fe_env_backup" && -f "$fe_env_backup" ]]; then
    cp "$fe_env_backup" "$FRONTEND/.env"
    chown fast:fast "$FRONTEND/.env"
    chmod 600 "$FRONTEND/.env"
    rm -f "$fe_env_backup"
  fi
  rm -f "$BACKEND/.requirements.sha256"
  mkdir -p "$DEPLOY_STATE_DIR"
  printf '%s\n' "$previous_sha" > "$PREVIOUS_RELEASE_FILE"
  chmod 600 "$PREVIOUS_RELEASE_FILE"
  log "Коммит: $(sudo -u fast git -C "$ROOT" log -1 --oneline)"
}

rollback_to_previous_release() {
  local env_backup="" previous_sha
  [[ -f "$PREVIOUS_RELEASE_FILE" ]] || die "Нет сохранённого предыдущего релиза: $PREVIOUS_RELEASE_FILE"
  previous_sha=$(tr -d '[:space:]' < "$PREVIOUS_RELEASE_FILE")
  [[ "$previous_sha" =~ ^[0-9a-f]{40}$ ]] || die "Некорректный SHA в $PREVIOUS_RELEASE_FILE"

  log "Откат к предыдущему релизу: $previous_sha"
  if [[ -f "$BACKEND/.env" ]]; then
    env_backup=$(mktemp)
    cp "$BACKEND/.env" "$env_backup"
  fi
  sudo -u fast git -C "$ROOT" cat-file -e "${previous_sha}^{commit}" \
    || die "Предыдущий SHA не найден в локальном Git-репозитории"
  sudo -u fast git -C "$ROOT" reset --hard "$previous_sha"
  sudo -u fast git -C "$ROOT" clean -fd
  if [[ -n "$env_backup" && -f "$env_backup" ]]; then
    cp "$env_backup" "$BACKEND/.env"
    chown fast:fast "$BACKEND/.env"
    chmod 600 "$BACKEND/.env"
    rm -f "$env_backup"
  fi
  rm -f "$BACKEND/.requirements.sha256"
}

sync_installer() {
  local src="$ROOT/scripts/deploy/update.sh"
  if [[ -f "$src" ]] && ! cmp -s "$src" /usr/local/bin/update; then
    cp "$src" /usr/local/bin/update
    chmod 755 /usr/local/bin/update
    log "Обновлён /usr/local/bin/update из репозитория"
  fi
}

install_backend_deps() {
  local req="$BACKEND/requirements.txt"
  local hash_file="$BACKEND/.requirements.sha256"
  local new_hash
  [[ -f "$req" ]] || die "Нет $req"
  new_hash=$(sha256sum "$req" | awk '{print $1}')
  if [[ -f "$hash_file" ]] && [[ "$(cat "$hash_file")" == "$new_hash" ]]; then
    log "Python-зависимости без изменений"
    return 0
  fi
  log "pip install -r requirements.txt ..."
  sudo -u fast "$VENV/bin/pip" install -r "$req" -q
  echo "$new_hash" > "$hash_file"
  chown fast:fast "$hash_file"
}

ensure_frontend_env() {
  local env="$FRONTEND/.env"
  if [[ ! -f "$env" ]]; then
    log "Создание frontend/.env для production (отсутствовал — из-за этого были 405 /undefined/...)"
    cat > "$env" <<'EOF'
REACT_APP_API_BASE_URL=https://svoygarage.ru/server/api
REACT_APP_BACKEND_BASE_URL=https://svoygarage.ru/server
EOF
    chown fast:fast "$env"
    chmod 600 "$env"
  fi
  if ! grep -qE '^REACT_APP_API_BASE_URL=https?://[^[:space:]]+/api' "$env"; then
    die "frontend/.env: нужен REACT_APP_API_BASE_URL=https://svoygarage.ru/server/api"
  fi
  if grep -qE '^REACT_APP_API_BASE_URL=.*127\.0\.0\.1|^REACT_APP_API_BASE_URL=.*localhost' "$env"; then
    die "frontend/.env указывает на localhost — для production нужен https://svoygarage.ru/server/api"
  fi
}

build_frontend() {
  ensure_frontend_env
  log "npm install + build (2–5 мин, backend пока работает)..."
  chown -R fast:fast "$FRONTEND"
  rm -rf "$FRONTEND/build"
  sudo -u fast env NODE_OPTIONS="--max-old-space-size=2048" bash -lc "
    set -e
    cd '$FRONTEND'
    if [[ -f package-lock.json ]]; then
      npm ci --no-audit --no-fund --legacy-peer-deps
    else
      npm install --no-audit --no-fund --legacy-peer-deps
    fi
    npm run build
  "
  [[ -f "$FRONTEND/build/index.html" ]] || die "Сборка frontend не создала build/index.html"
  if ! grep -q 'svoygarage.ru/server/api' "$FRONTEND"/build/static/js/main*.js 2>/dev/null; then
    die "В сборке нет https://svoygarage.ru/server/api — проверьте frontend/.env и пересоберите"
  fi
}

deploy_frontend() {
  log "rsync frontend -> $WEB_ROOT"
  rsync -a --delete "$FRONTEND/build/" "$WEB_ROOT/"
  chown -R www-data:www-data "$WEB_ROOT"
}

restart_backend() {
  install_kroan_unit
  log "systemctl restart kroan (один раз, без повторов)..."
  systemctl restart kroan.service
  wait_for_api
  log "systemctl restart celery..."
  systemctl restart celery.service
  systemctl is-active --quiet celery.service || die "celery не запустился"
  systemctl is-active --quiet kroan.service || die "kroan не запустился"
}

install_kroan_unit() {
  local src="$ROOT/docs/ops/kroan.service"
  local dst="/etc/systemd/system/kroan.service"
  [[ -f "$src" ]] || return 0
  if [[ ! -f "$dst" ]] || ! cmp -s "$src" "$dst"; then
    cp "$src" "$dst"
    systemctl daemon-reload
    log "Обновлён $dst (Gunicorn unit)"
  fi
}

verify_gunicorn() {
  local gunicorn_count uvicorn_standalone sched_started sched_skipped
  gunicorn_count=$(pgrep -f 'gunicorn.*app.main:app' 2>/dev/null | wc -l | tr -d ' ' || true)
  uvicorn_standalone=$(pgrep -f '/bin/uvicorn app.main:app' 2>/dev/null | wc -l | tr -d ' ' || true)
  sched_started=$(journalctl -u kroan -n 50 --no-pager 2>/dev/null | grep -c 'Scheduler started. Expired' || true)
  sched_skipped=$(journalctl -u kroan -n 50 --no-pager 2>/dev/null | grep -c 'Scheduler skipped' || true)
  gunicorn_count=${gunicorn_count:-0}
  uvicorn_standalone=${uvicorn_standalone:-0}
  sched_started=${sched_started:-0}
  sched_skipped=${sched_skipped:-0}
  log "Gunicorn: processes=$gunicorn_count standalone_uvicorn=$uvicorn_standalone scheduler_started=$sched_started scheduler_skipped=$sched_skipped"
  if [[ "$gunicorn_count" -lt 3 ]]; then
    log "WARN: expected gunicorn master + 2 workers (got $gunicorn_count)"
  fi
  if [[ "$uvicorn_standalone" -gt 0 ]]; then
    log "WARN: standalone uvicorn still running ($uvicorn_standalone)"
  fi
  if [[ "$sched_started" -lt 1 || "$sched_skipped" -lt 1 ]]; then
    log "WARN: expected 1 scheduler leader and 1 skipped worker in recent logs"
  fi
}

ensure_deploy_sudoers() {
  local dst="/etc/sudoers.d/autoparts-update"
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp" <<'EOF'
# Managed by /usr/local/bin/update — allow API (user fast) to trigger production update from /admin-settings
fast ALL=(root) NOPASSWD: /usr/local/bin/update
EOF
  if [[ ! -f "$dst" ]] || ! cmp -s "$tmp" "$dst"; then
    install -m 440 "$tmp" "$dst"
    if ! visudo -cf "$dst" >/dev/null 2>&1; then
      rm -f "$dst" "$tmp"
      die "Некорректный sudoers: $dst"
    fi
    log "Установлен $dst (NOPASSWD update для fast)"
  fi
  rm -f "$tmp"
}

ensure_vpn_bot_apply() {
  local src="$ROOT/vpn-marzban-bot/scripts/marzban-vpn-bot-apply.sh"
  local bot_src="$ROOT/vpn-marzban-bot/bot"
  local bot_dir="/opt/marzban-vpn-bot"
  local bin="/usr/local/bin/marzban-vpn-bot-apply"
  local unit_src="$bot_src/marzban-vpn-bot.service"
  local dst="/etc/sudoers.d/autoparts-vpn-bot"
  local tmp

  [[ -f "$src" ]] || return 0

  if [[ ! -f "$bin" ]] || ! cmp -s "$src" "$bin"; then
    install -m 755 "$src" "$bin"
    # Strip Windows CRLF if present
    sed -i 's/\r$//' "$bin" || true
    log "Установлен $bin"
  fi

  tmp="$(mktemp)"
  cat >"$tmp" <<'EOF'
# Managed by /usr/local/bin/update — allow API (user fast) to apply VPN bot token from /admin-settings
fast ALL=(root) NOPASSWD: /usr/local/bin/marzban-vpn-bot-apply
EOF
  if [[ ! -f "$dst" ]] || ! cmp -s "$tmp" "$dst"; then
    install -m 440 "$tmp" "$dst"
    if ! visudo -cf "$dst" >/dev/null 2>&1; then
      rm -f "$dst" "$tmp"
      die "Некорректный sudoers: $dst"
    fi
    log "Установлен $dst (NOPASSWD marzban-vpn-bot-apply для fast)"
  fi
  rm -f "$tmp"

  # Синхронизация кода бота (если каталог уже развёрнут)
  if [[ -d "$bot_dir" && -d "$bot_src" ]]; then
    install -m 644 "$bot_src/main.py" "$bot_dir/main.py"
    install -m 644 "$bot_src/requirements.txt" "$bot_dir/requirements.txt"
    sed -i 's/\r$//' "$bot_dir/main.py" "$bot_dir/requirements.txt" || true
    if [[ -f "$bot_dir/.env" ]] && ! grep -q '^TELEGRAM_PROXY_URL=' "$bot_dir/.env"; then
      printf '\nTELEGRAM_PROXY_URL=socks5://127.0.0.1:9050\n' >> "$bot_dir/.env"
    fi
    if [[ -x "$bot_dir/.venv/bin/pip" ]]; then
      "$bot_dir/.venv/bin/pip" install -q -r "$bot_dir/requirements.txt" || log "WARN: vpn-bot pip install failed"
    fi
    if [[ -f "$unit_src" ]]; then
      install -m 644 "$unit_src" /etc/systemd/system/marzban-vpn-bot.service
      sed -i 's/\r$//' /etc/systemd/system/marzban-vpn-bot.service || true
      systemctl daemon-reload
    fi
    chown -R marzbanbot:marzbanbot "$bot_dir" 2>/dev/null || true
    if systemctl is-enabled --quiet marzban-vpn-bot.service 2>/dev/null; then
      systemctl restart marzban-vpn-bot.service || log "WARN: marzban-vpn-bot restart failed"
      log "VPN-бот: код синхронизирован, сервис перезапущен"
    fi
  fi
}

ensure_pgbouncer() {
  local env="$BACKEND/.env" template="$ROOT/docs/ops/pgbouncer.ini.template"
  [[ -f "$env" && -f "$template" ]] || return 0

  if ! command -v pgbouncer >/dev/null 2>&1; then
    log "Установка pgbouncer..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq pgbouncer
  fi

  python3 - "$env" "$template" <<'PY'
import sys
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

env_path = Path(sys.argv[1])
template_path = Path(sys.argv[2])
lines = env_path.read_text(encoding="utf-8").splitlines()
url = None
out_lines = []
direct_saved = False
for line in lines:
    if line.startswith("DATABASE_URL=") and url is None:
        url = line.split("=", 1)[1].strip()
    if line.startswith("DATABASE_URL_DIRECT="):
        direct_saved = True
    out_lines.append(line)

if not url:
    sys.exit(0)

parsed = urlparse(url)
user = parsed.username or ""
password = parsed.password or ""
dbname = (parsed.path or "/").lstrip("/")
host = parsed.hostname or "127.0.0.1"
port = parsed.port or 5432

if not user or not dbname:
    print("skip pgbouncer: incomplete DATABASE_URL", file=sys.stderr)
    sys.exit(0)

ini = template_path.read_text(encoding="utf-8")
ini = ini.replace("__DB_ALIAS__", dbname)
ini = ini.replace("__DB_NAME__", dbname)
ini = ini.replace("__DB_USER__", user)
Path("/etc/pgbouncer/pgbouncer.ini").write_text(ini, encoding="utf-8")

userlist = f'"{user}" "{password}"\n'
Path("/etc/pgbouncer/userlist.txt").write_text(userlist, encoding="utf-8")
import os
import pwd
import grp

os.chmod("/etc/pgbouncer/userlist.txt", 0o600)
os.chmod("/etc/pgbouncer/pgbouncer.ini", 0o644)

if host in ("127.0.0.1", "localhost") and port == 5432:
    user_q = quote(user, safe="")
    auth = f"{user_q}:{quote(password, safe='')}" if password else user_q
    netloc = f"{auth}@{host}:6432"
    new_url = urlunparse(parsed._replace(netloc=netloc))
    replaced = False
    new_lines = []
    for line in out_lines:
        if line.startswith("DATABASE_URL=") and not replaced:
            if not direct_saved:
                new_lines.append(f"DATABASE_URL_DIRECT={url}")
                direct_saved = True
            new_lines.append(f"DATABASE_URL={new_url}")
            replaced = True
        else:
            new_lines.append(line)
    if replaced:
        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        os.chmod(str(env_path), 0o600)
        uid = pwd.getpwnam("fast").pw_uid
        gid = grp.getgrnam("fast").gr_gid
        os.chown(str(env_path), uid, gid)
PY

  chown pgbouncer:pgbouncer /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt 2>/dev/null || true
  systemctl enable pgbouncer.service 2>/dev/null || true
  systemctl restart pgbouncer.service
  log "PgBouncer: configured on 127.0.0.1:6432 (transaction pool)"
}

ensure_postgresql_tuning() {
  local src="$ROOT/docs/postgresql/tuning-4gb.conf" confd
  [[ -f "$src" ]] || return 0
  confd=$(find /etc/postgresql -maxdepth 3 -type d -name conf.d 2>/dev/null | head -1)
  [[ -n "$confd" ]] || return 0
  if [[ ! -f "$confd/99-autoparts-tuning.conf" ]] || ! cmp -s "$src" "$confd/99-autoparts-tuning.conf"; then
    cp "$src" "$confd/99-autoparts-tuning.conf"
    systemctl reload postgresql 2>/dev/null || systemctl restart postgresql 2>/dev/null || true
    log "PostgreSQL tuning: $confd/99-autoparts-tuning.conf"
  fi
}

verify_pgbouncer() {
  local listening direct_url
  listening=$(ss -lntp 2>/dev/null | grep -c ':6432' || true)
  listening=${listening:-0}
  direct_url=$(grep -E '^DATABASE_URL=' "$BACKEND/.env" 2>/dev/null | grep -c ':6432' || true)
  direct_url=${direct_url:-0}
  log "PgBouncer: listen_6432=$listening env_uses_6432=$direct_url"
  if [[ "$listening" -lt 1 ]]; then
    log "WARN: PgBouncer not listening on 6432"
  fi
  if [[ "$direct_url" -lt 1 ]]; then
    log "WARN: DATABASE_URL does not use port 6432"
  fi
}

ensure_monitoring() {
  local cron_line monitor_script env_example env_target
  monitor_script="$ROOT/scripts/ops/health-monitor.sh"
  [[ -f "$monitor_script" ]] || return 0
  chmod +x "$monitor_script"

  mkdir -p /var/lib/autoparts /etc/autoparts
  touch /var/log/autoparts-health.log /var/log/autoparts-alerts.log
  chmod 644 /var/log/autoparts-health.log /var/log/autoparts-alerts.log

  env_example="$ROOT/docs/ops/monitor.env.example"
  env_target="/etc/autoparts/monitor.env"
  if [[ -f "$env_example" && ! -f "$env_target" ]]; then
    cp "$env_example" "$env_target"
    chmod 600 "$env_target"
    log "Monitoring: создан $env_target (отредактируйте Telegram при необходимости)"
  fi

  cron_line="*/5 * * * * root $monitor_script >> /var/log/autoparts-health.log 2>&1"
  if [[ -f /etc/cron.d/autoparts-monitor ]]; then
    if ! grep -qF "$monitor_script" /etc/cron.d/autoparts-monitor 2>/dev/null; then
      echo "$cron_line" > /etc/cron.d/autoparts-monitor
      chmod 644 /etc/cron.d/autoparts-monitor
      log "Monitoring: обновлён /etc/cron.d/autoparts-monitor"
    fi
  else
    echo "$cron_line" > /etc/cron.d/autoparts-monitor
    chmod 644 /etc/cron.d/autoparts-monitor
    log "Monitoring: установлен cron /etc/cron.d/autoparts-monitor"
  fi

  if command -v fail2ban-client >/dev/null 2>&1; then
    if [[ -f "$ROOT/docs/ops/fail2ban/nginx-req-limit.filter" ]]; then
      cp "$ROOT/docs/ops/fail2ban/nginx-req-limit.filter" /etc/fail2ban/filter.d/nginx-req-limit.conf
    fi
    if [[ -f "$ROOT/docs/ops/fail2ban/nginx-req-limit.conf" ]]; then
      cp "$ROOT/docs/ops/fail2ban/nginx-req-limit.conf" /etc/fail2ban/jail.d/nginx-req-limit.conf
      systemctl reload fail2ban 2>/dev/null || systemctl restart fail2ban 2>/dev/null || true
      log "Monitoring: fail2ban nginx-req-limit применён"
    fi
  fi
}

verify_monitoring() {
  local cron_ok
  cron_ok=$(grep -c 'health-monitor.sh' /etc/cron.d/autoparts-monitor 2>/dev/null || echo 0)
  cron_ok=${cron_ok:-0}
  log "Monitoring: cron_entries=$cron_ok"
  if [[ "$cron_ok" -lt 1 ]]; then
    log "WARN: health-monitor cron not installed"
  fi
}

install_alert_bot_deps() {
  local alert_bot="$ROOT/alert-bot"
  local alert_venv="$alert_bot/venv"
  local req="$alert_bot/requirements.txt"
  local hash_file="$alert_bot/.requirements.sha256"
  local new_hash
  [[ -f "$req" ]] || return 0
  if [[ ! -d "$alert_venv" ]]; then
    log "alert-bot: создание venv..."
    sudo -u fast python3 -m venv "$alert_venv"
  fi
  new_hash=$(sha256sum "$req" | awk '{print $1}')
  if [[ -f "$hash_file" ]] && [[ "$(cat "$hash_file")" == "$new_hash" ]]; then
    log "alert-bot: зависимости без изменений"
    return 0
  fi
  log "alert-bot: pip install -r requirements.txt ..."
  sudo -u fast "$alert_venv/bin/pip" install -r "$req" -q
  echo "$new_hash" > "$hash_file"
  chown fast:fast "$hash_file"
}

ensure_telegram_tor_proxy() {
  local torrc_src="$ROOT/alert-bot/docs/ops/torrc"
  local torrc_dst="/etc/tor/torrc"
  local ts

  [[ -f "$torrc_src" ]] || return 0

  if ! command -v tor >/dev/null 2>&1 || ! command -v obfs4proxy >/dev/null 2>&1; then
    log "Tor: установка tor + obfs4proxy..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y tor obfs4proxy
  fi

  if [[ ! -f "$torrc_dst" ]] || ! cmp -s "$torrc_src" "$torrc_dst"; then
    ts=$(date +%Y%m%d_%H%M%S)
    [[ -f "$torrc_dst" ]] && cp "$torrc_dst" "${torrc_dst}.bak.${ts}"
    cp "$torrc_src" "$torrc_dst"
    chmod 644 "$torrc_dst"
    systemctl restart tor 2>/dev/null || true
    log "Tor: обновлён $torrc_dst"
  fi

  systemctl enable tor 2>/dev/null || true
  systemctl start tor 2>/dev/null || true
  sleep 3

  if curl -sf --max-time 25 --socks5-hostname 127.0.0.1:9050 https://api.telegram.org/ >/dev/null 2>&1; then
    log "Tor: Telegram доступен через socks5://127.0.0.1:9050"
  else
    log "WARN: Tor: Telegram через socks5://127.0.0.1:9050 недоступен (проверьте journalctl -u tor)"
  fi
}

ensure_alert_bot() {
  local alert_bot="$ROOT/alert-bot"
  local unit_src="$alert_bot/docs/ops/alert-bot.service"
  local unit_dst="/etc/systemd/system/alert-bot.service"
  local env_example="$alert_bot/docs/ops/alert-bot.env.example"
  local env_target="/etc/autoparts/alert-bot.env"
  local db_url

  [[ -d "$alert_bot" ]] || return 0

  ensure_telegram_tor_proxy
  usermod -aG adm,systemd-journal fast 2>/dev/null || true
  install_alert_bot_deps

  if [[ -f "$unit_src" ]]; then
    if [[ ! -f "$unit_dst" ]] || ! cmp -s "$unit_src" "$unit_dst"; then
      cp "$unit_src" "$unit_dst"
      systemctl daemon-reload
      log "alert-bot: обновлён $unit_dst"
    fi
  fi

  if [[ -f "$env_example" && ! -f "$env_target" ]]; then
    cp "$env_example" "$env_target"
    db_url=$(grep -E '^DATABASE_URL=' "$BACKEND/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)
    if [[ -n "$db_url" ]]; then
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${db_url}|" "$env_target"
    fi
    chmod 600 "$env_target"
    log "alert-bot: создан $env_target (добавьте BOT_TOKEN)"
  fi

  if [[ -f "$env_target" ]] && ! grep -qE '^TELEGRAM_PROXY_URL=' "$env_target" 2>/dev/null; then
    echo "TELEGRAM_PROXY_URL=socks5://127.0.0.1:9050" >> "$env_target"
    log "alert-bot: добавлен TELEGRAM_PROXY_URL в $env_target"
  fi

  if [[ -f "$env_target" ]] && grep -qE '^TELEGRAM_PROXY_URL=socks5://127\.0\.0\.1:40000$' "$env_target" 2>/dev/null; then
    sed -i 's|^TELEGRAM_PROXY_URL=socks5://127.0.0.1:40000|TELEGRAM_PROXY_URL=socks5://127.0.0.1:9050|' "$env_target"
    log "alert-bot: TELEGRAM_PROXY_URL мигрирован с WARP (40000) на Tor (9050)"
  fi

  if [[ -f "$unit_dst" && -f "$env_target" ]]; then
    if grep -qE '^BOT_TOKEN=.+$' "$env_target" 2>/dev/null; then
      systemctl enable alert-bot.service 2>/dev/null || true
      systemctl restart alert-bot.service 2>/dev/null || true
      log "alert-bot: service restarted"
    else
      log "alert-bot: BOT_TOKEN не задан в $env_target — сервис не запущен"
    fi
  fi
}

verify_alert_bot() {
  local active token_ok proxy_url proxy_ok tor_ok
  active=$(systemctl is-active alert-bot 2>/dev/null || echo inactive)
  tor_ok=$(systemctl is-active tor 2>/dev/null || echo inactive)
  token_ok=0
  proxy_ok=0
  proxy_url=""
  if [[ -f /etc/autoparts/alert-bot.env ]] && grep -qE '^BOT_TOKEN=.+$' /etc/autoparts/alert-bot.env 2>/dev/null; then
    token_ok=1
  fi
  if [[ -f /etc/autoparts/alert-bot.env ]]; then
    proxy_url=$(grep -E '^TELEGRAM_PROXY_URL=' /etc/autoparts/alert-bot.env 2>/dev/null | cut -d= -f2- || true)
  fi
  if [[ -n "$proxy_url" ]]; then
    if curl -sf --max-time 25 --proxy "$proxy_url" https://api.telegram.org/ >/dev/null 2>&1; then
      proxy_ok=1
    fi
  elif curl -sf --max-time 10 https://api.telegram.org/ >/dev/null 2>&1; then
    proxy_ok=1
  fi
  log "alert-bot: active=$active tor=$tor_ok token_configured=$token_ok telegram_reachable=$proxy_ok"
  if [[ "$token_ok" -eq 1 && "$active" != "active" ]]; then
    log "WARN: alert-bot не active (проверьте journalctl -u alert-bot)"
  fi
  if [[ "$token_ok" -eq 1 && "$proxy_ok" -eq 0 ]]; then
    log "WARN: Telegram API недоступен (proxy=${proxy_url:-direct})"
  fi
}

apply_nginx_configs() {
  local site="/etc/nginx/sites-available/svoygarage"
  local ts
  ts=$(date +%Y%m%d_%H%M%S)

  ensure_brotli_modules || true
  ensure_nginx_http_includes

  if [[ -f "$ROOT/docs/nginx/svoygarage.conf" ]]; then
    cp "$site" "${site}.bak.${ts}"
    cp "$ROOT/docs/nginx/svoygarage.conf" "$site"
    log "Обновлён $site из репозитория"
  fi
  if [[ -f "$ROOT/docs/nginx/http-microcache.conf" ]]; then
    cp "$ROOT/docs/nginx/http-microcache.conf" /etc/nginx/snippets/svoygarage-microcache.conf
  fi
  if [[ -f "$ROOT/docs/nginx/http-ddos-limits.conf" ]]; then
    cp "$ROOT/docs/nginx/http-ddos-limits.conf" /etc/nginx/snippets/svoygarage-ddos-limits.conf
  fi
  ensure_brotli_snippet
  nginx -t
  systemctl reload nginx
  log "nginx reload OK"
}

verify_nginx_cache() {
  local cache1 cache2 brotli_enc main_js
  cache1=$(curl -sI -H 'Host: svoygarage.ru' \
    "https://127.0.0.1/server/api/catalog/products?page=1&page_size=1&_nc=$(date +%s)" -k \
    | grep -i x-cache-status | awk '{print $2}' | tr -d '\r' || echo "unknown")
  cache2=$(curl -sI -H 'Host: svoygarage.ru' \
    "https://127.0.0.1/server/api/catalog/products?page=1&page_size=1" -k \
    | grep -i x-cache-status | awk '{print $2}' | tr -d '\r' || echo "unknown")
  main_js=$(basename "$(ls /var/www/my-autoparts/static/js/main.*.js 2>/dev/null | head -1)" 2>/dev/null || echo "main.js")
  brotli_enc=$(curl -sI -H 'Host: svoygarage.ru' -H 'Accept-Encoding: br' \
    "https://127.0.0.1/static/js/${main_js}" -k 2>/dev/null \
    | grep -i content-encoding | awk '{print $2}' | tr -d '\r' || echo "none")
  log "Nginx cache: catalog1=$cache1 catalog2=$cache2; ${main_js} br=$brotli_enc"
}

verify_frontend_chunks() {
  [[ -d "$WEB_ROOT/static/js" ]] || return 0
  local main_js chunk_count prefetch_ok used_ok prefetch_status used_status
  main_js=$(basename "$(ls "$WEB_ROOT/static/js/main."*.js 2>/dev/null | head -1)" 2>/dev/null || echo "none")
  chunk_count=$(ls "$WEB_ROOT/static/js/"*.chunk.js 2>/dev/null | wc -l)
  prefetch_ok=$(grep -rl 'prefetchPartDetail' "$WEB_ROOT/static/js/"*.map 2>/dev/null | head -1 || true)
  used_ok=$(grep -rl 'UsedPartsList' "$WEB_ROOT/static/js/"*.map 2>/dev/null | head -1 || true)
  prefetch_status="miss"
  used_status="miss"
  [[ -n "$prefetch_ok" ]] && prefetch_status="ok"
  [[ -n "$used_ok" ]] && used_status="ok"
  log "Frontend build: main=$main_js chunks=$chunk_count prefetch=$prefetch_status used_list=$used_status"
  [[ -n "$prefetch_ok" ]] || log "WARN: prefetchPartDetail missing from build source maps"
  [[ -n "$used_ok" ]] || log "WARN: UsedPartsList lazy chunk missing from build source maps"
}

verify() {
  local cart_code public_code part_types_code catalog_code
  cart_code=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8080/api/cart/ || echo "000")
  public_code=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 \
    -H 'Host: svoygarage.ru' https://127.0.0.1/server/api/cart/ -k || echo "000")
  part_types_code=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 \
    -H 'Host: svoygarage.ru' https://127.0.0.1/server/api/part-types/public -k || echo "000")
  catalog_code=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 15 \
    -H 'Host: svoygarage.ru' "https://127.0.0.1/server/api/catalog/products?page=1&page_size=1" -k || echo "000")
  log "Проверка: local cart=$cart_code public cart=$public_code part-types=$part_types_code catalog=$catalog_code"
  [[ "$cart_code" =~ ^(200|401)$ ]] || log "WARN: неожиданный код local cart=$cart_code"
  [[ "$part_types_code" == "200" ]] || log "WARN: неожиданный код part-types=$part_types_code"
  [[ "$catalog_code" == "200" ]] || log "WARN: неожиданный код catalog=$catalog_code"
}

main() {
  parse_args "$@"
  require_root
  acquire_lock
  touch "$LOG"
  chmod 644 "$LOG"

  log "========== Старт обновления =========="

  ensure_upload_dirs
  ensure_nginx_cache_dirs
  fix_backend_env
  if [[ $ROLLBACK -eq 1 ]]; then
    rollback_to_previous_release
  else
    git_pull
  fi
  sync_installer
  ensure_deploy_sudoers
  ensure_vpn_bot_apply
  ensure_scheduler_env
  install_kroan_unit
  ensure_pgbouncer
  ensure_postgresql_tuning
  ensure_monitoring
  ensure_alert_bot

  if [[ $SKIP_FRONTEND -eq 0 ]]; then
    install_backend_deps
    build_frontend
    deploy_frontend
  else
    install_backend_deps
  fi

  if [[ $SKIP_BACKEND -eq 0 ]]; then
    restart_backend
  fi

  if [[ $RELOAD_NGINX -eq 1 ]]; then
    apply_nginx_configs
    verify_nginx_cache
  fi

  verify
  verify_frontend_chunks
  verify_gunicorn
  verify_pgbouncer
  verify_monitoring
  verify_alert_bot
  log "========== Обновление завершено =========="
}

main "$@"
