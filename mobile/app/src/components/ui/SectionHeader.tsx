import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";

interface SectionHeaderProps {
  title: string;
  right?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, right, className }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View className={["mb-2 flex-row items-center justify-between", className].filter(Boolean).join(" ")}>
      <Text
        className="text-xs font-semibold uppercase"
        style={{ color: colors.inkMuted, letterSpacing: 0.5 }}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
