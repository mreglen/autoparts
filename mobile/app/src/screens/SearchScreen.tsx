import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState, Screen } from "../components/ui";
import { inputChrome } from "../components/ui/chrome";
import { useTheme } from "../theme/useTheme";
import { AppTextInput as TextInput } from "../components/ui/AppText";

/** Глобальный поиск — отдельный экран. Источники данных подключатся с разделами этапов 6+. */
export function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");

  return (
    <Screen scroll={false}>
      <View
        className="mb-4 flex-row items-center gap-2 rounded-xl px-4"
        style={inputChrome(colors)}
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
          className="flex-1 py-3 text-base"
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
      <EmptyState
        icon="search-outline"
        title="Найдите клиента, деталь или заказ"
        message="Поиск заработает вместе с разделами."
      />
    </Screen>
  );
}
