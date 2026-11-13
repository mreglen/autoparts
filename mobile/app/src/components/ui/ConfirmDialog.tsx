import { Modal, Pressable, Text, View } from "react-native";

import { useTheme } from "../../theme/useTheme";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View
          className="w-full max-w-sm rounded-2xl p-5"
          style={{ backgroundColor: colors.surface }}
        >
          <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
            {title}
          </Text>
          {message ? (
            <Text className="mt-2 text-sm" style={{ color: colors.inkMuted }}>
              {message}
            </Text>
          ) : null}
          <View className="mt-5 flex-row justify-end gap-3">
            <Pressable
              onPress={onCancel}
              className="rounded-xl px-4 py-2.5"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: colors.inkSoft }}
              >
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className="rounded-xl px-4 py-2.5"
              style={{
                backgroundColor: destructive ? colors.danger : colors.brand,
              }}
            >
              <Text className="text-sm font-semibold text-white">
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
