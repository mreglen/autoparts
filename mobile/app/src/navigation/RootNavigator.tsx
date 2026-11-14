import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";

import { canAccessSection } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { useAppRole } from "../auth/roles";
import { useSession } from "../auth/session";
import { OrderDetailScreen } from "../screens/OrderDetailScreen";
import { OrderFormScreen } from "../screens/OrderFormScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { PlannerScreen } from "../screens/PlannerScreen";
import { BookingsScreen } from "../screens/BookingsScreen";
import { BookingDetailScreen } from "../screens/BookingDetailScreen";
import { BookingFormScreen } from "../screens/BookingFormScreen";
import { ClientHistoryScreen } from "../screens/ClientHistoryScreen";
import { ClientVehicleScreen } from "../screens/ClientVehicleScreen";
import { ClientVehicleFormScreen } from "../screens/ClientVehicleFormScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MoreScreen } from "../screens/MoreScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SectionScreen } from "../screens/SectionScreen";
import { TodayScreen } from "../screens/TodayScreen";
import { WarehouseScreen } from "../screens/WarehouseScreen";
import { FinanceScreen } from "../screens/FinanceScreen";
import { ReportsScreen } from "../screens/ReportsScreen";
import { ClientsScreen } from "../screens/ClientsScreen";
import { EmployeesScreen } from "../screens/EmployeesScreen";
import { ContractorsScreen } from "../screens/ContractorsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useTheme } from "../theme/useTheme";
import { ClientTabs } from "./ClientTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
function BookingsTabScreen() {
  return <BookingsScreen />;
}
function OrdersTabScreen() {
  return <OrdersScreen />;
}
function PlannerTabScreen() {
  return <PlannerScreen />;
}
function MoreTabScreen() {
  return <MoreScreen />;
}

const TAB_SECTIONS: Record<string, string> = {
  Today: "dashboard",
  Bookings: "inspections",
  Orders: "orders",
  Planner: "planner",
};

function Tabs() {
  const { colors } = useTheme();
  const { user } = useSession();
  const codes = currentPermissionCodes();
  const allowed = (name: string) =>
    canAccessSection(user, codes, TAB_SECTIONS[name] ?? "dashboard");
  const initial = (
    ["Today", "Bookings", "Orders", "Planner", "More"] as const
  ).find((name) => name === "More" || allowed(name));

  return (
    <Tab.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: "Сегодня",
          tabBarButton: allowed("Today") ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsTabScreen}
        options={{
          title: "Записи",
          tabBarButton: allowed("Bookings") ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersTabScreen}
        options={{
          title: "Заказ-наряды",
          tabBarButton: allowed("Orders") ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Planner"
        component={PlannerTabScreen}
        options={{
          title: "Планировщик",
          tabBarButton: allowed("Planner") ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreTabScreen}
        options={{
          title: "Ещё",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="ellipsis-horizontal-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppShell() {
  const { activeRole, rolesReady, canUseStaff } = useAppRole();
  const { colors } = useTheme();
  if (!rolesReady && !canUseStaff) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.surface }}
      >
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return activeRole === "client" ? <ClientTabs /> : <Tabs />;
}

export function RootNavigator() {
  const { status, user } = useSession();
  const { colors } = useTheme();

  if (status === "loading") {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.surface }}
      >
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerBackTitle: "Назад",
        }}
      >
        {status === "signedIn" ? (
          user?.mustChangePassword ? (
            <Stack.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Main"
                component={AppShell}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Warehouse"
                component={WarehouseScreen}
                options={{ title: "Склад" }}
              />
              <Stack.Screen
                name="Finance"
                component={FinanceScreen}
                options={{ title: "Финансы" }}
              />
              <Stack.Screen
                name="Reports"
                component={ReportsScreen}
                options={{ title: "Отчёты" }}
              />
              <Stack.Screen
                name="Clients"
                component={ClientsScreen}
                options={{ title: "Клиенты" }}
              />
              <Stack.Screen
                name="Employees"
                component={EmployeesScreen}
                options={{ title: "Сотрудники" }}
              />
              <Stack.Screen
                name="Contractors"
                component={ContractorsScreen}
                options={{ title: "Подрядчики" }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: "Настройки" }}
              />
              <Stack.Screen
                name="Section"
                component={SectionScreen}
                options={({ route }) => ({ title: route.params.title })}
              />
              <Stack.Screen
                name="Search"
                component={SearchScreen}
                options={{ title: "Поиск" }}
              />
              <Stack.Screen
                name="BookingDetail"
                component={BookingDetailScreen}
                options={{ title: "Запись на осмотр" }}
              />
              <Stack.Screen
                name="BookingNew"
                component={BookingFormScreen}
                options={{ title: "Новая запись" }}
              />
              <Stack.Screen
                name="OrderDetail"
                component={OrderDetailScreen}
                options={{ title: "Заказ-наряд" }}
              />
              <Stack.Screen
                name="OrderForm"
                component={OrderFormScreen}
                options={({ route }) => ({
                  title: route.params?.orderId
                    ? "Редактирование заказ-наряда"
                    : "Новый заказ-наряд",
                })}
              />
              <Stack.Screen
                name="ClientHistory"
                component={ClientHistoryScreen}
                options={{ title: "История ремонтов" }}
              />
              <Stack.Screen
                name="ClientVehicle"
                component={ClientVehicleScreen}
                options={{ title: "Автомобиль" }}
              />
              <Stack.Screen
                name="ClientVehicleForm"
                component={ClientVehicleFormScreen}
                options={({ route }) => ({
                  title: route.params?.vehicle
                    ? "Редактирование автомобиля"
                    : "Новый автомобиль",
                })}
              />
            </>
          )
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
