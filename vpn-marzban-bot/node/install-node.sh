#!/bin/bash
# Install Marzban Node on a clean Ubuntu/Debian VPS.
# Usage:
#   sudo bash install-node.sh
#   sudo bash install-node.sh /path/to/ssl_client_cert.pem
#
# After install: add the node in Marzban panel (Address = this server public IP,
# Port 62050, API Port 62051). Host Settings remarks control Happ VPN flags.
set -euo pipefail

CERT_SRC="${1:-}"
OPT_DIR="/opt/marzban-node"
DATA_DIR="/var/lib/marzban-node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo "==> Creating directories"
mkdir -p "$OPT_DIR" "$DATA_DIR"

echo "==> Installing docker-compose.yml"
cp "$SCRIPT_DIR/docker-compose.yml" "$OPT_DIR/docker-compose.yml"

if [[ -n "$CERT_SRC" ]]; then
  if [[ ! -f "$CERT_SRC" ]]; then
    echo "ERROR: certificate file not found: $CERT_SRC" >&2
    exit 1
  fi
  cp "$CERT_SRC" "$DATA_DIR/ssl_client_cert.pem"
  chmod 600 "$DATA_DIR/ssl_client_cert.pem"
  echo "==> Certificate installed: $DATA_DIR/ssl_client_cert.pem"
else
  if [[ ! -f "$DATA_DIR/ssl_client_cert.pem" ]]; then
    echo "WARN: $DATA_DIR/ssl_client_cert.pem missing."
    echo "      Copy panel certificate first, then re-run or:"
    echo "      nano $DATA_DIR/ssl_client_cert.pem"
    echo "      cd $OPT_DIR && docker compose up -d"
  fi
fi

echo "==> Firewall (add-only; does not reset rules)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp comment 'SSH' || true
  ufw allow 62050/tcp comment 'Marzban Node SERVICE_PORT' || true
  ufw allow 62051/tcp comment 'Marzban Node XRAY_API_PORT' || true
  ufw allow 8443/tcp comment 'VLESS Reality' || true
  ufw status | head -n 40 || true
  echo "NOTE: if ufw is inactive, enable carefully after confirming SSH is allowed:"
  echo "      ufw enable"
else
  echo "ufw not installed — open 22, 62050, 62051, 8443/tcp in your cloud firewall / iptables"
fi

if [[ -f "$DATA_DIR/ssl_client_cert.pem" ]]; then
  echo "==> Starting marzban-node"
  cd "$OPT_DIR"
  docker compose pull
  docker compose up -d
  sleep 3
  docker compose ps
  docker compose logs --tail=40
  echo
  echo "OK. Next: add node in Marzban panel → Address=<this-IP> Port=62050 API=62051"
else
  echo "==> Skipping docker compose up (no certificate yet)"
fi

echo "Done."
