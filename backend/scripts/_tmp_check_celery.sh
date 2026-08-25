#!/usr/bin/env bash
set -euo pipefail
journalctl -u celery --since "5 min ago" --no-pager | grep -Ei 'SEO sync|run_new_parts|ERROR|InvalidRequest|succeeded' | tail -40 || true
echo '---DB---'
sudo -u postgres psql -d autoparts -tAc "SELECT count(1) FROM new_parts_seo_cards WHERE created_at >= CURRENT_DATE;"
