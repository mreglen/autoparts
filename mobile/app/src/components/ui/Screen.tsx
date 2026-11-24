import type { ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../theme/useTheme";

interface ScreenProps extends ScrollViewProps {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  onRefresh,
  refreshing = false,
  ...rest
}: ScreenProps) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={[
        { padding: 16, paddingBottom: 32 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.brand}
          />
        ) : undefined
      }
      {...rest}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1" style={{ padding: 16 }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.surfaceMuted }}
      edges={["top", "left", "right"]}
    >
      {body}
    </SafeAreaView>
  );
}
