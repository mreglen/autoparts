import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/types";

import { currentPermissionCodes } from "../auth/permissions";
import { canAccessSection } from "../auth/access";
import { useSession } from "../auth/session";
import { EmptyState, Screen } from "../components/ui";

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
        <EmptyState
          icon="lock-closed-outline"
          title="Нет доступа"
          message={`У вашего аккаунта нет права на раздел «${title}». Обратитесь к руководителю.`}
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <EmptyState
        icon={icon}
        title={title}
        message="Раздел в разработке — появится на следующем этапе."
      />
    </Screen>
  );
}
