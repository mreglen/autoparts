# Этап 31 — Офлайн клиентского контура

Статус: **реализован** (16.11.2026).

## Аудит: что уже было покрыто

Проверка показала, что инфраструктура этапа 3 уже покрывает клиентские чтения:

- **Чтения через `cachedGet` + политики:** гараж
  (`/autoservice/garage/vehicles` → `garage-vehicles`, 30 мин), история и
  деталка ЗН (`/autoservice/repair-orders/me*` → `repair-orders`, 10 мин),
  записи (`/autoservice/inspection-bookings/me` → `bookings`, 10 мин),
  карточки клиента (`/autoservice/clients/me*` → `clients`, 1 ч), лента
  уведомлений (`/api/notifications` → `notifications`, 5 мин, hot),
  публичный справочник СТО (`/public/autoservice` →
  `public-autoservice-orgs`, 1 сутки).
- **`StaleDataBadge`** уже показывается во всех клиентских списках и деталке
  ЗН (`ClientGarageScreen`, `ClientHistoryScreen`, `ClientOrderScreen`,
  `ClientBookingsScreen`, `ClientNotificationsScreen`) — возраст данных
  виден, устаревшее не выдаётся за актуальное.
- **Инвалидация после мутаций** уже вызывается из экранов:
  `ClientBookingFormScreen`/`ClientBookingsScreen` → `bookings`,
  `ClientVehicleFormScreen`/`ClientVehicleScreen` → `garage-vehicles`,
  `notifications.ts` → `notifications`.
- **Вытеснение:** лимиты 500 записей / ~8M символов, горячие сущности
  щадятся; бинарные данные (PDF через `apiBlob`, аватары) в кэш не попадают
  и не раздувают SQLite.

## Что добавлено в этом этапе

- `src/offline/__tests__/clientOffline.test.ts` — 5 кейсов: покрытие всех
  клиентских путей политиками, офлайн-отдача гаража/истории/записей/
  уведомлений/справочника с `stale`, инвалидация `bookings` после мутации.
- `docs/stages/03-offline.md` — таблица актуальности приведена в синхрон с
  `CACHE_POLICIES` (добавлены `garage-vehicles`, `public-autoservice-orgs`,
  `warehouse-items`, `notifications`, `calendar-sync`; исправлен префикс
  сотрудников `/autoservice/service-employees`) + блок про клиентский контур.

## Осознанные решения (online-only)

- **Профиль** (`/auth/profile`, `/users/me`) и **настройки уведомлений** —
  без кэша: это write-mostly данные, устаревший профиль опаснее его отсутствия.
- **PDF заказ-наряда** (`apiBlob`) и **decode-подбор** (POST vin/plate/frame)
  — только онлайн, в кэш не пишутся.
- **Мутации клиента** (создание/отмена записи, CRUD авто) — только онлайн;
  офлайн-очередь исходящих не делалась (как и у остальных write-операций
  приложения). Отправка без сети завершится ошибкой `network` + toast.

## Проверки

- `npm test` — 32/32 (было 27, +5 новых кейсов).
- `npm run typecheck`, `npm run lint` — чисто.
- Backend не менялся.

## Критерий готовности

Сценарий «приехал в сервис, нет сети — открыл гараж и историю» работает:
данные отдаются из SQLite-кэша с бейджем возраста; после появления сети
списки обновляются, мутации инвалидируют кэш.
