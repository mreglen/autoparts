import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

import {
  fetchMyClientOrgs,
  fetchMyRepairOrders,
  vehicleLabel,
  type ClientRepairOrder,
  type ClientVehicleBrief,
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
  clientOrderStatusLabel,
  formatDayMonth,
  formatMoney,
} from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "ClientHistory">;

type Scope = "all" | "active" | "history";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "history", label: "Завершённые" },
];

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

interface VehicleFilter extends ClientVehicleBrief {
  key: string;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3.5 py-2"
      style={{
        backgroundColor: active ? colors.brand : colors.surfaceSubtle,
      }}
    >
      <Text
        className="text-sm font-medium"
        style={{ color: active ? "#fff" : colors.inkSoft }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ClientHistoryScreen(_: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<ClientRepairOrder[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const orgList = (await fetchMyClientOrgs()).data ?? [];
        const results = orgList.length
          ? await Promise.all(
              orgList.map((o) => fetchMyRepairOrders(scope, o.organization_id)),
            )
          : [await fetchMyRepairOrders(scope)];
        const merged = new Map<number, ClientRepairOrder>();
        let oldestFetch: number | null = null;
        let anyStale = false;
        for (const r of results) {
          if (r.stale) anyStale = true;
          if (oldestFetch === null || r.fetchedAt < oldestFetch)
            oldestFetch = r.fetchedAt;
          for (const o of r.data ?? []) merged.set(o.id, o);
        }
        const list = [...merged.values()].sort((a, b) =>
          String(b.scheduled_at).localeCompare(String(a.scheduled_at)),
        );
        setRows(list);
        setStale(anyStale ? oldestFetch : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope, show],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка и смена фильтра
    void load();
  }, [load]);

  const vehicles = useMemo<VehicleFilter[]>(() => {
    const map = new Map<string, VehicleFilter>();
    for (const o of rows) {
      if (!o.vehicle?.id || map.has(String(o.vehicle.id))) continue;
      map.set(String(o.vehicle.id), {
        ...o.vehicle,
        key: String(o.vehicle.id),
      });
    }
    return [...map.values()];
  }, [rows]);

  const visible = useMemo(
    () =>
      vehicleFilter
        ? rows.filter((o) => String(o.vehicle_id) === vehicleFilter)
        : rows,
    [rows, vehicleFilter],
  );

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

      <View className="mb-3 flex-row gap-2">
        {SCOPES.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            active={scope === s.key}
            onPress={() => setScope(s.key)}
          />
        ))}
      </View>

      {vehicles.length > 1 ? (
        <View className="mb-3 flex-row flex-wrap gap-2">
          <Chip
            label="Все авто"
            active={vehicleFilter == null}
            onPress={() => setVehicleFilter(null)}
          />
          {vehicles.map((v) => (
            <Chip
              key={v.key}
              label={vehicleLabel(v)}
              active={vehicleFilter === v.key}
              onPress={() =>
                setVehicleFilter((prev) => (prev === v.key ? null : v.key))
              }
            />
          ))}
        </View>
      ) : null}

      {visible.length === 0 ? (
        <View className="items-center pt-16">
          <Text className="text-base font-medium" style={{ color: colors.ink }}>
            {rows.length === 0
              ? "История ремонтов пуста"
              : "Нет заказ-нарядов по выбранным фильтрам"}
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: colors.inkMuted }}
          >
            {rows.length === 0
              ? "Заказ-наряды автосервиса появятся здесь."
              : "Попробуйте другой фильтр."}
          </Text>
        </View>
      ) : (
        visible.map((o, i) => (
          <FadeSlideIn key={o.id} index={i} style={{ marginTop: 8 }}>
            <ListRow
              title={orderTitle(o)}
              subtitle={orderSubtitle(o)}
              right={`${clientOrderStatusLabel(o.status)} · ${formatMoney(o.grand_total)}`}
              onPress={() =>
                navigation.navigate("ClientOrder", { orderId: o.id })
              }
            />
          </FadeSlideIn>
        ))
      )}
    </Screen>
  );
}
