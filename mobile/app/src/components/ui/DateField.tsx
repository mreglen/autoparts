import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../theme/useTheme";

interface DateFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  error?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Поле даты ГГГГ-ММ-ДД. Нативный date-picker — отдельным этапом, пока текстовый ввод. */
export function DateField({
  value,
  onChangeText,
  label,
  error,
}: DateFieldProps) {
  const { colors } = useTheme();
  const invalid = Boolean(value) && !DATE_RE.test(value);
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="ГГГГ-ММ-ДД"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        className="rounded-xl px-4 py-3 text-base"
        style={{
          backgroundColor: colors.surfaceSubtle,
          color: colors.ink,
          minHeight: 48,
          borderWidth: invalid || error ? 1 : 0,
          borderColor: colors.danger,
        }}
      />
      {invalid ? (
        <Text className="mt-1 text-xs" style={{ color: colors.danger }}>
          Формат даты: ГГГГ-ММ-ДД
        </Text>
      ) : error ? (
        <Text className="mt-1 text-xs" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
