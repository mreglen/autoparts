import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";
import { PressableScale } from "./motion";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

interface ButtonProps {
  title?: string;
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
  style?: object;
  /** Компактный размер для тулбаров и строк. */
  compact?: boolean;
}

export function Button({
  title,
  children,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  className = "",
  style,
  compact = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border?: string }
  > = {
    primary: { bg: colors.brand, fg: "#ffffff" },
    secondary: { bg: colors.brandSoft, fg: colors.brand },
    outline: {
      bg: "transparent",
      fg: colors.inkSoft,
      border: colors.lineStrong,
    },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: "transparent", fg: colors.brand },
  };
  const tone = palette[variant];
  const isInactive = inactive && variant !== "ghost" && variant !== "outline";

  const content = (
    <View
      className={`flex-row items-center justify-center gap-2 rounded-xl ${compact ? "px-3 py-1.5" : "px-4 py-3"} ${className}`}
      style={[
        {
          backgroundColor: tone.bg,
          borderWidth: tone.border ? 1 : 0,
          borderColor: tone.border,
          opacity: inactive ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isInactive ? colors.inkFaint : tone.fg}
        />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={compact ? 15 : 18}
          color={isInactive ? colors.inkFaint : tone.fg}
        />
      ) : null}
      {typeof children === "string" || title ? (
        <Text
          className={compact ? "text-sm font-medium" : "text-base font-semibold"}
          style={{ color: isInactive ? colors.inkFaint : tone.fg }}
        >
          {children ?? title}
        </Text>
      ) : (
        children
      )}
    </View>
  );

  if (inactive) return content;
  return (
    <PressableScale onPress={onPress}>
      {content}
    </PressableScale>
  );
}
