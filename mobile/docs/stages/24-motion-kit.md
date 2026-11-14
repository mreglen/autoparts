# Этап 24 — Дизайн-система и motion-кит

План этапа из `mobile/docs/PLAN-client.md`. Статус: **ядро реализовано** (15.11.2026),
остаток — в разделе «Отложено».

## Что сделано

- **`src/theme/motion.ts`** — motion-токены: `DURATION` (fast 120 / base 200 / slow 320 /
  slower 480), `EASING` (standard/exit/enter, cubic-bezier), `STAGGER` (шаг 35 мс,
  потолок 280 мс), `PRESS`. Чистые константы — безопасны для jest/node.
- **`src/components/ui/motion.tsx`** — примитивы на RN Animated (осознанно без reanimated
  для простых случаев: меньше поверхности, jest-friendly):
  - `PressableScale` — масштаб 0.97 при нажатии, токены `PRESS`/`DURATION.fast`;
  - `FadeSlideIn` — появление блока fade + translateY 8→0 с `staggerDelay(index)`.
- **`src/utils/haptics.ts`** — обёртки `expo-haptics` (`haptic`, `hapticLight/Medium/
  Selection/Success/Error`). Модуль подгружается ленивым `require` — в jest/node молча
  пропускается.
- **Зависимость:** `expo-haptics ~58.0.8` (входит в набор Expo Go — iOS-ветка не страдает).
- **Миграция на токены:** `Skeleton` (пульс → `DURATION.slower`), `Toast`
  (180 мс → `DURATION.fast`, easing из токенов; success/error-варианты теперь дают
  тактильный отклик через `hapticSuccess`/`hapticError`).
- **Применение:** `ListRow` переведён на `PressableScale` — press-отклик теперь на всех
  строках приложения; клиентские списки (`ClientGarageScreen`, `ClientBookingsScreen`,
  `ClientHistoryScreen`) — stagger-появление строк через `FadeSlideIn`.

## Правила использования (для следующих этапов)

- Длительности/кривые — только из `theme/motion.ts`, литеральных ms в новых экранах нет.
- Новые списки — строки через `FadeSlideIn index={i}` (stagger бесплатный).
- Нажимаемые карточки/строки — `PressableScale` вместо голого `Pressable`.
- Результат действия → `Toast` (он сам даёт success/error-haptics); отдельные haptic-вызовы
  — только для значимых событий (подтверждение записи, удаление), не на каждый тап.
- Reanimated (`useSharedValue`/`withSpring`) — для сложной хореографии (планировщик,
  жесты, shared-element); для fade/scale достаточно RN Animated.

## Отложено (следующие этапы)

- Свайп-действия в списках (`react-native-gesture-handler` + Reanimated Swipeable) —
  кандидат на этапы 26–27 (отмена записи, быстрые действия).
- Success-анимация сохранения (checkmark burst) — к этапу 27 (создание записи).
- Shared-element переход фото авто → карточка — к этапу 25.
- Чек-лист доступности (контраст, tap ≥44pt, скринридер) — формализуется в этапе 32.
- Паттерны deep-link из уведомлений — к этапу 28.

## Проверки

- `npm run typecheck`, `npm run lint`, `npm test` — чисто.
- Визуальная проверка на устройстве/Expo Go — при следующем прогоне приложения.
