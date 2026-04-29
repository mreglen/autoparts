---
name: Fix Avito transition UX
overview: Перенести ввод CNC confirmCode с transition `confirm` на `receive`, и заменить browser `alert/prompt` на UI-модалку с нормальным подтверждением/ошибками в `/sales/orders`.
todos:
  - id: frontend-transition-logic
    content: Перенести CNC code flow с confirm на receive в SalesOrdersPage и убрать alert/prompt.
    status: completed
  - id: frontend-modal
    content: Добавить модалку ввода confirmCode для receive и обработку ошибок/лоадера через state.
    status: completed
  - id: backend-cnc-flow
    content: Перенести backend проверку confirmCode/check_confirmation_code с confirm на receive.
    status: completed
  - id: qa-flow-check
    content: Проверить сценарии transition для confirm/reject/perform/receive на /sales/orders.
    status: completed
isProject: false
---

# Исправить переходы Avito и UX ввода кода

## Что меняем
- Обновить логику переходов на странице заказов так, чтобы:
  - `confirm` выполнялся без запроса кода.
  - `receive` для CNC требовал ввод `confirmCode` через модалку.
- Убрать использование `window.prompt` и `alert` в Avito-сценарии; заменить на управляемый UI (модалка + inline ошибки/состояния).
- Синхронизировать backend-валидацию с новой логикой: код проверяется/передаётся на `receive`, а не на `confirm`.

## Точки изменений
- Фронт-логика переходов: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx](C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx)
- Карточка Avito (если потребуется проброс состояния/колбэков модалки): [C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/components/AvitoOrderCard.jsx](C:/Users/khram/OneDrive/Рабочий стол/autoparts/frontend/my-autoparts/src/components/AvitoOrderCard.jsx)
- Backend transition endpoint: [C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/routers/sales.py](C:/Users/khram/OneDrive/Рабочий стол/autoparts/backend/app/routers/sales.py)

## Детальный подход
- В `applyAvitoTransition`:
  - Перенести CNC-проверку с условия `transition === 'confirm'` на `transition === 'receive'`.
  - При `receive` открывать модалку ввода кода, валидировать непустое значение, и только затем отправлять `/sales/avito-orders/{id}/transition` с `params.cnc`.
  - Для ошибок и подтверждений использовать состояние компонента (текст ошибки/статус выполнения), без browser alerts.
- Добавить/встроить модалку в `SalesOrdersPage`:
  - Поля: код подтверждения.
  - Кнопки: отмена / подтвердить.
  - Состояния: загрузка, ошибка backend (`response.data.detail`).
- В backend `apply_avito_order_transition`:
  - Логику `check_confirmation_code` и требование `marketplaceId` для CNC перенести на `transition == 'receive'`.
  - Для `confirm` не требовать код и не делать pre-check.
- Прогнать проверку сценариев:
  - `confirm` для CNC/RDBS проходит без модалки.
  - `receive` для CNC без кода блокируется на UI.
  - `receive` для CNC с кодом проходит pre-check и transition.
  - Ошибки Avito показываются в модалке, а не alert.

## Риски и контроль
- Важно не сломать текущие transitions (`reject`, `perform`) и блокировки по `availableTransitions`.
- Проверить, что мобайл и десктоп ветки страницы используют одну и ту же новую логику модалки.