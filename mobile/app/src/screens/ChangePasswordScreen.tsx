import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import { Screen, useToast } from "../components/ui";
import { useTheme } from "../theme/useTheme";

export function ChangePasswordScreen() {
  const { colors } = useTheme();
  const { changePassword } = useSession();
  const { show } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

  const submit = async () => {
    setError("");
    if (!current || !next) {
      setError("Заполните оба поля пароля");
      return;
    }
    if (next.length < 6) {
      setError("Новый пароль должен быть не короче 6 символов");
      return;
    }
    if (next !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      show("Пароль изменён", "success");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false} className="justify-center">
      <View className="w-full max-w-sm self-center gap-4">
        <View className="mb-2 items-center">
          <Text className="text-xl font-bold" style={{ color: colors.ink }}>
            Смена пароля
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: colors.inkMuted }}
          >
            Для продолжения работы задайте новый пароль
          </Text>
        </View>

        <TextInput
          value={current}
          onChangeText={setCurrent}
          placeholder="Текущий пароль"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          editable={!busy}
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
        <TextInput
          value={next}
          onChangeText={setNext}
          placeholder="Новый пароль (мин. 6 символов)"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          editable={!busy}
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Повторите новый пароль"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          editable={!busy}
          onSubmitEditing={submit}
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />

        {error ? (
          <Text className="text-sm" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          className="items-center rounded-xl py-3.5"
          style={{ backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }}
        >
          <Text className="text-base font-semibold text-white">
            {busy ? "Сохранение…" : "Сохранить и продолжить"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
