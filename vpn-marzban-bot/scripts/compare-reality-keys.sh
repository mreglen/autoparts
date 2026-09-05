#!/bin/bash
set -euo pipefail
echo "=== MASTER reality ==="
python3 <<'PY'
import json
cfg=json.load(open('/var/lib/marzban-vpn/xray_config.json'))
r=cfg['inbounds'][0]['streamSettings']['realitySettings']
print('dest', r.get('dest'))
print('serverNames', r.get('serverNames'))
print('shortIds', r.get('shortIds'))
print('privateKey', r.get('privateKey'))
print('publicKey file', open('/root/marzban-vpn-reality-public.key').read().strip())
PY

echo "=== TLS probe SNI candidates from master ==="
for host in www.microsoft.com microsoft.com www.apple.com apple.com www.icloud.com icloud.com swatch.com www.swatch.com dl.google.com www.cloudflare.com; do
  code=$(timeout 5 bash -c "echo | openssl s_client -connect ${host}:443 -servername ${host} 2>/dev/null | openssl x509 -noout -subject 2>/dev/null" || true)
  if [[ -n "$code" ]]; then echo "OK $host -> $code"; else echo "FAIL $host"; fi
done

echo "=== GERMANY node reality via ssh ==="
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=12 root@212.102.227.25 'bash -s' <<'REMOTE'
set -e
echo "hostname=$(hostname)"
ss -tulpn | grep 8443 || true
# find xray config in marzban-node
find /var/lib/marzban-node /opt/marzban-node -type f 2>/dev/null | head -40
docker ps --format '{{.Names}} {{.Status}}' 
# dump running xray config if possible
for c in $(docker ps -q); do
  name=$(docker inspect -f '{{.Name}}' $c)
  echo "container $name"
done
# marzban node often writes config to /var/lib/marzban-node
if [[ -f /var/lib/marzban-node/xray_config.json ]]; then
  python3 - <<'PY'
import json
cfg=json.load(open('/var/lib/marzban-node/xray_config.json'))
for ib in cfg.get('inbounds',[]):
  r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
  if r:
    print('tag', ib.get('tag'), 'port', ib.get('port'))
    print('dest', r.get('dest'))
    print('serverNames', r.get('serverNames'))
    print('shortIds', r.get('shortIds'))
    print('privateKey', r.get('privateKey'))
PY
else
  echo "no local xray_config.json"
  # try docker exec
  CID=$(docker ps -q --filter name=marzban | head -1)
  if [[ -n "$CID" ]]; then
    docker exec "$CID" sh -c 'ls /var/lib/marzban; find / -name xray_config.json 2>/dev/null | head'
  fi
fi
REMOTE
