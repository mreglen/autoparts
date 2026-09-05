#!/usr/bin/env bash
# Master: nginx /sub/ + Reality SNI/hosts + soft crypt4 bot deploy
set -euo pipefail

SITE_AVAIL=/etc/nginx/sites-available/svoygarage
MARZ_PORT=62050
REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot
SNI_PRIMARY="www.microsoft.com"
SNI_ALT="apple.com"

echo "========== 1) NGINX /sub/ =========="
cp -a "$SITE_AVAIL" "/root/svoygarage.nginx.bak.$(date +%Y%m%d_%H%M%S)"

python3 - "$SITE_AVAIL" "$MARZ_PORT" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
port = sys.argv[2]
text = path.read_text(encoding="utf-8")

sub_block = f"""
    # === Marzban Happ subscriptions (fast proxy, no SPA) ===
    location /sub/ {{
        proxy_pass http://127.0.0.1:{port}/sub/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        add_header Cache-Control "no-store" always;
    }}
"""

# drop old /sub/ blocks (+ comment lines)
text2 = re.sub(
    r"(?m)^[ \t]*#(?:[^\n]*Marzban[^\n]*|[^\n]*subscription[^\n]*|[^\n]*Happ[^\n]*)\n(?:[ \t]*#[^\n]*\n)*"
    r"[ \t]*location\s+\^~\s+/sub/\s*\{.*?\n[ \t]*\}\n?",
    "",
    text,
    flags=re.S,
)
text2 = re.sub(r"(?m)^[ \t]*location\s+\^~\s+/sub/\s*\{.*?\n[ \t]*\}\n?", "", text2, flags=re.S)
text2 = re.sub(r"(?m)^[ \t]*location\s+/sub/\s*\{.*?\n[ \t]*\}\n?", "", text2, flags=re.S)

