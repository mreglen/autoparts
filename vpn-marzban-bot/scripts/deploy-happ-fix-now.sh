#!/bin/bash
set -euo pipefail
BOTDIR=/opt/marzban-vpn-bot
cp /tmp/happ_crypto.py "$BOTDIR/happ_crypto.py"
cp /tmp/handlers.py "$BOTDIR/handlers.py"
cp /tmp/sub_proxy.py "$BOTDIR/sub_proxy.py"
systemctl restart marzban-sub-proxy marzban-vpn-bot
sleep 1
systemctl is-active marzban-sub-proxy marzban-vpn-bot
echo "=== refreshed sub ==="
curl -sS -m 15 -A 'Happ/3' \
  'https://svoygarage.ru/sub/dGdfNzY4NjUxNzcxX2VmYmM1NCwxNzg4NjM2ODIwckWvWD3Wn5' \
  | python3 -c 'import sys,base64
t=sys.stdin.read().strip()
try: d=base64.b64decode(t).decode()
except Exception: d=t
print(d)'
