#!/bin/bash
# Шаг 2+3: VLESS + TLS (Let's Encrypt) на :8443, обновить hosts/users/bot.
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TAG="VLESS TCP REALITY"
DOMAIN=svoygarage.ru
# Path visible to marzban xray — use host path mounted in container
CERT=/var/lib/marzban-vpn/certs/fullchain.pem
KEY=/var/lib/marzban-vpn/certs/privkey.pem
BOT=/opt/marzban-vpn-bot

test -f "$CERT"
test -f "$KEY"

# Ensure docker-compose mounts certs
cd /opt/marzban-vpn
if ! grep -q '/var/lib/marzban-vpn/certs' docker-compose.yml 2>/dev/null; then
  echo "NOTE: check marzban volume mounts for certs"
fi
# Marzban typically mounts /var/lib/marzban → use that path inside
INNER_CERT=/var/lib/marzban/certs/fullchain.pem
INNER_KEY=/var/lib/marzban/certs/privkey.pem
# Our data dir is marzban-vpn
mkdir -p /var/lib/marzban-vpn/certs
cp -a /var/lib/marzban-vpn/certs/fullchain.pem /var/lib/marzban-vpn/certs/privkey.pem /var/lib/marzban-vpn/certs/ 2>/dev/null || true
# Also mirror to classic path if present
mkdir -p /var/lib/marzban/certs 2>/dev/null || true
cp -a "$CERT" "$KEY" /var/lib/marzban/certs/ 2>/dev/null || true

# Detect which path works inside container
INNER_CERT=""
INNER_KEY=""
for base in /var/lib/marzban-vpn /var/lib/marzban; do
  if docker compose exec -T marzban test -f "$base/certs/fullchain.pem" 2>/dev/null; then
    INNER_CERT="$base/certs/fullchain.pem"
    INNER_KEY="$base/certs/privkey.pem"
    break
  fi
done
if [[ -z "$INNER_CERT" ]]; then
  # fall back: put under xray config dir
  mkdir -p /var/lib/marzban-vpn/xray-certs
  cp -a "$CERT" /var/lib/marzban-vpn/xray-certs/fullchain.pem
  cp -a "$KEY" /var/lib/marzban-vpn/xray-certs/privkey.pem
  INNER_CERT=/var/lib/marzban/xray-certs/fullchain.pem
  INNER_KEY=/var/lib/marzban/xray-certs/privkey.pem
  # try common mount
  if docker compose exec -T marzban test -f /var/lib/marzban/xray-certs/fullchain.pem 2>/dev/null; then
    true
  else
    # copy into container filesystem via docker cp
    CID=$(docker compose ps -q marzban)
    docker exec "$CID" mkdir -p /var/lib/marzban/certs
    docker cp "$CERT" "$CID:/var/lib/marzban/certs/fullchain.pem"
    docker cp "$KEY" "$CID:/var/lib/marzban/certs/privkey.pem"
    INNER_CERT=/var/lib/marzban/certs/fullchain.pem
    INNER_KEY=/var/lib/marzban/certs/privkey.pem
  fi
fi
echo "INNER_CERT=$INNER_CERT"
echo "INNER_KEY=$INNER_KEY"

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request, urllib.error
TOKEN="$TOK"
TAG="$TAG"
DOMAIN="$DOMAIN"
CERT="$INNER_CERT"
KEY="$INNER_KEY"

def api(method, path, body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(
        f"http://127.0.0.1:62050{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw=r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:800])
        raise

cfg=api("GET","/api/core/config")
for ib in cfg.get("inbounds") or []:
    if ib.get("port")==8443 or ib.get("tag")==TAG:
        ib["tag"]=TAG
        ib["listen"]="0.0.0.0"
        ib["port"]=8443
        ib["protocol"]="vless"
        ib["settings"]={"clients":[], "decryption":"none"}
        ib["streamSettings"]={
            "network":"tcp",
            "security":"tls",
            "tlsSettings":{
                "certificates":[{"certificateFile": CERT, "keyFile": KEY}],
                "alpn":["http/1.1"],
            },
            "tcpSettings":{"header":{"type":"none"}},
        }
        ib["sniffing"]={"enabled": True, "destOverride": ["http","tls","quic"]}
        print("patched TLS inbound", TAG)
api("PUT","/api/core/config", cfg)
print("core saved")

hosts=api("GET","/api/hosts")
new={}
for tag, arr in (hosts or {}).items():
    if tag != TAG:
        new[tag]=arr
        continue
    out=[]
    for h in arr or []:
        h=dict(h)
        addr=h.get("address") or ""
        h["sni"]=DOMAIN
        h["host"]=""
        h["path"]=""
        h["alpn"]="http/1.1"
        h["fingerprint"]="chrome"
        h["security"]="tls"
        h["port"]=8443
        if "212.102" in addr:
            h["remark"]="Germany"
        elif "195.24" in addr or DOMAIN in addr:
            h["remark"]="Russia"
            # Prefer domain for Russia so SNI matches cert CN
            h["address"]=DOMAIN
        out.append(h)
        print("host", h.get("address"), h.get("remark"), "sni", h.get("sni"))
    new[TAG]=out
api("PUT","/api/hosts", new)
print("hosts saved")

# users: no flow (TLS TCP without vision)
users=api("GET","/api/users?limit=500")
items=users.get("users") if isinstance(users, dict) else users
for u in items or []:
    uname=u.get("username")
    full=api("GET", f"/api/user/{uname}")
    vless=dict((full.get("proxies") or {}).get("vless") or {})
    vless.pop("flow", None)
    body={
        "proxies": {"vless": vless},
        "inbounds": {"vless": [TAG]},
        "expire": full.get("expire"),
        "data_limit": full.get("data_limit"),
        "data_limit_reset_strategy": full.get("data_limit_reset_strategy") or "no_reset",
        "status": full.get("status") or "active",
        "note": full.get("note") or "",
        "on_hold_timeout": full.get("on_hold_timeout"),
        "on_hold_expire_duration": full.get("on_hold_expire_duration"),
    }
    api("PUT", f"/api/user/{uname}", body)
    print("user", uname, "ok")
PY

# Sync certs to Germany node (same paths for marzban-node)
if [[ -f /root/de-node.pass ]]; then
  DEPASS=$(cat /root/de-node.pass)
else
  DEPASS='vNGrzXaKqX96DrMb'
fi
sshpass -p "$DEPASS" ssh -o StrictHostKeyChecking=no root@212.102.227.25 \
  'mkdir -p /var/lib/marzban/certs /var/lib/marzban-node/certs' || true
sshpass -p "$DEPASS" scp -o StrictHostKeyChecking=no "$CERT" "$KEY" \
  root@212.102.227.25:/var/lib/marzban/certs/ || true
sshpass -p "$DEPASS" scp -o StrictHostKeyChecking=no "$CERT" "$KEY" \
  root@212.102.227.25:/var/lib/marzban-node/certs/ || true
# restart node container to pick certs if needed
sshpass -p "$DEPASS" ssh -o StrictHostKeyChecking=no root@212.102.227.25 \
  'docker restart marzban-node >/dev/null 2>&1 || true' || true

sleep 5

UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
echo "UUID=$UUID"
IMG=$(docker compose images -q marzban | head -1)
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-tls-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"tls","tlsSettings":{"serverName":"$DOMAIN","allowInsecure":false,"fingerprint":"chrome","alpn":["http/1.1"]}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU "$DOMAIN" 18301
prove DE 212.102.227.25 18302

curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;u=json.load(sys.stdin);
print("proxies",u.get("proxies"));
[print("LINK",x) for x in (u.get("links") or [])]'
