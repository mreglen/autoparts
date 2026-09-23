---
name: review
description: Ревью текущего git diff по чек-листу проекта перед коммитом
allowed-tools:
  - exec
  - read
  - grep
  - glob
---

Сделай ревью изменений:

1. `git status` + `git diff` (или `git diff --staged`, если есть staged).
2. Чек-лист:
   - `organization_id` фильтры в новых запросах к БД и API;
   - `order_number` — только строковые сравнения;
   - даты/время — локальные, без UTC-сдвига (см. `utils/serverDate.js`);
   - новые таблицы — только `autoserviceList*Class` (эталон `/autoservice/warehouse`);
   - мобильная вёрстка — стандартные `px-3`, без `mx-auto`/`fit-content`-ловушек на `<main>` и детях flex-колонки shell;
   - нет секретов, `console.log`, закомментированного кода, неиспользуемых импортов;
   - несвязанные изменения в diff (чужие правки не задеты).
3. Отчёт: блокеры / замечания / ок. Построчные ссылки на проблемные места.
