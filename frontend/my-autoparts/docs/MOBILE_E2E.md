# Mobile E2E (Playwright)

Smoke tests for mobile viewports **360×640** and **390×844** against the production build (`build/`), with API responses mocked in the browser.

## Prerequisites

```bash
cd frontend/my-autoparts
npm ci
npm run build
npx playwright install chromium
```

## Run locally

```bash
npm run test:e2e          # headless, both mobile projects
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:report   # open HTML report after a failed run
```

The config starts `serve -s build -l 4173` automatically unless a server is already running (local only).

## Specs (`e2e/mobile/`)

| Spec | Flow |
|------|------|
| `guest-catalog.spec.js` | Guest opens new part detail, no horizontal scroll |
| `auth-login.spec.js` | Login → token in storage → logout redirect |
| `buyer-checkout.spec.js` | Authenticated buyer checkout sticky pay CTA |
| `seller-my-parts.spec.js` | Seller inventory list |
| `push-deeplink.spec.js` | `navigateToUrl` custom event → route change |

## Mocks

Central helpers live in `e2e/fixtures/`:

- `apiMocks.js` — catch-all `**/api/**` routing for catalog, auth, cart, seller products
- `testUsers.js` — mock JWT/profile payloads (no real secrets)
- `base.js` — cookie consent, SW stub, default guest mocks; `seedAuthSession(page)` for authenticated flows

When backend paths change, update `apiMocks.js` first — keep mock shapes aligned with FastAPI responses.

## CI

GitHub Actions job **`mobile-quality`** (after `frontend` build):

1. `npm run build`
2. `npm run test:e2e` (Chromium, 360 + 390)
3. `npx @lhci/cli autorun` (Lighthouse budgets in `lighthouserc.js`)

On failure, download the **`playwright-report`** artifact from the workflow run.

## Lighthouse budgets

Configured in [`lighthouserc.js`](../lighthouserc.js):

- Performance score ≥ 0.65 (warn)
- LCP ≤ 4000 ms (warn)
- CLS ≤ 0.15 (error)
- PWA: installable manifest + service worker (error)

## Debugging flakes

- Prefer `expect(locator).toBeVisible()` over `networkidle`
- Lazy routes: increase timeout on first assertion (15s in smoke specs)
- Re-run a single spec: `npx playwright test e2e/mobile/guest-catalog.spec.js --project=mobile-360`

See also [`MOBILE_QA_CHECKLIST.md`](./MOBILE_QA_CHECKLIST.md) automation map.
