#!/usr/bin/env bash
set -euo pipefail
REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot

cd "$REPO"
sudo -u fast git fetch origin
sudo -u fast git pull --ff-only origin celery_update

rsync -a --delete \
  --exclude '.env' --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"
chown -R marzbanbot:marzbanbot "$BOT"

sudo -u marzbanbot "$BOT/.venv/bin/pip" install -q -r "$BOT/requirements.txt"

systemctl restart marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat
sleep 3
systemctl is-active marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat

# Re-encrypt existing fake keys now
cd "$BOT"
sudo -u marzbanbot "$BOT/.venv/bin/celery" -A celery_app.celery_app call marzvpn.verify_keys_authenticity
sleep 2
journalctl -u marzban-vpn-bot-celery --since '1 min ago' --no-pager | tail -20
journalctl -u marzban-vpn-bot -n 12 --no-pager

# Show first user link prefix
sudo -u marzbanbot "$BOT/.venv/bin/python" - <<'PY'
import asyncio, os
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg
async def main():
    db=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')
    conn=await asyncpg.connect(db)
    rows=await conn.fetch('select telegram_id, left(crypt4_link,40) as c4, key_valid, verify_note from marzvpn_users')
    for r in rows:
        print(dict(r))
    await conn.close()
asyncio.run(main())
PY
echo DEPLOY_CRYPTO_OK
