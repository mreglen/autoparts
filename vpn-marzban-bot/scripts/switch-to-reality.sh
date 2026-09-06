#!/bin/bash
# Switch Marzban :8443 from TLS to VLESS + REALITY (SNI dl.google.com).
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TAG="VLESS TCP REALITY"
SNI=dl.google.com
DEST="${SNI}:443"
BOT=/opt/marzban-vpn-bot
cd /opt/marzban-vpn

# --- Step 1: generate keys ---
IMG=$(docker compose images -q marzban | head -1)
KEYS=$(docker run --rm "$IMG" xray x25519)
PRIV=$(echo "$KEYS" | awk -F': ' '/Private/{print $2}' | tr -d '\r')
PUB=$(echo "$KEYS" | awk -F': ' '/Public/{print $2}' | tr -d '\r')
# newer xray may print "Password" as public
if [[ -z "$PUB" ]]; then
  PUB=$(echo "$KEYS" | awk -F': ' '/Password/{print $2}' | tr -d '\r')
fi
SID=$(openssl rand -hex 8)
echo "$PRIV" >/root/marzban-vpn-reality-private.key
echo "$PUB" >/root/marzban-vpn-reality-public.key
echo "$SID" >/root/marzban-vpn-reality-shortid.txt
chmod 600 /root/marzban-vpn-reality-*.key
echo "PRIV=${PRIV:0:12}..."
echo "PUB=$PUB"
echo "SID=$SID"
echo "$KEYS"

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request, urllib.error
TOKEN="$TOK"
TAG="$TAG"
PRIV="$PRIV"
SID="$SID"
SNI="$SNI"
DEST="$DEST"

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
            "security":"reality",
            "realitySettings":{
                "show": False,
                "dest": DEST,
                "xver": 0,
                "serverNames": [SNI, "google.com"],
                "privateKey": PRIV,
                "shortIds": [SID],
            },
            "tcpSettings":{"header":{"type":"none"}},
        }
        ib["sniffing"]={"enabled": True, "destOverride": ["http","tls","quic"]}
        print("patched REALITY inbound", TAG, "dest", DEST, "sid", SID)
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
        # Reality: use IPs (not domain cert)
        if addr in ("svoygarage.ru", "195.24.65.251") or "Russia" in (h.get("remark") or ""):
            h["address"]="195.24.65.251"
            h["remark"]="🇷🇺 Russia"
        elif "212.102" in addr or "Germany" in (h.get("remark") or ""):
            h["address"]="212.102.227.25"
            h["remark"]="🇩🇪 Germany"
        h["sni"]=SNI
        h["host"]=""
        h["path"]=""
        h["alpn"]=""
        h["fingerprint"]="chrome"
        # Marzban hosts API: only inbound_default|none|tls
        h["security"]="inbound_default"
        h["port"]=8443
        out.append(h)
        print("host", h["address"], h["remark"])
    # ensure both
    addrs={h.get("address") for h in out}
    if "195.24.65.251" not in addrs:
        out.append({"remark":"🇷🇺 Russia","address":"195.24.65.251","port":8443,"sni":SNI,"host":"","path":"","security":"reality","alpn":"","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False})
    if "212.102.227.25" not in addrs:
        out.append({"remark":"🇩🇪 Germany","address":"212.102.227.25","port":8443,"sni":SNI,"host":"","path":"","security":"reality","alpn":"","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False})
    new[TAG]=out
api("PUT","/api/hosts", new)
print("hosts saved")

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
    print("user", uname, "flow=vision", "uuid", vless.get("id"))
PY

# Sync private key path note for node — Marzban pushes config; wait for node
sleep 5

UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
echo "UUID=$UUID"

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

# Write keys for bot deploy
cat >/tmp/reality_keys.env <<EOF
DEFAULT_REALITY_PBK=$PUB
DEFAULT_REALITY_SID=$SID
DEFAULT_REALITY_SNI=$SNI
EOF
echo KEYS_WRITTEN
