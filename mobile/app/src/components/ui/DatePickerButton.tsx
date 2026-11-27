import { useState } from "react";
import { Pressable, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { formatDayMonthYear } from "../../utils/format";
import { useTheme } from "../../theme/useTheme";

interface DatePickerButtonProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePickerButton({
  value,
  onChange,
  minDate,
  maxDate,
}: DatePickerButtonProps) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  const handleChange = (event: any, selectedDate?: Date) => {
    setShow(false);
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setShow(true)}
        className="flex-row items-center gap-2 rounded-xl px-3 py-2"
        style={{ backgroundColor: colors.surfaceSubtle }}
      >
        <Text className="text-sm font-medium" style={{ color: colors.ink }}>
          {formatDayMonthYear(value)}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          onChange={handleChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}
    </>
  );
}
