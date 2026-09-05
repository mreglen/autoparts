#!/bin/bash
# Switch Marzban inbound 8443 to plain VLESS TCP (no Reality/TLS/flow).
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TAG="VLESS TCP REALITY"   # keep tag so existing users stay mapped
BOT=/opt/marzban-vpn-bot

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request, urllib.error
TOKEN="$TOK"
TAG="$TAG"

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
        print("HTTP", e.code, e.read().decode()[:500])
        raise

cfg=api("GET","/api/core/config")
found=False
for ib in cfg.get("inbounds") or []:
    if ib.get("port")==8443 or ib.get("tag")==TAG:
        found=True
        ib["tag"]=TAG
        ib["listen"]="0.0.0.0"
        ib["port"]=8443
        ib["protocol"]="vless"
        ib["settings"]={"clients":[], "decryption":"none"}
        ib["streamSettings"]={
            "network":"tcp",
            "security":"none",
            "tcpSettings":{"header":{"type":"none"}},
        }
        # drop reality
        ib.pop("sniffing", None)
        ib["sniffing"]={"enabled": True, "destOverride": ["http","tls","quic"]}
        print("patched inbound", ib.get("tag"), "port", ib.get("port"))
if not found:
    cfg.setdefault("inbounds", []).append({
        "tag": TAG,
        "listen": "0.0.0.0",
        "port": 8443,
        "protocol": "vless",
        "settings": {"clients": [], "decryption": "none"},
        "streamSettings": {
            "network": "tcp",
            "security": "none",
            "tcpSettings": {"header": {"type": "none"}},
        },
        "sniffing": {"enabled": True, "destOverride": ["http","tls","quic"]},
    })
    print("added inbound")

# ensure freedom outbound exists
outs=cfg.get("outbounds") or []
if not any((o.get("protocol")=="freedom") for o in outs):
    outs.append({"protocol":"freedom","tag":"direct"})
    cfg["outbounds"]=outs

api("PUT","/api/core/config", cfg)
print("core saved")

# hosts: plain, no sni/pbk
hosts=api("GET","/api/hosts")
new={}
for tag, arr in (hosts or {}).items():
    if tag != TAG and "REALITY" not in tag.upper() and tag != "VLESS-PLAIN":
        new[tag]=arr
        continue
    out=[]
    for h in arr or []:
        h=dict(h)
        addr=h.get("address") or ""
        h["sni"]=""
        h["host"]=""
        h["path"]=""
        h["alpn"]=""
        h["fingerprint"]=""
        h["security"]="none"
        h["allowinsecure"]=False
        h["port"]=8443
        if "212.102" in addr:
            h["remark"]="Germany"
        elif "195.24" in addr:
            h["remark"]="Russia"
        out.append(h)
        print("host", addr, h.get("remark"))
    new[TAG]=out
# ensure both hosts exist
have_ru=any(h.get("address")=="195.24.65.251" for h in new.get(TAG) or [])
have_de=any(h.get("address")=="212.102.227.25" for h in new.get(TAG) or [])
new.setdefault(TAG, [])
if not have_ru:
    new[TAG].append({"remark":"Russia","address":"195.24.65.251","port":8443,"sni":"","host":"","path":"","security":"none","alpn":"","fingerprint":"","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False})
if not have_de:
    new[TAG].append({"remark":"Germany","address":"212.102.227.25","port":8443,"sni":"","host":"","path":"","security":"none","alpn":"","fingerprint":"","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False})
api("PUT","/api/hosts", new)
print("hosts saved")

# strip flow from ALL users; keep UUID
users=api("GET","/api/users?limit=500")
items=users.get("users") if isinstance(users, dict) else users
for u in items or []:
    uname=u.get("username")
    full=api("GET", f"/api/user/{uname}")
    proxies=full.get("proxies") or {}
    vless=dict(proxies.get("vless") or {})
    # keep id if present; remove flow
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
    print("user", uname, "uuid", vless.get("id"), "flow_cleared")
print("users updated")
PY

sleep 4
# Prove plain VLESS
UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
echo "UUID=$UUID"
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-plain-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"none"}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU 195.24.65.251 18201
prove DE 212.102.227.25 18202

# show user links
curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;u=json.load(sys.stdin);
print("status",u.get("status"),"proxies",u.get("proxies"));
[print("LINK",x) for x in (u.get("links") or [])]'
