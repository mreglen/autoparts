import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import {
  createClientInspectionBooking,
  fetchGarageVehicles,
  fetchMyClientOrgs,
  type GarageVehicle,
  type MyClientOrg,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  Button,
  Chip,
  DateField,
  ListRow,
  Screen,
  useToast,
} from "../components/ui";
import { inputChrome } from "../components/ui/chrome";
import type { RootStackParamList } from "../navigation/types";
import { invalidateEntities } from "../offline";
import { toIsoDate } from "../utils/format";
import { useTheme } from "../theme/useTheme";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

type Props = NativeStackScreenProps<RootStackParamList, "ClientBookingNew">;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function vehicleTitle(v: GarageVehicle): string {
  return [v.make, v.model].filter(Boolean).join(" ") || "Авто";
}

function vehicleSubtitle(v: GarageVehicle): string {
  return [v.plate, v.year ? String(v.year) : null].filter(Boolean).join(" · ");
}

export function ClientBookingFormScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { show } = useToast();

  const [orgs, setOrgs] = useState<MyClientOrg[]>([]);
  const [orgId, setOrgId] = useState("");
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [manualVehicle, setManualVehicle] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");

  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMyClientOrgs()
      .then((r) => {
        if (cancelled) return;
        const list = r.data ?? [];
        setOrgs(list);
        setOrgId((prev) => prev || list[0]?.organization_id || "");
      })
      .catch((e) => show(describeError(e), "error"));
    return () => {
      cancelled = true;
    };
  }, [show]);

  useEffect(() => {
    if (!orgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс гаража при смене СТО
      setVehicles([]);
      return;
    }
    let cancelled = false;
    setVehiclesLoading(true);
    void fetchGarageVehicles(orgId)
      .then((r) => {
        if (cancelled) return;
        const list = r.data ?? [];
        setVehicles(list);
        setVehicleId((prev) =>
          prev != null && list.some((v) => v.id === prev)
            ? prev
            : (list[0]?.id ?? null),
        );
        if (list.length === 0) setManualVehicle(true);
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const inputStyle = inputChrome(colors);

  const submit = async () => {
    setError("");
    if (!orgId) {
      setError("Не удалось определить автосервис");
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
    const useManual = manualVehicle || vehicleId == null;
    if (useManual && !make.trim()) {
      setError("Укажите марку автомобиля или выберите авто из гаража");
      return;
    }
    setBusy(true);
    try {
      await createClientInspectionBooking({
        organization_id: orgId,
        preferred_date: date,
        preferred_time: time || undefined,
        garage_vehicle_id: useManual ? undefined : (vehicleId ?? undefined),
        vehicle_make: useManual ? make.trim() : undefined,
        vehicle_model: useManual ? model.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      await invalidateEntities(["bookings"]);
      show("Запись отправлена — автосервис подтвердит её", "success");
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
        {orgs.length > 1 ? (
          <View>
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{ color: colors.inkMuted }}
            >
              Автосервис
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {orgs.map((o) => (
                <Chip
                  key={o.organization_id}
                  label={o.organization_name ?? o.organization_id}
                  selected={o.organization_id === orgId}
                  onPress={() => {
                    setOrgId(o.organization_id);
                    setManualVehicle(false);
                    setVehicleId(null);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Text
            className="mb-1.5 text-xs font-medium"
            style={{ color: colors.inkMuted }}
          >
            Автомобиль
          </Text>
          {vehiclesLoading ? (
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Загрузка гаража…
            </Text>
          ) : vehicles.length > 0 ? (
            <View className="gap-2">
              {vehicles.map((v) => (
                <ListRow
                  key={v.id}
                  title={vehicleTitle(v)}
                  subtitle={vehicleSubtitle(v)}
                  right={vehicleId === v.id ? "Выбрано" : undefined}
                  onPress={() => {
                    setVehicleId(v.id);
                    setManualVehicle(false);
                  }}
                />
              ))}
              <Pressable
                onPress={() => {
                  setManualVehicle(true);
                  setVehicleId(null);
                }}
                className="flex-row items-center rounded-xl px-4 py-3"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: manualVehicle ? colors.brand : colors.lineStrong,
                }}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={manualVehicle ? colors.brand : colors.inkMuted}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className="text-sm font-medium"
                  style={{ color: manualVehicle ? colors.brand : colors.inkSoft }}
                >
                  Указать вручную
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              В гараже нет авто — укажите марку и модель.
            </Text>
          )}
          {manualVehicle || vehicles.length === 0 ? (
            <View className="mt-3 flex-row gap-3">
              <View className="flex-[2]">
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="Марка *"
                  placeholderTextColor={colors.inkFaint}
                  className="rounded-xl px-4 py-3 text-base"
                  style={inputStyle}
                />
              </View>
              <View className="flex-[3]">
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
          ) : null}
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField
              value={date}
              onChangeText={setDate}
              label="Желаемая дата"
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

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Комментарий (необязательно)"
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

        <Button
          title={busy ? "Отправка…" : "Записаться"}
          loading={busy}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}
