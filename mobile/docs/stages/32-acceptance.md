# Этап 32 — Приёмка клиентского контура

Статус: **автоматическая часть выполнена** (16.11.2026); device-прогон —
ручной, требует устройств.

## Что сделано

### Maestro E2E (`mobile/e2e/`)

- `subflows/login.yaml` — вход по email/телефону + паролю; пропускается,
  если сессия уже активна.
- `client-journey.yaml` — **read-only** сценарий: вход → гараж → история
  ремонтов → записи → профиль → уведомления. Безопасен для прода.
- `client-journey-write.yaml` — **write** сценарий: добавить авто
  (марка/модель) → запись на осмотр (дата `ГГГГ-ММ-ДД`). Создаёт реальные
  данные — только тестовый контур/тестовый клиент.

Запуск:

```bash
maestro test mobile/e2e/client-journey.yaml \
  -e CLIENT_LOGIN=... -e CLIENT_PASSWORD=...
maestro test mobile/e2e/client-journey-write.yaml \
  -e CLIENT_LOGIN=... -e CLIENT_PASSWORD=... \
  -e VEHICLE_MAKE=Lada -e VEHICLE_MODEL=Vesta -e BOOKING_DATE=2026-12-01
```

Ограничение: date/time-поля — текстовые `TextInput`, Maestro заполняет их
как обычные поля; селекторы опираются на placeholder-тексты — при смене
копирайта флоу надо править.

### Автоматические проверки (финальный прогон)

- `npm run typecheck` — чисто;
- `npm run lint` — чисто (0 errors, 0 warnings);
- `npm test` — 32/32;
- backend клиентского контура — 27/27
  (`test_autoservice_client_contour`, `test_autoservice_garage_multiorg`,
  `test_notification_feed`).

### Таблица актуальности

Проверена в этапе 31: все клиентские чтения покрыты политиками, `StaleDataBadge`
на всех списках/деталках, PDF/decode/мутации — online-only осознанно.
См. `stages/03-offline.md` и `stages/31-offline-client.md`.

## Осталось вручную (критерий готовности этапа)

1. **Expo Go на iPhone** — прогнать `client-journey.yaml`; push не проверять
   (не подключался, in-app лента — да).
2. **Android**: BlueStacks/бюджетное устройство + `build-apk.ps1` → APK;
   прогнать оба флоу.
3. **Доступность**: контраст текста на `surfaceSubtle`, тап-таргеты
   (строки `py-3` ≈ 44px+ — ок), скринридер TalkBack/VoiceOver базово.
4. **Перед включением write-экранов на проде** — бэкап БД и `uploads`
   (правило 2 PLAN.md). Экраны уже в приложении — бэкап нужен до первого
   реального клиента, а не до деплоя кода.
5. **Ручной smoke dual-role**: аккаунт «сотрудник + клиент» — переключение
   роли в «Ещё» → staff-контур → обратно.

## Известные ограничения клиентского контура

- Чат с автосервисом отложен (этап 29, вариант C) — backend-канала нет.
- Аватар read-only; «авто по умолчанию» и публичная ссылка на СТО — нет
  backend-полей.
- Уведомления о статусах заказ-нарядов клиенту на backend не отправляются
  (лента готова, события не подключены).
- Push (FCM/APNs) не подключён — только in-app центр.
