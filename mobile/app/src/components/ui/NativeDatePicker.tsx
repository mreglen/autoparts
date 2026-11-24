import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";

interface NativeDatePickerProps {
  visible: boolean;
  value: Date;
  title?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}

function IosDatePickerSheet({
  initialValue,
  minimumDate,
  maximumDate,
  onConfirm,
  onCancel,
}: {
  initialValue: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(initialValue);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 bg-black/40" onPress={onCancel} />
      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl px-4 pb-6 pt-3"
        style={{ backgroundColor: colors.surface }}
      >
        <View
          className="mb-3 h-1 w-10 self-center rounded-full"
          style={{ backgroundColor: colors.lineStrong }}
        />
        <DateTimePicker
          value={draft}
          mode="date"
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_event: DateTimePickerEvent, date?: Date) => {
            if (date) setDraft(date);
          }}
        />
        <View className="mt-3 flex-row justify-end gap-2">
          <Pressable onPress={onCancel} className="rounded-xl px-4 py-2">
            <Text
              className="text-sm font-medium"
              style={{ color: colors.inkMuted }}
            >
              Отмена
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(draft)}
            className="rounded-xl px-4 py-2"
            style={{ backgroundColor: colors.brand }}
          >
            <Text className="text-sm font-semibold" style={{ color: "#fff" }}>
              Готово
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function NativeDatePicker({
  visible,
  value,
  title,
  minimumDate,
  maximumDate,
  onChange,
  onClose,
}: NativeDatePickerProps) {
  if (!visible) return null;

  if (Platform.OS === "ios") {
    return (
      <IosDatePickerSheet
        initialValue={value}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onConfirm={(date) => {
          onChange(date);
          onClose();
        }}
        onCancel={onClose}
      />
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="default"
      title={title}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onChange={(event: DateTimePickerEvent, date?: Date) => {
        if (event.type === "set" && date) onChange(date);
        onClose();
      }}
    />
  );
}
