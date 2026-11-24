import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../theme/useTheme";
import { AppText as Text } from "./AppText";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Чип фильтра/переключателя: выбранный — brand-заливка, иначе белый с бордером. */
export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5"
      style={{
        backgroundColor: selected ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.lineStrong,
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={selected ? "#ffffff" : colors.inkMuted}
        />
      ) : null}
      <Text
        className="text-xs font-medium"
        style={{ color: selected ? "#ffffff" : colors.inkSoft }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
