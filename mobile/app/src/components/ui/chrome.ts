import type { TextStyle, ViewStyle } from "react-native";

import type { ThemeColors } from "../../theme/useTheme";

/** Карточка: белая поверхность + тонкий бордер + скругление 16. */
export function cardChrome(colors: ThemeColors): ViewStyle {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  };
}

/** Поле ввода: белый фон + бордер; invalid — danger-бордер. */
export function inputChrome(
  colors: ThemeColors,
  invalid = false,
): TextStyle {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: invalid ? colors.danger : colors.lineStrong,
    borderRadius: 12,
    color: colors.ink,
    minHeight: 48,
  };
}
