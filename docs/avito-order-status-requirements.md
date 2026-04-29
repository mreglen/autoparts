# Avito Order Status Requirements

Документ фиксирует требования интеграции статусов заказов Avito для `/sales/orders` и правила применения переходов.

Источник: [Avito Order Management API](https://developers.avito.ru/api-catalog/order-management/documentation#operation/checkConfirmationCode).

## 1. Поддерживаемые статусы и переходы

Минимальный рабочий граф переходов:

- `on_confirmation` -> `ready_to_ship` (`confirm`)
- `on_confirmation` -> `canceled` (`reject`)
- `ready_to_ship` -> `in_transit` (`perform`)
- `in_transit` -> `delivered` (`receive`)

Статусы `closed`, `on_return`, `in_dispute` считаются специальными/терминальными и не должны назначаться из UI вручную через локальные маппинги.

## 2. Обязательное правило по transitions

Перед каждым `applyTransition` backend обязан:

1. Получить доступные переходы через `GET /orders/{orderId}/transitions`.
2. Проверить, что запрошенный `transition` входит в список `available transitions`.
3. Если не входит — вернуть `409` и список доступных действий.

Это защищает от ошибок после ожидания, когда состояние заказа уже изменилось на стороне Avito.

## 3. CNC-заказы и checkConfirmationCode

Для CNC (`delivery.type == cnc` или `delivery.serviceType == cnc`) при `confirm`:

- обязательный `params.cnc.marketplaceId`;
- если используется код подтверждения — обязательный `params.cnc.confirmCode`;
- перед `applyTransition(confirm)` требуется `checkConfirmationCode`.

Backend endpoint:

- `POST /sales/avito-orders/{order_id}/check-confirmation-code`
  - `confirm_code`
  - `marketplace_id` (может быть взят из `avito_data.marketplaceId`)

После успешной проверки кода выполняется `applyTransition`.

## 4. Контракт backend endpoints

- `GET /sales/avito-orders/{order_id}/transitions`  
  Возвращает доступные переходы для текущего состояния заказа.

- `POST /sales/avito-orders/{order_id}/check-confirmation-code`  
  Проверяет код подтверждения для CNC.

- `POST /sales/avito-orders/{order_id}/transition`  
  Применяет переход:
  - `transition`: `confirm|reject|perform|receive`
  - `params` (опционально, но обязателен для CNC confirm по правилам выше)

## 5. Ошибки и ожидаемое поведение UI

Backend не должен превращать все ошибки Avito в `502`.

Рекомендуемый маппинг:

- `400/422` — валидация данных (плохой код, отсутствуют обязательные params)
- `401` — проблема токена/авторизации
- `403` — нет доступа к заказу
- `404` — заказ недоступен/не найден
- `409` — transition недоступен для текущего статуса
- `5xx` — инфраструктурные проблемы Avito

UI должен:

- показывать текст ошибки от backend;
- блокировать повторную отправку transition, пока запрос выполняется;
- после успешного перехода делать refresh списка заказов с backend (backend — источник истины).

## 6. Требования к frontend /sales/orders

1. Не использовать fallback-переходы без ответа backend transitions.
2. Для CNC confirm запрашивать `confirmCode` у пользователя.
3. Вызывать check-code endpoint перед applyTransition.
4. После успеха обновлять данные заказов повторным чтением (`/sales/avito-orders`).

## 7. Требования к логированию

Для диагностики в backend логировать:

- `order_id`, `avito_order_id`, `requested_transition`;
- `delivery_type`, `marketplaceId` (без утечки чувствительных данных);
- `available transitions` на момент запроса;
- статус/тело ответа Avito при ошибках.
