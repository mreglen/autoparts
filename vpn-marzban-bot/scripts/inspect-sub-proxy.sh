#!/bin/bash
set -euo pipefail
echo '=== nginx sites ==='
ls /etc/nginx/sites-enabled 2>/dev/null || true
grep -R "server_name\|listen 443\|ssl_certificate" /etc/nginx/sites-enabled/ 2>/dev/null | head -40
echo '=== 2086 ==='
ss -tulpn | grep 2086 || true
grep -R "2086\|/sub/" /etc/nginx/ 2>/dev/null | head -30
echo '=== marzban env prefix ==='
grep -E 'SUBSCRIPTION|XRAY_' /opt/marzban-vpn/.env || true
