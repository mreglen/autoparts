#!/bin/bash
set -euo pipefail
# Expose Marzban /sub/ only on public port 2086 (panel stays on 127.0.0.1:62050).
# Update bot to send all VLESS locations. Restart services.

echo "==> Sync bot code"
install -m 644 /home/fast/autoparts/vpn-marzban-bot/bot/main.py /opt/marzban-vpn-bot/main.py
sed -i 's/\r$//' /opt/marzban-vpn-bot/main.py
chown marzbanbot:marzbanbot /opt/marzban-vpn-bot/main.py

echo "==> Nginx subscription proxy on :2086"
cat > /etc/nginx/sites-available/marzban-sub <<'EOF'
# Public Marzban subscription only — does not touch svoygarage 80/443.
server {
    listen 2086;
    listen [::]:2086;
    server_name _;

    location /sub/ {
        proxy_pass http://127.0.0.1:62050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Deny everything else (panel/api)
    location / {
        return 404;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/marzban-sub /etc/nginx/sites-enabled/marzban-sub
nginx -t
systemctl reload nginx

ufw allow 2086/tcp comment 'Marzban subscription public' || true

echo "==> Update XRAY_SUBSCRIPTION_URL_PREFIX"
ENV=/opt/marzban-vpn/.env
if grep -q '^XRAY_SUBSCRIPTION_URL_PREFIX=' "$ENV"; then
  sed -i 's|^XRAY_SUBSCRIPTION_URL_PREFIX=.*|XRAY_SUBSCRIPTION_URL_PREFIX=http://195.24.65.251:2086|' "$ENV"
else
  echo 'XRAY_SUBSCRIPTION_URL_PREFIX=http://195.24.65.251:2086' >> "$ENV"
fi
grep XRAY_SUB /opt/marzban-vpn/.env

cd /opt/marzban-vpn
docker compose restart
sleep 6
curl -s -o /dev/null -w 'panel=%{http_code}\n' http://127.0.0.1:62050/docs || true

systemctl restart marzban-vpn-bot
sleep 3
systemctl is-active marzban-vpn-bot
journalctl -u marzban-vpn-bot -n 15 --no-pager

# Verify hosts + fresh user links
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/test_setup_001 \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("n_links", len(d.get("links") or []));
[print(l) for l in (d.get("links") or [])]; print("SUB", d.get("subscription_url"))'

# Public sub fetch test (should be base64 / text, not 404)
SUB=$(curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/test_setup_001 \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("subscription_url",""))')
echo "SUB_URL=$SUB"
if [[ -n "$SUB" ]]; then
  # rewrite old prefix if needed for test
  SUB_PUB=${SUB/http:\/\/195.24.65.251:62050/http:\/\/195.24.65.251:2086}
  curl -s -o /tmp/sub.out -w 'pub_sub_http=%{http_code} size=%{size_download}\n' "$SUB_PUB" || true
  # Decode and show remarks if base64
  python3 - <<'PY'
from pathlib import Path
import base64, re
raw = Path("/tmp/sub.out").read_bytes()
print("raw_head", raw[:40])
try:
    text = base64.b64decode(raw).decode("utf-8", errors="replace")
except Exception:
    text = raw.decode("utf-8", errors="replace")
print("decoded_lines", len(text.splitlines()))
for line in text.splitlines():
    if "vless://" in line or "vmess://" in line:
        # show remark
        if "#" in line:
            from urllib.parse import unquote
            print("CFG", unquote(line.rsplit("#",1)[-1])[:80])
        else:
            print("CFG", line[:60])
PY
fi

echo DONE_FIX
