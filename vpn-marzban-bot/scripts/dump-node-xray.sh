#!/bin/bash
set -euo pipefail
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new root@212.102.227.25 'bash -s' <<'REMOTE'
set -e
CID=$(docker ps -q --filter name=marzban-node | head -1)
echo CID=$CID
docker exec "$CID" sh -c 'find / -name "*.json" 2>/dev/null | head -50'
echo '---'
docker exec "$CID" sh -c 'ls -la /var/lib/marzban-node 2>/dev/null; ls -la /usr/local/share/xray 2>/dev/null; ls /tmp 2>/dev/null | head'
echo '--- process ---'
docker exec "$CID" sh -c 'ps aux | grep -i xray | grep -v grep'
# try to get config path from cmdline
docker exec "$CID" sh -c 'tr "\0" " " < /proc/$(pgrep -n xray)/cmdline; echo'
CFG=$(docker exec "$CID" sh -c 'tr "\0" "\n" < /proc/$(pgrep -n xray)/cmdline' | awk '/\.json/{print; exit}')
echo "CFG=$CFG"
if [[ -n "$CFG" ]]; then
  docker exec "$CID" cat "$CFG" | python3 -c 'import sys,json; cfg=json.load(sys.stdin); 
for ib in cfg.get("inbounds",[]):
 r=(ib.get("streamSettings") or {}).get("realitySettings") or {}
 if r:
  print("tag", ib.get("tag"), "port", ib.get("port"), "listen", ib.get("listen"))
  print("dest", r.get("dest"))
  print("serverNames", r.get("serverNames"))
  print("shortIds", r.get("shortIds"))
  print("privateKey", r.get("privateKey"))
  print("clients", len((ib.get("settings") or {}).get("clients") or []))
'
fi
REMOTE

echo "=== MASTER public from private (xray x25519) ==="
# verify pbk matches private
docker exec marzban-vpn xray x25519 -i "$(cat /root/marzban-vpn-reality-private.key)" 2>/dev/null || \
docker run --rm --entrypoint xray gngpp/marzban:latest x25519 -i "$(python3 -c 'print(open("/root/marzban-vpn-reality-private.key").read().strip())')" 2>/dev/null || \
python3 - <<'PY'
# fallback: just print stored
print('stored pub', open('/root/marzban-vpn-reality-public.key').read().strip())
print('stored priv', open('/root/marzban-vpn-reality-private.key').read().strip())
PY
