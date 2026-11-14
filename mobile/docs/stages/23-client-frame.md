# Этап 23 — Ролевая модель и каркас клиента

План этапа из `mobile/docs/PLAN-client.md` (карта — там). Решения пользователя (15.11.2026):
переключатель ролей — в «Ещё»; роль по умолчанию у dual-role — сотрудник; глубина — каркас +
простые read-only списки там, где API уже готов.

## Что уже есть

- Бэкенд этапа 22: `/autoservice/clients/me/orgs`, `/autoservice/clients/me`,
  `/autoservice/repair-orders/me` (+`organization_id`, org-поля), `/me/{id}/pdf`,
  `/autoservice/inspection-bookings/me` (мульти-орг), `/autoservice/garage/vehicles`
  (с `organization_id`), `/public/autoservice/organizations`.
- Приложение: staff-табы по `permission_codes`, offline-кэш `cachedGet` + `CACHE_POLICIES`,
  UI-kit (`Screen`, `ListRow`, `StaleDataBadge`, `Skeleton`, `Toast`), персистентный kv.

## Решения этапа

1. **Роль = «staff» | «client»**, определяется так:
   - staff: `hasAnyPermission(user, permission_codes)` (bypass admin/director/seller или
     сотрудник с autoservice-правами) — то же условие, что видимость staff-табов;
   - client: `GET /autoservice/clients/me/orgs` вернул непустой список.
2. **Активная роль** персистится (`sg:active-role`); дефолт — staff, если доступен,
   иначе client. При смене роли таб-навигатор пересоздаётся (состояние табов сбрасывается —
   приемлемо).
3. **Переключатель** — строка в «Ещё» соответствующей роли, только у dual-role.
4. **Клиентские табы:** «Гараж» (авто), «Записи» (мои записи), «Ещё» (сервисы, история,
   профиль, выход). История ремонтов — stack-экран из «Ещё».
5. Данные — только read-only через `cachedGet`; записи/редактирование — этапы 25–27.

## Файлы

- `src/api/clientAccount.ts` — типы и fetcher'ы клиентского контура.
- `src/auth/roles.tsx` — `RoleProvider`/`useAppRole`: clientOrgs, canUseStaff/canUseClient,
  activeRole + персистентность.
- `src/navigation/ClientTabs.tsx` — таб-навигатор клиента.
- `src/screens/ClientGarageScreen.tsx`, `ClientBookingsScreen.tsx`,
  `ClientHistoryScreen.tsx`, `ClientMoreScreen.tsx`.
- `src/navigation/RootNavigator.tsx` — `AppShell` выбирает Tabs/ClientTabs; роут
  `ClientHistory` в стеке.
- `src/navigation/types.ts` — `ClientHistory: undefined`.
- `src/offline/policies.ts` — политики `/autoservice/garage` и `/public/autoservice`.
- `src/storage/keys.ts` — `ACTIVE_ROLE_KEY`.
- `src/screens/MoreScreen.tsx` — строка переключения роли для dual-role.
- `App.tsx` — подключить `RoleProvider`.

## Критерии готовности

- Аккаунт без staff-прав и с клиентской карточкой → клиентские табы.
- Dual-role → staff-табы + переключатель в «Ещё» в обе стороны.
- Клиент видит свои записи и историю с `StaleDataBadge` офлайн.
- `npm run typecheck`, `npm test`, `npm run lint` чисты.
