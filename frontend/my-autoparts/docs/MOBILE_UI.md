# Mobile UI guidelines (Свой Гараж)

Rules for app-like mobile layout without changing desktop (`lg:` and up).

**Roadmap:** поэтапная программа улучшений — [MOBILE_IMPROVEMENT_MASTER_PLAN.md](./MOBILE_IMPROVEMENT_MASTER_PLAN.md).

## Breakpoints (three width tiers)

| Режим | Width | Tailwind | JS |
|-------|-------|----------|-----|
| **Phone** | 360–767 | `max-md:` | `useIsNarrowMobile()`, `PHONE_MAX_MEDIA` |
| **Tablet shell** | 768–1023 | `max-lg:` | `useMobileShell()`, `MOBILE_SHELL_MAX_MEDIA` |
| **Desktop** | ≥1024 | `lg:` | default |

**Правила:**

- Fixed bottom UI (sticky CTA, page padding над nav) — `max-lg:` / CSS vars `--sg-mobile-*`.
- Phone-only UX (pull-to-refresh, PWA install prompt) — `max-md:` / `useIsNarrowMobile()`.
- Desktop (≥1024): не менять существующие desktop-only блоки.

Constants: [`src/constants/mobileTokens.js`](../src/constants/mobileTokens.js), [`src/constants/breakpoints.js`](../src/constants/breakpoints.js).

**Tablet 768–1023:** mobile shell (header + bottom nav) активен; PTR выключен (phone-only).

## Touch and spacing

- Minimum interactive height **44px** (`min-h-11` / `h-11`) for primary controls on mobile.
- Page body on mobile: prefer `text-base`; section titles: `text-lg font-semibold`.
- Horizontal padding on mobile pages: `max-md:px-3`; vertical rhythm: `max-md:py-4` where appropriate.

## Headers

- `MobileHeader` shows the page title below `lg` (`max-lg:`).
- Duplicate page `h1` / main title: add `max-lg:hidden` so it does not stack under the sticky header.

## Lists vs tables

- **Mobile shell:** card stacks — `max-lg:hidden space-y-3` or `md:hidden` for phone-only cards.
- **Desktop:** tables — `hidden lg:block` (or existing table unchanged).

Use `ResponsiveDataView` when the same data is rendered as a table on desktop and cards on mobile.

## Bottom spacing

| Token / CSS var | Use for |
|-----------------|---------|
| `--sg-mobile-bottom-nav-total` / `MOBILE_PAGE_BOTTOM_PAD` / `.pb-mobile-nav` | Scroll padding страницы над bottom nav |
| `--sg-mobile-sticky-bottom-offset` / `MOBILE_STICKY_BOTTOM_OFFSET` | Fixed sticky CTA bar **above** nav |

Nav content height: `3.5rem` (`--sg-mobile-bottom-nav-h`). Safe-area: `env(safe-area-inset-bottom)`.

## Sticky actions

- Primary form actions on long mobile forms: `MobileStickyFooter` with `form="…"` on the submit button.
- Position: `bottom: calc(3.5rem + env(safe-area-inset-bottom))` — via `MOBILE_STICKY_BOTTOM_OFFSET` or class `.sg-mobile-sticky-footer`.
- Z-index: `Z_MOBILE_STICKY_FOOTER` (45).

## Overlay z-index matrix

Bottom-fixed layers (low → high):

| Layer | Z | Token / CSS var |
|-------|---|-----------------|
| Mobile header | 40 | `Z_MOBILE_HEADER` |
| Sticky footer CTA | 45 | `Z_MOBILE_STICKY_FOOTER` |
| PWA install prompt | 48 | `Z_MOBILE_PWA_PROMPT` |
| Bottom navigation | 50 | `Z_MOBILE_BOTTOM_NAV` |
| Cookie banner | 56 | `Z_COOKIE_BANNER` |
| Mobile side menu | 60 | `Z_MOBILE_DRAWER` |
| Modal | 110 | `Z_MODAL` |
| Context menu | 120 | `Z_CONTEXT_MENU` |

New fixed overlays must use tokens from `mobileTokens.js` — не добавлять ad-hoc `z-[…]`.

## Safe area

