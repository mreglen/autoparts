#!/bin/bash
# Шаг 1: обеспечить Let's Encrypt для svoygarage.ru (nginx plugin, без остановки сайта).
set -euo pipefail
DOMAIN=svoygarage.ru
EMAIL=admin@svoygarage.ru
LIVE=/etc/letsencrypt/live/$DOMAIN
DEST=/var/lib/marzban-vpn/certs

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx

if [[ -f "$LIVE/fullchain.pem" && -f "$LIVE/privkey.pem" ]]; then
  echo "CERT_EXISTS"
  openssl x509 -in "$LIVE/fullchain.pem" -noout -subject -issuer -dates
  # renew if close to expiry (certbot decides)
  certbot renew --nginx --quiet --deploy-hook "systemctl reload nginx" || true
else
  echo "CERT_ISSUE"
  # nginx occupies :80 — use nginx plugin, NOT standalone
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

test -f "$LIVE/fullchain.pem"
test -f "$LIVE/privkey.pem"

mkdir -p "$DEST"
install -m 644 "$LIVE/fullchain.pem" "$DEST/fullchain.pem"
install -m 600 "$LIVE/privkey.pem" "$DEST/privkey.pem"
ln -sfn fullchain.pem "$DEST/cert.pem"
ln -sfn privkey.pem "$DEST/key.pem"

echo "CERT_OK"
echo "fullchain=$LIVE/fullchain.pem"
echo "privkey=$LIVE/privkey.pem"
echo "xray_copy=$DEST"
ls -la "$DEST"
