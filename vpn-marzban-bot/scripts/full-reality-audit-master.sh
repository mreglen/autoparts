#!/bin/bash
# Full Reality/Marzban audit on master (195.24.65.251)
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
PBK_FILE=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key 2>/dev/null || true)
SID_FILE=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt 2>/dev/null || true)
PRIV_FILE=$(tr -d '\r\n' </root/marzban-vpn-reality-private.key 2>/dev/null || true)

echo "========== MASTER AUDIT $(date -Is) =========="
echo "=== file keys ==="
echo "pbk_file=$PBK_FILE"
echo "sid_file=$SID_FILE"
echo "priv_len=${#PRIV_FILE}"

echo "=== xray_config reality blocks ==="
CFG=/var/lib/marzban-vpn/xray_config.json
[[ -f "$CFG" ]] || CFG=/var/lib/marzban/xray_config.json
python3 - <<PY
import json
from pathlib import Path
p=Path("$CFG")
print("cfg", p)
c=json.loads(p.read_text())
for ib in c.get("inbounds",[]):
    if ib.get("protocol")!="vless":
        continue
    ss=ib.get("streamSettings") or {}
    rs=ss.get("realitySettings") or {}
    if not rs: continue
    print("--- inbound", ib.get("tag"), "port", ib.get("port"))
    print("  privateKey", (rs.get("privateKey") or "")[:16]+"...")
    print("  shortIds", rs.get("shortIds"))
    print("  serverNames", rs.get("serverNames"))
    print("  dest", rs.get("dest"))
    print("  clients", len((ib.get("settings") or {}).get("clients") or []))
    ids=[cl.get("id") for cl in (ib.get("settings") or {}).get("clients") or []]
    print("  has_uuid", "ccc7e71d-743a-499a-b5b7-f1a484368b7d" in ids)
PY

echo "=== marzban API user ==="
TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -sS -H "Authorization: Bearer $TOK" \
  http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 - <<'PY'
import sys,json
u=json.load(sys.stdin)
print("status", u.get("status"))
print("expire", u.get("expire"))
print("used", u.get("used_traffic"), "limit", u.get("data_limit"))
print("online", u.get("online_at"))
print("uuid", (u.get("proxies") or {}).get("vless",{}).get("id"))
print("flow", (u.get("proxies") or {}).get("vless",{}).get("flow"))
print("inbounds", u.get("inbounds"))
print("sub", u.get("subscription_url"))
for L in (u.get("links") or [])[:6]:
    print("LINK", L)
PY

echo "=== core config reality (API) ==="
curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 - <<'PY'
import sys,json
c=json.load(sys.stdin)
for ib in c.get("inbounds",[]):
    ss=ib.get("streamSettings") or {}
    rs=ss.get("realitySettings") or {}
    if not rs: continue
    print(ib.get("tag"), "port", ib.get("port"))
    print("  privateKey", (rs.get("privateKey") or "")[:20]+"...")
    print("  shortIds", rs.get("shortIds"))
    print("  serverNames", rs.get("serverNames"))
    print("  dest", rs.get("dest"))
PY

echo "=== recent marzban/xray logs ==="
cd /opt/marzban-vpn
docker compose logs --tail=120 marzban 2>/dev/null | grep -iE 'reality|rejected|invalid|failed|certificate|handshak|user' | tail -40 || true
docker ps --format '{{.Names}}' | head

echo "=== listen 8443 ==="
ss -lntp | grep -E ':8443|:2053' || true

echo "=== public sub decode ==="
SUB=$(sudo -u postgres psql -d autoparts -tAc "select subscription_url from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "db_sub=$SUB"
BODY=$(curl -sS -m 15 -A 'Happ/3' "$SUB")
python3 - <<PY
import base64,sys
t='''$BODY'''.strip()
try: d=base64.b64decode(t).decode()
except Exception: d=t
print(d)
PY
