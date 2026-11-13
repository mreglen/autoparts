import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { createBooking } from "../api/bookings";
import { describeError } from "../api/errors";
import { DateField, Screen, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

type Props = NativeStackScreenProps<RootStackParamList, "BookingNew">;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function BookingFormScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) {
      setError("Имя клиента — минимум 2 символа");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Укажите дату в формате ГГГГ-ММ-ДД");
      return;
    }
    if (time && !TIME_RE.test(time)) {
      setError("Время в формате ЧЧ:ММ");
      return;
    }
    setBusy(true);
    try {
      await createBooking({
        name: name.trim(),
        phone: phone.trim() || undefined,
        preferred_date: date,
        preferred_time: time || undefined,
        vehicle_make: make.trim() || undefined,
        vehicle_model: model.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      show("Запись создана", "success");
      navigation.goBack();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Имя клиента *"
          placeholderTextColor={colors.inkFaint}
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Телефон"
          placeholderTextColor={colors.inkFaint}
          keyboardType="phone-pad"
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField
              value={date}
              onChangeText={setDate}
              label="Дата записи"
            />
          </View>
          <View className="flex-1">
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{ color: colors.inkMuted }}
            >
              Время
            </Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="ЧЧ:ММ"
              placeholderTextColor={colors.inkFaint}
              keyboardType="numbers-and-punctuation"
              className="rounded-xl px-4 py-3 text-base"
              style={inputStyle}
            />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextInput
              value={make}
              onChangeText={setMake}
              placeholder="Марка авто"
              placeholderTextColor={colors.inkFaint}
              className="rounded-xl px-4 py-3 text-base"
              style={inputStyle}
            />
          </View>
          <View className="flex-1">
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="Модель"
              placeholderTextColor={colors.inkFaint}
              className="rounded-xl px-4 py-3 text-base"
              style={inputStyle}
            />
          </View>
        </View>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Комментарий"
          placeholderTextColor={colors.inkFaint}
          multiline
          numberOfLines={3}
          className="rounded-xl px-4 py-3 text-base"
          style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
        />

        {error ? (
          <Text className="text-sm" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          className="items-center rounded-xl py-3.5"
          style={{ backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }}
        >
          <Text className="text-base font-semibold text-white">
            {busy ? "Сохранение…" : "Создать запись"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
