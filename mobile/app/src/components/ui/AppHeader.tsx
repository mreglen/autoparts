import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
}

/** Единый заголовок экрана: eyebrow + title + subtitle + действия справа. */
export function AppHeader({ title, subtitle, eyebrow, right }: AppHeaderProps) {
  const { colors } = useTheme();
  return (
    <View className="mb-4 flex-row items-start justify-between">
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text
            className="mb-1 text-xs font-semibold uppercase"
            style={{ color: colors.brand, letterSpacing: 0.6 }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-2xl font-bold" style={{ color: colors.ink }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm" style={{ color: colors.inkMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