- Respect `env(safe-area-inset-bottom)` and `pt-safe-top` where fixed UI touches the screen edges (see `MobileHeader`, `MobileStickyFooter`, `InstallPwaPrompt`).
- Prefer CSS variables over inline `calc(3.5rem + …)`.

## PWA install prompt

- Shown only on **phone** (`useIsNarrowMobile()`), not in standalone, not after dismiss (`localStorage` key `pwa_install_dismissed`).
- Android Chrome: `beforeinstallprompt` when available.
- iOS Safari: short instruction (Share → «На экран Домой»).
- **Manifest:** `public/manifest.json` — 512 + maskable icons, `id`, `lang: ru`, shortcuts (каталог, корзина).
- **Offline:** `public/offline.html` + SW fetch (navigation network-first → cached shell / offline page).
- **SW update:** [`AppUpdateBanner.jsx`](../src/components/AppUpdateBanner/AppUpdateBanner.jsx) — «Обновить приложение» after new SW install (`SKIP_WAITING` + reload).
- **Offline UX:** [`OfflineBanner.jsx`](../src/components/OfflineBanner/OfflineBanner.jsx) on mobile shell; mutating API calls blocked via [`networkStatus.js`](../src/utils/networkStatus.js); cart checkout buttons disabled offline.
- **Session renew:** `POST /auth/refresh` + [`useAuthSessionRenew.js`](../src/hooks/useAuthSessionRenew.js) (renew ~2 min before JWT exp); refresh token in `localStorage` (Phase B: HttpOnly cookie).
- **ErrorBoundary:** [`ErrorBoundary.jsx`](../src/components/ErrorBoundary/ErrorBoundary.jsx) wraps routes in `App.js`.
- **Build:** `npm run build` runs `scripts/inject-sw-precache.js` to inject hashed assets into SW.
- **Performance:** Tesseract loaded via dynamic `import()` in [`vinOcr.js`](../src/utils/vinOcr.js) only on scan path; main bundle baseline ~256KB gzip (document only).

## Accessibility baseline

- **Pinch-zoom:** viewport in `public/index.html` allows `maximum-scale=5` (WCAG 1.4.4).
- **Form inputs on phone:** `text-base` (16px) via `MobileFormField` or `max-md:text-base` — prevents iOS focus zoom.
- **Touch targets:** primary icon buttons and steppers ≥44px (`h-11` / `min-h-11`) on buyer-critical routes.
- **Dialogs:** `useFocusTrap` in [`Modal.jsx`](../src/components/UI/Modal.jsx) and [`MobileSideMenu`](../src/components/MobileSideMenu/MobileSideMenu.jsx) — Tab cycle, Escape, restore focus on close.
- **Legacy custom dialogs** (`ConfirmModal`, `MediaModal`, `OrderPaymentModal`, drawers) — migrate to `Modal` when touched in later stages; not required for stage 4.

## QA matrix

See [`MOBILE_QA_CHECKLIST.md`](./MOBILE_QA_CHECKLIST.md) for manual regression scenarios at 375px, 768px tablet, and desktop.

## VIN entry (buyer)

- **Shared navigation:** [`vinCatalogNavigation.js`](../src/utils/vinCatalogNavigation.js) — `buildVinCatalogPath`, `navigateToVinCatalog`, `resolveSearchOrVin`.
- **Entry points:** главная (`Main.jsx`), каталог (`MobileCompactSearch` / `AutoParts`), header search (`Search.jsx`).
- **Typed VIN:** client-side detect via `normalizeVinForSearchOrNull` → `/autoparts/vin?vin=…` (not `/find`).
- **Scan:** `VinScanModal` opens with **intro step** before `getUserMedia`; upload photo and manual entry available on deny/error.

## Offers mobile cards

- **VIN / new parts results:** [`VinCatalogOffersTable.jsx`](../src/pages/AutoParts/VinCatalog/VinCatalogOffersTable.jsx) renders [`VinCatalogOfferMobileCard`](../src/pages/AutoParts/VinCatalog/VinCatalogOfferMobileCard.jsx) below `md`; desktop table unchanged (`hidden md:block`).
- **Do not wire** orphan `VinCatalogOfferCard.jsx` — different data shape; reserved for product detail polish (stage 6).

