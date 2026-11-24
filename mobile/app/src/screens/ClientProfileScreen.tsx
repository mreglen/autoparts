import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchPublicAutoserviceOrgs,
  type PublicAutoserviceOrg,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  fetchMyProfile,
  fetchNotificationPreferences,
  updateMyProfile,
  updateNotificationPreferences,
  type MyProfile,
  type NotificationPrefs,
} from "../api/profile";
import { useAppRole } from "../auth/roles";
import { useSession } from "../auth/session";
import { Screen, useToast } from "../components/ui";
import { useTheme } from "../theme/useTheme";

const PREF_LABELS: Record<keyof NotificationPrefs, string> = {
  orders: "Заказы и записи",
  messages: "Сообщения",
  search: "Поиск и подбор",
  other: "Прочие",
  autoservice: "Автосервис",
};

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      className="mb-2 mt-6 text-lg font-semibold"
      style={{ color: colors.ink }}
    >
      {children}
    </Text>
  );
}

export function ClientProfileScreen() {
  const { colors } = useTheme();
  const { refreshProfile, changePassword } = useSession();
  const { clientOrgs } = useAppRole();
  const { show } = useToast();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [publicOrgs, setPublicOrgs] = useState<PublicAutoserviceOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr, orgs] = await Promise.all([
        fetchMyProfile(),
        fetchNotificationPreferences().catch(() => null),
        fetchPublicAutoserviceOrgs().catch(() => ({ data: [] })),
      ]);
      setProfile(p);
      setLastName(p.last_name ?? "");
      setFirstName(p.first_name ?? "");
      setPatronymic(p.patronymic ?? "");
      setPhone(p.phone ?? "");
      setEmail(p.email ?? "");
      if (pr) setPrefs(pr.notification_prefs);
      setPublicOrgs(orgs.data ?? []);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  const displayName =
    [profile?.last_name, profile?.first_name, profile?.patronymic]
      .filter(Boolean)
      .join(" ") ||
    profile?.email ||
    "";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const saveProfile = async () => {
    if (!email.trim()) {
      show("Email обязателен", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile({
        last_name: lastName.trim() || null,
        first_name: firstName.trim() || null,
        patronymic: patronymic.trim() || null,
        phone: phone.trim() || null,
        email: email.trim(),
      });
      setProfile(updated);
      await refreshProfile();
      show("Профиль сохранён", "success");
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPwd || !newPwd) {
      show("Заполните оба поля пароля", "error");
      return;
    }
    if (newPwd.length < 6) {
      show("Новый пароль должен быть не короче 6 символов", "error");
      return;
    }
    if (newPwd !== confirmPwd) {
      show("Пароли не совпадают", "error");
      return;
    }
    setSavingPwd(true);
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setShowPassword(false);
      show("Пароль изменён", "success");
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSavingPwd(false);
    }
  };

  const togglePref = async (
    category: keyof NotificationPrefs,
    channel: "push" | "email",
    value: boolean,
  ) => {
    if (!prefs) return;
    const prev = prefs;
    const next: NotificationPrefs = {
      ...prefs,
      [category]: { ...prefs[category], [channel]: value },
    };
    setPrefs(next);
    try {
      await updateNotificationPreferences(next);
    } catch (e) {
      setPrefs(prev);
      show(describeError(e), "error");
    }
  };

  const orgPublicInfo = (orgId: string) =>
    publicOrgs.find((o) => o.organization_id === orgId);

  if (loading && !profile) {
    return (
      <Screen>
        <Text style={{ color: colors.inkMuted }}>Загрузка…</Text>
      </Screen>
    );
  }

  const field = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    opts: { keyboardType?: "default" | "phone-pad" | "email-address" } = {},
  ) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      keyboardType={opts.keyboardType ?? "default"}
      autoCapitalize="none"
      autoCorrect={false}
      className="rounded-xl px-4 py-3 text-base"
      style={inputStyle}
    />
  );

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <View className="mb-4 flex-row items-center gap-4">
        {profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <View
            className="h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.brandSoft }}
          >
            <Text className="text-xl font-bold" style={{ color: colors.brand }}>
              {initials || "?"}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
            {displayName || "Профиль"}
          </Text>
          <Text className="text-sm" style={{ color: colors.inkMuted }}>
            {profile?.email ?? ""}
          </Text>
        </View>
      </View>

      <SectionTitle>Данные аккаунта</SectionTitle>
      <View className="gap-3">
        {field(lastName, setLastName, "Фамилия")}
        {field(firstName, setFirstName, "Имя")}
        {field(patronymic, setPatronymic, "Отчество")}
        {field(phone, setPhone, "Телефон", { keyboardType: "phone-pad" })}
        {field(email, setEmail, "Email", { keyboardType: "email-address" })}
        <Pressable
          onPress={() => void saveProfile()}
          disabled={savingProfile}
          className="items-center rounded-xl py-3.5"
          style={{
            backgroundColor: colors.brand,
            opacity: savingProfile ? 0.6 : 1,
          }}
        >
          <Text className="text-base font-semibold" style={{ color: "#fff" }}>
            {savingProfile ? "Сохранение…" : "Сохранить"}
          </Text>
        </Pressable>
      </View>

      <SectionTitle>Смена пароля</SectionTitle>
      {showPassword ? (
        <View className="gap-3">
          {field(currentPwd, setCurrentPwd, "Текущий пароль")}
          {field(newPwd, setNewPwd, "Новый пароль")}
          {field(confirmPwd, setConfirmPwd, "Повторите новый пароль")}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowPassword(false)}
              className="flex-1 items-center rounded-xl py-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text style={{ color: colors.ink }}>Отмена</Text>
            </Pressable>
            <Pressable
              onPress={() => void savePassword()}
              disabled={savingPwd}
              className="flex-1 items-center rounded-xl py-3"
              style={{
                backgroundColor: colors.brand,
                opacity: savingPwd ? 0.6 : 1,
              }}
            >
              <Text className="font-semibold" style={{ color: "#fff" }}>
                {savingPwd ? "…" : "Сменить"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowPassword(true)}
          className="flex-row items-center justify-between rounded-xl px-4 py-3.5"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Text style={{ color: colors.ink }}>Изменить пароль</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </Pressable>
      )}

      {prefs ? (
        <>
          <SectionTitle>Уведомления</SectionTitle>
          <View
            className="rounded-xl px-4 py-2"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map(
              (key) => (
                <View
                  key={key}
                  className="flex-row items-center justify-between border-b py-3"
                  style={{ borderColor: colors.line }}
                >
                  <Text className="flex-1" style={{ color: colors.ink }}>
                    {PREF_LABELS[key]}
                  </Text>
                  <View className="flex-row items-center gap-4">
                    <View className="items-center">
                      <Switch
                        value={prefs[key].push}
                        onValueChange={(v) => void togglePref(key, "push", v)}
                        trackColor={{
                          false: colors.surfaceSubtle,
                          true: colors.brand,
                        }}
                        style={{ transform: [{ scale: 0.8 }] }}
                      />
                      <Text
                        className="text-[10px]"
                        style={{ color: colors.inkFaint }}
                      >
                        Push
                      </Text>
                    </View>
                    <View className="items-center">
                      <Switch
                        value={prefs[key].email}
                        onValueChange={(v) => void togglePref(key, "email", v)}
                        trackColor={{
                          false: colors.surfaceSubtle,
                          true: colors.brand,
                        }}
                        style={{ transform: [{ scale: 0.8 }] }}
                      />
                      <Text
                        className="text-[10px]"
                        style={{ color: colors.inkFaint }}
                      >
                        Email
                      </Text>
                    </View>
                  </View>
                </View>
              ),
            )}
          </View>
        </>
      ) : null}

      <SectionTitle>Мои автосервисы</SectionTitle>
      {clientOrgs.length === 0 ? (
        <Text style={{ color: colors.inkMuted }}>
          Нет привязанных автосервисов
        </Text>
      ) : (
        clientOrgs.map((org) => {
          const info = orgPublicInfo(org.organization_id);
          const subtitle = [info?.address, info?.phone]
            .filter(Boolean)
            .join(" · ");
          return (
            <View
              key={org.organization_id}
              className="mb-2 rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text className="font-medium" style={{ color: colors.ink }}>
                {org.organization_name ?? info?.name ?? org.organization_id}
              </Text>
              {subtitle ? (
                <Text
                  className="mt-0.5 text-sm"
                  style={{ color: colors.inkMuted }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}
