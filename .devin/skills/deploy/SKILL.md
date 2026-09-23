---
name: deploy
description: Безопасный деплой на продакшен svoygarage.ru. Только по явной команде пользователя — никогда самостоятельно.
triggers:
  - user
allowed-tools:
  - exec
  - read
---

Деплой на продакшен (`scripts/deploy/update.sh` → `sudo update` на сервере). Строго по шагам:

1. `git status` и `git log origin/HEAD..HEAD` — рабочее дерево должно быть чистым, всё запушено. Если нет — остановись и скажи, что сначала нужен commit + push (сам не пушь без просьбы).
2. Спроси у пользователя опции, если не указаны: `--frontend-only`, `--backend-only`, `--skip-frontend`, `--skip-backend`, `--rollback`.
3. Покажи точную команду и дождись явного «да» на этот конкретный запуск.
4. После деплоя — health-checks по AGENTS.md §5.4: `systemctl is-active kroan.service`, `celery.service`, curl `https://svoygarage.ru/server/api/auth/public-site-config`, попросить пользователя нажать Ctrl+F5.

НИКОГДА не деплой без явного подтверждения. НИКОГДА не запускай `update`/`update.sh` локально — только на сервере через sudo.
