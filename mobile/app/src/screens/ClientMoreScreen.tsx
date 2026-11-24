import { useEffect, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAppRole } from "../auth/roles";
import { fetchNotificationFeed } from "../api/notifications";
import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import {
  Button,
  ConfirmDialog,
  ListRow,
  Screen,
  SectionHeader,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

export function ClientMoreScreen() {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOut } = useSession();
  const { canUseStaff, clientOrgs, setActiveRole } = useAppRole();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { show } = useToast();
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchNotificationFeed(1)
      .then((r) => {
        if (!cancelled) setUnread(r.data?.unread_count ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const doSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      show(describeError(e), "error");
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SectionHeader title="Автосервисы" />
      {clientOrgs.length === 0 ? (
        <ListRow title="Нет привязанных автосервисов" />
      ) : (
        clientOrgs.map((org) => (
          <View key={org.organization_id} className="mt-2">
            <ListRow title={org.organization_name ?? org.organization_id} />
          </View>
        ))
      )}

      <SectionHeader title="Сервис" className="mt-6" />
      <View className="mt-2">
        <ListRow
          title="История ремонтов"
          subtitle="Ваши заказ-наряды во всех автосервисах"
          onPress={() => navigation.navigate("ClientHistory")}
        />
        <View className="mt-2">
          <ListRow
            title="Мои заказы"
            subtitle="Покупки новых и б/у запчастей"
            onPress={() => navigation.navigate("ClientPurchases")}
          />
        </View>
        <View className="mt-2">
          <ListRow
            title="Уведомления"
            subtitle={
              unread > 0
                ? `Непрочитанных: ${unread}`
                : "Статусы записей и заказов"
            }
            right={unread > 0 ? String(unread) : undefined}
            onPress={() => navigation.navigate("ClientNotifications")}
          />
        </View>
      </View>
      {canUseStaff ? (
        <View className="mt-2">
          <ListRow
            title="Режим сотрудника"
            subtitle="Перейти в рабочий контур автосервиса"
            onPress={() => setActiveRole("staff")}
          />
        </View>
      ) : null}

      <SectionHeader title="Профиль" className="mt-6" />
      <ListRow
        title="Профиль"
        subtitle={user?.email ?? "Данные аккаунта"}
        onPress={() => navigation.navigate("ClientProfile")}
      />

      <SectionHeader title="Приложение" className="mt-6" />
      <ListRow
        title={isDark ? "Тёмная тема" : "Светлая тема"}
        subtitle="Переключить оформление"
        onPress={toggleTheme}
      />

      <View className="mt-6">
        <Button
          title="Выйти"
          variant="danger"
          icon="log-out-outline"
          loading={busy}
          onPress={() => setConfirmOut(true)}
        />
      </View>

      <ConfirmDialog
        visible={confirmOut}
        title="Выйти из аккаунта?"
        message="Сессия на этом устройстве будет завершена."
        confirmLabel="Выйти"
        destructive
        onConfirm={() => {
          setConfirmOut(false);
          void doSignOut();
        }}
        onCancel={() => setConfirmOut(false)}
      />
    </Screen>
  );
}
