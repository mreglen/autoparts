import { TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";

export function SearchField({
  value,
  onChangeText,
  placeholder,
  className = "mb-3",
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      className={`flex-row items-center gap-2 rounded-xl px-3 ${className}`}
      style={{ backgroundColor: colors.surfaceSubtle, height: 42 }}
    >
      <Ionicons name="search" size={16} color={colors.inkFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        className="flex-1 text-sm"
        style={{ color: colors.ink }}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value ? (
        <Ionicons
          name="close-circle"
          size={16}
          color={colors.inkFaint}
          onPress={() => onChangeText("")}
        />
      ) : null}
    </View>
  );
}
