# Этап 27 — Запись к автосервису (клиент)

План этапа из `mobile/docs/PLAN-client.md`. Статус: **реализовано** (16.11.2026).

## Что сделано

### API-слой (`src/api/clientAccount.ts`)

- `ClientBooking` — добавлено `garage_vehicle_id` (уже было в ответе API).
- `createClientInspectionBooking(payload)` →
  `POST /autoservice/inspection-bookings/me` — клиентская заявка на осмотр:
  `organization_id`, `preferred_date`, `preferred_time`, `garage_vehicle_id`
  **или** `vehicle_make`/`vehicle_model`, `notes`. Имя/телефон не шлём —
  backend подставляет из карточки клиента.
- `cancelClientInspectionBooking(id)` →
  `POST /autoservice/inspection-bookings/me/{id}/cancel` (backend разрешает
  отмену только в статусах `new`/`confirmed`).

### Экраны

- **`ClientBookingFormScreen`** (новый stack-роут «Запись на осмотр»):
  - выбор СТО pills при мульти-СТО (по умолчанию первый);
  - выбор авто из гаража выбранного СТО (`fetchGarageVehicles`, кэш);
    «Указать вручную» → поля марки/модели; при пустом гараже — сразу ручной ввод;
  - дата (`DateField`, дефолт — сегодня), время `ЧЧ:ММ`, комментарий;
  - валидация даты/времени/марки; submit → create →
    `invalidateEntities(["bookings"])` → success-тост → назад.
- **`ClientBookingsScreen`** — из read-only в рабочий:
  - клиентские статусы (`clientBookingStatusLabel`: «Отправлена»,
    «Подтверждена», «Обработана», «Отменена»);
  - кнопка «Записаться на осмотр» → `ClientBookingNew`;
  - тап по записи в статусе `new`/`confirmed` → `ConfirmDialog` отмены →
    cancel-эндпоинт → инвалидация кэша; обработанные/отменённые — без onPress;
  - пустое состояние с иконкой.
- **`format.ts`** — `CLIENT_BOOKING_STATUS_LABELS` + `clientBookingStatusLabel`.
- **Навигация:** `ClientBookingNew` в `RootStackParamList` + `RootNavigator`.

## Решения

- **`/repair-bookings/me` не используется** — deprecated-алиас и только
  default-орг; канонический клиентский контур — `inspection-bookings/me`
  (там мульти-орг и `created_by_user_id` из коробки).
- **Имя/телефон в форме не редактируются** — backend берёт из `AutoserviceClient`;
  клиент может сменить их позже через профиль (этап 30) или в СТО.
- **Запись ≠ заказ-наряд:** клиент подаёт заявку на осмотр; заказ-наряд
  создаёт сотрудник СТО из заявки (web-флоу). В истории ремонтов запись
  «обработанная» (`processed`) — это сигнал, что заявка принята в работу.
- **Мутации онлайн-only:** create/cancel без очереди; при ошибке — тост,
  введённые данные формы сохраняются.
- **«Основное авто»:** в форме гаражного выбора дефолт — первый автомобиль
  СТО; отдельного «основного» в API нет (как и в этапе 25).

## Проверки

- `npm run typecheck`, `npm run lint`, `npx jest` — 27/27.
- Backend не менялся — контракты уже покрывали сценарий (клиентский create
  с `organization_id`/`garage_vehicle_id` добавлен ранее).
- E2E на устройстве (запись → видна в списке → отмена) — при прогоне Expo Go.
