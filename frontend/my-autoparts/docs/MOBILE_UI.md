# Mobile UI guidelines (Свой Гараж)

Rules for app-like mobile layout without changing desktop (`md:` and up).

## Breakpoints

- **Mobile / narrow:** `< 768px` — Tailwind `max-md:` or `md:hidden`.
- **Desktop:** `≥ 768px` — default styles; avoid changing existing desktop-only blocks.

Use `src/constants/breakpoints.js` and `useIsNarrowMobile()` when JavaScript must mirror the same breakpoint.

## Touch and spacing

- Minimum interactive height **44px** (`min-h-11` / `h-11`) for primary controls on mobile.
- Page body on mobile: prefer `text-base`; section titles: `text-lg font-semibold`.
- Horizontal padding on mobile pages: `max-md:px-3`; vertical rhythm: `max-md:py-4` where appropriate.

## Headers

- `MobileHeader` shows the page title on `< md`.
- Duplicate page `h1` / main title: add `max-md:hidden` so it does not stack under the sticky header.

## Lists vs tables

- **Mobile:** card stacks — `md:hidden space-y-3`.
- **Desktop:** tables — `hidden md:block` (or existing table unchanged).

Use `ResponsiveDataView` when the same data is rendered as a table on desktop and cards on mobile.

## Sticky actions

- Primary form actions on long mobile forms: `MobileStickyFooter` with `form="…"` on the submit button so it stays above the bottom navigation (`bottom: calc(4.5rem + safe-area)`).

## Safe area

- Respect `env(safe-area-inset-bottom)` and `pt-safe-top` where fixed UI touches the screen edges (see `MobileHeader`, `MobileStickyFooter`, `InstallPwaPrompt`).

## PWA install prompt

- Shown only on mobile, not in standalone, not after dismiss (`localStorage` key `pwa_install_dismissed`).
- Android Chrome: `beforeinstallprompt` when available.
- iOS Safari: short instruction (Share → «На экран Домой»).

## QA matrix

See [`MOBILE_QA_CHECKLIST.md`](./MOBILE_QA_CHECKLIST.md) for manual regression scenarios at 375px and desktop.
