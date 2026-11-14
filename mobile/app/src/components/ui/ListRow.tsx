import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";
import { PressableScale } from "./motion";

interface ListRowProps {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  destructive?: boolean;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  destructive,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View
      className="flex-row items-center justify-between rounded-xl px-4 py-3"
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <View className="min-w-0 flex-1">
        <Text
          className="text-base"
          style={{ color: destructive ? colors.danger : colors.ink }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-sm"
            style={{ color: colors.inkMuted }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text className="ml-3 text-sm" style={{ color: colors.inkMuted }}>
          {right}
        </Text>
      ) : null}
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.inkFaint}
          style={{ marginLeft: 8 }}
        />
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} android_ripple={{ color: colors.line }}>
      {content}
    </PressableScale>
  );
}