## Product detail sticky bar

- **Shared component:** [`ProductDetailStickyBar.jsx`](../src/components/ProductDetail/ProductDetailStickyBar.jsx) — fixed CTA above bottom nav; uses `Z_MOBILE_STICKY_FOOTER` + `MOBILE_STICKY_BOTTOM_OFFSET`.
- **Scroll padding:** `MOBILE_PRODUCT_STICKY_SCROLL_PAD` (`max-md:pb-32`) on page wrapper when sticky visible.
- **New parts:** `/autoparts/new/part/:id` — price + cart stepper in sticky; inline card hides mobile CTA via `hideMobileCartCta`.
- **Used parts:** `/part/:id` — «Купить сейчас» / «Написать» in sticky (same component).

## Product detail gallery (mobile)

- **New:** [`NewPartDetailMobileGallery.jsx`](../src/pages/AutoParts/NewParts/NewPartDetailMobileGallery.jsx) — fixed aspect box + skeleton before load (CLS-safe).
- **Used:** full-bleed hero + swipe left/right; counter `aria-live="polite"`.
- **Layout:** new detail hides mobile header (`layoutProfiles.isNewPartDetail`) like used `/part/`.

## Cart mobile cards

- **Split layout:** [`CartPage.jsx`](../src/pages/Cart/CartPage.jsx) uses [`ResponsiveDataView`](../src/components/ResponsiveDataView/ResponsiveDataView.jsx) — [`CartItemMobileCard`](../src/pages/Cart/CartItemMobileCard.jsx) below `md`; desktop table keeps `min-w-[640px]` inside `hidden md:block`.
- **Mobile toolbar:** primary «Оформить» row + overflow `⋯` menu for move / repair-order / delete / clear.
- **Qty stepper:** `h-11` touch targets on mobile cards.

## Checkout sticky bar and draft

- **Sticky CTA:** [`ProductDetailStickyBar`](../src/components/ProductDetail/ProductDetailStickyBar.jsx) on new checkout (`/cart/new/checkout`), used checkout (`/order-reg`), payment (`/cart/new/pay/:id`) — `ariaLabel="Действия с заказом"`.
- **Scroll padding:** `MOBILE_PRODUCT_STICKY_SCROLL_PAD` on checkout/payment wrappers.
- **Draft persistence:** [`checkoutDraft.js`](../src/utils/checkoutDraft.js) — recipient/delivery in `sessionStorage`; partial checkout item IDs no longer cleared on checkout unmount.
- **Cart auth:** [`CartAuthModal`](../src/components/CartAuthModal/CartAuthModal.jsx) — shared `Modal` + `max-md:text-base` inputs.

## Chats (mobile)

- **Routes:** canonical `/chats?source=…&chatId=…`; legacy `/chats/:id` redirects to query form via [`resolveActiveChatParams.js`](../src/utils/resolveActiveChatParams.js).
- **Active chat shell:** bottom nav hidden (`layoutProfiles.isMobileActiveChat`); composer uses [`useVisualViewportInset`](../src/hooks/useVisualViewportInset.js) so keyboard does not cover input.
- **Secure media:** [`chatMediaAuth.js`](../src/utils/chatMediaAuth.js) — `Authorization: Bearer`, no `?token=` in URLs; lightbox uses `Z_MODAL`.
- **Unread:** [`chatUnread.js`](../src/utils/chatUnread.js) — shared `selectTotalUnreadCount` for list rows + bottom nav.
- **Push:** SW posts full URL with `source`; local history at `/profile/notification-center`.
- **iOS:** A2HS hint on notification settings + banner when not standalone PWA.

## Seller parts and warehouse (mobile)

