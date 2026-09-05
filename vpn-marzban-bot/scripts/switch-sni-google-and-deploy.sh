#!/bin/bash
# Switch Reality SNI/dest to dl.google.com, update hosts, deploy bot, prove.
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
PBK=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
SNI=dl.google.com
BOT=/opt/marzban-vpn-bot

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request
TOKEN="$TOK"
SNI="$SNI"

def api(method, path, body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(
        f"http://127.0.0.1:62050{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())

cfg=api("GET","/api/core/config")
changed=False
for ib in cfg.get("inbounds") or []:
    ss=ib.get("streamSettings") or {}
    rs=ss.get("realitySettings") or {}
    if not rs: continue
    rs["dest"]=f"{SNI}:443"
    rs["serverNames"]=[SNI, "google.com"]
    # keep existing shortIds / privateKey
    if not rs.get("shortIds"):
        rs["shortIds"]=["$SID"]
    ss["realitySettings"]=rs
    ib["streamSettings"]=ss
    changed=True
    print("inbound", ib.get("tag"), "->", rs["dest"], rs["serverNames"])
if changed:
    api("PUT","/api/core/config", cfg)
    print("core updated")

hosts=api("GET","/api/hosts")
# hosts is dict tag -> list
new_hosts={}
for tag, arr in (hosts or {}).items():
    out=[]
    for h in arr or []:
        h=dict(h)
        if "REALITY" in tag.upper() or (h.get("security") or "").lower()=="reality":
            h["sni"]=SNI
            addr=h.get("address") or ""
            if "212.102" in addr:
                h["remark"]="Germany_VLESS_Reality"
            elif "195.24" in addr:
                h["remark"]="Russia_VLESS_Reality"
            print("host", tag, addr, "sni", h["sni"], "remark", h.get("remark"))
        out.append(h)
    new_hosts[tag]=out
api("PUT","/api/hosts", new_hosts)
print("hosts updated")
PY

# Deploy bot files from /tmp
for f in happ_crypto.py handlers.py sub_proxy.py services.py tasks.py marzban_api.py utils.py; do
  [[ -f /tmp/$f ]] && cp /tmp/$f "$BOT/$f" && echo deployed $f
done
chown -R marzbanbot:marzbanbot "$BOT"
systemctl restart marzban-sub-proxy marzban-vpn-bot marzban-vpn-bot-celery
sleep 2
systemctl is-active marzban-sub-proxy marzban-vpn-bot

# Refresh DB keys
cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import build_happ_add_link, build_simple_vless_links, DEFAULT_REALITY_SNI, DEFAULT_REALITY_PBK, DEFAULT_REALITY_SID

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
DSN=os.getenv('DATABASE_URL','').replace('postgresql+asyncpg://','postgresql://')

def to_https(u):
    u=(u or '').strip()
    return (u.replace('://195.24.65.251:2086','://svoygarage.ru')
             .replace('://195.24.65.251:62050','://svoygarage.ru')
             .replace('http://svoygarage.ru','https://svoygarage.ru'))

async def main():
    async with httpx.AsyncClient(timeout=20) as client:
        tok=(await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        conn=await asyncpg.connect(DSN)
        for r in await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users'):
            payload=(await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})).json()
            links=[x for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            cleaned=build_simple_vless_links(links)
            assert cleaned
            for c in cleaned:
                assert f'sni={DEFAULT_REALITY_SNI}' in c
                assert f'pbk={DEFAULT_REALITY_PBK}' in c
                assert f'sid={DEFAULT_REALITY_SID}' in c
                assert 'encryption=none' in c
            sub=to_https(payload.get('subscription_url') or r['subscription_url'] or '')
            add=build_happ_add_link(sub)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, add, 'happ_add_https_sni_google', datetime.now(timezone.utc), r['telegram_id'])
            print(r['telegram_id'], add)
            print(' ', cleaned[0][:140])
        await conn.close()
asyncio.run(main())
PY

sleep 3
# Prove with new SNI
UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-sni-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"$SNI","fingerprint":"chrome","publicKey":"$PBK","shortId":"$SID"}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU 195.24.65.251 18101
prove DE 212.102.227.25 18102

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -A Happ/3 "https://svoygarage.ru/sub/$TOKEN" | python3 -c 'import sys,base64;t=sys.stdin.read().strip();
try:d=base64.b64decode(t).decode()
except Exception:d=t
print(d)
assert "dl.google.com" in d and "encryption=none" in d and "65ebe0daaa020cb2" in d
print("SUB_OK")'
echo DONE
