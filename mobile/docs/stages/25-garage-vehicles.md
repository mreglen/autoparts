# Этап 25 — Гараж: авто

План этапа из `mobile/docs/PLAN-client.md`. Статус: **реализовано** (16.11.2026).

## Что сделано

### Backend (аддитивно, веб не затронут)

- `PATCH /autoservice/garage/vehicles/{id}` и `DELETE …/{id}` — новый опциональный
  query-параметр `organization_id`: без него поведение прежнее (default-орг), с ним
  карточка клиента резолвится в указанной организации. Закрыта мульти-СТО дыра:
  раньше клиент со СТО не в default-орге не мог править/удалять свои авто.
- `POST /autoservice/garage/decode-vin|plate|frame` — auth ослаблен с
  `require_my_active_autoservice_client` (карточка в default-орге) до
  `_require_any_client_card` (любая активная карточка клиента): decode не зависит
  от организации, а Laximo-поиск не должен падать у мульти-СТО клиентов.
- Тесты: `test_autoservice_garage_multiorg.py` (8 шт.); патчи в
  `test_garage_decode_vin.py` / `test_laximo_plate_lookup.py` обновлены под новый
  auth-хелпер. OpenAPI перегенерирован (`openapi.json` + `schema.d.ts`).

### Mobile

- **`src/utils/vehicleLookup.ts`** — порт web-утилит (`laximoVin`, `laximoPlate`,
  `vehicleLookupKind`, `laximoVinCandidate`): VIN-детект с OCR-фиксами и отсечением
  парт-номеров, нормализация RU-госномера (латиница→кириллица), `detectVehicleLookupKind`
  (vin/plate/frame), маппинг кандидата Laximo в поля формы и сборка create-payload
  (`source`: manual/laximo/plate/frame + `laximo_*` атрибуты, `frame_query`).
- **`src/api/clientAccount.ts`** — `decodeGarageVehicle(kind, input)` и CRUD:
  `createGarageVehicle` (с `organization_id`), `updateGarageVehicle`,
  `deleteGarageVehicle` (оба с `organization_id` из строки авто).
- **`ClientGarageScreen`** — read-only список стал интерактивным:
  - дедупликация по VIN (без VIN — по id): одно физическое авто = одна карточка,
    при наличии в нескольких СТО right-метка показывает все организации;
  - тап по строке → `ClientVehicle`; кнопка «Добавить автомобиль» → `ClientVehicleForm`;
  - пустое состояние с иконкой и подсказкой.
- **`ClientVehicleScreen`** (новый stack-роут) — карточка авто: шапка с маркой/моделью
  и организацией, поля (VIN, госномер, год, цвет, пробег, заметки), кнопки
  «Редактировать» → форма и «Удалить» → `ConfirmDialog` → DELETE → инвалидация кэша.
  Ошибка delete-guard («связаны заказ-наряды/записи») показывается тостом как есть.
- **`ClientVehicleFormScreen`** (новый stack-роут, create+edit):
  - create: блок «Подбор по VIN, госномеру или frame» — единое поле, тип определяется
    автоматически; кнопка «Найти» → decode-эндпоинт;
    - 1 кандидат → автоподстановка в форму;
    - N кандидатов → список вариантов (`candidateLabel`), выбор заполняет форму;
    - 0 / not_found / temporarily_unavailable / сетевая ошибка → мягкое notice
      и ручной ввод (поведение как на вебе);
  - селектор автосервиса (pills), если клиент в нескольких СТО — по умолчанию первый;
  - поля: марка*, модель, год, цвет, госномер, VIN/frame, заметки; валидация
    марки и года; VIN нормализуется через `normalizeGarageVinOrNull`;
  - edit-режим: те же поля без блока подбора, PATCH по `organization_id` строки;
  - после save — `invalidateEntities(["garage-vehicles"])` + success-тост.
- **Навигация:** `ClientVehicle`, `ClientVehicleForm` в `RootStackParamList` и
  `RootNavigator` (заголовки «Автомобиль» / «Новый автомобиль» / «Редактирование…»).
- **Тесты:** `src/utils/__tests__/vehicleLookup.test.ts` — 14 кейсов
  (VIN/plate/frame-детект, OCR-фиксы, маппинг кандидата, payload source).

## Решения и компромиссы

- **Дедупликация:** группировка по VIN в списке; представитель группы — строка с
  max id (свежая). Правка/удаление идут по `organization_id` представителя; если то же
  VIN заведено в двух СТО — это две backend-строки, редактируется выбранная. Пометка
  «также в другом СТО» не делалась — достаточно org-метки в списке.
- **Пробег:** только отображение. `mileage_km` обновляется бэкендом из заказ-нарядов
  (`garage_vehicle_mileage`), в PATCH-форму не выносили — веб тоже его не редактирует.
- **Фото авто:** в API нет поля фото — shared-element из этапа 24 отложен до появления
  фото в контракте.
- **«Основное авто»** из плана этапа — в API нет понятия «основного»; быстрый выбор
  авто для записи появится на этапе 27 (запись) через список гаража.
- **Запись только онлайн:** мутации без очереди — при сетевой ошибке тост
  `describeError`, данных не теряется (форма остаётся заполненной).

## Проверки

- Backend: `test_autoservice_garage_multiorg` + `test_autoservice_client_contour` +
  `test_garage_decode_vin` + `test_garage_vehicle_delete_guard` +
  `test_laximo_plate_lookup` — 50 тестов OK.
- Mobile: `npm run typecheck`, `npm run lint`, `npx jest` — 23/23.
- Pre-existing: `test_garage_vehicle_mileage` падает на импорте `pytest` (нет в venv) —
  не связано с этапом.
- Визуальная проверка decode-флоу на устройстве — при прогоне Expo Go.
