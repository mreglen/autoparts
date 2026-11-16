import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  fetchOrders,
  fetchWorkZones,
  orderPaymentStatus,
  PAYMENT_LABELS,
  type OrderListItem,
  type OrderListPage,
  type OrderSortBy,
  type PaymentFilter,
  type WorkZone,
} from "../api/orders";
import { ApiError } from "../api/errors";
import {
  DateField,
  Screen,
  Sheet,
  SkeletonRows,
  StaleDataBadge,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { usePersistedState } from "../storage/usePersistedState";
import { pageFiltersKey } from "../storage/keys";
import { useTheme } from "../theme/useTheme";
import {
  formatDayMonth,
  formatMoney,
  formatTime,
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
} from "../utils/format";
import { orderStatusColor, orderStatusSoft } from "../utils/orderStatusColors";
import {
  draftTitle,
  listOrderDrafts,
  type OrderFormDraft,
} from "../utils/orderDrafts";

const PAGE_SIZE = 50;
const NONE_ZONE = "none" as const;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Ожидание" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Выполнен" },
  { value: "review", label: "На проверке" },
  { value: "completed", label: "Закрыт" },
  { value: "cancelled", label: "Отменён" },
];
const DEFAULT_STATUSES = ["pending", "in_progress", "done", "review"];