- **Part-form recovery:** [`productDraftUtils.js`](../src/utils/productDraftUtils.js) + [`usePartFormLocalCache.js`](../src/hooks/usePartFormLocalCache.js) — debounced `sessionStorage` for AddPart (draft/pending/resubmit) and EditPart; flush on `visibilitychange` / `pagehide`.
- **Storage cells display:** [`StorageCellsDisplayTable.jsx`](../src/components/StorageCellsTable/StorageCellsDisplayTable.jsx) — vertical cards below `md`; desktop table unchanged.
- **Seller modals:** [`PrintReceiptModal`](../src/pages/MyParts/PrintReceiptModal/PrintReceiptModal.jsx), [`StockOutModal`](../src/pages/MyParts/StockOutModal/StockOutModal.jsx), [`ReturnModal`](../src/pages/StockOut/ReturnModal.jsx) — shared [`Modal`](../src/components/UI/Modal.jsx) with sticky footer on print.
- **Pull-to-refresh:** [`MyParts.jsx`](../src/pages/MyParts/MyParts.jsx), [`StockInList.jsx`](../src/pages/StockIn/StockInList.jsx), [`StockOutList.jsx`](../src/pages/StockOut/StockOutList.jsx) listen to `MOBILE_PULL_REFRESH_EVENT`.
- **Warehouse stats:** compact 3-column summary on phone for stock-in/out headers; toolbar actions wrap at ≤400px on stock-out.

## Seller sales, returns, finance (mobile)

- **Pull-to-refresh:** [`SalesOrdersPage.jsx`](../src/pages/Sales/SalesOrdersPage.jsx), [`SalesReturnsPage.jsx`](../src/pages/Sales/SalesReturnsPage.jsx), [`FinancePage.jsx`](../src/pages/Finance/FinancePage.jsx), [`DashboardPage.jsx`](../src/pages/Dashboard/DashboardPage.jsx), [`PurchasesOrdersPage.jsx`](../src/pages/Sales/PurchasesOrdersPage.jsx), [`PurchasesReturnsPage.jsx`](../src/pages/Sales/PurchasesReturnsPage.jsx) listen to `MOBILE_PULL_REFRESH_EVENT` for route-specific reload.
- **Order cards:** [`SalesGarageOrderCard.jsx`](../src/components/SalesOrders/SalesGarageOrderCard.jsx), [`AvitoOrderCard.jsx`](../src/components/AvitoOrderCard.jsx), [`PurchaseOrderCard.jsx`](../src/components/PurchaseOrderCard/PurchaseOrderCard.jsx) — primary CTAs `min-h-11`; checkbox hit areas enlarged on buyer order selection.
- **Modals:** CNC prepare/receive and warehouse retry on shared [`Modal`](../src/components/UI/Modal.jsx); seller return reject uses [`ConfirmDialog`](../src/components/UI/Modal.jsx); [`ReturnCreateModal`](../src/pages/Sales/PurchasesReturnsPage.jsx) migrated to shared Modal.
- **QR flows:** [`PickupVerifyModal.jsx`](../src/components/SalesOrders/PickupVerifyModal.jsx), [`ItemConfirmScanModal.jsx`](../src/components/SalesOrders/ItemConfirmScanModal.jsx) — shared [`Modal`](../src/components/UI/Modal.jsx) + [`useQrScannerCamera`](../src/components/QrScanner/useQrScannerCamera.js) (torch, haptics, safe camera stop); sticky footer CTA, `min-h-11` buttons, double-submit lock while `isSubmitting`.
- **Warehouse scan:** [`WarehouseScanPage.jsx`](../src/pages/Warehouse/WarehouseScanPage.jsx) — torch toggle, haptic feedback, bottom-nav padding; route `/warehouse/scan` in `isPullToRefreshDisabled`.
- **Scan entry:** [`StockInList.jsx`](../src/pages/StockIn/StockInList.jsx), [`StockOutList.jsx`](../src/pages/StockOut/StockOutList.jsx) — «Сканировать QR» CTA when `userHasWarehouseQrAccess`.
- **Print preview:** [`PrintReceiptModal`](../src/pages/MyParts/PrintReceiptModal/PrintReceiptModal.jsx) — on-screen scale disclaimer; print payload mm unchanged.
- **Inventory:** [`InventoryWizard.jsx`](../src/components/Warehouse/InventoryWizard.jsx) on shared Modal; count step buttons ≥44px.
- **Finance mobile:** channel filter as native `<select>` below `sm`; [`FinanceMobileCard`](../src/pages/Finance/FinancePage.jsx) stack — desktop table unchanged.
- **Integrations:** Avito and Drom settings show `md:hidden` hint «Массовые действия удобнее на ПК» with link to nomenclature pages.

