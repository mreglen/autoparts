---
name: verify
description: Проверка проекта после изменений — eslint, сборка frontend, backend-тесты, отчёт по git diff
allowed-tools:
  - exec
  - read
  - grep
  - glob
---

Прогони проверки и дай короткий отчёт:

1. `git status` + `git diff --stat` — перечисли изменённые файлы.
2. Frontend (если тронут `frontend/`): `cd frontend/my-autoparts`, `npx eslint` на изменённых файлах, затем `npm run build`.
   - Предупреждения про source maps (`html5-qrcode`) и stale Browserslist — не ошибки, если build выходит с кодом 0.
3. Backend (если тронут `backend/`): `cd backend`, `python -m unittest` по затронутым тестам.
4. Отчёт: что проверено, что упало, список warnings требующих внимания, несвязанные изменения в дереве.
