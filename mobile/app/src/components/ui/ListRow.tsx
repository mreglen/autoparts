import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";
import { cardChrome } from "./chrome";
import { AppText as Text } from "./AppText";
import { PressableScale } from "./motion";

interface ListRowProps {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  destructive,
  icon,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View
      className="flex-row items-center rounded-xl px-3.5 py-3"
      style={cardChrome(colors)}
    >
      {icon ? (
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: destructive ? colors.dangerSoft : colors.brandSoft,
          }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? colors.danger : colors.brand}
          />
        </View>
      ) : null}
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