const PAYMENT_OPTIONS: PaymentFilter[] = ["unpaid", "partial", "paid"];
interface OrdersFilters {
  statuses: string[];
  zoneIds: (number | typeof NONE_ZONE)[];
  payments: PaymentFilter[];
  sortBy: OrderSortBy;
  sortDir: "asc" | "desc";
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: OrdersFilters = {
  statuses: DEFAULT_STATUSES,
  zoneIds: [],
  payments: [],
  sortBy: "scheduled_at",
  sortDir: "desc",
  dateFrom: "",
  dateTo: "",
};

function paymentColor(
  colors: ReturnType<typeof useTheme>["colors"],
  payment: PaymentFilter,
): string {
  switch (payment) {
    case "paid":
      return colors.success;
    case "partial":
      return colors.warning;
    default:
      return colors.danger;
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = formatDayMonth(value);
  const t = formatTime(value);
  return t ? `${d} ${t}` : d || "—";
}

function vehicleLabel(vehicle: OrderListItem["vehicle"]): string {
  if (!vehicle) return "";
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return [name, vehicle.plate].filter(Boolean).join(" · ");
}

export function OrdersScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filters, setFilters] = usePersistedState<OrdersFilters>(
    pageFiltersKey("orders"),
    DEFAULT_FILTERS,
  );
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [zones, setZones] = useState<WorkZone[]>([]);
  const [drafts, setDrafts] = useState<OrderFormDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "more" = "initial") => {
      if (mode === "more") {
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else if (mode === "refresh") {
        setRefreshing(true);
      }
      try {
        const result = await fetchOrders({
          statuses: filters.statuses,
          workZoneIds: filters.zoneIds,
          payments: filters.payments,
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          limit: PAGE_SIZE,
          offset: mode === "more" ? offsetRef.current : 0,
        });
        const page = result.data as OrderListPage;
        const list = Array.isArray(page?.items) ? page.items : [];
        setItems((prev) => (mode === "more" ? [...prev, ...list] : list));
        setTotal(Number(page?.total) || list.length);
        const more = Boolean(page?.has_more);
        hasMoreRef.current = more;
        setHasMore(more);
        offsetRef.current =
          (mode === "more" ? offsetRef.current : 0) + list.length;
        setStaleAt(result.fromCache ? result.fetchedAt : null);
        setError("");
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : "Не удалось загрузить заказы",
        );
        if (mode !== "more") setItems([]);
      } finally {
        loadingMoreRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка и смена фильтров
    void load("initial");
  }, [load]);

  useEffect(() => {
    void fetchWorkZones()
      .then((r) => setZones(r.data.work_zones ?? []))
      .catch(() => setZones([]));
    void listOrderDrafts().then(setDrafts);
  }, []);

  const toggleIn = useCallback(
    <T,>(list: T[], value: T): T[] =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    [],
  );

  const patchFilters = useCallback(
    (patch: Partial<OrdersFilters>) =>
      setFilters((prev) => ({ ...prev, ...patch })),
    [setFilters],
  );

  const activeFilterCount =
    (filters.zoneIds.length > 0 ? 1 : 0) +
    (filters.payments.length > 0 ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.sortBy !== "scheduled_at" || filters.sortDir !== "desc" ? 1 : 0);

  const openOrder = useCallback(
    (order: OrderListItem) =>
      navigation.navigate("OrderDetail", { id: order.id }),
    [navigation],
  );

  const openDraft = useCallback(
    (draft: OrderFormDraft) => {
      if (draft.mode === "edit" && draft.orderId) {
        navigation.navigate("OrderForm", {
          orderId: draft.orderId,
          draftToken: draft.createToken || undefined,
        });
      } else {
        navigation.navigate("OrderForm", {
          draftToken: draft.createToken || undefined,
        });
      }
    },
    [navigation],
  );

  return (
    <Screen scroll={false}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
          Заказ-наряды
        </Text>
        <View className="flex-row items-center gap-2">
          {total > 0 ? (
            <Text className="text-xs" style={{ color: colors.inkMuted }}>
              {total}
            </Text>
          ) : null}
          {staleAt ? <StaleDataBadge fetchedAt={staleAt} /> : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
        contentContainerStyle={{ gap: 6 }}
      >
        {STATUS_OPTIONS.map((s) => {
          const active = filters.statuses.includes(s.value);
          return (
            <Pressable
              key={s.value}
              onPress={() =>
                patchFilters({ statuses: toggleIn(filters.statuses, s.value) })
              }
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: active ? colors.brand : colors.surfaceSubtle,
              }}
            >
              <Text
                className="text-[10px] font-medium"
                style={{ color: active ? "#fff" : colors.inkSoft }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => setSheetOpen(true)}
          className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Ionicons
            name="options-outline"
            size={12}
            color={activeFilterCount ? colors.brand : colors.inkMuted}
          />
          <Text
            className="text-[10px] font-medium"
            style={{ color: activeFilterCount ? colors.brand : colors.inkSoft }}
          >
            Фильтры{activeFilterCount ? ` · ${activeFilterCount}` : ""}
          </Text>
        </Pressable>
        {(["scheduled_at", "scheduled_end_at"] as const).map((key) => {
          const label = key === "scheduled_at" ? "Начало" : "Конец";
          const active = filters.sortBy === key;
          return (
            <Pressable
              key={key}
              onPress={() =>
                patchFilters({
                  sortBy: key,
                  sortDir: active
                    ? filters.sortDir === "asc"
                      ? "desc"
                      : "asc"
                    : "asc",
                })
              }
              className="flex-row items-center gap-0.5 rounded-full px-2 py-0.5"
              style={{
                backgroundColor: active ? colors.brandSoft : "transparent",
              }}
            >
              <Text
                className="text-[10px] font-medium"
                style={{ color: active ? colors.brand : colors.inkMuted }}
              >
                {label}
              </Text>
              {active ? (
                <Ionicons
                  name={filters.sortDir === "asc" ? "arrow-up" : "arrow-down"}
                  size={10}
                  color={colors.brand}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load("refresh")}
            tintColor={colors.brand}
          />
        }
      >
        {drafts.length > 0 ? (
          <View className="gap-2">
            <Pressable
              onPress={() => setDraftsOpen((v) => !v)}
              className="flex-row items-center gap-1 self-start"
            >
              <Text
                className="text-xs font-semibold uppercase"
                style={{ color: colors.inkMuted }}
              >
                Черновики · {drafts.length}
              </Text>
              <Ionicons
                name={draftsOpen ? "chevron-up" : "chevron-down"}
                size={12}
                color={colors.inkMuted}
              />
            </Pressable>
            {draftsOpen
              ? drafts.map((draft) => (
              <Pressable
                key={draft.key}
                onPress={() => openDraft(draft)}
                className="flex-row items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: colors.warningSoft }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.warning}
                />
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {draftTitle(draft)}
                  </Text>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: colors.inkMuted }}
                  >
                    Не отправлен ·{" "}
                    {new Date(draft.savedAt).toLocaleDateString("ru-RU")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.inkFaint}
                />
              </Pressable>
              ))
            : null}
          </View>
        ) : null}

        {loading ? (
          <SkeletonRows count={6} />
        ) : error && items.length === 0 ? (
          <View className="items-center gap-3 pt-10">
            <Ionicons
              name="cloud-offline-outline"
              size={40}
              color={colors.inkFaint}
            />
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              {error}
            </Text>
            <Pressable onPress={() => void load("initial")}>
              <Text
                className="text-sm font-medium"
                style={{ color: colors.brand }}
              >
                Повторить
              </Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View className="items-center gap-3 pt-10">
            <Ionicons
              name="construct-outline"
              size={40}
              color={colors.inkFaint}
            />
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Заказ-нарядов нет
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map((order) => {
              const payment = orderPaymentStatus(order);
              const dates =
                order.scheduled_end_at &&
                order.scheduled_end_at !== order.scheduled_at
                  ? `${formatDateTime(order.scheduled_at)} — ${formatDateTime(order.scheduled_end_at)}`
                  : formatDateTime(order.scheduled_at);
              return (
                <Pressable
                  key={order.id}
                  onPress={() => openOrder(order)}
                  className="flex-row items-center gap-3 rounded-xl p-3"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.ink }}
                        numberOfLines={1}
                      >
                        {order.order_number
                          ? `№${order.order_number}`
                          : `#${order.id}`}
                      </Text>
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: orderStatusSoft(
                            colors,
                            order.status,
                          ),
                        }}
                      >
                        <Text
                          className="text-[10px] font-medium"
                          style={{
                            color: orderStatusColor(colors, order.status),
                          }}
                        >
                          {ORDER_STATUS_LABELS[
                            normalizeOrderStatus(order.status)
                          ] ?? order.status}
                        </Text>
                      </View>
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.line,
                        }}
                      >
                        <Text
                          className="text-[10px] font-medium"
                          style={{ color: paymentColor(colors, payment) }}
                        >
                          {PAYMENT_LABELS[payment]}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={1}
                    >
                      {order.client?.name ?? "—"}
                      {vehicleLabel(order.vehicle)
                        ? ` · ${vehicleLabel(order.vehicle)}`
                        : ""}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkFaint }}
                      numberOfLines={1}
                    >
                      {dates}
                      {order.work_zone?.name
                        ? ` · ${order.work_zone.name}`
                        : ""}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: colors.ink }}
                    >
                      {formatMoney(order.grand_total)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.inkFaint}
                      style={{ marginTop: 4 }}
                    />
                  </View>
                </Pressable>
              );
            })}
            {hasMore ? (
              <Pressable
                onPress={() => void load("more")}
                disabled={loadingMore}
                className="items-center rounded-xl py-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.brand }}
                >
                  {loadingMore ? "Загрузка…" : "Показать ещё"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Sheet
        visible={sheetOpen}
        title="Фильтры"
        onClose={() => setSheetOpen(false)}
      >
        <ScrollView className="max-h-96">
          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Рабочая зона
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {zones.map((zone) => {
              const active = filters.zoneIds.includes(zone.id);
              return (
                <Pressable
                  key={zone.id}
                  onPress={() =>
                    patchFilters({
                      zoneIds: toggleIn(filters.zoneIds, zone.id),
                    })
                  }
                  className="rounded-full px-3 py-1.5"
                  style={{
                    backgroundColor: active
                      ? colors.brand
                      : colors.surfaceSubtle,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: active ? "#fff" : colors.inkSoft }}
                  >
                    {zone.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() =>
                patchFilters({ zoneIds: toggleIn(filters.zoneIds, NONE_ZONE) })
              }
              className="rounded-full px-3 py-1.5"
              style={{
                backgroundColor: filters.zoneIds.includes(NONE_ZONE)
                  ? colors.brand
                  : colors.surfaceSubtle,
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{
                  color: filters.zoneIds.includes(NONE_ZONE)
                    ? "#fff"
                    : colors.inkSoft,
                }}
              >
                Не назначено
              </Text>
            </Pressable>
          </View>

          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Оплата
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {PAYMENT_OPTIONS.map((p) => {
              const active = filters.payments.includes(p);
              return (
                <Pressable
                  key={p}
                  onPress={() =>
                    patchFilters({ payments: toggleIn(filters.payments, p) })
                  }
                  className="rounded-full px-3 py-1.5"
                  style={{
                    backgroundColor: active
                      ? colors.brand
                      : colors.surfaceSubtle,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: active ? "#fff" : colors.inkSoft }}
                  >
                    {PAYMENT_LABELS[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Период
          </Text>
          <View className="mb-4 gap-3">
            <DateField
              label="С"
              value={filters.dateFrom}
              onChangeText={(v) => patchFilters({ dateFrom: v })}
            />
            <DateField
              label="По"
              value={filters.dateTo}
              onChangeText={(v) => patchFilters({ dateTo: v })}
            />
          </View>

          <Pressable
            onPress={() => setFilters(DEFAULT_FILTERS)}
            className="items-center rounded-xl py-3"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: colors.danger }}
            >
              Сбросить фильтры
            </Text>
          </Pressable>
        </ScrollView>
      </Sheet>

      <Pressable
        onPress={() => navigation.navigate("OrderForm", {})}
        className="absolute bottom-4 right-4 h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.brand }}
        accessibilityLabel="Новый заказ-наряд"
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>
    </Screen>
  );
}
