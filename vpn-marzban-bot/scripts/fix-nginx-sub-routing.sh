#!/usr/bin/env bash
# Fix /sub/ routing on master for Happ subscriptions.
set -euo pipefail

SITE_AVAIL=/etc/nginx/sites-available/svoygarage
SITE_EN=/etc/nginx/sites-enabled/svoygarage
MARZ_PORT=62050

echo "==> Marzban listen / docker"
ss -tulpn | grep -E '62050|8000|8080' || true
docker ps --filter name=marzban-vpn --format '{{.Names}} {{.Status}} {{.Ports}}'
curl -s -o /dev/null -w "panel_local=%{http_code}\n" http://127.0.0.1:${MARZ_PORT}/docs || true

echo "==> backup nginx site"
cp -a "$SITE_AVAIL" "/root/svoygarage.nginx.bak.$(date +%Y%m%d_%H%M%S)"

echo "==> patch ALL ssl server blocks: inject/replace location ^~ /sub/"
python3 - "$SITE_AVAIL" "$MARZ_PORT" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
port = sys.argv[2]
text = path.read_text(encoding="utf-8")

sub_block = f"""
    # === Marzban Happ subscriptions (must win over SPA) ===
    location ^~ /sub/ {{
        proxy_pass http://127.0.0.1:{port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        # Prevent inheriting SPA security headers from server{{}}
        add_header Cache-Control "no-store" always;
    }}
"""

# Remove any existing /sub/ location blocks (with optional preceding comment lines)
text2 = re.sub(
    r"(?m)^[ \t]*#(?:[^\n]*Marzban[^\n]*|[^\n]*subscription[^\n]*|[^\n]*Happ[^\n]*)\n(?:[ \t]*#[^\n]*\n)*"
    r"[ \t]*location\s+\^~\s+/sub/\s*\{.*?\n[ \t]*\}\n?",
    "",
    text,
    flags=re.S,
)
text2 = re.sub(
    r"(?m)^[ \t]*location\s+\^~\s+/sub/\s*\{.*?\n[ \t]*\}\n?",
    "",
    text2,
    flags=re.S,
)
text2 = re.sub(
    r"(?m)^[ \t]*location\s+/sub/\s*\{.*?\n[ \t]*\}\n?",
    "",
    text2,
    flags=re.S,
)

# Insert sub_block into every server { ... listen 443 ... } block, right after opening/server_name
parts = []
idx = 0
inserted = 0
# Find server blocks with listen 443
for m in re.finditer(r"(?m)^server\s*\{", text2):
    start = m.start()
    # find matching closing brace for server
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
    # insert after first server_name line inside block
    sm = re.search(r"(?m)^([ \t]*server_name[^\n]*;\n)", block)
    if not sm:
        # after first listen 443 line
        sm = re.search(r"(?m)^([ \t]*listen[^\n]*443[^\n]*;\n)", block)
    if not sm:
        continue
    new_block = block[: sm.end()] + sub_block + block[sm.end() :]
    # rebuild: append previous gap + new block later
    # We'll reconstruct by replacements list
    parts.append((start, end, new_block))
    inserted += 1

if not parts:
    raise SystemExit("No listen 443 server blocks found")

out = []
prev = 0
for start, end, new_block in parts:
    out.append(text2[prev:start])
    out.append(new_block)
    prev = end
out.append(text2[prev:])
path.write_text("".join(out), encoding="utf-8")
print(f"patched {inserted} ssl server block(s)")
PY

# ensure symlink
ln -sfn "$SITE_AVAIL" "$SITE_EN"

