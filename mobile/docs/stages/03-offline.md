# Этап 3 — Офлайн-движок

## Что реализовано

- `src/offline/sqliteStore.ts` — SQLite (`expo-sqlite`, есть в Expo Go), таблица `cache_entries`
  (`key`, `entity`, `payload`, `fetched_at`, `expires_at`) + `cache_meta` с версией схемы.
- `src/offline/migrations.ts` — миграции кэша отдельно от миграций бэкенда; `pendingMigrations`
  применяет только неприменённые (тест «полёт после обновления»).
- `src/offline/policies.ts` — реестр актуальности (таблица ниже).
- `src/offline/cache.ts` — `cachedGet(path)`: сеть → кэш; при `network`/`timeout` отдаёт последнюю
  запись с `stale: true` + `fetchedAt` для `StaleDataBadge`. HTTP-ошибки и 401 в кэш не проваливаются.
- Инвалидация: `invalidateEntities([...])` / `invalidateKeys([...])` — экраны вызывают после
  успешной мутации, кэш не ждёт TTL.
- Вытеснение: `selectEvictionKeys` — лимиты 500 записей / ~8M символов; сначала уходят
  не-gorячие сущности по `fetched_at`, горячие (`hot: true`) щадятся.
- 401/истёкшая сессия: кэш **не чистится** (данные той же учётки), но `RootNavigator` закрывает
  экраны входом — читать кэш без сессии нельзя.
- `App.tsx` вызывает `bootstrapOfflineCache()` при старте; до готовности SQLite работает
  in-memory fallback.

## Таблица актуальности (синхронно с `CACHE_POLICIES`)

| Сущность             | Префикс API                                         | TTL     | Офлайн-чтение | Примечание                          |
| -------------------- | --------------------------------------------------- | ------- | ------------- | ----------------------------------- |
| dashboard            | `/autoservice/dashboard`                            | 5 мин   | да, hot       | плитки «Сегодня»                    |
| bookings             | `/autoservice/inspections`, `/autoservice/inspection-bookings`, `/autoservice/bookings` | 10 мин  | да, hot       | записи на осмотр                    |
| repair-orders        | `/autoservice/repair-orders`                        | 10 мин  | да, hot       | списки и детали ЗН                  |
| planner              | `/autoservice/planner`                              | 10 мин  | да, hot       | недельная сетка                     |
| warehouse            | `/autoservice/warehouse`                            | 15 мин  | да            | остатки/движения                    |
| warehouse-items      | `/autoservice/warehouse-items`                      | 15 мин  | да            | номенклатура                        |
| finance-transactions | `/autoservice/finance/transactions`                 | 15 мин  | да            | поступления                         |
| finance-expenses     | `/autoservice/finance/expenses`                     | 15 мин  | да            | расходы                             |
| finance-payments     | `/autoservice/finance/payments`                     | 5 мин   | **нет**       | статусы/суммы оплат — только онлайн |
| reports              | `/autoservice/reports`                              | 1 ч     | да            | просмотр (экспорт — онлайн)         |
| clients              | `/autoservice/clients`                              | 1 ч     | да            | справочник + клиентские `/me`-карточки |
| garage-vehicles      | `/autoservice/garage`                               | 30 мин  | да            | гараж клиента (decode — POST, не кэш) |
| public-autoservice-orgs | `/public/autoservice`                            | 1 сутки | да            | публичный справочник СТО            |
| employees            | `/autoservice/service-employees`                    | 1 сутки | да            | справочник                          |
| contractors          | `/autoservice/contractors`                          | 1 сутки | да            | справочник                          |
| expense-articles     | `/autoservice/expense-articles`                     | 1 сутки | да            | справочник                          |
| notifications        | `/api/notifications`                                | 5 мин   | да, hot       | in-app лента                        |
| settings             | `/autoservice/settings`                             | 1 сутки | да            | read-mostly                         |
| meta                 | `/autoservice/meta`                                 | 1 сутки | да            | служебное                           |
| calendar-sync        | `/autoservice/calendar-sync`                        | 1 ч     | **нет**       | креды CalDAV — только онлайн        |

**Клиентский контур (этап 31):** гараж (`/autoservice/garage/vehicles`),
история и деталка заказ-нарядов (`/autoservice/repair-orders/me*`), записи
(`/autoservice/inspection-bookings/me`), карточки клиента
(`/autoservice/clients/me*`), лента уведомлений и публичный справочник СТО
читаются офлайн с `StaleDataBadge`. Мутации (запись/отмена, авто) инвалидируют
сущности `bookings`/`garage-vehicles` из экранов. PDF заказ-наряда
(`apiBlob`) и decode-подбор (POST) в кэш не попадают — только онлайн.
Профиль (`/auth/profile`) и настройки уведомлений — онлайн-only.

**Запрещено показывать без сети** (правило 1.8): суммы к оплате, статус оплаты, результат
подтверждения записи. Эндпоинты без политики в таблице не кэшируются вовсе — добавить префикс
сюда и в `CACHE_POLICIES` одновременно.

## Тесты

`src/offline/__tests__/offline.test.ts` — 9 кейсов: кэш-хит офлайн, запрет для payments,
инвалидация после мутации, вытеснение, миграции, пустая БД. Jest — node-окружение
(jest-expo пресет в этом окружении не поднимается; нативные модули в тесты не попадают).
