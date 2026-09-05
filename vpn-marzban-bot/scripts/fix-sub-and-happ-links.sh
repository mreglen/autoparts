#!/usr/bin/env bash
# Harden /sub/ on HTTPS + redeploy bot with happ://add + crypt4.
set -euo pipefail

REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot
SITE=/etc/nginx/sites-enabled/svoygarage

cd "$REPO"
sudo -u fast git pull --ff-only origin celery_update
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"
chown -R marzbanbot:marzbanbot "$BOT"

echo "==> harden nginx /sub/ (no inherited HTML-security headers)"
python3 - "$SITE" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
block = """
    # Marzban subscription for Happ (clean text/plain, no SPA security headers)
    location ^~ /sub/ {
        proxy_pass http://127.0.0.1:62050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
        # Defining add_header here prevents inheriting site HSTS/CSP/X-Frame from server{}
        add_header Cache-Control "no-store" always;
    }
"""
# replace existing /sub/ location if present
pat = re.compile(r"\n\s*# Marzban subscription.*?location \^~ /sub/ \{.*?\n\s*\}\n", re.S)
if pat.search(text):
    text = pat.sub("\n" + block + "\n", text)
    print("replaced existing /sub/ block")
elif "location ^~ /sub/" in text:
    # cruder replace from location to closing brace
    start = text.find("location ^~ /sub/")
    # walk back to comment if any
    line_start = text.rfind("\n", 0, start) + 1
    # find matching closing brace for location
    i = text.find("{", start)
    depth = 0
    end = None
    for j in range(i, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    if end is None:
        raise SystemExit("cannot find end of /sub/ location")
    text = text[:line_start] + block.lstrip("\n") + text[end:]
    print("replaced location ^~ /sub/")
else:
    needle = "server_name svoygarage.ru;"
    idx = text.find(needle)
    if idx < 0:
        raise SystemExit("server_name not found")
    insert_at = text.find("\n", idx) + 1
    text = text[:insert_at] + block + text[insert_at:]
    print("inserted /sub/")
path.write_text(text, encoding="utf-8")
PY

nginx -t
systemctl reload nginx

TOKEN=$(sudo -u postgres psql -d autoparts -tAc \
  "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]')

echo "==> verify HTTPS /sub/"
curl -sS -D /tmp/h.txt -o /tmp/b.bin -A "Happ/3.0" "https://svoygarage.ru/sub/${TOKEN}" >/dev/null
python3 - <<'PY'
from pathlib import Path
hdrs=Path('/tmp/h.txt').read_text()
body=Path('/tmp/b.bin').read_bytes()
assert '200' in hdrs.splitlines()[0]
assert 'text/plain' in hdrs.lower()
assert b'<html' not in body.lower()
assert len(body) > 50
# security headers should NOT be present after harden
for bad in ('strict-transport-security', 'x-frame-options', 'content-security-policy'):
    if bad in hdrs.lower():
        print('WARN still has', bad)
print('endpoint OK', 'len', len(body), 'ctype ok')
print('hdr_sample:')
print('\n'.join(hdrs.splitlines()[:12]))
PY

echo "==> refresh crypt4 in DB"
cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_happ_crypt4, generate_happ_add_link, is_real_happ_crypto_link

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
HTTPS='https://svoygarage.ru'

def to_https(url):
    m=re.search(r'/sub/([^?\s#]+)', url or '')
    return f"{HTTPS}/sub/{m.group(1)}" if m else url

async def main():
    db=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')
    conn=await asyncpg.connect(db)
    rows=await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users')
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
        tok=(await c.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        h={'Authorization':f'Bearer {tok}'}
        for r in rows:
            resp=await c.get(f"{BASE}/api/user/{r['marzban_username']}", headers=h)
            api=(resp.json().get('subscription_url') if resp.status_code==200 else None) or r['subscription_url']
            sub=to_https(api)
            probe=await c.get(sub, headers={'User-Agent':'Happ/3.0'})
            assert probe.status_code==200 and 'text/plain' in probe.headers.get('content-type','')
            crypt=generate_happ_crypt4(sub)
            assert is_real_happ_crypto_link(crypt)
            await conn.execute(
                'update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true, verify_note=$3, last_verified_at=$4 where telegram_id=$5',
                sub, crypt, 'crypt4_json+add', datetime.now(timezone.utc), r['telegram_id'])
            print('sub', sub)
            print('add', generate_happ_add_link(sub))
            print('crypt4', crypt)
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot
echo SUB_AND_HAPP_OK