echo "==> keep dedicated :2086 sub proxy too"
cat > /etc/nginx/sites-available/marzban-sub <<'EOF'
# Public Marzban subscription (plain port fallback)
server {
    listen 2086;
    listen [::]:2086;
    server_name _;

    location /sub/ {
        proxy_pass http://127.0.0.1:62050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        add_header Cache-Control "no-store" always;
    }

    location / {
        return 404;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/marzban-sub /etc/nginx/sites-enabled/marzban-sub

nginx -t
systemctl reload nginx

echo "==> pick token and test"
TOKEN=$(sudo -u postgres psql -d autoparts -tAc \
  "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" \
  | tr -d '[:space:]')
if [[ -z "$TOKEN" ]]; then
  # fallback: ask marzban for any user
  PASS=$(cat /root/marzban-vpn-admin.pass)
  TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
    -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
  TOKEN=$(curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/users?limit=1" \
    | python3 -c 'import sys,json,re;d=json.load(sys.stdin);u=(d.get("users") or [{}])[0]; s=u.get("subscription_url") or ""; m=re.search(r"/sub/([^?\s]+)", s); print(m.group(1) if m else "")')
fi
echo "TOKEN=${TOKEN:0:40}..."

for URL in \
  "http://127.0.0.1:62050/sub/${TOKEN}" \
  "http://127.0.0.1:2086/sub/${TOKEN}" \
  "https://svoygarage.ru/sub/${TOKEN}" \
  "https://195.24.65.251/sub/${TOKEN}"
do
  echo "--- $URL"
  code=$(curl -sk -o /tmp/sub_test.bin -w '%{http_code}' -A "Happ/3.0" "$URL" || echo ERR)
  ctype=$(curl -sk -I -A "Happ/3.0" "$URL" 2>/dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
  echo "HTTP $code ctype=$ctype len=$(wc -c </tmp/sub_test.bin 2>/dev/null || echo 0)"
  python3 - <<'PY'
from pathlib import Path
b=Path('/tmp/sub_test.bin').read_bytes()
low=b[:200].lower()
print('html?', b'<!doctype' in low or b'<html' in low)
print('head', b[:60])
PY
done

# Ensure marzban env prefix is HTTPS domain
if grep -q '^XRAY_SUBSCRIPTION_URL_PREFIX=' /opt/marzban-vpn/.env; then
  sed -i 's|^XRAY_SUBSCRIPTION_URL_PREFIX=.*|XRAY_SUBSCRIPTION_URL_PREFIX=https://svoygarage.ru|' /opt/marzban-vpn/.env
else
  echo 'XRAY_SUBSCRIPTION_URL_PREFIX=https://svoygarage.ru' >> /opt/marzban-vpn/.env
fi
# bot rewrite
if [[ -f /opt/marzban-vpn-bot/.env ]]; then
  grep -q '^SUB_URL_REWRITE_TO=' /opt/marzban-vpn-bot/.env \
    && sed -i 's|^SUB_URL_REWRITE_TO=.*|SUB_URL_REWRITE_TO=://svoygarage.ru|' /opt/marzban-vpn-bot/.env \
    || echo 'SUB_URL_REWRITE_TO=://svoygarage.ru' >> /opt/marzban-vpn-bot/.env
fi

# refresh user subscription urls + crypt / add links in DB
cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_happ_crypt4, generate_happ_add_link

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
    rows=await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users')
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as c:
        tok=(await c.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        h={'Authorization':f'Bearer {tok}'}
        for r in rows:
            resp=await c.get(f"{BASE}/api/user/{r['marzban_username']}", headers=h)
            api=(resp.json().get('subscription_url') if resp.status_code==200 else None) or r['subscription_url']
            sub=to_https(api)
            probe=await c.get(sub, headers={'User-Agent':'Happ/3.0'})
            print(r['telegram_id'], sub, probe.status_code, probe.headers.get('content-type'), len(probe.content))
            if probe.status_code != 200 or b'<html' in probe.content[:200].lower():
                raise SystemExit(f'BAD SUB RESPONSE for {sub}')
            crypt=generate_happ_crypt4(sub)
            await conn.execute(
                'update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true, verify_note=$3, last_verified_at=$4 where telegram_id=$5',
                sub, crypt, 'sub_nginx_fixed', datetime.now(timezone.utc), r['telegram_id'])
            print(' add', generate_happ_add_link(sub))
            print(' crypt4', crypt[:80], '...')
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot || true
sleep 2
systemctl is-active marzban-vpn-bot || true
echo MASTER_SUB_FIX_OK