## Autoservice (mobile)

- **Clients list:** [`AutoserviceClientsPage.jsx`](../src/pages/Autoservice/AutoserviceClientsPage.jsx) — `ClientMobileCard` below `md`; profile modal unchanged.
- **Order form:** [`AutoserviceOrderFormPage.jsx`](../src/pages/Autoservice/AutoserviceOrderFormPage.jsx) — sticky footer above bottom nav (`--sg-mobile-sticky-bottom-offset`); line items stack on `max-md`; shared `Modal` + `ConfirmDialog`; [`repairOrderFormDraft.js`](../src/utils/repairOrderFormDraft.js) session recovery on create.
- **PTR routes:** `/autoservice/orders`, `/autoservice/clients`, `/autoservice/planner`, `/autoservice/inspections`, `/autoservice/finance`, `/autoservice/reports`, `/garage`, `/autoservice/warehouse`, `/autoservice/warehouse/receipts`, `/autoservice/warehouse/expenses`.
- **PTR policy:** `/autoservice/orders/new` and `/autoservice/orders/:id/edit` in `isPullToRefreshFormOnly`.
- **Planner:** mobile day view zone header «+» opens create choice (order / inspection).
- **Garage:** vehicle delete via `ConfirmDialog`.

## Admin and moderation (mobile)

- **Product moderation:** [`ModerationProductRow`](../src/pages/Moderation/ProductModeration/productModerationShared.jsx) — footer CTAs «Просмотреть / Принять / Отклонить» (`min-h-11`) on phone; kebab menu hidden below `md`.
- **Org moderation page:** [`OrganizationProductModerationPage.jsx`](../src/pages/Moderation/ProductModeration/OrganizationProductModerationPage.jsx) — `ConfirmDialog` for approve; inline success/error banner; shared [`RejectProductModal`](../src/pages/Moderation/ProductModeration/RejectProductModal.jsx).
- **Pending sellers:** [`PendingSellersPage.jsx`](../src/pages/Moderation/PendingSellersPage.jsx) — approve via `ConfirmDialog`; reject via shared `Modal`; queue count in header.
- **Autoservice applications:** [`AutoserviceApplicationsPage.jsx`](../src/pages/Moderation/AutoserviceApplicationsPage.jsx) — `ConfirmDialog`; default button size (not `sm`).
- **Audit log:** [`AuditLogPage.jsx`](../src/pages/Admin/AuditLogPage.jsx) — detail on shared `Modal`.
- **Admin panel:** [`AdminPanelPage.jsx`](../src/pages/Admin/AdminPanelPage.jsx) — mobile quick links block; TOC chips `min-h-11` with horizontal scroll.
- **Analytics:** [`AnalyticsPage.jsx`](../src/pages/Admin/analytics/AnalyticsPage.jsx) — `md:hidden` «Удобнее на компьютере» banner; [`ConversionsTab.jsx`](../src/pages/Admin/analytics/ConversionsTab.jsx) — KPI cards on mobile, heavy funnel sections hidden with hint.
- **PTR routes:** `/moderation/pending-sellers`, `/moderation/products`, `/moderation/products/:orgId`, `/moderation/autoservice-applications`, `/admin/audit-log`, `/admin/users`.

## Release gate (CI)

PR merge to `main` expects green **`mobile-quality`** job:

- **Playwright:** 5 smoke flows × viewports 360 and 390 ([`MOBILE_E2E.md`](./MOBILE_E2E.md))
- **Lighthouse CI:** mobile emulation on `build/` — performance warn ≥0.65, LCP ≤4000 ms (warn), CLS ≤0.15 (error), installable manifest + service worker (error), total bytes ≤3.5 MB (warn)
- **Unit:** Jest + jest-axe smoke (Login, Modal, Cart shell, MobileHeader, ErrorBoundary)

Optional crash reporting: set `REACT_APP_SENTRY_DSN` in production; ErrorBoundary forwards to Sentry when DSN is configured.

Main bundle baseline (post stage 14): ~**258 KB gzip** — track via LHCI `total-byte-weight`, not a separate webpack gate.
