# Design system — Свой Гараж

## Tokens (`tailwind.config.js`)
- `brand` — primary indigo (#4f46e5)
- `accent` — warm orange for б/у and warnings
- `surface` / `surface-muted` — page and card backgrounds
- `ink` / `ink-soft` / `ink-muted` / `ink-faint` — text
- `line` — borders
- `success` / `warning` / `danger` — status
- Radii: `rounded-sg`, `rounded-sg-lg`
- Shadows: `shadow-sg`, `shadow-sg-md`

## Components (`src/components/UI/`)
Button, Card, Field (Input/Select/Textarea/Checkbox), Badge, Modal/ConfirmDialog, EmptyState, SectionHeader/PageHeader, Skeleton, DataTable

Import as `from '../../components/UI'` (capital `UI` — required for Linux deploy).

## Preview
Admin-only route: `/design-system` (also in Админка menu)

## Content
- Copy: `src/utils/brandCopy.js`
- Illustrations: `src/components/illustrations/BrandIllustrations.jsx`
- Photo brief: `docs/brand-content.md`
- Release checklist: `docs/redesign-checklist.md`
