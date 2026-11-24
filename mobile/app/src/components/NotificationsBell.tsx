import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { fetchNotificationFeed } from "../api/notifications";
import { useAppRole } from "../auth/roles";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

export function NotificationsBell() {
  const { colors } = useTheme();
  const { activeRole } = useAppRole();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const categories = activeRole === "staff" ? "autoservice" : null;
  const { data } = useQuery({
    queryKey: ["notifications-feed-badge", categories],
    queryFn: () => fetchNotificationFeed(1, categories),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const unread = data?.data?.unread_count ?? 0;

  return (
    <Pressable
      onPress={() => navigation.navigate("Notifications")}
      className="relative h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: colors.surfaceSubtle }}
      accessibilityLabel="Уведомления"
    >
      <Ionicons name="notifications-outline" size={20} color={colors.inkSoft} />
      {unread > 0 ? (
        <View
          className="absolute -right-0.5 -top-0.5 h-5 min-w-[20px] items-center justify-center rounded-full px-1"
          style={{ backgroundColor: colors.danger }}
        >
          <Text className="text-[10px] font-bold" style={{ color: "#fff" }}>
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
