#!/bin/bash
set -euo pipefail
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new root@212.102.227.25 'bash -s' <<'REMOTE'
set -e
# xray runs on host (from ss) pid 12998
PID=$(ss -tulpn | awk '/:8443/{match($0,/pid=([0-9]+)/,a); print a[1]; exit}')
echo "xray_pid=$PID"
if [[ -n "$PID" ]]; then
  tr '\0' ' ' < /proc/$PID/cmdline; echo
  ls -l /proc/$PID/cwd /proc/$PID/exe
  # open files looking for json
  ls -l /proc/$PID/fd 2>/dev/null | head
  for fd in /proc/$PID/fd/*; do
    t=$(readlink $fd 2>/dev/null || true)
    case "$t" in
      *.json*) echo "fdjson $t";;
    esac
  done
  # environ
  tr '\0' '\n' < /proc/$PID/environ | grep -iE 'config|xray|marz' || true
fi
# also check docker inspect mounts
docker inspect marzban-node --format '{{json .Mounts}}' | python3 -m json.tool
# search writable volumes
find /var/lib/docker/volumes -name '*xray*' 2>/dev/null | head
find /tmp /run -name '*xray*.json' 2>/dev/null | head
# marzban-node may keep config in memory; try API on node
curl -sk https://127.0.0.1:62050/ 2>/dev/null | head -c 200; echo
REMOTE

# From master: get node settings / core that is pushed
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
echo "=== MASTER core config reality (full) ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 -c '
import sys,json
cfg=json.load(sys.stdin)
r=cfg["inbounds"][0]["streamSettings"]["realitySettings"]
print(json.dumps({k:r.get(k) for k in ("dest","serverNames","shortIds","privateKey","publicKey","fingerprint","spiderX","show","xver")}, indent=2))
'
