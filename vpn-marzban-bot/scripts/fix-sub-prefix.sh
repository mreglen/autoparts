#!/bin/bash
set -euo pipefail
grep XRAY_SUB /opt/marzban-vpn/.env
cd /opt/marzban-vpn
docker compose up -d --force-recreate
sleep 10
docker exec marzban-vpn printenv | grep -i SUB || true
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -X POST -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/1/reconnect || true
sleep 5
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/happfixde25 \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("subscription_url"))'
# Bot rewrite: if Marzban still emits :62050, rewrite in bot when sending - already can patch bot
# For now patch bot to rewrite subscription URL 62050 -> 2086
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/marzban-vpn-bot/main.py")
t = p.read_text()
needle = "def extract_subscription_url(user_payload: dict[str, Any]) -> str | None:"
if "62050" in t and "2086" not in t[t.find(needle):t.find(needle)+400]:
    old = '''def extract_subscription_url(user_payload: dict[str, Any]) -> str | None:
    url = user_payload.get("subscription_url")
    if isinstance(url, str) and url.strip():
        return url.strip()
    return None'''
    new = '''def extract_subscription_url(user_payload: dict[str, Any]) -> str | None:
    url = user_payload.get("subscription_url")
    if isinstance(url, str) and url.strip():
        # Panel is localhost-only; public sub proxy listens on :2086
        return url.strip().replace("://195.24.65.251:62050", "://195.24.65.251:2086")
    return None'''
    if old in t:
        p.write_text(t.replace(old, new))
        print("bot_sub_rewrite_patched")
    else:
        print("bot_patch_skip_pattern")
else:
    print("bot_already_or_skip")
PY
systemctl restart marzban-vpn-bot
sleep 3
journalctl -u marzban-vpn-bot -n 6 --no-pager
echo DONE
