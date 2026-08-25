# Mobile QA checklist (375px + desktop)

Use together with [`MOBILE_UI.md`](./MOBILE_UI.md), the stage roadmap [`MOBILE_IMPROVEMENT_MASTER_PLAN.md`](./MOBILE_IMPROVEMENT_MASTER_PLAN.md), and E2E runbook [`MOBILE_E2E.md`](./MOBILE_E2E.md).

## Автоматизация (CI / unit)

| Ручной блок | Автотест |
|-------------|----------|
| Guest catalog → part detail | `e2e/mobile/guest-catalog.spec.js` @360/390 |
| Cart checkout (new parts) | `e2e/mobile/buyer-checkout.spec.js` |
| Seller my-parts list | `e2e/mobile/seller-my-parts.spec.js` |
| Push deep link (`navigateToUrl`) | `e2e/mobile/push-deeplink.spec.js` |
| Auth login / session cleared | `e2e/mobile/auth-login.spec.js` |
| Login form a11y | `Login.a11y.test.jsx` |
| Modal focus trap | `Modal.a11y.test.jsx` |
| Cart empty shell a11y | `CartPage.a11y.test.jsx` |
| Mobile header landmark | `MobileHeader.a11y.test.jsx` |
| PWA installable manifest + SW | LHCI (`lighthouserc.js`) |
| ErrorBoundary retry UI | `ErrorBoundary.test.jsx` |
| PWA offline / airplane mode | **manual** |
| Session 2h refresh | **manual** |

## Viewports

| Ширина | Фокус |
|--------|--------|
| 375px | iPhone: каталог → карточка товара → корзина → оформление |
| 375px | AddPart / EditPart: все секции, сохранение, ячейки карточками |
| 390px | PWA: баннер установки → «Не показывать» → не появляется после перезагрузки |
| ≥1024px | Регрессия: боковое меню кабинета, таблицы, формы без изменений |

## Сценарии по ролям

- **Покупатель:** главная (поиск только в шапке на mobile), каталог, PartDetail (липкий CTA), **корзина (карточки без H-scroll)**, **checkout/payment (sticky итог + оплата)**, **чаты (composer над клавиатурой, без token в media URL, push deep link)**.

## Чаты и push (375px)

- [ ] Открыть чат из push (Android Chrome / PWA) — правильный `source` и `chatId`
- [ ] `/chats/:id` → редирект на `/chats?chatId=…`
- [ ] Отправить фото — превью и lightbox без `?token=` в Network
- [ ] Клавиатура не перекрывает поле ввода в активном чате
- [ ] Badge непрочитанных совпадает в списке и bottom nav
- [ ] Голосовое Avito воспроизводится (VoicePlayer, touch ≥44px)
- [ ] iOS Safari: подсказка A2HS на `/profile/notifications`
- [ ] `/profile/notification-center` — история push на устройстве

## Корзина и checkout (375px)

- [ ] Корзина: 3+ позиции — вертикальные карточки, **нет horizontal scroll**
- [ ] Корзина: выбор части позиций → checkout только выбранных
- [ ] New checkout: sticky «Оплатить» виден при скролле; оферта в scroll area
- [ ] New checkout → pay → back: recipient и доставка восстановлены из draft
- [ ] Used checkout: sticky «Оформить» над bottom nav
- [ ] Payment SBP: QR ≥200px; sticky «Оплатить картой» на mobile
- [ ] Payment expired / refunded / fulfillment_failed — сообщения и ссылки
- [ ] Guest checkout: CartAuthModal → auth → resume checkout route
- **Продавец:** AddPart / EditPart, финансы (сворачиваемые фильтры), склад/адреса, Авито/Drom (подсказки), **заказы/возвраты/дашборд (PTR, confirm на reject)**.
- **Админ:** журнал аудита (фильтры), модерация (карточки с footer CTAs), analytics — KPI на телефоне, deep dives «удобнее на ПК».

## Продавец: товары и склад (375px)

- [ ] AddPart: прервать ввод (свернуть вкладку) → вернуться — поля и ячейки восстановлены из session cache
- [ ] EditPart: изменить описание → перезагрузка — черновик восстановлен
- [ ] MyParts: развернуть ячейки — карточки без horizontal scroll
- [ ] MyParts: pull-to-refresh — список и модерация обновляются
- [ ] Печать этикетки: modal на телефоне, кнопка «Распечатать» в sticky footer
- [ ] Stock-in / stock-out: сводка (документы / сумма) видна на телефоне
- [ ] StorageAddresses: кнопки редактирования/удаления ≥44px

## Продавец: заказы, возвраты, финансы (390px)

