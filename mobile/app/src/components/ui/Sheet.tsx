import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../theme/useTheme";

interface SheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable className="flex-1 bg-black/40" onPress={onClose} />
        <View
          className="rounded-t-2xl px-5 pt-3"
          style={{
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View
            className="mb-3 h-1 w-10 self-center rounded-full"
            style={{ backgroundColor: colors.lineStrong }}
          />
          {title ? (
            <Text
              className="mb-3 text-lg font-semibold"
              style={{ color: colors.ink }}
            >
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
