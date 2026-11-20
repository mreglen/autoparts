import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAppRole } from "../auth/roles";
import { fetchNotificationFeed } from "../api/notifications";
import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import { ConfirmDialog, ListRow, Screen, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

export function ClientMoreScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
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
      <Text
        className="mb-3 text-lg font-semibold"
        style={{ color: colors.ink }}
      >
        Автосервисы
      </Text>
      {clientOrgs.length === 0 ? (
        <ListRow title="Нет привязанных автосервисов" />
      ) : (
        clientOrgs.map((org) => (
          <View key={org.organization_id} className="mt-2">
            <ListRow title={org.organization_name ?? org.organization_id} />
          </View>
        ))
      )}

      <Text
        className="mb-3 mt-6 text-lg font-semibold"
        style={{ color: colors.ink }}
      >
        Сервис
      </Text>
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

      <Text
        className="mb-3 mt-6 text-lg font-semibold"
        style={{ color: colors.ink }}
      >
        Профиль
      </Text>
      <ListRow
        title="Профиль"
        subtitle={user?.email ?? "Данные аккаунта"}
        onPress={() => navigation.navigate("ClientProfile")}
      />

      <Text
        className="mb-3 mt-6 text-lg font-semibold"
        style={{ color: colors.ink }}
      >
        Приложение
      </Text>
      <ListRow
        title={isDark ? "Тёмная тема" : "Светлая тема"}
        subtitle="Переключить оформление"
        onPress={toggleTheme}
      />

      <View className="mt-6">
        <Pressable
          onPress={() => setConfirmOut(true)}
          disabled={busy}
          className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
          style={{
            backgroundColor: colors.dangerSoft,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text
            className="text-base font-semibold"
            style={{ color: colors.danger }}
          >
            Выйти
          </Text>
        </Pressable>
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
