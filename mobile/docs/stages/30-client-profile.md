# Этап 30 — Профиль клиента

Статус: **реализован** (16.11.2026).

## Что сделано

### Backend / контракты

- `export_openapi.py`: добавлен префикс `/api/users/me` в мобильный срез —
  в `openapi.json`/`schema.d.ts` попали `PUT /api/users/me` и
  `POST|DELETE /api/users/me/avatar` (админ-эндпоинты `/api/users/*` не попали,
  префикс `/api/users/me` их не пересекает).
- `openapi.json` + `schema.d.ts` регенерированы.
- Backend-логика не менялась: `PUT /users/me` (`UserUpdate`: last_name,
  first_name, patronymic, email, phone, password) и `PATCH
  /notifications/preferences` уже существовали и валидируются Pydantic.

### Mobile

- `src/api/profile.ts` — `fetchMyProfile` (`/auth/profile`),
  `updateMyProfile` (`PUT /users/me`), `fetchNotificationPreferences`,
  `updateNotificationPreferences` (`PATCH /notifications/preferences`).
- `src/api/clientAccount.ts` — `fetchPublicAutoserviceOrgs`
  (`/public/autoservice/organizations`, через `cachedGet`).
- `src/screens/ClientProfileScreen.tsx` — новый экран:
  - шапка: аватар (`avatar_url` или инициалы) + ФИО + email;
  - «Данные аккаунта»: фамилия/имя/отчество/телефон/email, сохранение →
    `PUT /users/me` → `session.refreshProfile()`;
  - «Смена пароля»: сворачиваемая форма (текущий/новый/подтверждение,
    мин. 6 символов) → `session.changePassword` (`/auth/change-password`);
  - «Уведомления»: каналы push/email для 5 категорий
    (`orders/messages/search/other/autoservice`), переключатели применяются
    сразу (PATCH), при ошибке — откат состояния + toast;
  - «Мои автосервисы»: список `clientOrgs` с адресом/телефоном из публичного
    справочника СТО.
- Навигация: роут `ClientProfile` (title «Профиль») в `RootNavigator` +
  `RootStackParamList`; вход из `ClientMoreScreen` (строка «Профиль»).

## Осознанные ограничения

- **Аватар read-only**: загрузка фото не делалась — в проекте нет
  `expo-image-picker`; `POST /users/me/avatar` в API есть, UI загрузки —
  отдельной задачей при необходимости.
- **«Авто по умолчанию» не реализовано**: в модели garage-vehicle нет поля
  default/primary — нужна backend-миграция; отложено.
- **Ссылка на страницу СТО**: публичного URL автосервиса в мобильном API нет
  (`/public/autoservice/organizations` отдаёт только карточку); вместо ссылки
  показываем адрес/телефон.
- **Email/телефон**: `PUT /users/me` не нормализует телефон и не инвалидирует
  сессии — UX повторного входа не требуется; email-уникальность контролирует
  БД (ошибка → toast).
- Выход из аккаунта остался в `ClientMoreScreen` (общий для обеих ролей).

## Проверки

- `npm run typecheck` — чисто;
- `npm run lint` — чисто;
- `npm test` — 27/27;
- backend не менялся, backend-тесты не требовались.
