import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { bookingStatusLabel } from "../api/bookings";
import {
  fetchMyClientBookings,
  vehicleLabel,
  type ClientBooking,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  FadeSlideIn,
  ListRow,
  Screen,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import { useTheme } from "../theme/useTheme";
import { formatDayMonth } from "../utils/format";

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

export function ClientBookingsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [rows, setRows] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);

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
      {rows.length === 0 ? (
        <View className="items-center pt-16">
          <Text className="text-base font-medium" style={{ color: colors.ink }}>
            Записей пока нет
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: colors.inkMuted }}
          >
            Запись к автосервису появится на следующем этапе.
          </Text>
        </View>
      ) : (
        rows.map((b, i) => (
          <FadeSlideIn key={b.id} index={i} style={{ marginTop: 8 }}>
            <ListRow
              title={bookingTitle(b)}
              subtitle={bookingSubtitle(b)}
              right={bookingStatusLabel(b.status)}
            />
          </FadeSlideIn>
        ))
      )}
    </Screen>
  );
}
