import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../../theme/useTheme";
import { cardChrome } from "./chrome";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Внутренние отступы p-4; выключить для карточек-обёрток списков. */
  padded?: boolean;
}

export function Card({
  children,
  className,
  style,
  padded = true,
}: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      className={[padded ? "p-4" : "", className].filter(Boolean).join(" ")}
      style={[cardChrome(colors), style]}
    >
      {children}
    </View>
  );
}
