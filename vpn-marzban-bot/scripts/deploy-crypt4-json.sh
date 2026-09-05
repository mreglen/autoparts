#!/usr/bin/env bash
set -euo pipefail
REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot

cd "$REPO"
sudo -u fast git pull --ff-only origin celery_update
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"
chown -R marzbanbot:marzbanbot "$BOT"

cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv("/opt/marzban-vpn-bot/.env")
import asyncpg, httpx
from happ_crypto import generate_valid_happ_link, is_real_happ_crypto_link, decode_happ_crypt4

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
    # smoke
    sample = generate_valid_happ_link("https://svoygarage.ru/sub/demo")
    assert sample.startswith("happ://crypt4/eyJ")
    assert is_real_happ_crypto_link(sample)
    assert decode_happ_crypt4(sample) == "https://svoygarage.ru/sub/demo"
    print("smoke", sample)

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
            print(uname, https_sub, check.status_code, len(check.content))
            crypt = generate_valid_happ_link(https_sub)
            assert is_real_happ_crypto_link(crypt)
            await conn.execute(
                """update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note='crypt4_json', last_verified_at=$3 where telegram_id=$4""",
                https_sub, crypt, datetime.now(timezone.utc), r["telegram_id"],
            )
            print(" ", crypt)
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot marzban-vpn-bot-celery
sleep 2
systemctl is-active marzban-vpn-bot
sudo -u postgres psql -d autoparts -c "select telegram_id, left(subscription_url,55) as sub, left(crypt4_link,55) as crypt from marzvpn_users;"
echo CRYPT4_JSON_OK
