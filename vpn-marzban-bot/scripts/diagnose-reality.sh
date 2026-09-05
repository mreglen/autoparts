#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer ${TOK}"

echo "=== NODES ==="
curl -s -H "$AUTH" http://127.0.0.1:62050/api/nodes | python3 -m json.tool | head -80

echo "=== HOSTS ==="
curl -s -H "$AUTH" http://127.0.0.1:62050/api/hosts | python3 -m json.tool | head -200

echo "=== CORE CONFIG (reality bits) ==="
curl -s -H "$AUTH" http://127.0.0.1:62050/api/core/config | python3 - <<'PY'
import sys, json
cfg = json.load(sys.stdin)
inbounds = cfg.get("inbounds") or []
for ib in inbounds:
    stream = ib.get("streamSettings") or {}
    reality = stream.get("realitySettings") or {}
    print("--- inbound", ib.get("tag"), "port", ib.get("port"), "protocol", ib.get("protocol"))
    print("network", stream.get("network"), "security", stream.get("security"))
    print("dest", reality.get("dest"))
    print("serverNames", reality.get("serverNames"))
    print("shortIds", reality.get("shortIds"))
    print("publicKey", (reality.get("publicKey") or "")[:40], "...")
    print("fingerprint", (stream.get("tlsSettings") or reality.get("fingerprint")))
    rs = reality
    for k in ("show","xver","spiderX","fingerprint"):
        if k in rs:
            print(k, rs.get(k))
PY

echo "=== SAMPLE USER LINKS ==="
# latest bot user
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users order by created_at desc limit 1" 2>/dev/null || true)
if [[ -z "$USER" ]]; then
  USER=$(curl -s -H "$AUTH" "http://127.0.0.1:62050/api/users?limit=1" | python3 -c 'import sys,json; d=json.load(sys.stdin); u=(d.get("users") or [None])[0]; print(u["username"] if u else "")')
fi
echo "user=$USER"
if [[ -n "$USER" ]]; then
  curl -s -H "$AUTH" "http://127.0.0.1:62050/api/user/${USER}" | python3 - <<'PY'
import sys, json, base64, urllib.parse
u = json.load(sys.stdin)
print("status", u.get("status"), "expire", u.get("expire"))
print("subscription_url", u.get("subscription_url"))
for link in (u.get("links") or []):
    print("LINK:", link[:180], "...")
    if link.startswith("vless://"):
        # parse query
        q = link.split("?",1)[-1].split("#",1)[0]
        params = urllib.parse.parse_qs(q)
        for k in ("security","type","flow","fp","pbk","sid","sni","spx","pqv"):
            if k in params:
                print(f"  {k}={params[k][0]}")
        hostpart = link.split("@",1)[-1].split("?",1)[0]
        print("  address:port", hostpart)
print("--- fetch sub ---")
sub = u.get("subscription_url","").replace(":62050",":2086")
import urllib.request
try:
    body = urllib.request.urlopen(sub, timeout=10).read()
    print("sub bytes", len(body))
    try:
        text = body.decode()
    except Exception:
        text = base64.b64decode(body).decode(errors="replace")
        print("was base64")
    # maybe still base64 line
    try:
        if not text.startswith("vless://"):
            text2 = base64.b64decode(text.strip()).decode()
            if "vless://" in text2:
                text = text2
                print("decoded nested b64")
    except Exception:
        pass
    for line in text.splitlines()[:5]:
        print("SUBLINE", line[:200])
except Exception as e:
    print("sub fetch err", e)
PY
fi

echo "=== ENV / FILES ==="
grep -E 'XRAY_|SUBSCRIPTION|SUDO' /opt/marzban-vpn/.env 2>/dev/null || true
ls /root/marzban-vpn-reality* 2>/dev/null || true
cat /root/marzban-vpn-reality-public.key 2>/dev/null | head -c 80; echo
cat /root/marzban-vpn-reality-shortid.txt 2>/dev/null; echo
