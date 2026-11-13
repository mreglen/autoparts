import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { canAccessSection } from "../auth/access";
import { useSession } from "../auth/session";
import { currentPermissionCodes } from "../auth/permissions";
import {
  ConfirmDialog,
  MoneyField,
  Screen,
  Sheet,
  SkeletonRows,
  useToast,
} from "../components/ui";
import { formatDayMonth, formatTime } from "../utils/format";
import { useTheme } from "../theme/useTheme";

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

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

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
      {loading ? (
        <SkeletonRows count={6} />
      ) : (
        <View className="gap-5">
          {canSettings ? (
            <View className="gap-3">
              <Text className="text-lg font-bold" style={{ color: colors.ink }}>
                Публичная карточка
              </Text>
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
              <Pressable
                onPress={() => void save()}
                disabled={saving}
                className="items-center rounded-xl py-3.5"
                style={{
                  backgroundColor: colors.brand,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className="text-base font-semibold"
                    style={{ color: "#fff" }}
                  >
                    Сохранить
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {canPlanner ? (
            <View className="gap-3">
              <Text className="text-lg font-bold" style={{ color: colors.ink }}>
                Синхронизация календаря
              </Text>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                {!caldav?.configured ? (
                  <Text className="text-sm" style={{ color: colors.inkMuted }}>
                    Синхронизация календаря отключена на сервере.
                  </Text>
                ) : caldav?.enabled ? (
                  <View className="gap-2">
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
                    <View className="mt-1 flex-row gap-2">
                      <Pressable
                        onPress={() => void caldavAction(regenerateCaldav)}
                        disabled={caldavBusy}
                        className="rounded-full px-4 py-2"
                        style={{ backgroundColor: colors.surfaceSubtle }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.brand }}
                        >
                          Новые данные доступа
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmDisconnect(true)}
                        disabled={caldavBusy}
                        className="rounded-full px-4 py-2"
                        style={{ backgroundColor: colors.dangerSoft }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.danger }}
                        >
                          Отключить
                        </Text>
                      </Pressable>
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
                    <Pressable
                      onPress={() => void caldavAction(connectCaldav)}
                      disabled={caldavBusy}
                      className="items-center self-start rounded-full px-4 py-2"
                      style={{ backgroundColor: colors.brand }}
                    >
                      {caldavBusy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: "#fff" }}
                        >
                          Подключить
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
              <Text className="text-xs" style={{ color: colors.inkFaint }}>
                iPhone: Настройки → Пароли и учётные записи → Учётная запись
                CalDAV. Android: любое CalDAV-приложение (например DAVx⁵).
              </Text>
            </View>
          ) : null}
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
              <View
                key={label}
                className="rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
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
            ))}
            <Pressable
              onPress={() => void copyCreds()}
              className="items-center rounded-xl py-3"
              style={{ backgroundColor: colors.brand }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: "#fff" }}
              >
                Скопировать
              </Text>
            </Pressable>
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
