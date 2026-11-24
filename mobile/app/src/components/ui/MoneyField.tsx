import { TextInput, type TextInputProps } from "react-native";

import { useTheme } from "../../theme/useTheme";

interface MoneyFieldProps
  extends Omit<TextInputProps, "keyboardType" | "value" | "onChangeText"> {
  value: string;
  onChangeText: (value: string) => void;
}

/** Поле суммы: цифровая клавиатура, хранит строку как на вебе (запятая допустима). */
export function MoneyField({
  value,
  onChangeText,
  placeholder = "0,00",
  ...rest
}: MoneyFieldProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/[^\d.,\s-]/g, ""))}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      className="rounded-xl px-4 py-3 text-base"
      style={{
        backgroundColor: colors.surfaceSubtle,
        color: colors.ink,
        minHeight: 48,
      }}
      {...rest}
    />
  );
}
