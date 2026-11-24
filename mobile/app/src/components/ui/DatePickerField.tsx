import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { toIsoDate } from "../../utils/format";
import { useTheme } from "../../theme/useTheme";
import { NativeDatePicker } from "./NativeDatePicker";
import { AppText as Text } from "./AppText";

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatIsoDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DatePickerField({
  value,
  onChange,
  label,
  placeholder = "Выберите дату",
  minimumDate,
  maximumDate,
}: DatePickerFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  return (
    <View>
      {label ? (
        <Text
          className="mb-1.5 text-xs font-medium"
          style={{ color: colors.inkMuted }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl px-4"
        style={{
          backgroundColor: colors.surface,
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.lineStrong,
          borderRadius: 12,
        }}
      >
        <Text
          className="text-base"
          style={{ color: selected ? colors.ink : colors.inkFaint }}
        >
          {selected ? formatIsoDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.inkMuted} />
      </Pressable>
      <NativeDatePicker
        visible={open}
        value={selected ?? new Date()}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(date) => onChange(toIsoDate(date))}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
