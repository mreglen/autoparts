import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/ui";
import { useTheme } from "../theme/useTheme";

/** Глобальный поиск — отдельный экран. Источники данных подключатся с разделами этапов 6+. */
export function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");

  return (
    <Screen scroll={false}>
      <View
        className="mb-4 flex-row items-center gap-2 rounded-xl px-4"
        style={{ backgroundColor: colors.surfaceSubtle, minHeight: 48 }}
      >
        <Ionicons name="search" size={18} color={colors.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Клиент, авто, заказ-наряд, деталь…"
          placeholderTextColor={colors.inkFaint}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 text-base"
          style={{ color: colors.ink }}
        />
        {query ? (
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.inkFaint}
            onPress={() => setQuery("")}
          />
        ) : null}
      </View>
      <View className="items-center gap-3 pt-10">
        <Ionicons name="search-outline" size={40} color={colors.inkFaint} />
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          Поиск по разделам появится вместе с ними.
        </Text>
      </View>
    </Screen>
  );
}
