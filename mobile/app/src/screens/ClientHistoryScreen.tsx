import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  fetchMyRepairOrders,
  vehicleLabel,
  type ClientRepairOrder,
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
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  formatDayMonth,
  formatMoney,
  normalizeOrderStatus,
  orderStatusLabel,
} from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "ClientHistory">;

function orderTitle(o: ClientRepairOrder): string {
  const num = o.order_number ? `№${o.order_number}` : "Заказ-наряд";
  const vehicle = vehicleLabel(o.vehicle);
  return vehicle ? `${num} · ${vehicle}` : num;
}

function orderSubtitle(o: ClientRepairOrder): string {
  const parts: string[] = [];
  const date = formatDayMonth(o.scheduled_at);
  if (date) parts.push(date);
  if (o.organization_name) parts.push(o.organization_name);
  return parts.join(" · ");
}

export function ClientHistoryScreen(_: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [rows, setRows] = useState<ClientRepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await fetchMyRepairOrders("all");
        const list = [...(r.data ?? [])].sort((a, b) =>
          String(b.scheduled_at).localeCompare(String(a.scheduled_at)),
        );
        setRows(list);
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
            История ремонтов пуста
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: colors.inkMuted }}
          >
            Заказ-наряды автосервиса появятся здесь.
          </Text>
        </View>
      ) : (
        rows.map((o, i) => (
          <FadeSlideIn key={o.id} index={i} style={{ marginTop: 8 }}>
            <ListRow
              title={orderTitle(o)}
              subtitle={orderSubtitle(o)}
              right={`${orderStatusLabel(normalizeOrderStatus(o.status))} · ${formatMoney(o.grand_total)}`}
            />
          </FadeSlideIn>
        ))
      )}
    </Screen>
  );
}
