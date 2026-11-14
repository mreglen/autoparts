import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { ClientBookingsScreen } from "../screens/ClientBookingsScreen";
import { ClientGarageScreen } from "../screens/ClientGarageScreen";
import { ClientMoreScreen } from "../screens/ClientMoreScreen";
import { useTheme } from "../theme/useTheme";

const Tab = createBottomTabNavigator();

export function ClientTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
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
        name="ClientGarage"
        component={ClientGarageScreen}
        options={{
          title: "Гараж",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ClientBookings"
        component={ClientBookingsScreen}
        options={{
          title: "Записи",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ClientMore"
        component={ClientMoreScreen}
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
