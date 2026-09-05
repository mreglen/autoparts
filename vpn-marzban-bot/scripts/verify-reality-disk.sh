#!/bin/bash
python3 - <<'PY'
import json
r=json.load(open('/var/lib/marzban-vpn/xray_config.json'))['inbounds'][0]['streamSettings']['realitySettings']
print('dest', r.get('dest'))
print('serverNames', r.get('serverNames'))
print('shortIds', r.get('shortIds'))
print('fingerprint', r.get('fingerprint'))
print('spiderX', r.get('spiderX'))
print('pbk', (r.get('publicKey') or '')[:24])
PY
ss -tulpn | grep 8443 || true
