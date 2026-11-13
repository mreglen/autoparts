import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { canAccessSection } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import { ConfirmDialog, ListRow, Screen, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

interface SectionLink {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  section: string;
  route: keyof RootStackParamList;
}

const SECTIONS: SectionLink[] = [
  {
    title: "Склад",
    icon: "cube-outline",
    section: "warehouse",
    route: "Warehouse",
  },
  {
    title: "Финансы",
    icon: "wallet-outline",
    section: "finance",
    route: "Finance",
  },
  {
    title: "Отчёты",
    icon: "stats-chart-outline",
    section: "reports",
    route: "Reports",
  },
  {
    title: "Клиенты",
    icon: "people-outline",
    section: "clients",
    route: "Clients",
  },
  {
    title: "Сотрудники",
    icon: "id-card-outline",
    section: "orders",
    route: "Employees",
  },
  {
    title: "Подрядчики",
    icon: "construct-outline",
    section: "settings",
    route: "Contractors",
  },
  {
    title: "Настройки",
    icon: "settings-outline",
    section: "settings",
    route: "Settings",
  },
];

export function MoreScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, signOut } = useSession();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { show } = useToast();
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);

  const codes = currentPermissionCodes();
  const visibleSections = SECTIONS.filter((s) =>
    canAccessSection(user, codes, s.section),
  );

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
        Разделы
      </Text>
      <ListRow
        title="Поиск"
        subtitle="Клиенты, авто, заказы, детали"
        onPress={() => navigation.navigate("Search")}
      />
      {visibleSections.map((s) => (
        <View key={s.section} className="mt-2">
          <ListRow
            title={s.title}
            onPress={() => {
              switch (s.route) {
                case "Warehouse":
                  navigation.navigate("Warehouse");
                  break;
                case "Finance":
                  navigation.navigate("Finance");
                  break;
                case "Reports":
                  navigation.navigate("Reports");
                  break;
                case "Clients":
                  navigation.navigate("Clients");
                  break;
                case "Employees":
                  navigation.navigate("Employees");
                  break;
                case "Contractors":
                  navigation.navigate("Contractors");
                  break;
                default:
                  navigation.navigate("Settings");
              }
            }}
          />
        </View>
      ))}

      <Text
        className="mb-3 mt-6 text-lg font-semibold"
        style={{ color: colors.ink }}
      >
        Профиль
      </Text>
      <ListRow title={user?.email ?? "—"} subtitle="Аккаунт автосервиса" />

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
