import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/ui";
import { useTheme } from "../theme/useTheme";

interface PlaceholderScreenProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
}

export function PlaceholderScreen({
  title,
  icon,
  description,
}: PlaceholderScreenProps) {
  const { colors } = useTheme();
  return (
    <Screen className="items-center justify-center">
      <View className="items-center gap-3">
        <Ionicons name={icon} size={48} color={colors.brand} />
        <Text className="text-xl font-semibold" style={{ color: colors.ink }}>
          {title}
        </Text>
        <Text
          className="max-w-xs text-center text-sm"
          style={{ color: colors.inkMuted }}
        >
          {description ?? "Раздел появится на следующих этапах каркаса."}
        </Text>
      </View>
    </Screen>
  );
}
