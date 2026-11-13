import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./src/api/queryClient";
import { bootstrapOfflineCache } from "./src/offline";
import { initThemeMode, useTheme } from "./src/theme/useTheme";
import { SessionProvider } from "./src/auth/session";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { ToastProvider } from "./src/components/ui";
import { RootNavigator } from "./src/navigation/RootNavigator";

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function App() {
  useEffect(() => {
    void bootstrapOfflineCache();
    void initThemeMode();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ToastProvider>
            <RootNavigator />
            <OfflineBanner />
            <ThemedStatusBar />
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
