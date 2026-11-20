import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { fetchShopCart } from "../api/partsShop";
import { ClientBookingsScreen } from "../screens/ClientBookingsScreen";
import { ClientCartScreen } from "../screens/ClientCartScreen";
import { ClientGarageScreen } from "../screens/ClientGarageScreen";
import { ClientMoreScreen } from "../screens/ClientMoreScreen";
import { ClientSearchScreen } from "../screens/ClientSearchScreen";
import { useTheme } from "../theme/useTheme";

const Tab = createBottomTabNavigator();

function useShopCartCount(): number {
  const { data } = useQuery({
    queryKey: ["shop-cart"],
    queryFn: fetchShopCart,
    staleTime: 15_000,
  });
  const basket = (data?.new_parts_baskets ?? []).find((b) => b.is_default);
  return basket?.items?.length ?? data?.new_parts_items?.length ?? 0;
}

export function ClientTabs() {
  const { colors } = useTheme();
  const cartCount = useShopCartCount();
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
        name="ClientSearch"
        component={ClientSearchScreen}
        options={{
          title: "Поиск",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ClientCart"
        component={ClientCartScreen}
        options={{
          title: "Корзина",
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" color={color} size={size} />
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
