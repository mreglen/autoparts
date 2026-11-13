import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";

interface StaleDataBadgeProps {
  fetchedAt: Date | string | number | null | undefined;
}

/** Маркировка возраста кэшированных данных — обязательна по правилу 1.8 плана. */
export function StaleDataBadge({ fetchedAt }: StaleDataBadgeProps) {
  const { colors } = useTheme();
  if (!fetchedAt) return null;
  const date = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  if (Number.isNaN(date.getTime())) return null;
  const label = date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: colors.warningSoft }}
    >
      <Ionicons name="time-outline" size={12} color={colors.warning} />
      <Text className="text-xs font-medium" style={{ color: colors.warning }}>
        Данные от {label}
      </Text>
    </View>
  );
}
