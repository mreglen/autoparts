#!/bin/bash
# Restore working VLESS+TLS (LE cert) — Reality handshake fails on user device.
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TAG="VLESS TCP REALITY"
DOMAIN=svoygarage.ru
CERT=/var/lib/marzban/certs/fullchain.pem
KEY=/var/lib/marzban/certs/privkey.pem
BOT=/opt/marzban-vpn-bot

# ensure certs
mkdir -p /var/lib/marzban-vpn/certs
install -m 644 /etc/letsencrypt/live/svoygarage.ru/fullchain.pem /var/lib/marzban-vpn/certs/fullchain.pem
install -m 600 /etc/letsencrypt/live/svoygarage.ru/privkey.pem /var/lib/marzban-vpn/certs/privkey.pem
# volume mount: host /var/lib/marzban-vpn -> container /var/lib/marzban
test -f "$CERT" || { CERT=/var/lib/marzban-vpn/certs/fullchain.pem; KEY=/var/lib/marzban-vpn/certs/privkey.pem; }

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request, urllib.error
TOKEN="$TOK"
TAG="$TAG"
DOMAIN="$DOMAIN"
CERT="$CERT"
KEY="$KEY"
# inside container path
INNER_CERT="/var/lib/marzban/certs/fullchain.pem"
INNER_KEY="/var/lib/marzban/certs/privkey.pem"

def api(method, path, body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(f"http://127.0.0.1:62050{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw=r.read().decode(); return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:600]); raise

cfg=api("GET","/api/core/config")
for ib in cfg.get("inbounds") or []:
    if ib.get("port")==8443 or ib.get("tag")==TAG:
        ib["tag"]=TAG
        ib["port"]=8443
        ib["protocol"]="vless"
        ib["settings"]={"clients":[], "decryption":"none"}
        ib["streamSettings"]={
            "network":"tcp",
            "security":"tls",
            "tlsSettings":{
                "certificates":[{"certificateFile": INNER_CERT, "keyFile": INNER_KEY}],
                "alpn":["http/1.1"],
            },
            "tcpSettings":{"header":{"type":"none"}},
        }
        ib["sniffing"]={"enabled": True, "destOverride": ["http","tls","quic"]}
        print("TLS inbound patched")
api("PUT","/api/core/config", cfg)
print("core saved")

api("PUT","/api/hosts", {TAG: [
    {"remark":"Russia","address":DOMAIN,"port":8443,"sni":DOMAIN,"host":"","path":"","security":"tls","alpn":"http/1.1","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False},
    {"remark":"Germany","address":"212.102.227.25","port":8443,"sni":DOMAIN,"host":"","path":"","security":"tls","alpn":"http/1.1","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False},
]})
print("hosts saved")

# no flow for TLS TCP
users=api("GET","/api/users?limit=500")
items=users.get("users") if isinstance(users, dict) else users
for u in items or []:
    full=api("GET", f"/api/user/{u['username']}")
    vless=dict((full.get("proxies") or {}).get("vless") or {})
    vless.pop("flow", None)
    api("PUT", f"/api/user/{u['username']}", {
        "proxies": {"vless": vless},
        "inbounds": {"vless": [TAG]},
        "expire": full.get("expire"),
        "data_limit": full.get("data_limit"),
        "data_limit_reset_strategy": full.get("data_limit_reset_strategy") or "no_reset",
        "status": full.get("status") or "active",
        "note": full.get("note") or "",
        "on_hold_timeout": full.get("on_hold_timeout"),
        "on_hold_expire_duration": full.get("on_hold_expire_duration"),
    })
    print("user", u["username"], "flow cleared")
PY

# sync certs to DE + reconnect
DEPASS=$(cat /root/de-node.pass 2>/dev/null || echo 'vNGrzXaKqX96DrMb')
sshpass -p "$DEPASS" ssh -o StrictHostKeyChecking=no root@212.102.227.25 'mkdir -p /var/lib/marzban/certs' || true
sshpass -p "$DEPASS" scp -o StrictHostKeyChecking=no /var/lib/marzban-vpn/certs/fullchain.pem /var/lib/marzban-vpn/certs/privkey.pem root@212.102.227.25:/var/lib/marzban/certs/ || true
python3 - <<PY
import json, urllib.request
TOKEN="$TOK"
def api(method, path, body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(f"http://127.0.0.1:62050{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw=r.read().decode(); return json.loads(raw) if raw else {}
for n in api("GET","/api/nodes"):
    try:
        api("POST", f"/api/node/{n['id']}/reconnect")
        print("reconnect", n.get("name"))
    except Exception as e:
        print("reconnect err", e)
PY
sleep 6

UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-tls2-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"tls","tlsSettings":{"serverName":"$DOMAIN","allowInsecure":false,"fingerprint":"chrome","alpn":["http/1.1"]}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU "$DOMAIN" 18701
prove DE 212.102.227.25 18702
echo SERVER_DONE
