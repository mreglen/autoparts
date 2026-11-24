import { useState } from "react";
import { Image, View } from "react-native";

import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import { Button, Screen } from "../components/ui";
import { inputChrome } from "../components/ui/chrome";
import { useTheme } from "../theme/useTheme";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

const NOTICE_TEXT = {
  rights: "Права сотрудника изменились — войдите заново",
  expired: "Сессия истекла — войдите заново",
} as const;

export function LoginScreen() {
  const { colors } = useTheme();
  const { signIn, notice, lastLogin, clearNotice } = useSession();
  const [login, setLogin] = useState("");
  const [loginEdited, setLoginEdited] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Сохранённый логин подставляем, пока пользователь не начал вводить сам.
  const effectiveLogin = loginEdited ? login : login || lastLogin;

  const submit = async () => {
    if (!effectiveLogin.trim() || !password) {
      setError("Введите email/телефон и пароль");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signIn(effectiveLogin, password);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false} className="justify-center">
      <View className="w-full max-w-sm self-center gap-4">
        <View className="mb-6 items-center">
          <View
            className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl"
            style={{ backgroundColor: colors.brandSoft }}
          >
            <Image
              source={require("../../assets/icon.png")}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
          </View>
          <Text className="mt-4 text-2xl font-bold" style={{ color: colors.ink }}>
            Свой Гараж
          </Text>
          <Text className="mt-1 text-sm" style={{ color: colors.inkMuted }}>
            Кабинет автосервиса
          </Text>
        </View>

        {notice ? (
          <View
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: colors.warningSoft }}
          >
            <Text className="text-sm" style={{ color: colors.warning }}>
              {NOTICE_TEXT[notice]}
            </Text>
          </View>
        ) : null}

        <TextInput
          value={effectiveLogin}
          onChangeText={(text) => {
            setLoginEdited(true);
            setLogin(text);
            if (notice) clearNotice();
          }}
          placeholder="Email или телефон"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
          className="rounded-xl px-4 py-3 text-base"
          style={inputChrome(colors)}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          editable={!busy}
          onSubmitEditing={submit}
          className="rounded-xl px-4 py-3 text-base"
          style={inputChrome(colors)}
        />

        {error ? (
          <Text className="text-sm" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Button
          title={busy ? "Вход…" : "Войти"}
          loading={busy}
          className="mt-2"
          onPress={submit}
        />
      </View>
    </Screen>
  );
}
