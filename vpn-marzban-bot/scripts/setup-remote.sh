#!/bin/bash
set -euo pipefail

SERVER_IP=195.24.65.251
SRC=/home/fast/autoparts/vpn-marzban-bot

mkdir -p /opt/marzban-vpn /var/lib/marzban-vpn
cp "$SRC/marzban/docker-compose.yml" /opt/marzban-vpn/

if [[ ! -f /opt/marzban-vpn/.env ]]; then
  MARZ_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  cat > /opt/marzban-vpn/.env <<EOF
SUDO_USERNAME=admin
SUDO_PASSWORD=${MARZ_PASS}
UVICORN_HOST=127.0.0.1
UVICORN_PORT=62050
XRAY_JSON=/var/lib/marzban/xray_config.json
XRAY_SUBSCRIPTION_URL_PREFIX=http://${SERVER_IP}:62050
XRAY_SUBSCRIPTION_PATH=sub
EOF
  chmod 600 /opt/marzban-vpn/.env
  echo "$MARZ_PASS" > /root/marzban-vpn-admin.pass
  chmod 600 /root/marzban-vpn-admin.pass
else
  MARZ_PASS=$(grep '^SUDO_PASSWORD=' /opt/marzban-vpn/.env | cut -d= -f2-)
  echo "$MARZ_PASS" > /root/marzban-vpn-admin.pass
  chmod 600 /root/marzban-vpn-admin.pass
fi

KEYS=$(docker run --rm --entrypoint xray gozargah/marzban:latest x25519)
PRIV=$(printf '%s\n' "$KEYS" | sed -n 's/.*Private key: \([^ ]*\).*/\1/p')
PUB=$(printf '%s\n' "$KEYS" | sed -n 's/.*Public key: \([^ ]*\).*/\1/p')
SHORT_ID=$(openssl rand -hex 8)

if [[ -z "$PRIV" || -z "$PUB" ]]; then
  echo "Failed to parse Reality keys: $KEYS" >&2
  exit 1
fi

printf '%s\n' "$PRIV" > /root/marzban-vpn-reality-private.key
printf '%s\n' "$PUB" > /root/marzban-vpn-reality-public.key
printf '%s\n' "$SHORT_ID" > /root/marzban-vpn-reality-shortid.txt
chmod 600 /root/marzban-vpn-reality-*.key /root/marzban-vpn-reality-shortid.txt

python3 - "$PRIV" "$PUB" "$SHORT_ID" <<'PY'
import json, pathlib, sys
priv, pub, short = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = {
  "log": {"loglevel": "warning"},
  "routing": {
    "rules": [
      {"ip": ["geoip:private"], "outboundTag": "BLOCK", "type": "field"},
      {"outboundTag": "DIRECT", "protocol": ["bittorrent"], "type": "field"},
    ]
  },
  "inbounds": [
    {
      "tag": "VLESS TCP REALITY",
      "listen": "0.0.0.0",
      "port": 8443,
      "protocol": "vless",
      "settings": {"clients": [], "decryption": "none"},
      "streamSettings": {
        "network": "tcp",
        "tcpSettings": {},
        "security": "reality",
        "realitySettings": {
          "show": False,
          "dest": "www.microsoft.com:443",
          "xver": 0,
          "serverNames": ["www.microsoft.com", "microsoft.com"],
          "privateKey": priv,
          "publicKey": pub,
          "shortIds": [short],
        },
      },
      "sniffing": {
        "enabled": True,
        "destOverride": ["http", "tls", "quic"],
      },
    }
  ],
  "outbounds": [
    {"protocol": "freedom", "tag": "DIRECT"},
    {"protocol": "blackhole", "tag": "BLOCK"},
  ],
}
path = pathlib.Path("/var/lib/marzban-vpn/xray_config.json")
path.write_text(json.dumps(cfg, indent=2) + "\n")
print("wrote", path)
PY

