import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./src/api/queryClient";
import { bootstrapOfflineCache } from "./src/offline";
import { useAppFonts } from "./src/theme/fonts";
import { initThemeMode, useTheme } from "./src/theme/useTheme";
import { SessionProvider } from "./src/auth/session";
import { RoleProvider } from "./src/auth/roles";
import { AppUpdatePrompt } from "./src/components/AppUpdatePrompt";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { ToastProvider } from "./src/components/ui";
import { RootNavigator } from "./src/navigation/RootNavigator";

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function App() {
  const fontsReady = useAppFonts();

  useEffect(() => {
    void bootstrapOfflineCache();
    void initThemeMode();
  }, []);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1d4ed8" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RoleProvider>
            <ToastProvider>
              <RootNavigator />
              <AppUpdatePrompt />
              <OfflineBanner />
              <ThemedStatusBar />
            </ToastProvider>
          </RoleProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
