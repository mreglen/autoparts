import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { canAccessSection } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { describeError } from "../api/errors";
import { useAppRole } from "../auth/roles";
import { useSession } from "../auth/session";
import {
  AppHeader,
  Button,
  ConfirmDialog,
  ListRow,
  Screen,
  SectionHeader,
  useToast,
} from "../components/ui";
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
    title: "Статьи расходов",
    icon: "pricetag-outline",
    section: "settings",
    route: "ExpenseArticles",
  },
  {
    title: "Настройки",
    icon: "settings-outline",
    section: "settings",
    route: "Settings",
  },
];

export function MoreScreen() {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOut } = useSession();
  const { canUseClient, setActiveRole } = useAppRole();
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
      <AppHeader title="Ещё" subtitle="Разделы и настройки" />

      <SectionHeader title="Разделы" />
      <View className="gap-2">
        <ListRow
          title="Поиск"
          subtitle="Клиенты, авто, заказы, детали"
          icon="search-outline"
          onPress={() => navigation.navigate("Search")}
        />
        {visibleSections.map((s) => (
          <ListRow
            key={s.route}
            title={s.title}
            icon={s.icon}
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
                case "ExpenseArticles":
                  navigation.navigate("ExpenseArticles");
                  break;
                default:
                  navigation.navigate("Settings");
              }
            }}
          />
        ))}
      </View>

      <SectionHeader title="Профиль" />
      <View className="gap-2">
        <ListRow title={user?.email ?? "—"} subtitle="Аккаунт автосервиса" />
        {canUseClient ? (
          <ListRow
            title="Режим клиента"
            subtitle="Гараж, записи и история ремонтов"
            icon="person-outline"
            onPress={() => setActiveRole("client")}
          />
        ) : null}
      </View>

      <SectionHeader title="Приложение" />
      <View className="gap-2">
        <ListRow
          title={isDark ? "Тёмная тема" : "Светлая тема"}
          subtitle="Переключить оформление"
          icon={isDark ? "moon-outline" : "sunny-outline"}
          onPress={toggleTheme}
        />
      </View>

      <View className="mt-8">
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