- [ ] `/warehouse-sales`: pull-to-refresh обновляет список; индикатор refresh при фоновом reload
- [ ] `/warehouse-sales`: CNC prepare/receive — modal с focus trap; Avito warehouse retry banner
- [ ] `/warehouse-sales`: выдача заказа (PickupVerifyModal) — sticky CTA, кнопки ≥44px, нет double-submit
- [ ] `/warehouse-sales`: подтверждение позиции (ItemConfirmScanModal) — fullscreen на телефоне, «Подтвердить» ≥44px
- [ ] `/sales/returns`: отклонение возврата — ConfirmDialog; Avito transitions на русском
- [ ] `/finance`: pull-to-refresh; channel filter — select на телефоне, pills на sm+
- [ ] `/dashboard`: pull-to-refresh; quick action «Финансы» ведёт на `/finance`
- [ ] `/purchases/orders`, `/purchases/returns`: pull-to-refresh; bottom-nav padding
- [ ] `/settings/integration/drom`: mobile hint про массовые действия на ПК
- [ ] Order cards (Garage / Avito / Purchase): primary actions ≥44px без horizontal scroll

## Автосервис (390px)

- [ ] `/autoservice/clients`: карточки клиентов без H-scroll; PTR; create account — ConfirmDialog
- [ ] `/autoservice/orders/new`: sticky «Сохранить» над bottom nav; строки работ/ЗЧ stack на телефоне
- [ ] `/autoservice/orders/new`: прервать ввод → вернуться — черновик восстановлен
- [ ] `/autoservice/orders`: PTR; удаление ЗН — ConfirmDialog
- [ ] `/autoservice/planner`: mobile day view; «+» в зоне создаёт запись
- [ ] `/autoservice/inspections`, `/autoservice/finance`, `/autoservice/reports`, `/garage`: PTR
- [ ] `/garage`: удаление авто — ConfirmDialog
- [ ] Print routes (`/autoservice/orders/:id/print*`) — A4 без регрессии

## Склад, QR, печать (390px)

- [ ] `/warehouse/scan`: pull-to-refresh **отключён**; камера освобождается при уходе со страницы
- [ ] `/warehouse/scan`: torch (Android) + haptic/vibration на success/error scan
- [ ] `/warehouse/scan`: ручной ввод и «Повторить» — кнопки ≥44px; bottom-nav padding
- [ ] `/stock-in`, `/stock-out`: кнопка «Сканировать QR» → `/warehouse/scan`
- [ ] `/warehouse-sales`: PickupVerifyModal — shared Modal, focus trap, torch, haptics
- [ ] `/warehouse-sales`: ItemConfirmScanModal — fullscreen mobile, torch, close ≥44px
- [ ] Печать этикетки: preview с подписью «приблизительный масштаб»; print mm без изменений
- [ ] `/qr/label/:code`: ошибка — «Открыть сканер» + ссылка на «Мои запчасти»
- [ ] Инвентаризация (WmsStorages): wizard на shared Modal; count actions ≥44px
- [ ] `/autoservice/warehouse*`: pull-to-refresh обновляет списки

## Админка и модерация (390px)

- [ ] `/moderation/products`: карточки организаций — tap ≥44px; PTR обновляет очередь
- [ ] `/moderation/products/:orgId`: footer «Просмотреть / Принять / Отклонить» ≥44px; approve — ConfirmDialog; reject — shared Modal
- [ ] `/moderation/pending-sellers`: approve — ConfirmDialog; reject — Modal; queue count в шапке; PTR
- [ ] `/moderation/autoservice-applications`: approve — ConfirmDialog; PTR
- [ ] `/admin/audit-log`: detail modal на shared Modal; PTR; фильтры без H-scroll
- [ ] `/admin/users`: mobile cards + actions dropdown; PTR
- [ ] `/admin`: mobile quick links; TOC chips ≥44px, horizontal scroll
- [ ] `/admin/analytics`: banner «удобнее на компьютере»; Conversions — KPI видны, funnel скрыт с подсказкой

## PWA, offline и session (390px)

- [ ] Lighthouse PWA: installable, 512 icon, themed manifest
- [ ] Chrome → «Установить приложение» → standalone открывается на `/autoparts/new`
- [ ] Airplane mode → PWA показывает offline shell или `/offline.html` + OfflineBanner
- [ ] Online → offline: кнопки «Оформить» в корзине disabled; POST API → «Нет сети»
- [ ] Deploy новой версии при открытом приложении → «Обновить приложение» → reload
- [ ] Push notification click → deep link без регрессии
- [ ] Login → 35+ min → API call без re-login (refresh token)
- [ ] Runtime error → ErrorBoundary «Повторить» / «На главную»
- [ ] Metrika не грузится до принятия cookie banner

## Сборка

```bash
cd frontend/my-autoparts
npm run build
```

## Lighthouse (опционально)

- Mobile: PWA, tap targets.
- Убедиться, что `manifest.json` содержит иконку 512 и `theme_color`.
