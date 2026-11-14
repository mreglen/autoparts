/** Motion-токены приложения (mobile/docs/stages/23-client-frame.md → этап 24).
 *  Чистые константы без импортов RN — файл безопасен для jest/node.
 *  Длительности в ms; easing — cubic-bezier(x1,y1,x2,y2) для RN Animated/Easing.bezier
 *  и react-native-reanimated/Easing.bezier (совместимы). */

export const DURATION = {
  /** Микро-отклик: нажатие, переключение. */
  fast: 120,
  /** Стандартное появление/скрытие. */
  base: 200,
  /** Крупные переходы: sheet, подтверждения. */
  slow: 320,
  /** Долгие акценты: skeleton-пульс, stagger-хвост. */
  slower: 480,
} as const;

export const EASING = {
  /** Стандартный вход/выход (material standard). */
  standard: [0.2, 0, 0, 1] as const,
  /** Ускоренный выход — для dismiss-эффектов. */
  exit: [0.3, 0, 1, 1] as const,
  /** Мягкий вход для контентных блоков. */
  enter: [0, 0, 0.2, 1] as const,
} as const;

export const STAGGER = {
  /** Задержка между строками списка. */
  itemDelay: 35,
  /** Максимальная суммарная задержка — хвост не растягиваем. */
  maxDelay: 280,
} as const;

export function staggerDelay(index: number): number {
  return Math.min(index * STAGGER.itemDelay, STAGGER.maxDelay);
}

export const PRESS = {
  /** Масштаб нажатия для PressableScale. */
  scale: 0.97,
  /** Длительность нажатия/отпускания. */
  duration: DURATION.fast,
} as const;
