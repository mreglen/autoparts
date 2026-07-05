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
HEALTH_URL="http://127.0.0.1:8080/api/auth/public-site-config"
HEALTH_MAX_WAIT=120

SKIP_FRONTEND=0
SKIP_BACKEND=0
RELOAD_NGINX=0

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
  mkdir -p /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check
  chown www-data:www-data /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check
}

git_pull() {
  log "git fetch + sync с origin (локальные правки сбрасываются, backend/.env сохраняется)..."
  local branch env_backup=""
  branch=$(sudo -u fast git -C "$ROOT" rev-parse --abbrev-ref HEAD)
  if [[ -f "$BACKEND/.env" ]]; then
    env_backup=$(mktemp)
    cp "$BACKEND/.env" "$env_backup"
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
  rm -f "$BACKEND/.requirements.sha256"
  log "Коммит: $(sudo -u fast git -C "$ROOT" log -1 --oneline)"
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

build_frontend() {
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
}

deploy_frontend() {
  log "rsync frontend -> $WEB_ROOT"
  rsync -a --delete "$FRONTEND/build/" "$WEB_ROOT/"
  chown -R www-data:www-data "$WEB_ROOT"
}

restart_backend() {
  log "systemctl restart kroan (один раз, без повторов)..."
  systemctl restart kroan.service
  wait_for_api
  log "systemctl restart celery..."
  systemctl restart celery.service
  systemctl is-active --quiet celery.service || die "celery не запустился"
  systemctl is-active --quiet kroan.service || die "kroan не запустился"
}

apply_nginx_configs() {
  local site="/etc/nginx/sites-available/svoygarage"
  local ts
  ts=$(date +%Y%m%d_%H%M%S)

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
  nginx -t
  systemctl reload nginx
  log "nginx reload OK"
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
  git_pull
  sync_installer

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
  fi

  verify
  log "========== Обновление завершено =========="
}

main "$@"
