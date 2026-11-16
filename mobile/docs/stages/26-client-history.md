# Этап 26 — История ремонтов (клиент)

План этапа из `mobile/docs/PLAN-client.md`. Статус: **реализовано** (16.11.2026).

## Что сделано

### API-слой (`src/api/clientAccount.ts`)

- `ClientRepairOrder` расширен до полного `RepairOrderClientView` (этап 22):
  `works`, `client_parts`, `shop_parts`, `deliveries`, `works_total`,
  `shop_parts_total`, `deliveries_total`, `grand_total`, `discount_percent`,
  `vat_rate`, `work_zone`, `vehicle_id`.
- `fetchMyRepairOrders(scope, organizationId?)` — добавлен `organization_id`;
  `fetchMyRepairOrder(orderId)` — деталь `GET /repair-orders/me/{id}` через
  `cachedGet` (политика `repair-orders` уже покрывает путь — офлайн-чтение
  с `StaleDataBadge` работает из коробки).
- `shareMyRepairOrderPdf(orderId)` — клиентский PDF `GET /me/{id}/pdf`
  (без закупочных цен/маржи) → `expo-file-system` + `expo-sharing`, паттерн
  staff-`shareOrderPdf`.

### Экраны

- **`ClientHistoryScreen`** — переработан:
  - **мульти-СТО:** заказы грузятся по каждому СТО из `/clients/me/orgs`
    (`?organization_id=`), merge по `id`, сортировка по `scheduled_at desc`.
    Раньше без org-параметра возвращались только заказы default-организации —
    дыра этапа 22 закрыта на клиенте;
  - фильтры-чипы: scope «Все / Активные / Завершённые» (→ `all|active|history`)
    и фильтр по авто (уникальные `vehicle` из загруженных заказов, toggle);
  - статусы — клиентские формулировки через новый `clientOrderStatusLabel`
    («Запланирован», «Авто у мастера», «Завершён»…), не staff-«В работе/Закрыт»;
  - тап по строке → `ClientOrder`.
- **`ClientOrderScreen`** (новый stack-роут «Заказ-наряд») — read-only карточка:
  - шапка: № заказ-наряда, статус-бейдж, СТО, авто+госномер, даты начала/конца,
    пост (work_zone);
  - секции: Работы (цена), Клиентские запчасти (без цен — как в API),
    Запчасти магазина (с ценами), Доставки;
  - итоги: работы/запчасти/доставки/скидка (если >0)/grand_total;
  - `client_comment`; кнопка «Счёт-заказ (PDF)» → share sheet.
- **`format.ts`** — `CLIENT_ORDER_STATUS_LABELS` + `clientOrderStatusLabel`
  (staff `orderStatusLabel` не тронут).
- **Навигация:** `ClientOrder: { orderId }` в `RootStackParamList` + `RootNavigator`.

## Решения

- **Оплаты/долг** — в `RepairOrderClientView` нет платежей, ничего не выдумываем
  (по критерию этапа). При необходимости — отдельный этап после проверки API.
- **Фильтр по авто** — из `vehicle` брифа заказов (id/make/model/plate), без
  дополнительного запроса гаража; покрывает ровно те авто, по которым есть заказы.
- **Статусы**: `pending`→«Запланирован», `in_progress`→«Авто у мастера»,
  `done`→«Выполнен», `completed`→«Завершён», `cancelled`→«Отменён»,
  `review`→«На проверке»; легаси `ready/issued` нормализуются в `completed`.
- PDF — только онлайн (apiBlob), офлайн показывает `StaleDataBadge` на данных,
  кнопка при отсутствии сети вернёт сетевую ошибку тостом.

## Проверки

- `npm run typecheck`, `npm run lint`, `npx jest` — 27/27 (новый `format.test.ts`).
- Backend не менялся — этап чисто клиентский, контракты этапа 22 достаточны.
- Визуальная проверка PDF-шаринга на устройстве — при прогоне Expo Go.
