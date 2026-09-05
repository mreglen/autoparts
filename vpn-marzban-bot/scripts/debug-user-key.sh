#!/bin/bash
set -euo pipefail
cd /opt/marzban-vpn-bot
# shellcheck disable=SC1091
set -a
source .env
set +a

python3 <<'PY'
import asyncio, json, os
from urllib.parse import urlparse
import asyncpg, httpx

async def main():
    db = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db)
    rows = await conn.fetch(
        "select telegram_id, marzban_username, subscription_url, crypt4_link, expire_at, key_valid, verify_note from marzvpn_users order by created_at desc limit 5"
    )
    for r in rows:
        print("=== USER", r["telegram_id"], r["marzban_username"], "===")
        print("expire:", r["expire_at"])
        print("key_valid:", r["key_valid"], "note:", r["verify_note"])
        print("sub:", r["subscription_url"])
        print("crypt4:", r["crypt4_link"][:120], "...")
        url = r["subscription_url"]
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
                resp = await c.get(url, headers={"User-Agent": "Happ/1.0"})
                print("HTTP", resp.status_code, "ctype", resp.headers.get("content-type"), "len", len(resp.content))
                body = resp.text[:300].replace("\n", "\\n")
                print("body:", body)
        except Exception as e:
            print("FETCH_ERR", type(e).__name__, e)
    await conn.close()

asyncio.run(main())
PY
