#!/bin/bash
# Finish: deploy bot files from /tmp and refresh all Happ keys.
set -euo pipefail
BOT=/opt/marzban-vpn-bot

for f in happ_crypto.py handlers.py sub_proxy.py services.py tasks.py marzban_api.py utils.py; do
  if [[ -f "/tmp/$f" ]]; then
    cp "/tmp/$f" "$BOT/$f"
    echo "deployed $f"
  fi
done

systemctl restart marzban-sub-proxy marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat
sleep 2
systemctl is-active marzban-sub-proxy marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat

cd "$BOT"
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
        rows=await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users')
        for r in rows:
            resp=await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})
            payload=resp.json()
            links=[x for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            cleaned=build_simple_vless_links(links)
            assert cleaned, f"no links for {r['marzban_username']}"
            for c in cleaned:
                assert 'sid=' in c and 'sid=&' not in c
                assert 'pbk=Rlb-IPbM75c8dIoOHRI3ptprWuMgmJig2f8X-2y0RRI' in c
                assert 'headerType=' not in c
            sub=to_https(payload.get('subscription_url') or r['subscription_url'] or '')
            add=build_happ_add_link(sub)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, add, 'happ_add_https', datetime.now(timezone.utc), r['telegram_id'])
            print(r['telegram_id'], add)
            for c in cleaned:
                print(' ', c[:120])
        await conn.close()
asyncio.run(main())
PY

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -o /tmp/subF.bin -A 'Happ/3.5.0' "https://svoygarage.ru/sub/${TOKEN}"
python3 - <<'PY'
import base64, pathlib
raw=pathlib.Path('/tmp/subF.bin').read_bytes()
try:
    dec=base64.b64decode(raw).decode()
except Exception:
    dec=raw.decode()
print(dec)
assert '65ebe0daaa020cb2' in dec
assert 'Rlb-IPbM75c8dIoOHRI3ptprWuMgmJig2f8X-2y0RRI' in dec
assert 'encryption=none' in dec
assert 'Russia' in dec and 'Germany' in dec
print('SUB_OK')
PY

# Quick VPN prove
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
UUID=$(curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
PBK=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
IMG=$(cd /opt/marzban-vpn && docker compose images -q marzban | head -1)
CFG=/tmp/prove-final.json
cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":18091,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"195.24.65.251","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"www.apple.com","fingerprint":"chrome","publicKey":"$PBK","shortId":"$SID"}}}]}
JSON
CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
sleep 2
CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:18091" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
docker stop "$CID" >/dev/null 2>&1 || true
echo "PROVE_RU_HTTP=$CODE"
[[ "$CODE" == "204" ]]
echo DONE
