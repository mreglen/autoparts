import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View className="items-center px-6 pt-14">
      <View
        className="mb-4 h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: colors.brandSoft }}
      >
        <Ionicons name={icon} size={28} color={colors.brand} />
      </View>
      <Text
        className="text-center text-base font-semibold"
        style={{ color: colors.ink }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          className="mt-1 text-center text-sm"
          style={{ color: colors.inkMuted }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-5 self-stretch">
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
