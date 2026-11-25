import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import {
  cancelClientInspectionBooking,
  fetchMyClientBookings,
  vehicleLabel,
  type ClientBooking,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  ConfirmDialog,
  FadeSlideIn,
  ListRow,
  Screen,
  SearchField,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { invalidateEntities } from "../offline";
import { useTheme } from "../theme/useTheme";
import { clientBookingStatusLabel, formatDayMonth } from "../utils/format";

function bookingTitle(b: ClientBooking): string {
  const label = vehicleLabel(b.vehicle) || b.vehicle_make || b.name || "Запись";
  return b.vehicle_make && !b.vehicle
    ? `${b.vehicle_make} ${b.vehicle_model ?? ""}`.trim()
    : label;
}

function bookingSubtitle(b: ClientBooking): string {
  const parts: string[] = [];
  const date = formatDayMonth(b.preferred_date);
  const time = b.preferred_time ? String(b.preferred_time).slice(0, 5) : "";
  if (date) parts.push(time ? `${date} ${time}` : date);
  if (b.organization_name) parts.push(b.organization_name);
  return parts.join(" · ");
}

function isCancellable(b: ClientBooking): boolean {
  return b.status === "new" || b.status === "confirmed";
}

export function ClientBookingsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClientBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await fetchMyClientBookings();
        setRows(r.data ?? []);
        setStale(r.stale ? r.fetchedAt : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelClientInspectionBooking(cancelTarget.id);
      await invalidateEntities(["bookings"]);
      show("Запись отменена", "success");
      setCancelTarget(null);
      await load(true);
    } catch (e) {
      show(describeError(e), "error");
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((b) =>
        `${bookingTitle(b)} ${bookingSubtitle(b)}`
          .toLowerCase()
          .includes(q),
      )
    : rows;

  if (loading) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      {stale != null ? <StaleDataBadge fetchedAt={stale} /> : null}
      {rows.length > 0 ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Автосервис, авто, дата"
          className="mb-2"
        />
      ) : null}
      {visible.length === 0 ? (
        <View className="items-center pt-16">
          <Ionicons
            name="calendar-outline"
            size={40}
            color={colors.inkFaint}
            style={{ marginBottom: 8 }}
          />
          <Text className="text-base font-medium" style={{ color: colors.ink }}>
            {rows.length === 0 ? "Записей пока нет" : "Ничего не найдено"}
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: colors.inkMuted }}
          >
            {q
              ? "Ничего не найдено."
              : "Запишитесь на осмотр — автосервис подтвердит дату и время."}
          </Text>
        </View>
      ) : (
        visible.map((b, i) => (
          <FadeSlideIn key={b.id} index={i} style={{ marginTop: 8 }}>
            <ListRow
              title={bookingTitle(b)}
              subtitle={bookingSubtitle(b)}
              right={clientBookingStatusLabel(b.status)}
              onPress={isCancellable(b) ? () => setCancelTarget(b) : undefined}
            />
          </FadeSlideIn>
        ))
      )}

      <Pressable
        onPress={() => navigation.navigate("ClientBookingNew")}
        className="mt-6 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
        style={{ backgroundColor: colors.brand }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-base font-semibold text-white">
          Записаться на осмотр
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={cancelTarget != null}
        title="Отменить запись?"
        message={
          cancelTarget
            ? `${bookingTitle(cancelTarget)} · ${bookingSubtitle(cancelTarget)}`
            : undefined
        }
        confirmLabel={cancelling ? "Отмена…" : "Отменить запись"}
        destructive
        onConfirm={() => void doCancel()}
        onCancel={() => setCancelTarget(null)}
      />
    </Screen>
  );
}