parts = []
inserted = 0
for m in re.finditer(r"(?m)^server\s*\{", text2):
    start = m.start()
    depth = 0
    end = None
    for j in range(m.end() - 1, len(text2)):
        ch = text2[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    if end is None:
        continue
    block = text2[start:end]
    if not re.search(r"listen\s+[^;]*443", block):
        continue
    sm = re.search(r"(?m)^([ \t]*server_name[^\n]*;\n)", block)
    if not sm:
        sm = re.search(r"(?m)^([ \t]*listen[^\n]*443[^\n]*;\n)", block)
    if not sm:
        continue
    new_block = block[: sm.end()] + sub_block + block[sm.end():]
    parts.append((start, end, new_block))
    inserted += 1

out = []
last = 0
for start, end, nb in parts:
    out.append(text2[last:start])
    out.append(nb)
    last = end
out.append(text2[last:])
path.write_text("".join(out), encoding="utf-8")
print(f"inserted /sub/ into {inserted} SSL server blocks → 127.0.0.1:{port}")
PY

nginx -t
systemctl reload nginx
echo "nginx reloaded"

echo "========== 2) Reality SNI + Hosts public IPs =========="
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - "$TOK" "$SNI_PRIMARY" "$SNI_ALT" <<'PY'
import json, sys, urllib.request

tok, sni_primary, sni_alt = sys.argv[1], sys.argv[2], sys.argv[3]

def api(method, path, data=None):
    req = urllib.request.Request(
        f"http://127.0.0.1:62050{path}",
        data=None if data is None else json.dumps(data).encode(),
        headers={
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)

cfg = api("GET", "/api/core/config")
changed = False
for ib in cfg.get("inbounds") or []:
    ss = ib.get("streamSettings") or {}
    r = ss.get("realitySettings")
    if not r:
        continue
    # dest + serverNames: microsoft (primary), apple as alt
    want_dest = f"{sni_primary}:443"
    want_names = [sni_primary, sni_alt]
    if r.get("dest") != want_dest:
        print("dest", r.get("dest"), "→", want_dest)
        r["dest"] = want_dest
        changed = True
    if r.get("serverNames") != want_names:
        print("serverNames", r.get("serverNames"), "→", want_names)
        r["serverNames"] = want_names
        changed = True
    if r.get("fingerprint") != "chrome":
        r["fingerprint"] = "chrome"
        changed = True
    if r.get("spiderX") not in ("/", ""):
        # keep /
        r["spiderX"] = "/"
        changed = True
if changed:
    api("PUT", "/api/core/config", cfg)
    print("core Reality updated")
else:
    print("core Reality already OK")

hosts = api("GET", "/api/hosts")
# Map remarks → public IPv4
# 🇷🇺 master 195.24.65.251, 🇩🇪 node 212.102.227.25
ADDR_MAP = {
    "🇷🇺": "195.24.65.251",
    "Russia": "195.24.65.251",
    "🇩🇪": "212.102.227.25",
    "Germany": "212.102.227.25",
}
hchanged = False
for tag, entries in list(hosts.items()):
    for h in entries:
        remark = h.get("remark") or ""
        addr = (h.get("address") or "").strip()
        target = None
        for key, ip in ADDR_MAP.items():
            if key in remark:
                target = ip
                break
        if target and addr != target:
            print(f"host {remark}: address {addr!r} → {target}")
            h["address"] = target
            hchanged = True
        if h.get("sni") != sni_primary:
            print(f"host {remark}: sni {h.get('sni')} → {sni_primary}")
            h["sni"] = sni_primary
            hchanged = True
        if h.get("path") in ("/", "%2F"):
            print(f"host {remark}: clear path {h.get('path')!r}")
            h["path"] = ""
            hchanged = True
        h["fingerprint"] = h.get("fingerprint") or "chrome"
        if h.get("port") not in (8443, "8443"):
            print(f"host {remark}: port {h.get('port')} → 8443")
            h["port"] = 8443
            hchanged = True


if hchanged:
    api("PUT", "/api/hosts", hosts)
    print("hosts updated")
else:
    print("hosts already OK")

nodes = api("GET", "/api/nodes")
for n in (nodes if isinstance(nodes, list) else []):
    print("node", n.get("name"), n.get("status"), n.get("address"), "port", n.get("port"))
PY

# ensure subscription prefix HTTPS
ENVF=/opt/marzban-vpn/.env
grep -q '^XRAY_SUBSCRIPTION_URL_PREFIX=' "$ENVF" \
  && sed -i 's|^XRAY_SUBSCRIPTION_URL_PREFIX=.*|XRAY_SUBSCRIPTION_URL_PREFIX=https://svoygarage.ru|' "$ENVF" \
  || echo 'XRAY_SUBSCRIPTION_URL_PREFIX=https://svoygarage.ru' >> "$ENVF"

echo "========== 3) Deploy bot (soft crypt4 only) =========="
# Prefer files already synced to REPO; rsync bot → /opt
if [[ -d "$REPO/vpn-marzban-bot/bot" ]]; then
  rsync -a --delete \
    --exclude .env --exclude .venv --exclude '__pycache__' --exclude '*.pyc' \
    "$REPO/vpn-marzban-bot/bot/" "$BOT/"
fi
systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot

echo "========== 4) Refresh DB crypt4 links =========="
cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import get_single_happ_link, is_real_happ_crypto_link, decode_happ_crypt4

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
DSN=os.getenv('DATABASE_URL','').replace('postgresql+asyncpg://','postgresql://')

def to_https(u: str) -> str:
    u = (u or '').strip()
    u = u.replace('://195.24.65.251:2086','://svoygarage.ru')
    u = u.replace('://195.24.65.251:62050','://svoygarage.ru')
    u = u.replace('http://svoygarage.ru','https://svoygarage.ru')
    if u.startswith('https://svoygarage.ru/') and '/sub/' not in u:
        pass
    return u

async def main():
    async with httpx.AsyncClient(timeout=20) as client:
        tok = (await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        conn = await asyncpg.connect(DSN)
        rows = await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users')
        for r in rows:
            resp = await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})
            api_sub = (resp.json().get('subscription_url') if resp.status_code==200 else None) or r['subscription_url']
            sub = to_https(api_sub)
            crypt = get_single_happ_link(sub)
            assert is_real_happ_crypto_link(crypt)
            assert decode_happ_crypt4(crypt) == sub
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, crypt, 'soft_crypt4_json', datetime.now(timezone.utc), r['telegram_id'])
            print(r['telegram_id'], sub, crypt[:48]+'...')
        await conn.close()
asyncio.run(main())
PY

echo "========== 5) Verify /sub/ speed =========="
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]' || true)
if [[ -n "${TOKEN}" ]]; then
  for i in 1 2 3; do
    curl -sS -o /tmp/sub.bin -w "try$i http=%{http_code} time=%{time_total}s size=%{size_download} ctype=%{content_type}\n" \
      -A "Happ/3.5.0" --max-time 10 "https://svoygarage.ru/sub/${TOKEN}" || echo "try$i FAIL"
  done
  # decode first bytes
  python3 - <<'PY'
import base64, pathlib
raw=pathlib.Path('/tmp/sub.bin').read_bytes()
print('raw_head', raw[:40])
try:
    dec=base64.b64decode(raw)
    print('decoded_head', dec[:120])
except Exception as e:
    print('not b64', e)
PY
fi

echo "========== MASTER DONE =========="
