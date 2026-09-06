#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TAG="VLESS TCP REALITY"
DOMAIN=svoygarage.ru
TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request
TOKEN="$TOK"
TAG="$TAG"
DOMAIN="$DOMAIN"

def api(method, path, body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(
        f"http://127.0.0.1:62050{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        raw=r.read().decode()
        return json.loads(raw) if raw else {}

api("PUT", "/api/hosts", {TAG: [
    {
        "remark": "Russia",
        "address": "195.24.65.251",
        "port": 8443,
        "sni": DOMAIN,
        "host": "",
        "path": "",
        "security": "tls",
        "alpn": "http/1.1",
        "fingerprint": "chrome",
        "allowinsecure": False,
        "is_disabled": False,
        "mux_enable": False,
        "fragment_setting": "",
        "noise_setting": "",
        "random_user_agent": False,
        "use_sni_as_host": False,
    },
    {
        "remark": "Germany",
        "address": "212.102.227.25",
        "port": 8443,
        "sni": DOMAIN,
        "host": "",
        "path": "",
        "security": "tls",
        "alpn": "http/1.1",
        "fingerprint": "chrome",
        "allowinsecure": False,
        "is_disabled": False,
        "mux_enable": False,
        "fragment_setting": "",
        "noise_setting": "",
        "random_user_agent": False,
        "use_sni_as_host": False,
    },
]})
print("hosts updated")
u = api("GET", "/api/user/tg_768651771_efbc54")
for L in u.get("links") or []:
    print("LINK", L)
PY

# Deploy happ_crypto if present
[[ -f /tmp/happ_crypto.py ]] && cp /tmp/happ_crypto.py /opt/marzban-vpn-bot/happ_crypto.py

cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import build_happ_add_link, build_simple_vless_links

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
            links=[x.replace('@svoygarage.ru:', '@195.24.65.251:') for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            cleaned=build_simple_vless_links(links)
            assert cleaned
            assert all('195.24.65.251' in c or '212.102.227.25' in c for c in cleaned)
            assert all('svoygarage.ru:8443' not in c for c in cleaned)
            sub=to_https(payload.get('subscription_url') or r['subscription_url'] or '')
            add=build_happ_add_link(sub)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, add, 'happ_add_tls_ip', datetime.now(timezone.utc), r['telegram_id'])
            print(r['telegram_id'], add)
            for c in cleaned:
                print(' ', c)
        await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-sub-proxy
sleep 1
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -A Happ/3 "https://svoygarage.ru/sub/$TOKEN" | python3 -c 'import sys,base64;print(base64.b64decode(sys.stdin.read().strip()).decode())'

UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
CFG=/tmp/prove-ruip3.json
cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":18751,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"195.24.65.251","port":8443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"tls","tlsSettings":{"serverName":"svoygarage.ru","fingerprint":"chrome","alpn":["http/1.1"]}}}]}
JSON
CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
sleep 2
CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:18751" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
echo "PROVE_RU=$CODE"
docker stop "$CID" >/dev/null 2>&1 || true
echo "KEY=$(sudo -u postgres psql -d autoparts -tAc "select crypt4_link from marzvpn_users where telegram_id=768651771")"
