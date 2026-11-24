import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/types";

import { currentPermissionCodes } from "../auth/permissions";
import { canAccessSection } from "../auth/access";
import { useSession } from "../auth/session";
import { Screen } from "../components/ui";
import { useTheme } from "../theme/useTheme";

export interface SectionRouteParams {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  section: string;
}

export type SectionScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Section"
>;

/** Плейсхолдер раздела автосервиса: проверка права + каркас экрана.
 *  Реальные списки подключаются на этапах 6–16 через cachedGet. */
export function SectionScreen({ route }: SectionScreenProps) {
  const { colors } = useTheme();
  const { user } = useSession();
  const { title, icon, section } = route.params;
  const [refreshing, setRefreshing] = useState(false);

  const allowed = canAccessSection(user, currentPermissionCodes(), section);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Здесь разделы этапов 6+ будут перезапрашивать данные через cachedGet.
    await new Promise((resolve) => setTimeout(resolve, 400));
    setRefreshing(false);
  }, []);

  if (!allowed) {
    return (
      <Screen className="items-center justify-center">
        <View className="items-center gap-3">
          <Ionicons
            name="lock-closed-outline"
            size={48}
            color={colors.inkFaint}
          />
          <Text className="text-xl font-semibold" style={{ color: colors.ink }}>
            Нет доступа
          </Text>
          <Text
            className="max-w-xs text-center text-sm"
            style={{ color: colors.inkMuted }}
          >
            У вашего аккаунта нет права на раздел «{title}». Обратитесь к
            руководителю.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View className="items-center gap-3 pt-10">
        <Ionicons name={icon} size={48} color={colors.brand} />
        <Text className="text-xl font-semibold" style={{ color: colors.ink }}>
          {title}
        </Text>
        <Text
          className="max-w-xs text-center text-sm"
          style={{ color: colors.inkMuted }}
        >
          Раздел в разработке — появится на следующем этапе.
        </Text>
      </View>
    </Screen>
  );
}
