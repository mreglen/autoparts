#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TAG="VLESS TCP REALITY"
SNI=dl.google.com
PUB=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
PRIV=$(tr -d '\r\n' </root/marzban-vpn-reality-private.key)
echo "PUB=$PUB SID=$SID"

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request, urllib.error
TOKEN="$TOK"
TAG="$TAG"
SNI="$SNI"

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

# verify core still reality
cfg=api("GET","/api/core/config")
for ib in cfg.get("inbounds") or []:
    if ib.get("port")==8443:
        ss=ib.get("streamSettings") or {}
        print("security", ss.get("security"), "dest", (ss.get("realitySettings") or {}).get("dest"))

hosts={
  TAG: [
    {"remark":"Russia","address":"195.24.65.251","port":8443,"sni":SNI,"host":"","path":"","security":"inbound_default","alpn":"","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False},
    {"remark":"Germany","address":"212.102.227.25","port":8443,"sni":SNI,"host":"","path":"","security":"inbound_default","alpn":"","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False},
  ]
}
api("PUT","/api/hosts", hosts)
print("hosts ok")

users=api("GET","/api/users?limit=500")
items=users.get("users") if isinstance(users, dict) else users
for u in items or []:
    uname=u.get("username")
    full=api("GET", f"/api/user/{uname}")
    vless=dict((full.get("proxies") or {}).get("vless") or {})
    vless["flow"]="xtls-rprx-vision"
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
    print("user", uname, vless.get("id"))
PY

sleep 4
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-reality-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"$SNI","fingerprint":"chrome","publicKey":"$PUB","shortId":"$SID"}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU 195.24.65.251 18401
prove DE 212.102.227.25 18402

curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;u=json.load(sys.stdin);print(u.get("proxies"));
[print(x) for x in (u.get("links") or [])]'
