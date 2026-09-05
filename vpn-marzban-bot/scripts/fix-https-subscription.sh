#!/usr/bin/env bash
# Fix Happ "subscription invalid": expose /sub/ on HTTPS and refresh crypt links.
set -euo pipefail

REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot
SITE_CONF=/etc/nginx/sites-enabled/svoygarage
HTTPS_PREFIX=https://svoygarage.ru

echo "==> git pull + sync bot"
cd "$REPO"
sudo -u fast git fetch origin
sudo -u fast git pull --ff-only origin celery_update
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"
chown -R marzbanbot:marzbanbot "$BOT"

echo "==> nginx HTTPS /sub/ on svoygarage.ru"
python3 - "$SITE_CONF" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
snippet = """
    # Marzban subscription (Happ requires HTTPS)
    location ^~ /sub/ {
        proxy_pass http://127.0.0.1:62050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
    }
"""
if "location ^~ /sub/" in text or "location /sub/ {" in text:
    print("already present")
else:
    needle = "server_name svoygarage.ru;"
    idx = text.find(needle)
    if idx < 0:
        raise SystemExit("svoygarage.ru not found")
    insert_at = text.find("\n", idx) + 1
    path.write_text(text[:insert_at] + snippet + text[insert_at:], encoding="utf-8")
    print("inserted")
PY
nginx -t
systemctl reload nginx

echo "==> env prefixes"
python3 - <<'PY'
from pathlib import Path

def upsert(path, key, value):
    p = Path(path)
    lines = p.read_text(encoding="utf-8").splitlines() if p.exists() else []
    out, found = [], False
    for line in lines:
        if line.startswith(key + "="):
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{key}={value}")
    p.write_text("\n".join(out) + "\n", encoding="utf-8")

upsert("/opt/marzban-vpn/.env", "XRAY_SUBSCRIPTION_URL_PREFIX", "https://svoygarage.ru")
upsert("/opt/marzban-vpn-bot/.env", "SUB_URL_REWRITE_FROM", "://195.24.65.251:62050")
upsert("/opt/marzban-vpn-bot/.env", "SUB_URL_REWRITE_TO", "://svoygarage.ru")
print("env ok")
PY

echo "==> refresh users to HTTPS + new crypt"
cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv("/opt/marzban-vpn-bot/.env")
import asyncpg, httpx
from happ_crypto import generate_valid_happ_link, is_real_happ_crypto_link

BASE = os.getenv("MARZBAN_BASE_URL", "http://127.0.0.1:62050").rstrip("/")
USER = os.getenv("MARZBAN_USERNAME", "admin")
PASS = os.getenv("MARZBAN_PASSWORD", "")
HTTPS = "https://svoygarage.ru"

def to_https(url: str) -> str:
    m = re.search(r"/sub/([^?\s#]+)", url or "")
    if m:
        return f"{HTTPS}/sub/{m.group(1)}"
    return (url or "").replace("http://195.24.65.251:2086", HTTPS).replace("http://195.24.65.251:62050", HTTPS)

async def main():
    db = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db)
    rows = await conn.fetch("select telegram_id, marzban_username, subscription_url from marzvpn_users")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        tok = (await client.post(f"{BASE}/api/admin/token", data={"username": USER, "password": PASS})).json()["access_token"]
        headers = {"Authorization": f"Bearer {tok}"}
        for r in rows:
            uname = r["marzban_username"]
            resp = await client.get(f"{BASE}/api/user/{uname}", headers=headers)
            api_sub = (resp.json().get("subscription_url") if resp.status_code == 200 else None) or r["subscription_url"]
            https_sub = to_https(api_sub)
            check = await client.get(https_sub, headers={"User-Agent": "Happ/3.0"})
            print(uname, https_sub, "HTTP", check.status_code, "len", len(check.content))
            if check.status_code != 200:
                raise SystemExit(f"HTTPS sub failed for {uname}")
            crypt = generate_valid_happ_link(https_sub)
            assert is_real_happ_crypto_link(crypt)
            await conn.execute(
                """update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note='https_sub_reencrypted', last_verified_at=$3 where telegram_id=$4""",
                https_sub, crypt, datetime.now(timezone.utc), r["telegram_id"],
            )
            print(" crypt", crypt[:56], "...")
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot
sudo -u postgres psql -d autoparts -c "select telegram_id, subscription_url, left(crypt4_link,48) as crypt from marzvpn_users;"
echo FIX_HTTPS_SUB_OK
