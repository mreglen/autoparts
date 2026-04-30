---
name: CNC setDetails flow
overview: Добавить обязательный шаг подготовки CNC-заказа через Avito `cncSetDetails` перед переходом `receive`, с backend endpoint и UI-модалкой на `/sales/orders`.
todos:
  - id: add-cnc-set-details-api
    content: Добавить backend вызов Avito cncSetDetails и endpoint /sales/avito-orders/{order_id}/cnc-set-details.
    status: completed
  - id: add-cnc-prepare-modal
    content: Добавить frontend модалку подготовки CNC заказа с полями address/bookingPeriod/details.
    status: completed
  - id: gate-cnc-receive
    content: Заблокировать receive для CNC до успешной подготовки заказа.
    status: completed
  - id: validate-cnc-flows
    content: "Проверить сценарии CNC: prepare -> receive, reject без prepare, ошибки Avito."
    status: completed
isProject: false
---

# Добавить обязательный CNC шаг перед receive

## Цель
Сделать корректный CNC-процесс в `/sales/orders`: сначала продавец выполняет `cncSetDetails` (адрес, срок бронирования, комментарий), затем становится доступен `receive` с вводом кода.

## Что поменять
- Ввести backend-метод и endpoint для `POST /order-management/1/order/cncSetDetails`.
- На фронте добавить отдельное действие «Подготовить заказ (CNC)» с модалкой полей `address`, `bookingPeriod`, `details`.
- Блокировать `receive` для CNC до успешного `cncSetDetails` в текущей сессии UI (и/или на основании флага в кеше).
- Сохранить текущую логику: для CNC `confirm` не используется; `receive` требует `confirmCode`.

## Файлы
- Backend роутер: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/routers/sales.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/routers/sales.py)
- Backend Avito API service: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/services/avito_orders_api.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/services/avito_orders_api.py)
- Backend схемы запросов: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/schemas/avito_orders.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/schemas/avito_orders.py)
- Frontend страница заказов: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx](C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx)
- (Опционально) карточка для отображения нового действия: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/components/AvitoOrderCard.jsx](C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/components/AvitoOrderCard.jsx)

## Шаги реализации
1. Добавить в `avito_orders_api.py` функцию `cnc_set_details(...)`:
   - `POST /order-management/1/order/cncSetDetails`
   - body: `address`, `bookingPeriod`, `details`, `id`, `marketplaceId`
   - единая обработка ошибок через `AvitoOrdersError`.
2. Добавить Pydantic-схему запроса `AvitoCncSetDetailsRequest` в `avito_orders.py`.
3. Добавить endpoint в `sales.py`:
   - `POST /sales/avito-orders/{order_id}/cnc-set-details`
   - проверка доступа/интеграции/типа доставки `cnc`
   - определение `marketplaceId` (из payload или из `order.avito_data`)
   - вызов `cnc_set_details(...)` и возврат результата.
4. Обновить логику transitions для CNC:
   - в списке действий для CNC в `on_confirmation` показывать `receive`/`reject` (уже сделано),
   - добавить frontend-gate: `receive` доступен только после успешного `cncSetDetails`.
5. На фронте добавить модалку «Подготовить заказ (CNC)»:
   - поля: `address` (обязательно), `bookingPeriod` (обязательно), `details` (опционально),
   - submit в новый endpoint,
   - сохранение `prepared=true` для конкретного `order.id` в state.
6. В модалке `receive`:
   - если `prepared` не выполнен, не отправлять `receive`, показать понятную ошибку «Сначала подготовьте CNC заказ».
7. Прогнать проверку сценариев:
   - CNC: `receive` до подготовки блокируется,
   - CNC: после успешного `cncSetDetails` + код → `receive` проходит,
   - CNC: `reject` доступен без подготовки,
   - не-CNC заказы работают как раньше.

## Риски
- Если не сохранять факт подготовки в БД, после reload страницы потребуется повторная подготовка (или доп. синк из Avito).
- Возможны отличия обязательных полей Avito по конкретным аккаунтам/типам доставки — ошибки API нужно явно показывать в UI.