---
name: Finalize CNC transition flow
overview: "Привести CNC-логику к единому потоку: без отдельного checkConfirmationCode, только applyTransition, при этом confirmCode передавать на receive вместе с marketplaceId."
todos:
  - id: remove-precheck-from-transition-flow
    content: Убрать вызов checkConfirmationCode из CNC receive потока в backend и frontend.
    status: completed
  - id: normalize-cnc-transition-payload
    content: Зафиксировать payload receive как params.cnc.confirmCode + marketplaceId в applyTransition.
    status: completed
  - id: cleanup-legacy-check-path
    content: Привести в порядок схему/endpoint check-confirmation-code (удалить или оставить как неиспользуемый).
    status: completed
  - id: validate-single-flow
    content: Проверить, что CNC сценарий проходит только через applyTransition без лишних 400.
    status: completed
isProject: false
---

# Финализировать CNC applyTransition flow

## Цель
Убрать рассинхронизацию между разными схемами интеграции и оставить один рабочий путь: CNC подтверждение/доставка через `applyTransition`, без отдельного `checkConfirmationCode` endpoint, с передачей `confirmCode + marketplaceId` на `receive`.

## Что меняем
- Убрать pre-check вызовы `checkConfirmationCode` из backend и frontend flow.
- Для CNC `receive` оставляем только один запрос `applyTransition` с `params.cnc.confirmCode` и `params.cnc.marketplaceId`.
- Вернуть/сохранить использование `marketplaceId` из `avito_data` для CNC перехода.
- Актуализировать тексты/схемы, чтобы не было упоминаний `parcelID` и лишнего endpoint-потока.

## Файлы
- [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/routers/sales.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/routers/sales.py)
- [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/services/avito_orders_api.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/services/avito_orders_api.py)
- [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/schemas/avito_orders.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/schemas/avito_orders.py)
- [C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx](C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx)

## Шаги реализации
1. Backend router (`sales.py`):
   - в `apply_avito_order_transition` убрать pre-check вызов `check_confirmation_code`;
   - в CNC `receive` оставить валидацию `confirmCode` (4 цифры) и `marketplaceId`, затем сразу `apply_order_transition(...)`.
2. Backend service (`avito_orders_api.py`):
   - удалить/деактивировать использование `check_confirmation_code` в боевом потоке (функцию можно оставить как неиспользуемую или убрать по решению);
   - убедиться, что `apply_order_transition` корректно передает `params.cnc` без модификации.
3. Backend schema (`avito_orders.py`):
   - привести `AvitoCheckConfirmationCodeRequest` к статусу неиспользуемого (или удалить endpoint/схему целиком, если безопасно);
   - оставить в `AvitoOrderTransitionRequest` описание `params.cnc.confirmCode/marketplaceId` как основной контракт.
4. Frontend (`SalesOrdersPage.jsx`):
   - убрать отдельный вызов `/sales/avito-orders/{id}/check-confirmation-code` перед `receive`;
   - оставить отправку `transition=receive` с `params.cnc.confirmCode` и `params.cnc.marketplaceId`.
5. Проверка:
   - CNC `receive` отправляет только `applyTransition`;
   - код 4 цифры валидируется до запроса;
   - отсутствуют ошибки из-за `checkConfirmationCode` payload;
   - `confirm/reject/perform/receive` отображаются и работают по текущей карте transitions.

## Риски
- Если Avito в конкретных сценариях реально требует предварительный `checkConfirmationCode`, возврат 400 нужно обрабатывать понятным сообщением и (опционально) включать fallback.
- При удалении endpoint `/check-confirmation-code` важно убедиться, что его больше нигде не вызывает фронт.