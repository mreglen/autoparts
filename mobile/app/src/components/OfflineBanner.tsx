import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/useTheme";

/** Глобальный баннер «нет сети» — поверх всего приложения. */
export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(
        state.isConnected === false || state.isInternetReachable === false,
      );
    });
    void NetInfo.fetch().then((state) => {
      setOffline(
        state.isConnected === false || state.isInternetReachable === false,
      );
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      <View
        className="flex-row items-center justify-center gap-1.5 px-4 py-1.5"
        style={{ backgroundColor: colors.warningSoft }}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={14}
          color={colors.warning}
        />
        <Text className="text-xs font-medium" style={{ color: colors.warning }}>
          Нет соединения — показаны последние загруженные данные
        </Text>
      </View>
    </View>
  );
}