cd /opt/marzban-vpn
docker compose up -d --force-recreate

for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:62050/docs || true)
  if [[ "$code" == "200" ]]; then
    echo "panel ready http=$code"
    break
  fi
  echo "waiting panel... $i code=$code"
  sleep 2
done

ss -tulpn | grep -E ':(8443|62050)\s' || true
docker ps --filter name=marzban-vpn
docker logs marzban-vpn --tail 25 || true

# Auth + Host Settings via API
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${MARZ_PASS}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')

if [[ -z "$TOKEN" ]]; then
  echo "WARN: could not get admin token" >&2
  exit 0
fi

echo "token ok"

# Configure host for VLESS Reality so links include correct address/port/pbk
python3 - "$TOKEN" "$SERVER_IP" "$PUB" "$SHORT_ID" <<'PY'
import json, sys, urllib.request
token, ip, pub, short = sys.argv[1:5]
hosts = {
  "VLESS TCP REALITY": [
    {
      "remark": "Reality",
      "address": ip,
      "port": 8443,
      "sni": "www.microsoft.com",
      "host": "",
      "path": "",
      "security": "inbound_default",
      "alpn": "",
      "fingerprint": "chrome",
      "allowinsecure": False,
      "is_disabled": False,
      "mux_enable": False,
      "fragment_setting": "",
      "noise_setting": "",
      "random_user_agent": False,
      "use_sni_as_host": False,
    }
  ]
}
# Some Marzban versions use slightly different Host model; send common fields.
req = urllib.request.Request(
  "http://127.0.0.1:62050/api/hosts",
  data=json.dumps(hosts).encode(),
  headers={
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
  },
  method="PUT",
)
try:
  with urllib.request.urlopen(req, timeout=30) as resp:
    print("hosts status", resp.status)
    print(resp.read()[:500])
except Exception as e:
  print("hosts update failed:", e)
  # Try GET to see schema
  req2 = urllib.request.Request(
    "http://127.0.0.1:62050/api/hosts",
    headers={"Authorization": f"Bearer {token}"},
  )
  with urllib.request.urlopen(req2, timeout=30) as resp:
    print("current hosts:", resp.read()[:1000])
PY

# Create a test user to verify links
python3 - "$TOKEN" <<'PY'
import json, sys, urllib.request
token = sys.argv[1]
body = {
  "username": "test_setup_001",
  "proxies": {"vless": {"flow": "xtls-rprx-vision"}},
  "inbounds": {"vless": ["VLESS TCP REALITY"]},
  "expire": 0,
  "data_limit": 0,
  "data_limit_reset_strategy": "no_reset",
  "status": "active",
  "note": "setup-test",
}
req = urllib.request.Request(
  "http://127.0.0.1:62050/api/user",
  data=json.dumps(body).encode(),
  headers={
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
  },
  method="POST",
)
try:
  with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.load(resp)
    print("user created", data.get("username"))
    links = data.get("links") or []
    for l in links:
      print("LINK:", l[:120], "...")
    print("SUB:", data.get("subscription_url"))
except Exception as e:
  print("create user failed:", e)
  # maybe already exists
  req2 = urllib.request.Request(
    "http://127.0.0.1:62050/api/user/test_setup_001",
    headers={"Authorization": f"Bearer {token}"},
  )
  with urllib.request.urlopen(req2, timeout=30) as resp:
    data = json.load(resp)
    print("existing user links:", data.get("links"))
PY

# Firewall: add only 8443
if command -v ufw >/dev/null; then
  ufw allow 8443/tcp comment 'Marzban VLESS Reality' || true
  ufw status | grep 8443 || true
fi

echo "ADMIN_PASS=$(cat /root/marzban-vpn-admin.pass)"
echo "PUBLIC_KEY=$(cat /root/marzban-vpn-reality-public.key)"
echo "SHORT_ID=$(cat /root/marzban-vpn-reality-shortid.txt)"
echo "DONE"
