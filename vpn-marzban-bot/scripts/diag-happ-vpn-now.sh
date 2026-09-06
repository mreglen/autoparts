#!/bin/bash
set -euo pipefail
SUB='https://svoygarage.ru/sub/dGdfNzY4NjUxNzcxX2VmYmM1NCwxNzg4NjM2ODIwckWvWD3Wn5'
echo "=== sub body ==="
BODY=$(curl -sS -m 20 "$SUB" || true)
echo "$BODY" | head -c 120; echo
echo "$BODY" | base64 -d 2>/dev/null | tr '#' '\n' | head -30
echo
echo "=== user ==="
cd /opt/marzban-vpn
docker compose exec -T marzban python3 - <<'PY'
from marzban import crud
from marzban.db import GetDB
with GetDB() as db:
    u = crud.get_user(db, "tg_768651771_efbc54")
    print("status", u.status)
    print("used", u.used_traffic)
    print("online", getattr(u, "online_at", None))
    print("sub", getattr(u, "subscription_url", None) or "")
    links = getattr(u, "links", None) or []
    for L in links[:6]:
        print("LINK", L[:140])
PY
echo "=== listen 8443 ==="
ss -lntp | grep -E '8443|2053' || true
echo "=== prove via xray client if present ==="
ls /tmp/prove* 2>/dev/null || true
