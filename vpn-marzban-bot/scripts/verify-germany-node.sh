#!/usr/bin/env bash
# Germany node: Reality port + container health (no /sub/ here)
set -euo pipefail

echo "=== hostname / IP ==="
hostname -I || true
curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || true
echo

echo "=== marzban-node docker ==="
docker ps --filter name=marzban --format '{{.Names}} {{.Status}} {{.Ports}}' || true

echo "=== ports 8443 / 62050 / 62051 ==="
ss -tulpn | grep -E ':(8443|62050|62051)\s' || true

echo "=== ufw 8443 ==="
ufw status 2>/dev/null | grep -E '8443|Status' || true
# ensure 8443 open
ufw allow 8443/tcp >/dev/null 2>&1 || true

echo "=== local reality listen probe ==="
# container should publish 8443
if ! ss -tulpn | grep -q ':8443'; then
  echo "WARN: 8443 not listening — restarting marzban-node"
  cd /opt/marzban-node 2>/dev/null || cd /root/marzban-node 2>/dev/null || true
  docker compose restart || docker restart marzban-node || true
  sleep 5
  ss -tulpn | grep -E ':(8443|62050|62051)\s' || true
fi

echo "=== NODE DONE ==="
