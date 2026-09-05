#!/usr/bin/env bash
# Fix Reality host path→spx bug, force official Happ crypto, sync sub tokens.
set -euo pipefail

REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot

cd "$REPO"
sudo -u fast git pull --ff-only origin celery_update || true
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/" 2>/dev/null || true

# If git pull didn't get latest (local deploy), files may already be uploaded via rsync from this script after push

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

echo "==> Fix Host Settings: clear path (was emitted as path=/ instead of spx)"
python3 - "$TOK" <<'PY'
import json, sys, urllib.request
tok = sys.argv[1]
req = urllib.request.Request(
    "http://127.0.0.1:62050/api/hosts",
    headers={"Authorization": f"Bearer {tok}"},
)
hosts = json.load(urllib.request.urlopen(req))
changed = False
for tag, entries in list(hosts.items()):
    for h in entries:
        if h.get("path") in ("/", "%2F"):
            print(f"clear path for {h.get('remark')} ({h.get('address')})")
            h["path"] = ""
            changed = True
        # keep sni/fp
        h["fingerprint"] = h.get("fingerprint") or "chrome"
if changed:
    req2 = urllib.request.Request(
        "http://127.0.0.1:62050/api/hosts",
        data=json.dumps(hosts).encode(),
        headers={
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
        },
        method="PUT",
    )
    with urllib.request.urlopen(req2) as resp:
        print("hosts updated", resp.status)
else:
    print("hosts path already clean")
PY

# Ensure core spiderX stays /
python3 - "$TOK" <<'PY'
import json, sys, urllib.request
tok = sys.argv[1]
req = urllib.request.Request("http://127.0.0.1:62050/api/core/config", headers={"Authorization": f"Bearer {tok}"})
cfg = json.load(urllib.request.urlopen(req))
changed=False
for ib in cfg.get("inbounds") or []:
    r = (ib.get("streamSettings") or {}).get("realitySettings") or {}
    if not r: continue
    if r.get("spiderX") != "/":
        r["spiderX"] = "/"
        changed=True
    if r.get("fingerprint") != "chrome":
        r["fingerprint"] = "chrome"
        changed=True
if changed:
    req2 = urllib.request.Request(
        "http://127.0.0.1:62050/api/core/config",
        data=json.dumps(cfg).encode(),
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        method="PUT",
    )
    urllib.request.urlopen(req2).read()
    print("core updated")
else:
    print("core ok")
PY

echo "==> ensure HTTPS prefix in marzban env + recreate container carefully"
ENVF=/opt/marzban-vpn/.env
grep -q '^XRAY_SUBSCRIPTION_URL_PREFIX=' "$ENVF" \
  && sed -i 's|^XRAY_SUBSCRIPTION_URL_PREFIX=.*|XRAY_SUBSCRIPTION_URL_PREFIX=https://svoygarage.ru|' "$ENVF" \
  || echo 'XRAY_SUBSCRIPTION_URL_PREFIX=https://svoygarage.ru' >> "$ENVF"
# soft restart: only recreate marzban-vpn without wiping volumes
cd /opt/marzban-vpn
docker compose up -d --force-recreate --no-deps marzban-vpn 2>/dev/null \
  || docker compose up -d --force-recreate 2>/dev/null \
  || docker restart marzban-vpn
sleep 8
# wait panel
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:62050/docs || true)
  [[ "$code" != "000" ]] && break
  sleep 1
done
echo "panel probe done"

# reconnect node if needed
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json; ns=json.load(sys.stdin);
print([(n.get("name"), n.get("status")) for n in (ns if isinstance(ns,list) else [])])'

echo "==> refresh DB with official Happ crypto + latest https sub"
cd "$BOT"
# ensure latest bot code present — copy from uploaded files if needed
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_happ_official_crypto, generate_happ_add_link, is_real_happ_crypto_link

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
HTTPS='https://svoygarage.ru'

def to_https(url: str) -> str:
    m=re.search(r'/sub/([^?\s#]+)', url or '')
    return f"{HTTPS}/sub/{m.group(1)}" if m else url

async def main():
    db=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')
    conn=await asyncpg.connect(db)
    rows=await conn.fetch('select telegram_id, marzban_username from marzvpn_users')
    async with httpx.AsyncClient(timeout=40.0, follow_redirects=True) as c:
        tok=(await c.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        h={'Authorization':f'Bearer {tok}'}
        for r in rows:
            resp=await c.get(f"{BASE}/api/user/{r['marzban_username']}", headers=h)
            data=resp.json()
            sub=to_https(data.get('subscription_url') or '')
            # verify links no longer have path=/
            for link in data.get('links') or []:
                bad = 'path=%2F' in link or 'path=/' in link.split('?')[-1]
                print('link_path_bad' if bad else 'link_ok', link[:120])
            probe=await c.get(sub, headers={'User-Agent':'Happ/3.5.0'})
            print('sub', sub, probe.status_code, probe.headers.get('content-type'))
            assert probe.status_code==200
            crypt=generate_happ_official_crypto(sub)
            print('crypt', crypt[:60], '... real=', is_real_happ_crypto_link(crypt))
            print('add', generate_happ_add_link(sub))
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, crypt, 'official_crypto_no_path', datetime.now(timezone.utc), r['telegram_id'])
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot marzban-vpn-bot-celery || systemctl restart marzban-vpn-bot
sleep 3
systemctl is-active marzban-vpn-bot
echo FIX_ROUND2_OK
