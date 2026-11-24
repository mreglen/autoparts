import { useCallback, useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import {
  connectCaldav,
  disconnectCaldav,
  fetchCaldavStatus,
  fetchSettings,
  regenerateCaldav,
  saveSettings,
  type CaldavCredentials,
  type CaldavStatus,
} from "../api/directory";
import { describeError } from "../api/errors";
import { APP_VERSION } from "../app/appIdentity";
import { requestUpdateCheck } from "../app/appUpdate";
import { canAccessSection } from "../auth/access";
import { useSession } from "../auth/session";
import { currentPermissionCodes } from "../auth/permissions";
import {
  AppHeader,
  Button,
  Card,
  ConfirmDialog,
  MoneyField,
  Screen,
  SectionHeader,
  Sheet,
  SkeletonRows,
  useToast,
} from "../components/ui";
import { inputChrome } from "../components/ui/chrome";
import { formatDayMonth, formatTime } from "../utils/format";
import { useTheme } from "../theme/useTheme";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

export function SettingsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const { user } = useSession();
  const codes = currentPermissionCodes();
  const canSettings = canAccessSection(user, codes, "settings");
  const canPlanner = canAccessSection(user, codes, "planner");

  const [caldav, setCaldav] = useState<CaldavStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [publicName, setPublicName] = useState("");
  const [publicDesc, setPublicDesc] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [saving, setSaving] = useState(false);

  const [credentials, setCredentials] = useState<CaldavCredentials | null>(
    null,
  );
  const [caldavBusy, setCaldavBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const inputStyle = inputChrome(colors);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [s, c] = await Promise.all([
          canSettings ? fetchSettings() : Promise.resolve(null),
          canPlanner ? fetchCaldavStatus() : Promise.resolve(null),
        ]);
        if (s) {
          setPublicName(s.data.public_name ?? "");
          setPublicDesc(s.data.public_description ?? "");
          setVatRate(String(s.data.vat_rate ?? ""));
        }
        if (c) setCaldav(c);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canSettings, canPlanner, show],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const vat = Number(String(vatRate).replace(",", "."));
      await saveSettings({
        public_name: publicName.trim() || undefined,
        public_description: publicDesc.trim() || undefined,
        vat_rate: Number.isFinite(vat) ? vat : undefined,
      });
      show("Настройки сохранены", "success");
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const caldavAction = async (fn: () => Promise<CaldavCredentials | void>) => {
    setCaldavBusy(true);
    try {
      const creds = await fn();
      if (creds) setCredentials(creds);
      const status = await fetchCaldavStatus();
      setCaldav(status);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setCaldavBusy(false);
    }
  };

  const copyCreds = async () => {
    if (!credentials) return;
    await Clipboard.setStringAsync(
      `${credentials.server_url}\n${credentials.username}\n${credentials.password}`,
    );
    show("Данные скопированы", "success");
  };

  const field = (label: string, node: ReactNode) => (
    <View className="gap-1.5">
      <Text
        className="text-xs font-semibold uppercase"
        style={{ color: colors.inkMuted }}
      >
        {label}
      </Text>
      {node}
    </View>
  );

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <AppHeader title="Настройки" />
      {loading ? (
        <SkeletonRows count={6} />
      ) : (
        <View>
          {canSettings ? (
            <View>
              <SectionHeader title="Публичная карточка" />
              <Card className="gap-4">
                {field(
                  "Название",
                  <TextInput
                    value={publicName}
                    onChangeText={setPublicName}
                    placeholder="Название автосервиса"
                    placeholderTextColor={colors.inkFaint}
                    className="rounded-xl px-4 py-3 text-base"
                    style={inputStyle}
                  />,
                )}
                {field(
                  "Описание",
                  <TextInput
                    value={publicDesc}
                    onChangeText={setPublicDesc}
                    placeholder="Описание для клиентов"
                    placeholderTextColor={colors.inkFaint}
                    className="rounded-xl px-4 py-3 text-base"
                    style={inputStyle}
                    multiline
                  />,
                )}
                {field(
                  "Ставка НДС, %",
                  <MoneyField
                    value={vatRate}
                    onChangeText={setVatRate}
                    placeholder="22"
                    className="rounded-xl px-4 py-3 text-base"
                    style={inputStyle}
                  />,
                )}
                <Button
                  title="Сохранить"
                  onPress={() => void save()}
                  loading={saving}
                />
              </Card>
            </View>
          ) : null}

          {canPlanner ? (
            <View>
              <SectionHeader title="Синхронизация календаря" />
              <Card>
                {!caldav?.configured ? (
                  <Text className="text-sm" style={{ color: colors.inkMuted }}>
                    Синхронизация календаря отключена на сервере.
                  </Text>
                ) : caldav?.enabled ? (
                  <View className="gap-3">
                    <View className="flex-row items-center gap-2">
                      <Ionicons
                        name="calendar"
                        size={18}
                        color={colors.success}
                      />
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.ink }}
                      >
                        Подключено
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.inkMuted }}
                    >
                      Логин: {caldav.username}
                      {caldav.last_synced_at
                        ? ` · синхронизировано ${formatDayMonth(caldav.last_synced_at)} ${formatTime(caldav.last_synced_at)}`
                        : ""}
                    </Text>
                    <View className="flex-row gap-2">
                      <Button
                        title="Новые данные доступа"
                        variant="secondary"
                        className="flex-1"
                        loading={caldavBusy}
                        onPress={() => void caldavAction(regenerateCaldav)}
                      />
                      <Button
                        title="Отключить"
                        variant="danger"
                        className="flex-1"
                        disabled={caldavBusy}
                        onPress={() => setConfirmDisconnect(true)}
                      />
                    </View>
                  </View>
                ) : (
                  <View className="gap-3">
                    <Text
                      className="text-sm"
                      style={{ color: colors.inkMuted }}
                    >
                      Подключите календарь планировщика к iPhone/Android: сервер
                      отдаёт планировщику записи по CalDAV.
                    </Text>
                    <Button
                      title="Подключить"
                      variant="secondary"
                      className="self-start"
                      loading={caldavBusy}
                      onPress={() => void caldavAction(connectCaldav)}
                    />
                  </View>
                )}
              </Card>
              <Text className="mt-2 text-xs" style={{ color: colors.inkFaint }}>
                iPhone: Настройки → Пароли и учётные записи → Учётная запись
                CalDAV. Android: любое CalDAV-приложение (например DAVx⁵).
              </Text>
            </View>
          ) : null}

          <View>
            <SectionHeader title="О приложении" />
            <Card className="flex-row items-center justify-between">
              <View>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  Свой Гараж · Автосервис
                </Text>
                <Text className="text-xs" style={{ color: colors.inkMuted }}>
                  Версия {APP_VERSION}
                </Text>
              </View>
              <Button
                title="Проверить обновление"
                variant="secondary"
                className="self-center"
                onPress={requestUpdateCheck}
              />
            </Card>
          </View>
        </View>
      )}

      <Sheet
        visible={!!credentials}
        title="Данные доступа CalDAV"
        onClose={() => setCredentials(null)}
      >
        {credentials ? (
          <View className="gap-3">
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Сохраните данные — пароль показывается один раз.
            </Text>
            {[
              ["Сервер", credentials.server_url],
              ["Логин", credentials.username],
              ["Пароль", credentials.password],
            ].map(([label, value]) => (
              <Card key={label} padded={false}>
                <View className="p-3">
                  <Text className="text-xs" style={{ color: colors.inkMuted }}>
                    {label}
                  </Text>
                  <Text
                    className="mt-1 text-sm font-medium"
                    style={{ color: colors.ink }}
                    selectable
                  >
                    {value}
                  </Text>
                </View>
              </Card>
            ))}
            <Button
              title="Скопировать"
              icon="copy-outline"
              onPress={() => void copyCreds()}
            />
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={confirmDisconnect}
        title="Отключить синхронизацию календаря?"
        message="Календарь на устройствах перестанет получать записи планировщика."
        confirmLabel="Отключить"
        destructive
        onConfirm={() => {
          setConfirmDisconnect(false);
          void caldavAction(async () => {
            await disconnectCaldav();
          }).then(() => show("Синхронизация отключена", "success"));
        }}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </Screen>
  );
}
